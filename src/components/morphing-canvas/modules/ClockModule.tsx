/**
 * Clock Module
 *
 * Displays current time with optional date and timezone
 */

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import type { ModuleProps } from '../types';

interface ClockData {
  time: string;
  date: string;
  timezone?: string;
}

interface ClockSettings {
  format24h?: boolean;
  showSeconds?: boolean;
  showDate?: boolean;
  timezone?: string;
}

export function ClockModule({ config }: ModuleProps<ClockData>) {
  const settings = (config.settings || {}) as ClockSettings;
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, settings.showSeconds ? 1000 : 60000);

    return () => clearInterval(interval);
  }, [settings.showSeconds]);

  const formatTime = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    if (settings.format24h) {
      const displaySeconds = settings.showSeconds ? `:${seconds}` : '';
      return `${hours.toString().padStart(2, '0')}:${minutes}${displaySeconds}`;
    }

    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displaySeconds = settings.showSeconds ? `:${seconds}` : '';
    return `${displayHours}:${minutes}${displaySeconds} ${period}`;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <div className="text-6xl font-bold tracking-tight mb-2">
        {formatTime(currentTime)}
      </div>
      {settings.showDate && (
        <div className="text-lg text-gray-600 dark:text-gray-400">
          {formatDate(currentTime)}
        </div>
      )}
      {settings.timezone && (
        <div className="text-sm text-gray-500 dark:text-gray-500 mt-2">
          {settings.timezone}
        </div>
      )}
    </div>
  );
}

ClockModule.displayName = 'ClockModule';
