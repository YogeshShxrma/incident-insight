import { useSystem } from '@/context/SystemContext';

export default function TracesView() {
  const { uiData } = useSystem();
  const traces = [...uiData.traces].reverse();

  return (
    <div>
      <h2 className="text-heading text-foreground mb-6">Distributed Traces</h2>
      <div className="rounded-lg bg-card card-shadow overflow-hidden">
        <div className="sticky top-0 z-10 grid grid-cols-[100px_120px_100px_80px_1fr] gap-4 border-b border-border bg-card px-5 py-3">
          <span className="text-caps text-muted-foreground">Time</span>
          <span className="text-caps text-muted-foreground">Service</span>
          <span className="text-caps text-muted-foreground">Duration</span>
          <span className="text-caps text-muted-foreground">Status</span>
          <span className="text-caps text-muted-foreground">Spans</span>
        </div>
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
          {traces.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground text-data">No traces yet</div>
          ) : (
            traces.map((trace) => (
              <div
                key={trace.id}
                className="grid grid-cols-[100px_120px_100px_80px_1fr] gap-4 border-b border-border px-5 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <span className="text-data text-muted-foreground">
                  {new Date(trace.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className="text-data text-foreground">{trace.serviceId}</span>
                <span className="text-data text-foreground tabular-nums">{trace.duration}ms</span>
                <span className={`text-data font-medium ${trace.status === 'OK' ? 'text-status-ok' : 'text-status-error'}`}>
                  {trace.status}
                </span>
                <div className="flex items-center gap-1">
                  {trace.spans.map((span, i) => (
                    <div
                      key={i}
                      className="h-5 rounded-sm bg-primary/20 border border-primary/30 px-1.5 flex items-center"
                      style={{ minWidth: Math.max(span.duration / 10, 30) }}
                    >
                      <span className="text-[9px] text-primary truncate">{span.service}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
