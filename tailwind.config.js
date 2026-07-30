/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0a0a0a',
        surface: '#1a1a1a',
        'surface-border': '#2a2a2a',
        'text-primary': '#fafafa',
        'text-secondary': '#a1a1aa',
        accentStart: '#a855f7',
        accentEnd: '#ec4899',
        success: '#10b981',
        error: '#ef4444'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace']
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)'
      }
    }
  },
  plugins: []
}
