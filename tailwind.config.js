/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
  		screens: {
  			'compact': '1000px',
  		},
  		borderRadius: {
  			modal: '32px',
  			card: '24px',
  			field: '20px',
  			element: '16px'
  		},
  		backdropBlur: {
  			'glass-subtle': '4px',
  			'glass-medium': '12px',
  			'glass-strong': '40px'
  		},
  		colors: {
  			glass: {
  				'10': 'rgba(255, 255, 255, 0.1)',
  				'20': 'rgba(255, 255, 255, 0.2)',
  				'30': 'rgba(255, 255, 255, 0.3)',
  				'40': 'rgba(255, 255, 255, 0.4)',
  				'50': 'rgba(255, 255, 255, 0.5)',
  				'60': 'rgba(255, 255, 255, 0.6)',
  				'70': 'rgba(255, 255, 255, 0.7)',
  				'80': 'rgba(255, 255, 255, 0.8)',
  				'90': 'rgba(255, 255, 255, 0.9)'
  			}
  		},
  		animation: {
  			'slide-in-right': 'slideInRight 0.3s ease-out',
  			skeleton: 'skeleton 1.5s ease-in-out infinite',
  			shimmer: 'shimmer 2s ease-in-out infinite',
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		},
  		keyframes: {
  			slideInRight: {
  				'0%': {
  					transform: 'translateX(100%)',
  					opacity: '0'
  				},
  				'100%': {
  					transform: 'translateX(0)',
  					opacity: '1'
  				}
  			},
  			skeleton: {
  				'0%, 100%': {
  					opacity: '0.4'
  				},
  				'50%': {
  					opacity: '0.8'
  				}
  			},
  			shimmer: {
  				'0%': {
  					backgroundPosition: '-200% 0'
  				},
  				'100%': {
  					backgroundPosition: '200% 0'
  				}
  			},
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		transitionTimingFunction: {
  			bouncy: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
  		}
  	}
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