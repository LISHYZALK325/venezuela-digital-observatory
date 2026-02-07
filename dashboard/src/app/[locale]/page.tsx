'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import {
  ArrowRight,
  RefreshCw,
  Github,
  Globe,
  Shield,
  Code,
  TrendingUp,
  Clock,
  ShieldX,
  Info,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { StatusSummary } from '@/components/StatusSummary';
import { formatRelativeTime, formatResponseTime, formatDate } from '@/lib/utils';

type SummaryData = {
  checkedAt: string;
  checkDuration: number;
  summary: {
    totalDomains: number;
    online: number;
    offline: number;
    withSSL: number;
    validSSL: number;
    avgResponseTime: number;
  };
};

type TrendData = {
  timeline: {
    date: string;
    online: number;
    offline: number;
    total: number;
    avgResponseTime: number;
  }[];
  insights: {
    expiringSSL: { domain: string; daysUntilExpiry: number }[];
    expiredSSL: { domain: string; daysUntilExpiry: number }[];
    renewedSSL: { domain: string; daysUntilExpiry: number }[];
    inconsistentSSL: { domain: string; issue: string }[];
    slowestDomains: { domain: string; responseTime: number }[];
  };
  distributions: {
    nameservers: { provider: string; count: number; example: string }[];
  };
};

export default function OverviewPage() {
  const t = useTranslations('overview');
  const tHome = useTranslations('home');
  const tTrends = useTranslations('trends');
  const locale = useLocale();

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [summaryRes, trendsRes] = await Promise.all([
          fetch('/api/monitor/summary'),
          fetch('/api/monitor/trends?days=7'),
        ]);

        if (summaryRes.ok) {
          setSummary(await summaryRes.json());
        }
        if (trendsRes.ok) {
          setTrends(await trendsRes.json());
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  // Format timeline data for charts
  const chartData =
    trends?.timeline.map((point) => ({
      ...point,
      date: formatDate(point.date, locale),
    })) || [];

  // Format nameserver data for bar chart
  const nameserverData =
    trends?.distributions?.nameservers?.slice(0, 8).map((item) => ({
      name: item.provider.length > 12 ? item.provider.substring(0, 12) + '...' : item.provider,
      fullName: item.example,
      count: item.count,
    })) || [];

  // Calculate totals for SSL insights
  const sslExpiringCount = trends?.insights?.expiringSSL?.length || 0;
  const sslExpiredCount = trends?.insights?.expiredSSL?.length || 0;

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-slate-900 dark:bg-slate-950">
        <div className="container mx-auto px-4 py-10 sm:py-12">
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:justify-between sm:text-left gap-6">
            {/* Title & Subtitle */}
            <div>
              <h1 className="mb-2 text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
                {t('title')}
              </h1>
              <p className="text-slate-400 sm:text-lg">{t('subtitle')}</p>
              {/* Badges */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                  <Globe className="h-3 w-3" />
                  {t('realTime')}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                  <Code className="h-3 w-3" />
                  Open Source
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                  <Shield className="h-3 w-3" />
                  {t('publicData')}
                </span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex items-center gap-3">
              <Link
                href={`/${locale}/domains`}
                className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100"
              >
                {t('viewAll')}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://github.com/ggangix/venezuela-digital-observatory"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
              >
                <Github className="h-4 w-4" />
                GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="card py-12 text-center">
            <p className="text-slate-500 dark:text-slate-400">{tHome('loading')}</p>
          </div>
        ) : summary ? (
          <>
            {/* Last Update */}
            <div className="mb-4 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <RefreshCw className="h-4 w-4" />
              <span>
                {t('lastUpdate')}: {formatRelativeTime(summary.checkedAt, locale)}
              </span>
            </div>

            {/* Stats Summary */}
            <StatusSummary
              summary={summary.summary}
              className="mb-8"
            />
          </>
        ) : (
          <div className="card py-12 text-center">
            <p className="text-slate-500 dark:text-slate-400">{t('loadError')}</p>
          </div>
        )}
      </section>

      {/* Mini Availability Chart */}
      {trends && chartData.length > 0 && (
        <section className="container mx-auto px-4 pb-8">
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <TrendingUp className="h-5 w-5 text-green-600" />
                {tTrends('charts.availability')}
              </h2>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {tTrends('period.7days')}
              </span>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorOnlineHome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorOfflineHome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-slate-200 dark:stroke-slate-700"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-background)',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-foreground)',
                    }}
                    formatter={(value: number, name: string) => [
                      value,
                      name === 'online' ? tTrends('legend.online') : tTrends('legend.offline'),
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="online"
                    stackId="1"
                    stroke="#22c55e"
                    fill="url(#colorOnlineHome)"
                  />
                  <Area
                    type="monotone"
                    dataKey="offline"
                    stackId="1"
                    stroke="#ef4444"
                    fill="url(#colorOfflineHome)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      )}

      {/* SSL Insights Grid */}
      {trends && (
        <section className="container mx-auto px-4 pb-8">
          <h2 className="mb-4 text-lg font-semibold">{tTrends('insights.title')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Expiring SSL */}
            <div className="card">
              <div className="mb-3 flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-600" />
                <span className="font-medium">{tTrends('insights.expiringSSL')}</span>
              </div>
              <p className="mb-2 text-2xl font-bold text-amber-600">{sslExpiringCount}</p>
              {trends.insights.expiringSSL.slice(0, 3).map((d) => (
                <Link
                  key={d.domain}
                  href={`/${locale}/domain/${encodeURIComponent(d.domain)}`}
                  className="mb-1 block truncate font-mono text-xs text-slate-500 hover:text-blue-600 dark:text-slate-400"
                >
                  {d.domain} ({d.daysUntilExpiry}d)
                </Link>
              ))}
              {sslExpiringCount === 0 && (
                <p className="text-xs text-slate-400">{tTrends('noCertificates')}</p>
              )}
            </div>

            {/* Expired SSL */}
            <div className="card">
              <div className="mb-3 flex items-center gap-2">
                <ShieldX className="h-5 w-5 text-red-600" />
                <span className="font-medium">{tTrends('insights.expiredSSL')}</span>
              </div>
              <p className="mb-2 text-2xl font-bold text-red-600">{sslExpiredCount}</p>
              {trends.insights.expiredSSL?.slice(0, 3).map((d) => (
                <Link
                  key={d.domain}
                  href={`/${locale}/domain/${encodeURIComponent(d.domain)}`}
                  className="mb-1 block truncate font-mono text-xs text-slate-500 hover:text-blue-600 dark:text-slate-400"
                >
                  {d.domain} ({Math.abs(d.daysUntilExpiry)}d)
                </Link>
              ))}
              {sslExpiredCount === 0 && (
                <p className="text-xs text-slate-400">{tTrends('noExpiredCertificates')}</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Quick Insights Row */}
      {trends && (
        <section className="container mx-auto px-4 pb-8">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Nameserver Distribution */}
            {nameserverData.length > 0 && (
              <div className="card">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                  <Globe className="h-5 w-5 text-cyan-600" />
                  {tTrends('distributions.nameservers')}
                </h2>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={nameserverData}
                      layout="vertical"
                      margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-slate-200 dark:stroke-slate-700"
                      />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        width={90}
                      />
                      <Tooltip
                        formatter={(value: number) => [value, tTrends('legend.domains')]}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                        contentStyle={{
                          backgroundColor: 'var(--color-background)',
                          borderRadius: '8px',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-foreground)',
                        }}
                      />
                      <Bar dataKey="count" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Slowest Domains */}
            <div className="card">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <Clock className="h-5 w-5 text-amber-600" />
                {tTrends('insights.slowestDomains')}
              </h2>
              {trends.insights.slowestDomains.length > 0 ? (
                <ol className="space-y-2">
                  {trends.insights.slowestDomains.slice(0, 5).map((d, i) => (
                    <li
                      key={d.domain}
                      className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800"
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          {i + 1}
                        </span>
                        <Link
                          href={`/${locale}/domain/${encodeURIComponent(d.domain)}`}
                          className="font-mono text-sm hover:text-blue-600 hover:underline"
                        >
                          {d.domain}
                        </Link>
                      </span>
                      <span className="font-mono text-sm font-medium text-amber-600 dark:text-amber-400">
                        {formatResponseTime(d.responseTime)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-4 text-center text-slate-400">{tTrends('noDataShort')}</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Links Row */}
      <section className="container mx-auto px-4 pb-12">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href={`/${locale}/trends`}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <TrendingUp className="h-4 w-4" />
            {tHome('viewAllTrends')}
          </Link>
          <Link
            href={`/${locale}/about`}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Info className="h-4 w-4" />
            {tHome('learnMore')}
          </Link>
        </div>
      </section>
    </div>
  );
}
