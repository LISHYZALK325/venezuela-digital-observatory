'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Globe, WifiOff, Shield, ShieldCheck, Clock, Timer } from 'lucide-react';
import { cn, percentage, formatResponseTime, formatDuration, formatNumberWithSeparator } from '@/lib/utils';

type Summary = {
  totalDomains: number;
  online: number;
  offline: number;
  withSSL: number;
  validSSL: number;
  avgResponseTime: number;
  checkDuration?: number;
};

type Props = {
  summary: Summary;
  className?: string;
};

export function StatusSummary({ summary, className }: Props) {
  const t = useTranslations('stats');
  const locale = useLocale();

  const stats = [
    {
      key: 'totalDomains',
      value: formatNumberWithSeparator(summary.totalDomains, locale),
      icon: Globe,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      key: 'online',
      value: formatNumberWithSeparator(summary.online, locale),
      subtitle: percentage(summary.online, summary.totalDomains),
      icon: Globe,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      key: 'offline',
      value: formatNumberWithSeparator(summary.offline, locale),
      subtitle: percentage(summary.offline, summary.totalDomains),
      icon: WifiOff,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
    },
    {
      key: 'withSSL',
      value: formatNumberWithSeparator(summary.withSSL, locale),
      icon: Shield,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
    {
      key: 'validSSL',
      value: formatNumberWithSeparator(summary.validSSL, locale),
      icon: ShieldCheck,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    },
    {
      key: 'avgResponseTime',
      value: formatResponseTime(summary.avgResponseTime),
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    },
  ];

  if (summary.checkDuration) {
    stats.push({
      key: 'checkDuration',
      value: formatDuration(summary.checkDuration),
      icon: Timer,
      color: 'text-slate-600 dark:text-slate-400',
      bgColor: 'bg-slate-100 dark:bg-slate-900/30',
    });
  }

  return (
    <div className={cn('grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5', className)}>
      {stats.map((stat) => (
        <div key={stat.key} className="stat-card flex-row gap-2 p-3">
          <div className={cn('rounded-md p-1.5', stat.bgColor)}>
            <stat.icon className={cn('h-4 w-4', stat.color)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="stat-value text-lg font-bold">{stat.value}</span>
              {stat.subtitle && (
                <span className="text-xs text-slate-500 dark:text-slate-400">{stat.subtitle}</span>
              )}
            </div>
            <div className="stat-label truncate text-xs">{t(stat.key)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
