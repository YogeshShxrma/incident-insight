import { useSystem } from '@/context/SystemContext';

export default function AlertsView() {
  const { uiData } = useSystem();
  const alerts = [...uiData.alerts].reverse();

  const severityColor = (severity: string) => {
    return severity === 'critical' ? 'text-status-error' : 'text-status-warn';
  };

  return (
    <div>
      <h2 className="text-heading text-foreground mb-6">Alert Feed</h2>
      <div className="rounded-lg bg-card card-shadow overflow-hidden">
        <div className="sticky top-0 z-10 grid grid-cols-[100px_120px_80px_80px_100px_80px] gap-4 border-b border-border bg-card px-5 py-3">
          <span className="text-caps text-muted-foreground">Time</span>
          <span className="text-caps text-muted-foreground">Service</span>
          <span className="text-caps text-muted-foreground">Type</span>
          <span className="text-caps text-muted-foreground">Severity</span>
          <span className="text-caps text-muted-foreground">Value</span>
          <span className="text-caps text-muted-foreground">Status</span>
        </div>
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground text-data">No alerts yet</div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="grid grid-cols-[100px_120px_80px_80px_100px_80px] gap-4 border-b border-border px-5 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <span className="text-data text-muted-foreground">
                  {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="text-data text-foreground">{alert.serviceId}</span>
                <span className="text-data text-foreground uppercase">{alert.type}</span>
                <span className={`text-data font-medium ${severityColor(alert.severity)}`}>
                  {alert.severity}
                </span>
                <span className="text-data text-foreground tabular-nums">
                  {alert.value}{alert.type === 'latency' ? 'ms' : '%'}
                </span>
                <span>
                  {alert.correlated ? (
                    <span className="inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
                      Correlated
                    </span>
                  ) : (
                    <span className="text-data text-muted-foreground">Raw</span>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
