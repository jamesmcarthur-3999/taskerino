import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
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
      font-medium rounded-2xl
      transition-all duration-300
      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
      ${fullWidth ? 'w-full' : ''}
    `;

    // Variant styles
    const variantStyles = {
      primary: `
        bg-gradient-to-r from-cyan-600 to-blue-600
        text-white
        shadow-lg shadow-cyan-200/50
        hover:shadow-xl hover:shadow-cyan-300/60 hover:scale-105
        active:scale-95
      `,
      secondary: `
        bg-white/70 backdrop-blur-xl
        border border-white/60
        text-gray-700
        shadow-sm
        hover:bg-white/90 hover:shadow-lg hover:scale-105
        active:scale-95
      `,
      tertiary: `
        bg-white/60 backdrop-blur-lg
        border border-white/40
        text-gray-600
        hover:bg-white/80 hover:text-cyan-600 hover:scale-110
        active:scale-90
      `,
      ghost: `
        bg-transparent
        text-gray-600
        hover:bg-white/40 hover:text-cyan-600 hover:scale-105
        active:scale-95
      `,
    };

    // Size styles
    const sizeStyles = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2.5 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    const combinedStyles = `
      ${baseStyles}
      ${variantStyles[variant]}
      ${sizeStyles[size]}
      ${className}
    `.trim();

    return (
      <button
        ref={ref}
        className={combinedStyles}
        disabled={disabled}
        style={{
          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
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
