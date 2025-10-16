import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import {
  type ColorScheme,
  RADIUS,
  SHADOWS,
  SCALE,
  TRANSITIONS,
  getGradientClasses,
  getGlassClasses,
  getColoredShadow,
} from '../design-system/theme';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  colorScheme?: ColorScheme;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  children?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      colorScheme = 'ocean',
      icon,
      iconPosition = 'left',
      children,
      fullWidth = false,
      className = '',
      disabled = false,
      ...props
    },
    ref
  ) => {
    // Base styles - always applied
    const baseStyles = `
      inline-flex items-center justify-center gap-2
      font-medium
      ${RADIUS.field}
      ${TRANSITIONS.bouncy}
      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
      ${fullWidth ? 'w-full' : ''}
    `;

    // Get variant-specific styles using theme system
    const getVariantStyles = () => {
      switch (variant) {
        case 'primary':
          return `
            ${getGradientClasses(colorScheme, 'primary')}
            text-white
            ${SHADOWS.button} ${getColoredShadow(colorScheme)}
            hover:shadow-xl hover:${getColoredShadow(colorScheme)} ${SCALE.buttonHover}
            ${SCALE.buttonActive}
          `;

        case 'secondary':
          return `
            ${getGlassClasses('medium')}
            text-gray-700
            hover:${getGlassClasses('strong')} ${SCALE.buttonHover}
            ${SCALE.buttonActive}
          `;

        case 'tertiary':
          return `
            ${getGlassClasses('subtle')}
            text-gray-600
            hover:${getGlassClasses('medium')} hover:text-${colorScheme === 'ocean' ? 'cyan' : colorScheme === 'sunset' ? 'orange' : colorScheme === 'forest' ? 'emerald' : colorScheme === 'lavender' ? 'purple' : 'gray'}-600 ${SCALE.buttonHover}
            ${SCALE.buttonActive}
          `;

        case 'ghost':
          return `
            bg-transparent
            text-gray-600
            hover:bg-white/40 hover:text-${colorScheme === 'ocean' ? 'cyan' : colorScheme === 'sunset' ? 'orange' : colorScheme === 'forest' ? 'emerald' : colorScheme === 'lavender' ? 'purple' : 'gray'}-600 ${SCALE.buttonHover}
            ${SCALE.buttonActive}
          `;

        case 'danger':
          return `
            bg-gradient-to-r from-red-600 to-rose-600
            text-white
            ${SHADOWS.button} shadow-red-200/50
            hover:shadow-xl hover:shadow-red-300/60 ${SCALE.buttonHover}
            ${SCALE.buttonActive}
          `;

        case 'success':
          return `
            bg-gradient-to-r from-green-600 to-emerald-600
            text-white
            ${SHADOWS.button} shadow-green-200/50
            hover:shadow-xl hover:shadow-green-300/60 ${SCALE.buttonHover}
            ${SCALE.buttonActive}
          `;

        default:
          return '';
      }
    };

    // Size styles using SCALE constants
    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2.5 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    const combinedStyles = `
      ${baseStyles}
      ${getVariantStyles()}
      ${sizeStyles[size]}
      ${className}
    `.trim();

    return (
      <button
        ref={ref}
        type="button"
        className={combinedStyles}
        disabled={disabled}
        aria-disabled={disabled}
        {...props}
      >
        {icon && iconPosition === 'left' && <span className="inline-flex">{icon}</span>}
        {children}
        {icon && iconPosition === 'right' && <span className="inline-flex">{icon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
