export interface Service {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  cpu: number;
  latency: number;
  errorRate: number;
  dependencies: string[];
}

export interface Metric {
  id: string;
  serviceId: string;
  timestamp: number;
  cpu: number;
  latency: number;
  errorRate: number;
  packetsPerSec: number;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  serviceId: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
}

export interface Trace {
  id: string;
  traceId: string;
  timestamp: number;
  serviceId: string;
  duration: number;
  status: 'OK' | 'ERROR';
  spans: { service: string; duration: number }[];
}

export interface Alert {
  id: string;
  timestamp: number;
  serviceId: string;
  type: 'cpu' | 'latency' | 'error';
  severity: 'warning' | 'critical';
  value: number;
  threshold: number;
  correlated: boolean;
  incidentId?: string;
}

export interface Incident {
  id: string;
  title: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: number;
  resolvedAt?: number;
  alertIds: string[];
  correlationScore: number;
  rootCause?: string;
  affectedServices: string[];
}

export type FaultType = 'latency' | 'cpu' | 'error';

export interface FaultState {
  [serviceId: string]: FaultType[];
}

export interface UIData {
  metrics: Metric[];
  logs: LogEntry[];
  traces: Trace[];
  alerts: Alert[];
  incidents: Incident[];
  throughput: { timestamp: number; packetsPerSec: number }[];
}

export type PageType = 'dashboard' | 'logs' | 'traces' | 'alerts' | 'incidents' | 'reports';
