import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { Service, Metric, LogEntry, Trace, Alert, Incident, FaultState, FaultType, UIData } from '@/lib/types';
import { genId, initDB, dbAction, clearAllData } from '@/lib/db';
import { SERVICES, areDependents } from '@/lib/topology';

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
  const servicesRef = useRef<Service[]>(services);

  // Load persisted data on mount
  useEffect(() => {
    (async () => {
      await initDB();
      const [metrics, logs, traces, alerts, incidents] = await Promise.all([
        dbAction<Metric>('metrics', 'readonly', 'getAll'),
        dbAction<LogEntry>('logs', 'readonly', 'getAll'),
        dbAction<Trace>('traces', 'readonly', 'getAll'),
        dbAction<Alert>('alerts', 'readonly', 'getAll'),
        dbAction<Incident>('incidents', 'readonly', 'getAll'),
      ]);
      alertsRef.current = alerts;
      incidentsRef.current = incidents;
      setUiData({
        metrics: metrics.slice(-MAX_ITEMS),
        logs: logs.slice(-MAX_ITEMS),
        traces: traces.slice(-MAX_ITEMS),
        alerts: alerts.slice(-MAX_ITEMS),
        incidents,
        throughput: metrics.slice(-60).map((m) => ({ timestamp: m.timestamp, packetsPerSec: m.packetsPerSec })),
      });
    })();
  }, []);

  // Simulation tick
  useEffect(() => {
    if (!running) return;

    const interval = setInterval(async () => {
      const now = Date.now();
      const faults = faultsRef.current;
      const hasAnyError = Object.values(faults).some((f) => f.includes('error'));
      const packetsPerSec = hasAnyError ? Math.random() * 50 : 800 + Math.random() * 400;

      const newMetrics: Metric[] = [];
      const newLogs: LogEntry[] = [];
      const newTraces: Trace[] = [];
      const newAlerts: Alert[] = [];
      const currentServices = servicesRef.current;
      const updatedServices = currentServices.map((svc) => {
        const svcFaults = faults[svc.id] || [];
        let cpu = svc.cpu * 0.7 + (15 + Math.random() * 20) * 0.3;
        let latency = svc.latency * 0.7 + (20 + Math.random() * 40) * 0.3;
        let errorRate = 0;

        if (svcFaults.includes('cpu')) cpu = 85 + Math.random() * 15;
        if (svcFaults.includes('latency')) latency = 800 + Math.random() * 600;
        if (svcFaults.includes('error')) {
          errorRate = 15 + Math.random() * 30;
          cpu = Math.min(cpu + 20, 100);
        }

        // Cascade from dependencies
        const depServices = SERVICES.filter((s) => svc.dependencies.includes(s.id));
        for (const dep of depServices) {
          const depFaults = faults[dep.id] || [];
          if (depFaults.includes('latency')) latency += 200 + Math.random() * 200;
          if (depFaults.includes('error')) errorRate += 5 + Math.random() * 10;
        }

        cpu = Math.min(cpu, 100);
        latency = Math.max(latency, 5);
        errorRate = Math.min(errorRate, 100);

        const status: Service['status'] =
          errorRate > 10 || cpu > 95 ? 'down' : latency > 500 || cpu > 80 ? 'degraded' : 'healthy';

        const metric: Metric = {
          id: genId(),
          serviceId: svc.id,
          timestamp: now,
          cpu: Math.round(cpu * 10) / 10,
          latency: Math.round(latency * 10) / 10,
          errorRate: Math.round(errorRate * 10) / 10,
          packetsPerSec: Math.round(packetsPerSec),
        };
        newMetrics.push(metric);

        // Logs
        const logLevel: LogEntry['level'] = errorRate > 10 ? 'ERROR' : latency > 500 ? 'WARN' : 'INFO';
        const logMessages: Record<LogEntry['level'], string[]> = {
          INFO: [`Request processed in ${Math.round(latency)}ms`, `Health check passed`, `Connection pool: ${Math.round(cpu)}% utilized`],
          WARN: [`High latency detected: ${Math.round(latency)}ms`, `CPU usage elevated: ${cpu.toFixed(1)}%`],
          ERROR: [`Service error rate: ${errorRate.toFixed(1)}%`, `Connection timeout after ${Math.round(latency)}ms`, `Circuit breaker triggered`],
        };
        const msgs = logMessages[logLevel];
        newLogs.push({
          id: genId(),
          timestamp: now,
          serviceId: svc.id,
          level: logLevel,
          message: msgs[Math.floor(Math.random() * msgs.length)],
        });

        // Traces
        if (Math.random() > 0.6) {
          newTraces.push({
            id: genId(),
            traceId: genId(),
            timestamp: now,
            serviceId: svc.id,
            duration: Math.round(latency + Math.random() * 100),
            status: errorRate > 10 ? 'ERROR' : 'OK',
            spans: [
              { service: svc.name, duration: Math.round(latency * 0.4) },
              ...depServices.map((d) => ({ service: d.name, duration: Math.round(latency * 0.3 + Math.random() * 50) })),
            ],
          });
        }

        // Alerts
        if (cpu > 90) {
          newAlerts.push({
            id: genId(),
            timestamp: now,
            serviceId: svc.id,
            type: 'cpu',
            severity: cpu > 95 ? 'critical' : 'warning',
            value: Math.round(cpu * 10) / 10,
            threshold: 90,
            correlated: false,
          });
        }
        if (latency > 1000) {
          newAlerts.push({
            id: genId(),
            timestamp: now,
            serviceId: svc.id,
            type: 'latency',
            severity: latency > 2000 ? 'critical' : 'warning',
            value: Math.round(latency),
            threshold: 1000,
            correlated: false,
          });
        }
        if (errorRate > 10) {
          newAlerts.push({
            id: genId(),
            timestamp: now,
            serviceId: svc.id,
            type: 'error',
            severity: errorRate > 25 ? 'critical' : 'warning',
            value: Math.round(errorRate * 10) / 10,
            threshold: 10,
            correlated: false,
          });
        }

        return { ...svc, cpu: Math.round(cpu * 10) / 10, latency: Math.round(latency * 10) / 10, errorRate: Math.round(errorRate * 10) / 10, status };
      });

      // Correlation
      const allAlerts = [...alertsRef.current, ...newAlerts];
      const newIncidents: Incident[] = [];
      for (const alert of newAlerts) {
        const match = correlateAlert(alert, allAlerts);
        if (match) {
          alert.correlated = true;
          const matchedAlert = allAlerts.find((a) => a.id === match.matchId);
          if (matchedAlert) matchedAlert.correlated = true;

          // Check if matched alert already belongs to an incident
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
              createdAt: now,
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

      servicesRef.current = updatedServices;
      setServices(updatedServices);
      setUiData((prev) => ({
        metrics: [...prev.metrics, ...newMetrics].slice(-MAX_ITEMS),
        logs: [...prev.logs, ...newLogs].slice(-MAX_ITEMS),
        traces: [...prev.traces, ...newTraces].slice(-MAX_ITEMS),
        alerts: [...prev.alerts, ...newAlerts].slice(-MAX_ITEMS),
        incidents: [...incidentsRef.current],
        throughput: [...prev.throughput, { timestamp: now, packetsPerSec }].slice(-60),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [running]);

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
