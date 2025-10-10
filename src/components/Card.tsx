import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

type CardVariant = 'default' | 'elevated' | 'interactive' | 'flat';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  hover?: boolean;
  active?: boolean;
  children: ReactNode;
  gradient?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      hover = false,
      active = false,
      gradient = false,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    // Base styles
    const baseStyles = `
      relative
      rounded-2xl
      transition-all duration-300
    `;

    // Variant styles
    const variantStyles = {
      default: `
        bg-white/50 backdrop-blur-xl
        border border-white/60
        shadow-sm
      `,
      elevated: `
        bg-white/60 backdrop-blur-2xl
        border-2 border-white/50
        shadow-xl
      `,
      interactive: `
        bg-white/50 backdrop-blur-xl
        border border-white/60
        shadow-sm
        cursor-pointer
      `,
      flat: `
        bg-white/40 backdrop-blur-lg
        border border-white/50
      `,
    };

    // Hover effects
    const hoverStyles = hover
      ? `
        hover:shadow-xl hover:shadow-cyan-100/30
        hover:-translate-y-1 hover:scale-[1.02]
      `
      : '';

    // Active state
    const activeStyles = active
      ? `
        shadow-xl shadow-cyan-200/40
        border-cyan-300/60
        scale-[1.02]
      `
      : '';

    const combinedStyles = `
      ${baseStyles}
      ${variantStyles[variant]}
      ${hoverStyles}
      ${activeStyles}
      ${className}
    `.trim();

    return (
      <div
        ref={ref}
        className={combinedStyles}
        style={{
          transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        {...props}
      >
        {/* Gradient hover overlay */}
        {gradient && (
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 transition-opacity duration-300" />
        )}

        {/* Content with relative positioning for z-index */}
        <div className="relative z-10">{children}</div>
      </div>
    );
  }
);

Card.displayName = 'Card';
