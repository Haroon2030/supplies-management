'use client';

import { useI18n } from '@/lib/i18n';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export const PALETTE = ['#0a84ff', '#30d158', '#64d2ff', '#bf5af2', '#ff453a', '#5ac8fa'];

const axis = { fill: '#8ea3b2', fontSize: 12 };

function Tip({ active, payload, label, fmt }: { active?: boolean; payload?: { value: number; name?: string; color?: string }[]; label?: string; fmt?: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass glass-strong rounded-lg bg-[#1c1c1e]/95 px-3 py-2 text-xs shadow-xl">
      {label && <p className="mb-1 text-muted">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-semibold tabular-nums" style={{ color: p.color }}>
          {fmt ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

/** منحنى مساحي لقيمة واحدة عبر الزمن. */
export function TrendChart({ data, x, y, color = '#0a84ff', fmt }: { data: Record<string, unknown>[]; x: string; y: string; color?: string; fmt?: (n: number) => string }) {
  const id = `g-${y}`;
  const { dir } = useI18n();
  return (
    <div className="h-64" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          {/* في الواجهة العربية يسير الزمن من اليمين إلى اليسار */}
          <XAxis dataKey={x} tick={axis} axisLine={false} tickLine={false} reversed={dir === 'rtl'} />
          <YAxis hide />
          <Tooltip content={<Tip fmt={fmt} />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
          <Area type="monotone" dataKey={y} stroke={color} strokeWidth={2.5} fill={`url(#${id})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** أعمدة أفقية مرتبة (للتصنيفات). */
export function RankBars({ data, label, value, fmt }: { data: Record<string, unknown>[]; label: string; value: string; fmt?: (n: number) => string }) {
  return (
    <div style={{ height: Math.max(180, data.length * 44) }} dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey={label} width={165} tick={{ ...axis, fill: '#e8eef2' }} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip fmt={fmt} />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar dataKey={value} radius={[0, 8, 8, 0]} barSize={18}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** أعمدة مجمّعة (معتمد/مرفوض/معاد). */
export function StackedBars({ data, x, series }: { data: Record<string, unknown>[]; x: string; series: { key: string; name: string; color: string }[] }) {
  return (
    <div className="h-72" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey={x} tick={axis} axisLine={false} tickLine={false} interval={0} />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="glass glass-strong rounded-lg bg-[#1c1c1e]/95 px-3 py-2 text-xs">
                  <p className="mb-1 text-muted">{label}</p>
                  {payload.map((p) => (
                    <p key={String(p.dataKey)} style={{ color: p.color }} className="font-semibold">{p.name}: {String(p.value)}</p>
                  ))}
                </div>
              ) : null
            }
          />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} stackId="a" fill={s.color} radius={i === series.length - 1 ? [6, 6, 0, 0] : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** حلقة تقدم: نسبة المكتمل من الإجمالي مع رقم في الوسط. */
export function Donut({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const data = [{ v: done }, { v: Math.max(total - done, 0) }];
  return (
    <div className="relative mx-auto size-44" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="v" innerRadius="72%" outerRadius="100%" startAngle={90} endAngle={-270} stroke="none" cornerRadius={8} paddingAngle={total && done && done < total ? 3 : 0}>
            <Cell fill="#0a84ff" />
            <Cell fill="rgba(255,255,255,0.1)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-4xl font-bold tabular-nums">{pct}%</p>
          <p className="text-xs text-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}

/** أعمدة الأسبوع؛ اليوم الحالي يُبرز بالأزرق والباقي بدرجة أهدأ. */
export function WeeklyBars({ data }: { data: { label: string; requests: number; today: boolean }[] }) {
  const { dir } = useI18n();
  return (
    <div className="h-44" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} reversed={dir === 'rtl'} interval={0} />
          <YAxis hide domain={[0, (m: number) => Math.max(m, 3)]} />
          <Tooltip content={<Tip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          <Bar dataKey="requests" radius={[8, 8, 8, 8]} minPointSize={4}>
            {data.map((d, i) => <Cell key={i} fill={d.today ? '#0a84ff' : 'rgba(100,210,255,0.55)'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
