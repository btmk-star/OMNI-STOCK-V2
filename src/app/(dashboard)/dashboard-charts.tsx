'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  DayPoint,
  SessionPoint,
  TopMenuPoint,
} from '@/lib/utils/dashboard-aggregate';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils/format';

interface Props {
  canViewNominal: boolean;
  dailySeries: DayPoint[];
  sessionSeries: SessionPoint[];
  topMenu: TopMenuPoint[];
}

const TEAL = 'hsl(166 88% 18%)';
const LIME = 'hsl(65 87% 54%)';
const MINT = 'hsl(96 88% 89%)';
const FOREST = 'hsl(161 62% 12%)';

export function DashboardCharts({ canViewNominal, dailySeries, sessionSeries, topMenu }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="rounded-xl bg-surface p-5 shadow-card lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Sales Trend (30 hari)</h2>
          <span className="text-xs text-text-muted">{dailySeries.length} hari ada transaksi</span>
        </div>
        <SalesTrendChart data={dailySeries} canViewNominal={canViewNominal} />
      </div>

      <div className="rounded-xl bg-surface p-5 shadow-card">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-text-primary">Session Breakdown</h2>
          <p className="text-xs text-text-muted">Distribusi 30 hari per waktu makan</p>
        </div>
        <SessionChart data={sessionSeries} canViewNominal={canViewNominal} />
      </div>

      <div className="rounded-xl bg-surface p-5 shadow-card lg:col-span-3">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-text-primary">Top Menu (7 hari)</h2>
          <p className="text-xs text-text-muted">
            {topMenu.length === 0
              ? 'Items detail belum ter-sync dari Pawoon (transaksi historis tidak punya breakdown items)'
              : `Top ${topMenu.length} produk by qty terjual`}
          </p>
        </div>
        <TopMenuChart data={topMenu} canViewNominal={canViewNominal} />
      </div>
    </div>
  );
}

function SalesTrendChart({ data, canViewNominal }: { data: DayPoint[]; canViewNominal: boolean }) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-text-muted">
        Belum ada data transaksi di periode ini
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={TEAL} stopOpacity={0.4} />
            <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(d) => formatDate(d).slice(0, 5)}
          fontSize={11}
          tick={{ fill: '#666' }}
        />
        <YAxis
          tickFormatter={(v) =>
            canViewNominal
              ? new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(v)
              : ''
          }
          fontSize={11}
          tick={{ fill: '#666' }}
          width={canViewNominal ? 60 : 0}
        />
        <Tooltip
          formatter={(value, name) => {
            const num = typeof value === 'number' ? value : Number(value) || 0;
            if (String(name) === 'revenue') {
              return canViewNominal
                ? [formatCurrency(num), 'Revenue']
                : ['••••', 'Revenue'];
            }
            return [formatNumber(num), 'Trx'];
          }}
          labelFormatter={(label) => formatDate(String(label))}
          contentStyle={{
            backgroundColor: FOREST,
            color: 'white',
            borderRadius: 12,
            border: 'none',
            fontSize: 12,
          }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke={TEAL}
          strokeWidth={2}
          fill="url(#salesGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function SessionChart({ data, canViewNominal }: { data: SessionPoint[]; canViewNominal: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 60, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) =>
            new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(v)
          }
          fontSize={11}
          tick={{ fill: '#666' }}
        />
        <YAxis
          type="category"
          dataKey="label"
          fontSize={11}
          tick={{ fill: '#666' }}
          width={120}
        />
        <Tooltip
          formatter={(value, name) => {
            const num = typeof value === 'number' ? value : Number(value) || 0;
            if (String(name) === 'revenue') {
              return canViewNominal
                ? [formatCurrency(num), 'Revenue']
                : ['••••', 'Revenue'];
            }
            return [formatNumber(num), 'Trx'];
          }}
          contentStyle={{
            backgroundColor: FOREST,
            color: 'white',
            borderRadius: 12,
            border: 'none',
            fontSize: 12,
          }}
        />
        <Bar dataKey="trxCount" fill={TEAL} radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function TopMenuChart({ data, canViewNominal }: { data: TopMenuPoint[]; canViewNominal: boolean }) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-text-muted">
        — items belum ter-sync —
      </div>
    );
  }
  const colors = [TEAL, LIME, MINT, 'hsl(166 50% 30%)', 'hsl(65 70% 70%)'];
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
        <XAxis
          dataKey="productName"
          fontSize={11}
          tick={{ fill: '#666' }}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={60}
        />
        <YAxis fontSize={11} tick={{ fill: '#666' }} />
        <Tooltip
          formatter={(value, name) => {
            const num = typeof value === 'number' ? value : Number(value) || 0;
            if (String(name) === 'qty') return [`${formatNumber(num)} pcs`, 'Qty'];
            return canViewNominal
              ? [formatCurrency(num), 'Revenue']
              : ['••••', 'Revenue'];
          }}
          contentStyle={{
            backgroundColor: FOREST,
            color: 'white',
            borderRadius: 12,
            border: 'none',
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="qty" fill={TEAL} radius={[6, 6, 0, 0]}>
          {data.map((_, idx) => (
            <Cell key={idx} fill={colors[idx % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
