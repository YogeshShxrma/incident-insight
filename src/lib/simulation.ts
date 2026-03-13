import type { Service, Metric, LogEntry, Trace, Alert, FaultType } from './types';
import { SERVICES } from './topology';
import { genId } from './db';

// ── Realistic noise generators ──────────────────────────────

/** Gaussian-ish random via Box-Muller (clamped) */
function gaussian(mean: number, stddev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stddev;
}

/** Simulated diurnal load multiplier (peaks at ~14:00) */
function diurnalFactor(): number {
  const hour = new Date().getHours();
  // Bell curve centered at 14:00
  return 0.6 + 0.4 * Math.exp(-((hour - 14) ** 2) / 50);
}

/** Periodic micro-burst (simulates GC pauses, batch jobs) */
function burstFactor(tickCount: number): number {
  // Every ~30 ticks, 20% chance of a small burst
  if (tickCount % 30 < 3 && Math.random() > 0.8) {
    return 1.5 + Math.random() * 0.5;
  }
  return 1;
}

// ── Service baseline profiles ──────────────────────────────

const SERVICE_PROFILES: Record<string, { baseCpu: number; baseLatency: number; cpuStd: number; latencyStd: number }> = {
  'api-gateway': { baseCpu: 22, baseLatency: 35, cpuStd: 8, latencyStd: 15 },
  'auth-service': { baseCpu: 12, baseLatency: 25, cpuStd: 5, latencyStd: 10 },
  'order-service': { baseCpu: 30, baseLatency: 65, cpuStd: 10, latencyStd: 25 },
  'user-db': { baseCpu: 18, baseLatency: 8, cpuStd: 6, latencyStd: 4 },
};

// ── Main simulation tick ──────────────────────────────

export interface TickResult {
  updatedServices: Service[];
  newMetrics: Metric[];
  newLogs: LogEntry[];
  newTraces: Trace[];
  newAlerts: Alert[];
  packetsPerSec: number;
}

export function simulateTick(
  services: Service[],
  faults: Record<string, FaultType[]>,
  tickCount: number
): TickResult {
  const now = Date.now();
  const diurnal = diurnalFactor();
  const burst = burstFactor(tickCount);
  const hasAnyError = Object.values(faults).some((f) => f.length > 0 && f.includes('error'));

  // Throughput: realistic variation with sharp drops on errors
  const basePackets = (750 + gaussian(200, 80)) * diurnal * burst;
  const packetsPerSec = hasAnyError
    ? Math.max(5, gaussian(30, 15))
    : Math.max(50, basePackets);

  const newMetrics: Metric[] = [];
  const newLogs: LogEntry[] = [];
  const newTraces: Trace[] = [];
  const newAlerts: Alert[] = [];

  // First pass: compute raw metrics per service
  const serviceMetrics: Record<string, { cpu: number; latency: number; errorRate: number }> = {};

  for (const svc of services) {
    const profile = SERVICE_PROFILES[svc.id] || { baseCpu: 20, baseLatency: 30, cpuStd: 8, latencyStd: 12 };
    const svcFaults = faults[svc.id] || [];

    // Base: gaussian noise around profile baseline, scaled by diurnal + burst
    let cpu = Math.max(2, gaussian(profile.baseCpu * diurnal * burst, profile.cpuStd));
    let latency = Math.max(1, gaussian(profile.baseLatency * diurnal * burst, profile.latencyStd));
    let errorRate = Math.max(0, gaussian(0.2, 0.15)); // tiny baseline error

    // Apply direct faults (immediate, no smoothing — faults should be felt NOW)
    if (svcFaults.includes('cpu')) {
      cpu = gaussian(92, 5); // 87-97 range, reliably above 90 threshold
    }
    if (svcFaults.includes('latency')) {
      latency = gaussian(1400, 300); // 800-2000+ range, reliably above 1000 threshold
    }
    if (svcFaults.includes('error')) {
      errorRate = gaussian(28, 8); // 12-44 range, reliably above 10 threshold
      cpu = Math.min(cpu + gaussian(25, 5), 100); // errors cause CPU spike too
    }

    serviceMetrics[svc.id] = { cpu, latency, errorRate };
  }

  // Second pass: cascade faults from dependencies (STRONG cascade)
  for (const svc of services) {
    const deps = SERVICES.find((s) => s.id === svc.id)?.dependencies || [];
    for (const depId of deps) {
      const depFaults = faults[depId] || [];
      const depMetrics = serviceMetrics[depId];

      if (depFaults.includes('latency') || (depMetrics && depMetrics.latency > 500)) {
        // Downstream gets significant latency from slow dependency
        serviceMetrics[svc.id].latency += gaussian(400, 100);
      }
      if (depFaults.includes('error') || (depMetrics && depMetrics.errorRate > 10)) {
        // Downstream gets errors when dependency is erroring
        serviceMetrics[svc.id].errorRate += gaussian(12, 4);
        serviceMetrics[svc.id].cpu += gaussian(10, 3);
      }
      if (depFaults.includes('cpu') || (depMetrics && depMetrics.cpu > 90)) {
        // CPU-bound dependency slows responses
        serviceMetrics[svc.id].latency += gaussian(150, 50);
      }
    }
  }

  // Third pass: generate telemetry from computed metrics
  const updatedServices = services.map((svc) => {
    const m = serviceMetrics[svc.id];
    const cpu = Math.min(Math.max(m.cpu, 0), 100);
    const latency = Math.max(m.latency, 1);
    const errorRate = Math.min(Math.max(m.errorRate, 0), 100);

    const status: Service['status'] =
      errorRate > 10 || cpu > 95 ? 'down' : latency > 500 || cpu > 80 ? 'degraded' : 'healthy';

    // Metric
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

    // Logs (richer messages)
    const logLevel: LogEntry['level'] = errorRate > 10 ? 'ERROR' : latency > 500 ? 'WARN' : 'INFO';
    const logMessages: Record<LogEntry['level'], string[]> = {
      INFO: [
        `Request processed in ${Math.round(latency)}ms`,
        `Health check passed — pool utilization ${Math.round(cpu)}%`,
        `Served 200 OK — ${Math.round(latency)}ms`,
        `Connection recycled, active: ${Math.floor(cpu / 5)}`,
      ],
      WARN: [
        `High latency detected: ${Math.round(latency)}ms (p99 breach)`,
        `CPU elevated: ${cpu.toFixed(1)}% — approaching throttle limit`,
        `Retry queue depth increasing — downstream slow`,
        `Thread pool near capacity: ${Math.round(cpu)}% utilized`,
      ],
      ERROR: [
        `Service error rate spiked to ${errorRate.toFixed(1)}% — circuit breaker OPEN`,
        `Connection timeout after ${Math.round(latency)}ms — retries exhausted`,
        `Upstream ${svc.dependencies[0] || 'dependency'} unreachable — 503 returned`,
        `OOM warning: heap pressure at ${Math.round(cpu)}%`,
      ],
    };
    const msgs = logMessages[logLevel];
    newLogs.push({
      id: genId(),
      timestamp: now,
      serviceId: svc.id,
      level: logLevel,
      message: msgs[Math.floor(Math.random() * msgs.length)],
    });

    // Traces (40% of ticks)
    if (Math.random() > 0.6) {
      const depServices = SERVICES.filter((s) => svc.dependencies.includes(s.id));
      newTraces.push({
        id: genId(),
        traceId: genId(),
        timestamp: now,
        serviceId: svc.id,
        duration: Math.round(latency + Math.random() * 100),
        status: errorRate > 10 ? 'ERROR' : 'OK',
        spans: [
          { service: svc.name, duration: Math.round(latency * 0.4) },
          ...depServices.map((d) => ({
            service: d.name,
            duration: Math.round(latency * 0.3 + Math.random() * 50),
          })),
        ],
      });
    }

    // Alerts with reliable threshold detection
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

    return {
      ...svc,
      cpu: Math.round(cpu * 10) / 10,
      latency: Math.round(latency * 10) / 10,
      errorRate: Math.round(errorRate * 10) / 10,
      status,
    };
  });

  return { updatedServices, newMetrics, newLogs, newTraces, newAlerts, packetsPerSec };
}
