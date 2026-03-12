import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useSystem } from '@/context/SystemContext';
import { toast } from 'sonner';

export default function ReportsView() {
  const { uiData, clearHistory } = useSystem();

  const kpis = useMemo(() => {
    const incidents = uiData.incidents;
    const resolved = incidents.filter((i) => i.status === 'RESOLVED' && i.resolvedAt);

    // MTTD: avg time from first alert to incident creation
    const mttd = incidents.length > 0
      ? Math.round(incidents.reduce((sum, inc) => sum + 0, 0) / Math.max(incidents.length, 1))
      : 0;

    // MTTR: avg time from creation to resolution
    const mttr = resolved.length > 0
      ? Math.round(
          resolved.reduce((sum, inc) => sum + ((inc.resolvedAt || 0) - inc.createdAt), 0) / resolved.length / 1000
        )
      : 0;

    // Noise reduction
    const totalAlerts = uiData.alerts.length;
    const correlatedAlerts = uiData.alerts.filter((a) => a.correlated).length;
    const noiseReduction = totalAlerts > 0 ? Math.round((correlatedAlerts / totalAlerts) * 100) : 0;

    return {
      totalIncidents: incidents.length,
      openIncidents: incidents.filter((i) => i.status === 'OPEN').length,
      resolvedIncidents: resolved.length,
      mttd,
      mttr,
      totalAlerts,
      correlatedAlerts,
      noiseReduction,
    };
  }, [uiData.incidents, uiData.alerts]);

  const handleClear = () => {
    clearHistory();
    toast.success('History cleared');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-heading text-foreground">System Performance Report</h2>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleClear}
          className="h-9 rounded-md bg-destructive px-4 text-[12px] font-medium text-destructive-foreground transition-colors hover:opacity-90"
        >
          Clear History
        </motion.button>
      </div>

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4 mb-8">
        <KPICard label="Total Incidents" value={kpis.totalIncidents.toString()} />
        <KPICard label="Open" value={kpis.openIncidents.toString()} highlight={kpis.openIncidents > 0} />
        <KPICard label="Resolved" value={kpis.resolvedIncidents.toString()} />
        <KPICard label="MTTR" value={kpis.mttr > 0 ? `${kpis.mttr}s` : '—'} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-card p-6 card-shadow">
          <h3 className="text-caps text-muted-foreground mb-4">Alert Analysis</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Total Alerts</span>
              <span className="text-data text-foreground font-medium tabular-nums">{kpis.totalAlerts}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Correlated Alerts</span>
              <span className="text-data text-accent font-medium tabular-nums">{kpis.correlatedAlerts}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Noise Reduction</span>
              <span className="text-data font-semibold text-primary tabular-nums">{kpis.noiseReduction}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden mt-2">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${kpis.noiseReduction}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-card p-6 card-shadow">
          <h3 className="text-caps text-muted-foreground mb-4">TD-CIM Effectiveness</h3>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              The Temporal-Dependency Correlation algorithm groups related alerts into incidents,
              reducing alert fatigue by <span className="text-primary font-semibold">{kpis.noiseReduction}%</span>.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Avg Correlation Score</span>
              <span className="text-data font-medium tabular-nums text-foreground">
                {uiData.incidents.length > 0
                  ? (uiData.incidents.reduce((s, i) => s + i.correlationScore, 0) / uiData.incidents.length).toFixed(2)
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Alerts per Incident</span>
              <span className="text-data font-medium tabular-nums text-foreground">
                {uiData.incidents.length > 0
                  ? (uiData.incidents.reduce((s, i) => s + i.alertIds.length, 0) / uiData.incidents.length).toFixed(1)
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg bg-card p-5 card-shadow">
      <p className="text-caps text-muted-foreground mb-1">{label}</p>
      <p className={`text-3xl font-semibold tabular-nums ${highlight ? 'text-status-error' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
