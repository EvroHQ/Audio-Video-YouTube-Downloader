/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#09090b',
        surface: '#111114',
        'surface-border': '#232329',
        'text-primary': '#d4d4d8',
        'text-body': '#d4d4d8',
        'text-secondary': '#71717a',
        'text-muted': '#52525b',
        accentStart: '#5618a7',
        accentMid: '#a02368',
        accentEnd: '#db2736',
        success: '#22c55e',
        error: '#ef4444'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace']
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(100deg, #5618A7 0%, #DB2736 100%)',
        'accent-gradient-soft':
          'linear-gradient(100deg, rgba(86, 24, 167, 0.18) 0%, rgba(219, 39, 54, 0.18) 100%)'
      },
      boxShadow: {
        glow: '0 10px 40px -10px rgba(86, 24, 167, 0.5)',
        'glow-lg': '0 20px 60px -12px rgba(86, 24, 167, 0.55)',
        glass: '0 8px 32px -8px rgba(0, 0, 0, 0.6)'
      },
      borderRadius: {
        '2.5xl': '1.25rem'
      },
      keyframes: {
        drift: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(8%, -6%) scale(1.08)' },
          '66%': { transform: 'translate(-6%, 5%) scale(0.96)' }
        },
        shine: {
          '0%': { transform: 'translateX(-120%)' },
          '60%, 100%': { transform: 'translateX(220%)' }
        },
        'gradient-pan': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' }
        }
      },
      animation: {
        'drift-slow': 'drift 20s ease-in-out infinite',
        'drift-slower': 'drift 28s ease-in-out infinite',
        shine: 'shine 3.5s ease-in-out infinite',
        'gradient-pan': 'gradient-pan 6s ease infinite'
      }
    }
  },
  plugins: []
}
