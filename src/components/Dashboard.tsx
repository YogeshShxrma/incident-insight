import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useSystem } from '@/context/SystemContext';
import ThroughputChart from '@/components/ThroughputChart';
import { Zap, Cpu, AlertTriangle } from 'lucide-react';
import type { FaultType } from '@/lib/types';

const FAULT_CONFIG: { type: FaultType; label: string; icon: React.ElementType }[] = [
  { type: 'latency', label: 'Latency', icon: Zap },
  { type: 'cpu', label: 'CPU Spike', icon: Cpu },
  { type: 'error', label: 'Errors', icon: AlertTriangle },
];

export default function Dashboard() {
  const { services, uiData, toggleFault, getFaults } = useSystem();
  const [faultStates, setFaultStates] = useState<Record<string, FaultType[]>>({});

  const handleToggleFault = (serviceId: string, type: FaultType) => {
    toggleFault(serviceId, type);
    setFaultStates((prev) => {
      const current = prev[serviceId] || [];
      const next = current.includes(type) ? current.filter((f) => f !== type) : [...current, type];
      return { ...prev, [serviceId]: next };
    });
  };

  const stats = useMemo(() => {
    if (uiData.metrics.length === 0) return { avgCpu: 0, avgLatency: 0, avgError: 0 };
    const recent = uiData.metrics.slice(-services.length);
    return {
      avgCpu: Math.round((recent.reduce((s, m) => s + m.cpu, 0) / recent.length) * 10) / 10,
      avgLatency: Math.round(recent.reduce((s, m) => s + m.latency, 0) / recent.length),
      avgError: Math.round((recent.reduce((s, m) => s + m.errorRate, 0) / recent.length) * 10) / 10,
    };
  }, [uiData.metrics, services.length]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-status-ok';
      case 'degraded': return 'bg-status-warn';
      case 'down': return 'bg-status-error animate-pulse-status';
      default: return 'bg-muted';
    }
  };

  return (
    <div>
      <h2 className="text-heading text-foreground mb-6">Dashboard</h2>

      {/* System Health Summary */}
      <div className="mb-6 grid grid-cols-3 gap-6">
        <StatCard label="Avg CPU" value={`${stats.avgCpu}%`} warn={stats.avgCpu > 80} />
        <StatCard label="Avg Latency" value={`${stats.avgLatency}ms`} warn={stats.avgLatency > 500} />
        <StatCard label="Error Rate" value={`${stats.avgError}%`} warn={stats.avgError > 5} />
      </div>

      {/* Throughput Chart */}
      <div className="mb-6">
        <ThroughputChart />
      </div>

      {/* Service Grid */}
      <h3 className="text-caps text-muted-foreground mb-3">Services</h3>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {services.map((svc) => {
          const activeFaults = faultStates[svc.id] || [];
          return (
            <motion.div
              key={svc.id}
              whileHover={{ y: -2 }}
              transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
              className="rounded-lg bg-card p-5 card-shadow hover:card-shadow-hover transition-shadow duration-200"
            >
              <div className="flex items-center gap-2 mb-4">
                <span className={`h-2.5 w-2.5 rounded-full transition-colors duration-300 ${statusColor(svc.status)}`} />
                <span className="text-sm font-medium text-card-foreground">{svc.name}</span>
              </div>

              <div className="space-y-2 mb-4">
                <MetricRow label="CPU" value={`${svc.cpu}%`} percent={svc.cpu} />
                <MetricRow label="Latency" value={`${svc.latency}ms`} percent={Math.min(svc.latency / 20, 100)} />
                <MetricRow label="Errors" value={`${svc.errorRate}%`} percent={svc.errorRate} />
              </div>

              <div className="flex gap-1.5">
                {FAULT_CONFIG.map(({ type, label, icon: Icon }) => {
                  const isActive = activeFaults.includes(type);
                  return (
                    <motion.button
                      key={type}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleToggleFault(svc.id, type)}
                      className={`flex h-8 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors ${
                        isActive
                          ? type === 'error'
                            ? 'bg-status-error text-primary-foreground'
                            : type === 'cpu'
                            ? 'bg-status-warn text-foreground'
                            : 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-muted'
                      }`}
                    >
                      <Icon size={12} />
                      {label}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, warn }: { label: string; value: string; warn: boolean }) {
  return (
    <div className="rounded-lg bg-card p-5 card-shadow">
      <p className="text-caps text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${warn ? 'text-status-error' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  );
}

function MetricRow({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-muted-foreground w-12">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            percent > 80 ? 'bg-status-error' : percent > 50 ? 'bg-status-warn' : 'bg-status-ok'
          }`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className="text-data text-muted-foreground w-16 text-right">{value}</span>
    </div>
  );
}
