import { useSystem } from '@/context/SystemContext';

export default function LogsView() {
  const { uiData } = useSystem();
  const logs = [...uiData.logs].reverse();

  const levelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'text-status-error';
      case 'WARN': return 'text-status-warn';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div>
      <h2 className="text-heading text-foreground mb-6">Log Stream</h2>
      <div className="rounded-lg bg-card card-shadow overflow-hidden">
        <div className="sticky top-0 z-10 grid grid-cols-[100px_80px_120px_1fr] gap-4 border-b border-border bg-card px-5 py-3">
          <span className="text-caps text-muted-foreground">Time</span>
          <span className="text-caps text-muted-foreground">Level</span>
          <span className="text-caps text-muted-foreground">Service</span>
          <span className="text-caps text-muted-foreground">Message</span>
        </div>
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
          {logs.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground text-data">No logs yet</div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="grid grid-cols-[100px_80px_120px_1fr] gap-4 border-b border-border px-5 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <span className="text-data text-muted-foreground">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={`text-data font-medium ${levelColor(log.level)}`}>{log.level}</span>
                <span className="text-data text-foreground">{log.serviceId}</span>
                <span className="text-data text-foreground">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
