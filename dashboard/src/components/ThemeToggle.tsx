'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <span className="sr-only">Toggle theme</span>
      </button>
    );
  }

  const themes = [
    { value: 'light' as const, icon: Sun, label: 'Light' },
    { value: 'dark' as const, icon: Moon, label: 'Dark' },
    { value: 'system' as const, icon: Monitor, label: 'System' },
  ];

  const currentTheme = themes.find((t) => t.value === theme) || themes[2];
  const CurrentIcon = currentTheme.icon;

  // Cycle through themes
  const cycleTheme = () => {
    const currentIndex = themes.findIndex((t) => t.value === theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex].value);
  };

  return (
    <button
      onClick={cycleTheme}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-md border transition-colors',
        'border-slate-200 bg-white hover:bg-slate-100',
        'dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700'
      )}
      title={`Theme: ${currentTheme.label}`}
      aria-label={`Current theme: ${currentTheme.label}. Click to change.`}
    >
      <CurrentIcon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
    </button>
  );
}
