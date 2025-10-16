import React from 'react';
import { Button } from './Button';
import { useTheme } from '../context/ThemeContext';
import { getGlassClasses, RADIUS, TRANSITIONS } from '../design-system/theme';

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  message?: string;
  illustration?: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'compact';
}

export const EmptyState = React.memo(function EmptyState({
  icon: Icon,
  title,
  message,
  illustration,
  primaryAction,
  secondaryAction,
  variant = 'default',
}: EmptyStateProps) {
  const { colorScheme } = useTheme();

  // Get themed icon color based on color scheme
  const getIconColorClass = () => {
    const colorMap = {
      ocean: 'text-cyan-500',
      sunset: 'text-orange-500',
      forest: 'text-emerald-500',
      lavender: 'text-purple-500',
      monochrome: 'text-gray-500',
    };
    return colorMap[colorScheme];
  };

  // Variant-specific padding and sizing
  const variantClasses = {
    default: {
      container: 'p-8',
      iconSize: 'w-12 h-12',
      illustrationSize: 'w-32 h-32',
      titleSize: 'text-lg',
      messageSize: 'text-sm',
      actionGap: 'gap-3',
      messageMargin: 'mb-6',
    },
    compact: {
      container: 'p-6',
      iconSize: 'w-10 h-10',
      illustrationSize: 'w-24 h-24',
      titleSize: 'text-base',
      messageSize: 'text-xs',
      actionGap: 'gap-2',
      messageMargin: 'mb-4',
    },
  };

  const classes = variantClasses[variant];

  return (
    <div
      className={`
        ${getGlassClasses('medium')}
        ${RADIUS.card}
        ${classes.container}
        ${TRANSITIONS.standard}
        text-center
      `.trim()}
    >
      {/* Icon or Illustration */}
      {Icon && !illustration && (
        <Icon
          className={`
            ${classes.iconSize}
            ${getIconColorClass()}
            mx-auto mb-4
            ${TRANSITIONS.standard}
          `.trim()}
        />
      )}
      {illustration && !Icon && (
        <img
          src={illustration}
          alt=""
          className={`
            ${classes.illustrationSize}
            mx-auto mb-4
            ${TRANSITIONS.standard}
            object-contain
          `.trim()}
        />
      )}

      {/* Title */}
      <h3
        className={`
          ${classes.titleSize}
          font-semibold
          text-gray-900
          mb-2
        `.trim()}
      >
        {title}
      </h3>

      {/* Message */}
      {message && (
        <p
          className={`
            ${classes.messageSize}
            text-gray-600
            ${classes.messageMargin}
            max-w-md
            mx-auto
          `.trim()}
        >
          {message}
        </p>
      )}

      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <div
          className={`
            flex
            ${classes.actionGap}
            justify-center
            flex-wrap
          `.trim()}
        >
          {primaryAction && (
            <Button
              variant="primary"
              colorScheme={colorScheme}
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="ghost"
              colorScheme={colorScheme}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
});
