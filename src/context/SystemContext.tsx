import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { Alert, Incident, FaultState, FaultType, UIData } from '@/lib/types';
import { genId, initDB, dbAction, clearAllData } from '@/lib/db';
import { SERVICES, areDependents } from '@/lib/topology';
import { simulateTick } from '@/lib/simulation';
import type { Service } from '@/lib/types';

interface SystemContextType {
  services: Service[];
  uiData: UIData;
  running: boolean;
  toggleRunning: () => void;
  toggleFault: (serviceId: string, type: FaultType) => void;
  getFaults: (serviceId: string) => FaultType[];
  resolveIncident: (id: string) => void;
  clearHistory: () => void;
  openIncidentCount: number;
}

const SystemContext = createContext<SystemContextType | null>(null);

export function useSystem() {
  const ctx = useContext(SystemContext);
  if (!ctx) throw new Error('useSystem must be used within SystemProvider');
  return ctx;
}

const MAX_ITEMS = 200;

function correlateAlert(newAlert: Alert, allAlerts: Alert[]): { matchId: string; score: number } | null {
  const WINDOW = 5 * 60 * 1000;
  const candidates = allAlerts.filter(
    (a) =>
      a.id !== newAlert.id &&
      !a.correlated &&
      Math.abs(a.timestamp - newAlert.timestamp) < WINDOW
  );

  let bestMatch: { matchId: string; score: number } | null = null;

  for (const candidate of candidates) {
    const timeDiff = Math.abs(candidate.timestamp - newAlert.timestamp);
    const T = 1 - timeDiff / WINDOW;
    const D = areDependents(candidate.serviceId, newAlert.serviceId) ? 1 : 0;
    const S = candidate.type === newAlert.type ? 1 : 0;
    const score = 0.35 * T + 0.45 * D + 0.2 * S;

    if (score > 0.7 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { matchId: candidate.id, score };
    }
  }

  return bestMatch;
}

export function SystemProvider({ children }: { children: React.ReactNode }) {
  const [services, setServices] = useState<Service[]>(SERVICES.map((s) => ({ ...s })));
  const [uiData, setUiData] = useState<UIData>({
    metrics: [],
    logs: [],
    traces: [],
    alerts: [],
    incidents: [],
    throughput: [],
  });
  const [running, setRunning] = useState(true);
  const faultsRef = useRef<FaultState>({});
  const alertsRef = useRef<Alert[]>([]);
  const incidentsRef = useRef<Incident[]>([]);
  const servicesRef = useRef<Service[]>(SERVICES.map((s) => ({ ...s })));
  const tickCountRef = useRef(0);

  // Keep servicesRef in sync
  useEffect(() => {
    servicesRef.current = services;
  }, [services]);

  // Load persisted data on mount
  useEffect(() => {
    (async () => {
      await initDB();
      const [metrics, logs, traces, alerts, incidents] = await Promise.all([
        dbAction('metrics', 'readonly', 'getAll'),
        dbAction('logs', 'readonly', 'getAll'),
        dbAction('traces', 'readonly', 'getAll'),
        dbAction('alerts', 'readonly', 'getAll'),
        dbAction('incidents', 'readonly', 'getAll'),
      ]);
      alertsRef.current = alerts as Alert[];
      incidentsRef.current = incidents as Incident[];
      setUiData({
        metrics: (metrics as any[]).slice(-MAX_ITEMS),
        logs: (logs as any[]).slice(-MAX_ITEMS),
        traces: (traces as any[]).slice(-MAX_ITEMS),
        alerts: (alerts as any[]).slice(-MAX_ITEMS),
        incidents: incidents as Incident[],
        throughput: (metrics as any[]).slice(-60).map((m: any) => ({ timestamp: m.timestamp, packetsPerSec: m.packetsPerSec })),
      });
    })();
  }, []);

  // Simulation tick — NO dependency on `services` to avoid re-creating interval
  useEffect(() => {
    if (!running) return;

    const interval = setInterval(async () => {
      tickCountRef.current++;
      const currentServices = servicesRef.current;
      const faults = faultsRef.current;

      const { updatedServices, newMetrics, newLogs, newTraces, newAlerts, packetsPerSec } =
        simulateTick(currentServices, faults, tickCountRef.current);

      // Correlation
      const allAlerts = [...alertsRef.current, ...newAlerts];
      const newIncidents: Incident[] = [];
      for (const alert of newAlerts) {
        const match = correlateAlert(alert, allAlerts);
        if (match) {
          alert.correlated = true;
          const matchedAlert = allAlerts.find((a) => a.id === match.matchId);
          if (matchedAlert) matchedAlert.correlated = true;

          const existingIncident = incidentsRef.current.find(
            (inc) => inc.status === 'OPEN' && inc.alertIds.includes(match.matchId)
          );

          if (existingIncident) {
            existingIncident.alertIds.push(alert.id);
            alert.incidentId = existingIncident.id;
            if (!existingIncident.affectedServices.includes(alert.serviceId)) {
              existingIncident.affectedServices.push(alert.serviceId);
            }
            existingIncident.correlationScore = Math.max(existingIncident.correlationScore, match.score);
            await dbAction('incidents', 'readwrite', 'put', existingIncident);
          } else {
            const incident: Incident = {
              id: genId(),
              title: `Correlated: ${alert.type} on ${alert.serviceId}`,
              status: 'OPEN',
              createdAt: Date.now(),
              alertIds: [match.matchId, alert.id],
              correlationScore: Math.round(match.score * 100) / 100,
              affectedServices: [...new Set([alert.serviceId, matchedAlert?.serviceId || ''])].filter(Boolean),
            };
            alert.incidentId = incident.id;
            if (matchedAlert) matchedAlert.incidentId = incident.id;
            newIncidents.push(incident);
            incidentsRef.current.push(incident);
            await dbAction('incidents', 'readwrite', 'add', incident);
          }
        }
      }

      alertsRef.current = [...alertsRef.current, ...newAlerts].slice(-500);

      // Persist (fire-and-forget)
      for (const m of newMetrics) dbAction('metrics', 'readwrite', 'add', m);
      for (const l of newLogs) dbAction('logs', 'readwrite', 'add', l);
      for (const t of newTraces) dbAction('traces', 'readwrite', 'add', t);
      for (const a of newAlerts) dbAction('alerts', 'readwrite', 'add', a);

      setServices(updatedServices);
      setUiData((prev) => ({
        metrics: [...prev.metrics, ...newMetrics].slice(-MAX_ITEMS),
        logs: [...prev.logs, ...newLogs].slice(-MAX_ITEMS),
        traces: [...prev.traces, ...newTraces].slice(-MAX_ITEMS),
        alerts: [...prev.alerts, ...newAlerts].slice(-MAX_ITEMS),
        incidents: [...incidentsRef.current],
        throughput: [...prev.throughput, { timestamp: Date.now(), packetsPerSec }].slice(-60),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [running]); // Only depends on `running`, not `services`

  const toggleRunning = useCallback(() => setRunning((r) => !r), []);

  const toggleFault = useCallback((serviceId: string, type: FaultType) => {
    const current = faultsRef.current[serviceId] || [];
    if (current.includes(type)) {
      faultsRef.current[serviceId] = current.filter((f) => f !== type);
    } else {
      faultsRef.current[serviceId] = [...current, type];
    }
  }, []);

  const getFaults = useCallback((serviceId: string): FaultType[] => {
    return faultsRef.current[serviceId] || [];
  }, []);

  const resolveIncident = useCallback(async (id: string) => {
    const incident = incidentsRef.current.find((i) => i.id === id);
    if (incident) {
      incident.status = 'RESOLVED';
      incident.resolvedAt = Date.now();
      await dbAction('incidents', 'readwrite', 'put', incident);
      setUiData((prev) => ({
        ...prev,
        incidents: [...incidentsRef.current],
      }));
    }
  }, []);

  const clearHistory = useCallback(async () => {
    await clearAllData();
    alertsRef.current = [];
    incidentsRef.current = [];
    setUiData({
      metrics: [],
      logs: [],
      traces: [],
      alerts: [],
      incidents: [],
      throughput: [],
    });
  }, []);

  const openIncidentCount = uiData.incidents.filter((i) => i.status === 'OPEN').length;

  return (
    <SystemContext.Provider
      value={{ services, uiData, running, toggleRunning, toggleFault, getFaults, resolveIncident, clearHistory, openIncidentCount }}
    >
      {children}
    </SystemContext.Provider>
  );
}
