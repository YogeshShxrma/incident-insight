import { useMemo, useRef, useEffect, useState } from 'react';
import { useSystem } from '@/context/SystemContext';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

export default function ThroughputChart() {
  const { uiData } = useSystem();
  const [smoothData, setSmoothData] = useState<{ time: string; pps: number }[]>([]);
  const animFrameRef = useRef<number>(0);
  const targetDataRef = useRef<{ time: string; pps: number }[]>([]);
  const currentDataRef = useRef<{ time: string; pps: number }[]>([]);

  // Update target data when uiData changes
  const latestTarget = useMemo(() => {
    return uiData.throughput.map((d) => ({
      time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      pps: Math.round(d.packetsPerSec),
    }));
  }, [uiData.throughput]);

  useEffect(() => {
    targetDataRef.current = latestTarget;
    if (currentDataRef.current.length === 0 && latestTarget.length > 0) {
      currentDataRef.current = latestTarget.map(d => ({ ...d }));
      setSmoothData([...currentDataRef.current]);
    }
  }, [latestTarget]);

  // Smooth animation loop at ~30fps
  useEffect(() => {
    let lastTime = 0;
    const LERP = 0.08;

    const animate = (timestamp: number) => {
      if (timestamp - lastTime > 33) { // ~30fps
        lastTime = timestamp;
        const target = targetDataRef.current;
        const current = currentDataRef.current;

        if (target.length > 0) {
          // Resize current array to match target
          while (current.length < target.length) {
            current.push({ ...target[current.length] });
          }
          if (current.length > target.length) {
            current.length = target.length;
          }

          let changed = false;
          for (let i = 0; i < target.length; i++) {
            const newPps = current[i].pps + (target[i].pps - current[i].pps) * LERP;
            if (Math.abs(newPps - current[i].pps) > 0.5) {
              current[i] = { time: target[i].time, pps: Math.round(newPps) };
              changed = true;
            } else if (current[i].time !== target[i].time) {
              current[i] = { ...target[i] };
              changed = true;
            }
          }

          if (changed) {
            setSmoothData(current.map(d => ({ ...d })));
          }
        }
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  if (smoothData.length < 2) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-lg bg-card card-shadow">
        <span className="text-muted-foreground text-data">Awaiting data…</span>
      </div>
    );
  }

  const maxVal = Math.max(...smoothData.map((d) => d.pps));
  const isHealthy = maxVal > 500;

  // Normalize to 0-5 scale
  const peakPps = Math.max(...smoothData.map(d => d.pps), 1);
  const normalizedData = smoothData.map(d => ({
    time: d.time,
    value: Math.round((d.pps / peakPps) * 5 * 100) / 100,
  }));

  return (
    <div className="rounded-lg bg-card card-shadow p-5">
      <h3 className="text-caps text-muted-foreground mb-3">Network Throughput</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={normalizedData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
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
            domain={[0, 5]}
            ticks={[0, 1, 2, 3, 4, 5]}
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
            dataKey="value"
            stroke={isHealthy ? 'hsl(140 70% 40%)' : 'hsl(0 85% 60%)'}
            strokeWidth={2}
            fill="url(#throughputGrad)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
