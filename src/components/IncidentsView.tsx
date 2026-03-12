import { motion } from 'framer-motion';
import { useSystem } from '@/context/SystemContext';
import { toast } from 'sonner';

export default function IncidentsView() {
  const { uiData, resolveIncident } = useSystem();
  const incidents = [...uiData.incidents].sort((a, b) => b.createdAt - a.createdAt);

  const handleResolve = (id: string) => {
    resolveIncident(id);
    toast.success(`Incident resolved`, { description: `ID: ${id.slice(0, 8)}` });
  };

  return (
    <div>
      <h2 className="text-heading text-foreground mb-6">Incidents</h2>
      <div className="rounded-lg bg-card card-shadow overflow-hidden">
        <div className="sticky top-0 z-10 grid grid-cols-[1fr_120px_100px_120px_100px] gap-4 border-b border-border bg-card px-5 py-3">
          <span className="text-caps text-muted-foreground">Title</span>
          <span className="text-caps text-muted-foreground">Services</span>
          <span className="text-caps text-muted-foreground">Score</span>
          <span className="text-caps text-muted-foreground">Status</span>
          <span className="text-caps text-muted-foreground">Action</span>
        </div>
        <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
          {incidents.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground text-data">No incidents yet</div>
          ) : (
            incidents.map((inc) => (
              <div
                key={inc.id}
                className="grid grid-cols-[1fr_120px_100px_120px_100px] gap-4 border-b border-border px-5 py-3 hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="text-sm text-foreground font-medium">{inc.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(inc.createdAt).toLocaleString()} · {inc.alertIds.length} alerts
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 items-start">
                  {inc.affectedServices.map((s) => (
                    <span key={s} className="inline-block rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
                      {s}
                    </span>
                  ))}
                </div>
                <span className="text-data text-foreground tabular-nums self-center">{inc.correlationScore}</span>
                <span className={`text-data font-medium self-center ${inc.status === 'OPEN' ? 'text-status-error' : 'text-status-ok'}`}>
                  {inc.status}
                </span>
                <div className="self-center">
                  {inc.status === 'OPEN' ? (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleResolve(inc.id)}
                      className="h-8 rounded-md bg-status-ok px-3 text-[11px] font-medium text-primary-foreground transition-colors hover:opacity-90"
                    >
                      Resolve
                    </motion.button>
                  ) : (
                    <span className="text-data text-muted-foreground">
                      {inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
