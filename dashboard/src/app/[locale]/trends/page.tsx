'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { TrendingUp, Clock, Shield, Server, PieChart, Activity } from 'lucide-react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { formatResponseTime, formatDate } from '@/lib/utils';

type TrendData = {
  timeline: {
    date: string;
    online: number;
    offline: number;
    total: number;
    avgResponseTime: number;
    withSSL: number;
    validSSL: number;
  }[];
  insights: {
    expiringSSL: { domain: string; daysUntilExpiry: number }[];
    slowestDomains: { domain: string; responseTime: number }[];
  };
  distributions: {
    httpCodes: { code: string; count: number }[];
    servers: { server: string; count: number }[];
  };
  period: {
    start: string;
    end: string;
    days: number;
  };
};

const HTTP_CODE_COLORS: Record<string, string> = {
  '2xx': '#22c55e', // green
  '3xx': '#3b82f6', // blue
  '4xx': '#f59e0b', // amber
  '5xx': '#ef4444', // red
  'error': '#6b7280', // gray
};

const HTTP_CODE_LABELS: Record<string, Record<string, string>> = {
  en: {
    '2xx': 'Success (2xx)',
    '3xx': 'Redirect (3xx)',
    '4xx': 'Client Error (4xx)',
    '5xx': 'Server Error (5xx)',
    'error': 'Connection Error',
  },
  es: {
    '2xx': 'Éxito (2xx)',
    '3xx': 'Redirección (3xx)',
    '4xx': 'Error Cliente (4xx)',
    '5xx': 'Error Servidor (5xx)',
    'error': 'Error de Conexión',
  },
};

export default function TrendsPage() {
  const t = useTranslations('trends');
  const locale = useLocale();

  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    async function fetchTrends() {
      setLoading(true);
      try {
        const res = await fetch(`/api/monitor/trends?days=${days}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (error) {
        console.error('Failed to fetch trends:', error);
      }
      setLoading(false);
    }
    fetchTrends();
  }, [days]);

  // Format timeline data for charts
  const chartData = data?.timeline.map((point) => ({
    ...point,
    date: formatDate(point.date, locale),
    availabilityPercent: point.total > 0 ? ((point.online / point.total) * 100).toFixed(1) : 0,
    avgResponseTimeSec: point.avgResponseTime ? (point.avgResponseTime / 1000).toFixed(2) : 0,
  })) || [];

  // Format HTTP code data for pie chart
  const httpCodeData = data?.distributions?.httpCodes?.map((item) => ({
    name: HTTP_CODE_LABELS[locale]?.[item.code] || item.code,
    value: item.count,
    code: item.code,
  })) || [];

  // Format server data for bar chart
  const serverData = data?.distributions?.servers?.map((item) => ({
    name: item.server.length > 20 ? item.server.substring(0, 20) + '...' : item.server,
    fullName: item.server,
    count: item.count,
  })) || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Period selector */}
      <div className="mb-8 flex gap-2">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`btn ${days === d ? 'btn-primary' : 'btn-outline'}`}
          >
            {t(`period.${d}days`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">{locale === 'es' ? 'Cargando...' : 'Loading...'}</p>
        </div>
      ) : data ? (
        <div className="grid gap-6">
          {/* Availability Over Time - Area Chart */}
          <div className="card">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <TrendingUp className="h-5 w-5 text-green-600" />
              {t('charts.availability')}
            </h2>
            {chartData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorOnline" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id="colorOffline" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                      }}
                      formatter={(value: number, name: string) => [
                        value,
                        name === 'online' ? (locale === 'es' ? 'En línea' : 'Online') : (locale === 'es' ? 'Fuera de línea' : 'Offline'),
                      ]}
                    />
                    <Legend
                      formatter={(value) =>
                        value === 'online' ? (locale === 'es' ? 'En línea' : 'Online') : (locale === 'es' ? 'Fuera de línea' : 'Offline')
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="online"
                      stackId="1"
                      stroke="#22c55e"
                      fill="url(#colorOnline)"
                    />
                    <Area
                      type="monotone"
                      dataKey="offline"
                      stackId="1"
                      stroke="#ef4444"
                      fill="url(#colorOffline)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground py-8 text-center">
                {locale === 'es' ? 'No hay datos disponibles' : 'No data available'}
              </p>
            )}
          </div>

          {/* Response Time Trend - Line Chart */}
          <div className="card">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Activity className="h-5 w-5 text-blue-600" />
              {t('charts.responseTime')}
            </h2>
            {chartData.length > 0 ? (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}s`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                      }}
                      formatter={(value: number) => [`${value}s`, locale === 'es' ? 'Tiempo promedio' : 'Avg response']}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgResponseTimeSec"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-muted-foreground py-8 text-center">
                {locale === 'es' ? 'No hay datos disponibles' : 'No data available'}
              </p>
            )}
          </div>

          {/* Distribution Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* HTTP Code Distribution - Pie Chart */}
            <div className="card">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <PieChart className="h-5 w-5 text-purple-600" />
                {locale === 'es' ? 'Distribución de Códigos HTTP' : 'HTTP Code Distribution'}
              </h2>
              {httpCodeData.length > 0 ? (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={httpCodeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {httpCodeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={HTTP_CODE_COLORS[entry.code] || '#6b7280'} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [value, name]}
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                        }}
                      />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center">
                  {locale === 'es' ? 'No hay datos disponibles' : 'No data available'}
                </p>
              )}
            </div>

            {/* Server Distribution - Bar Chart */}
            <div className="card">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Server className="h-5 w-5 text-orange-600" />
                {locale === 'es' ? 'Servidores Más Usados' : 'Top Servers'}
              </h2>
              {serverData.length > 0 ? (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serverData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        width={100}
                      />
                      <Tooltip
                        formatter={(value: number) => [value, locale === 'es' ? 'Dominios' : 'Domains']}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                        }}
                      />
                      <Bar dataKey="count" fill="#f97316" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-muted-foreground py-8 text-center">
                  {locale === 'es' ? 'No hay datos disponibles' : 'No data available'}
                </p>
              )}
            </div>
          </div>

          {/* Insights Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Slowest Domains */}
            <div className="card">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Clock className="h-5 w-5 text-amber-600" />
                {t('insights.slowestDomains')}
              </h2>
              {data.insights.slowestDomains.length > 0 ? (
                <ol className="space-y-2">
                  {data.insights.slowestDomains.map((d, i) => (
                    <li key={d.domain} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                      <span className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          {i + 1}
                        </span>
                        <a
                          href={`/${locale}/domain/${encodeURIComponent(d.domain)}`}
                          className="font-mono text-sm hover:text-primary hover:underline"
                        >
                          {d.domain}
                        </a>
                      </span>
                      <span className="font-mono text-sm font-medium text-amber-600 dark:text-amber-400">
                        {formatResponseTime(d.responseTime)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground py-4 text-center">
                  {locale === 'es' ? 'No hay datos' : 'No data'}
                </p>
              )}
            </div>

            {/* Expiring SSL */}
            <div className="card">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Shield className="h-5 w-5 text-red-600" />
                {t('insights.expiringSSL')}
              </h2>
              {data.insights.expiringSSL.length > 0 ? (
                <ol className="space-y-2">
                  {data.insights.expiringSSL.map((d) => (
                    <li key={d.domain} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                      <a
                        href={`/${locale}/domain/${encodeURIComponent(d.domain)}`}
                        className="font-mono text-sm hover:text-primary hover:underline"
                      >
                        {d.domain}
                      </a>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          d.daysUntilExpiry <= 7
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}
                      >
                        {d.daysUntilExpiry} {locale === 'es' ? 'días' : 'days'}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-muted-foreground py-4 text-center">
                  {locale === 'es' ? 'No hay certificados por expirar' : 'No certificates expiring soon'}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card py-12 text-center">
          <p className="text-muted-foreground">
            {locale === 'es' ? 'Error al cargar los datos' : 'Failed to load trends data'}
          </p>
        </div>
      )}
    </div>
  );
}
