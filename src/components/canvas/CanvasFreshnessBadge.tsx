/**
 * CanvasFreshnessBadge Component
 *
 * Visual indicator showing whether canvas is fresh or stale
 */

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Clock, Loader } from 'lucide-react';

interface CanvasFreshnessBadgeProps {
  canvasGeneratedAt?: string;
  summaryLastUpdated?: string;
  isGenerating?: boolean;
  className?: string;
}

type FreshnessStatus = 'fresh' | 'stale' | 'generating' | 'unknown';

export function CanvasFreshnessBadge({
  canvasGeneratedAt,
  summaryLastUpdated,
  isGenerating = false,
  className = '',
}: CanvasFreshnessBadgeProps) {
  const getStatus = (): FreshnessStatus => {
    if (isGenerating) return 'generating';
    if (!canvasGeneratedAt || !summaryLastUpdated) return 'unknown';

    const canvasTime = new Date(canvasGeneratedAt);
    const summaryTime = new Date(summaryLastUpdated);

    return canvasTime >= summaryTime ? 'fresh' : 'stale';
  };

  const status = getStatus();

  const statusConfig = {
    fresh: {
      icon: CheckCircle,
      label: 'Fresh',
      description: 'Canvas is up to date',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      ringColor: 'ring-green-200',
    },
    stale: {
      icon: AlertCircle,
      label: 'Outdated',
      description: 'Summary updated since canvas generation',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      ringColor: 'ring-amber-200',
    },
    generating: {
      icon: Loader,
      label: 'Generating',
      description: 'Creating new canvas',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      ringColor: 'ring-blue-200',
    },
    unknown: {
      icon: Clock,
      label: 'Unknown',
      description: 'Canvas status unknown',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      ringColor: 'ring-gray-200',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bgColor} ring-1 ${config.ringColor} ${className}`}
      title={config.description}
    >
      <Icon
        className={`w-4 h-4 ${config.color} ${status === 'generating' ? 'animate-spin' : ''}`}
      />
      <span className={`text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    </motion.div>
  );
}
