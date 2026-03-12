import { motion } from 'framer-motion';
import type { PageType } from '@/lib/types';
import { useSystem } from '@/context/SystemContext';
import {
  LayoutDashboard,
  FileText,
  Activity,
  AlertTriangle,
  ShieldAlert,
  BarChart3,
  Play,
  Pause,
} from 'lucide-react';

const NAV_ITEMS: { id: PageType; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'traces', label: 'Traces', icon: Activity },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { id: 'incidents', label: 'Incidents', icon: ShieldAlert },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

interface LayoutProps {
  children: React.ReactNode;
  page: PageType;
  setPage: (page: PageType) => void;
}

export default function Layout({ children, page, setPage }: LayoutProps) {
  const { running, toggleRunning, openIncidentCount } = useSystem();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r border-border bg-sidebar p-6">
        <div className="mb-8">
          <h1 className="text-base font-semibold tracking-tight text-foreground">NOC Dashboard</h1>
          <p className="text-caps text-muted-foreground mt-1">TD-CIM Monitor</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = page === id;
            return (
              <button
                key={id}
                onClick={() => setPage(id)}
                className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-sidebar-accent text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                }`}
              >
                <Icon size={16} />
                <span>{label}</span>
                {id === 'incidents' && openIncidentCount > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                    {openIncidentCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-border">
          <button
            onClick={toggleRunning}
            className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
          >
            {running ? <Pause size={16} /> : <Play size={16} />}
            <span>{running ? 'Pause Simulation' : 'Resume Simulation'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <motion.div
          key={page}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
          className="mx-auto max-w-[1400px] p-12"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
