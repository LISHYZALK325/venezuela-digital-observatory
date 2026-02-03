'use client';

import { useTranslations } from 'next-intl';
import { Shield, ShieldAlert, ShieldX, ShieldOff } from 'lucide-react';
import { cn } from '@/lib/utils';

type SSLInfo = {
  enabled?: boolean;
  valid?: boolean;
  selfSigned?: boolean;
  daysUntilExpiry?: number;
} | null;

type Props = {
  ssl: SSLInfo;
  showLabel?: boolean;
  className?: string;
};

export function SSLBadge({ ssl, showLabel = true, className }: Props) {
  const t = useTranslations('ssl');

  if (!ssl || !ssl.enabled) {
    return (
      <span className={cn('badge badge-ssl-none', className)}>
        <ShieldOff className="mr-1 h-3 w-3" />
        {showLabel && t('none')}
      </span>
    );
  }

  if (!ssl.valid) {
    return (
      <span className={cn('badge badge-ssl-invalid', className)}>
        <ShieldX className="mr-1 h-3 w-3" />
        {showLabel && t('invalid')}
      </span>
    );
  }

  if (ssl.selfSigned) {
    return (
      <span className={cn('badge badge-ssl-invalid', className)}>
        <ShieldAlert className="mr-1 h-3 w-3" />
        {showLabel && t('selfSigned')}
      </span>
    );
  }

  if (ssl.daysUntilExpiry !== undefined && ssl.daysUntilExpiry <= 30) {
    return (
      <span className={cn('badge bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', className)}>
        <ShieldAlert className="mr-1 h-3 w-3" />
        {showLabel && `${ssl.daysUntilExpiry}d`}
      </span>
    );
  }

  return (
    <span className={cn('badge badge-ssl-valid', className)}>
      <Shield className="mr-1 h-3 w-3" />
      {showLabel && t('valid')}
    </span>
  );
}
