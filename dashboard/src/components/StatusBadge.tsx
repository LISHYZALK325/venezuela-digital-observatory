'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

type Props = {
  status: 'online' | 'offline';
  className?: string;
};

export function StatusBadge({ status, className }: Props) {
  const t = useTranslations('status');

  return (
    <span
      className={cn(
        'badge',
        status === 'online' ? 'badge-online' : 'badge-offline',
        className
      )}
    >
      {t(status)}
    </span>
  );
}
