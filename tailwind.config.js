/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Custom border radius values for design system
      borderRadius: {
        'modal': '32px',      // Large modals and overlays
        'card': '24px',       // Cards, sections, containers
        'field': '20px',      // Inputs, buttons, select boxes
        'element': '16px',    // Small interactive elements
      },
      // Custom backdrop blur values
      backdropBlur: {
        'glass-subtle': '4px',
        'glass-medium': '12px',
        'glass-strong': '40px',
      },
      // Glass morphism opacity values
      colors: {
        glass: {
          10: 'rgba(255, 255, 255, 0.1)',
          20: 'rgba(255, 255, 255, 0.2)',
          30: 'rgba(255, 255, 255, 0.3)',
          40: 'rgba(255, 255, 255, 0.4)',
          50: 'rgba(255, 255, 255, 0.5)',
          60: 'rgba(255, 255, 255, 0.6)',
          70: 'rgba(255, 255, 255, 0.7)',
          80: 'rgba(255, 255, 255, 0.8)',
          90: 'rgba(255, 255, 255, 0.9)',
        },
      },
      // Custom animations for loading states
      animation: {
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'skeleton': 'skeleton 1.5s ease-in-out infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
      },
      keyframes: {
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        skeleton: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      // Bouncy easing for playful interactions
      transitionTimingFunction: {
        'bouncy': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    function({ addUtilities }) {
      addUtilities({
        '.will-change-transform': {
          'will-change': 'transform',
        },
      });
    },
  ],
}