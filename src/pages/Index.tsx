import { useState } from 'react';
import type { PageType } from '@/lib/types';
import { SystemProvider } from '@/context/SystemContext';
import Layout from '@/components/Layout';
import Dashboard from '@/components/Dashboard';
import LogsView from '@/components/LogsView';
import TracesView from '@/components/TracesView';
import AlertsView from '@/components/AlertsView';
import IncidentsView from '@/components/IncidentsView';
import ReportsView from '@/components/ReportsView';

const PAGES: Record<PageType, React.ComponentType> = {
  dashboard: Dashboard,
  logs: LogsView,
  traces: TracesView,
  alerts: AlertsView,
  incidents: IncidentsView,
  reports: ReportsView,
};

const Index = () => {
  const [page, setPage] = useState<PageType>('dashboard');
  const PageComponent = PAGES[page];

  return (
    <SystemProvider>
      <Layout page={page} setPage={setPage}>
        <PageComponent />
      </Layout>
    </SystemProvider>
  );
};

export default Index;
