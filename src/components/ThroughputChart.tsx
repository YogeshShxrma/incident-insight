import { useMemo } from 'react';
import { useSystem } from '@/context/SystemContext';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

export default function ThroughputChart() {
  const { uiData } = useSystem();

  const data = useMemo(() => {
    return uiData.throughput.map((d) => ({
      time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      pps: Math.round(d.packetsPerSec),
    }));
  }, [uiData.throughput]);

  if (data.length < 2) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg bg-card card-shadow">
        <span className="text-muted-foreground text-data">Awaiting data…</span>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.pps));
  const isHealthy = maxVal > 500;

  return (
    <div className="rounded-lg bg-card card-shadow p-5">
      <h3 className="text-caps text-muted-foreground mb-3">Network Throughput</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="throughputGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isHealthy ? 'hsl(140 70% 40%)' : 'hsl(0 85% 60%)'} stopOpacity={0.3} />
              <stop offset="100%" stopColor={isHealthy ? 'hsl(140 70% 40%)' : 'hsl(0 85% 60%)'} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: 'hsl(220 15% 50%)' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'hsl(220 15% 50%)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(0 0% 100%)',
              border: '1px solid hsl(220 20% 92%)',
              borderRadius: '8px',
              fontSize: '12px',
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          />
          <Area
            type="monotone"
            dataKey="pps"
            stroke={isHealthy ? 'hsl(140 70% 40%)' : 'hsl(0 85% 60%)'}
            strokeWidth={2}
            fill="url(#throughputGrad)"
            dot={false}
            animationDuration={300}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
