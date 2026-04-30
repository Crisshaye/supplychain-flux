/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette (raw)
        navy: {
          DEFAULT: '#1B263B',
          900: '#0F1626',
          800: '#1B263B',
          700: '#243049',
        },
        steel: {
          DEFAULT: '#415A77',
          600: '#4F6B8A',
          400: '#7C93AE',
          200: '#C9D3E0',
        },
        lime: {
          DEFAULT: '#D8F3DC',
          700: '#7AC79A',
          900: '#2F7B53',
        },
        canvas: '#F8F9FA',
        ink: '#0F172A',
        muted: '#475569',
        amber: '#F59E0B',
        danger: '#DC2626',

        // Semantic tokens (use these in components, not the raw colors above)
        surface: {
          DEFAULT: '#FFFFFF',
          inset: '#F8F9FA',
          deep: '#1B263B',
        },
        line: {
          DEFAULT: '#E2E8F0',
          strong: '#CBD5E1',
        },
        // Foreground / text color tokens. Named 'fg' rather than 'text' because
        // Tailwind already uses the `text-*` prefix for text-color utilities;
        // a color group also called `text` causes a circular @apply error.
        fg: {
          DEFAULT: '#0F172A',
          muted: '#475569',
          onDeep: '#F8F9FA',
        },
        accent: {
          progress: '#D8F3DC',
          progressInk: '#2F7B53',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Tabular numerals applied via the .num utility in index.css
        'metric-sm': ['1.125rem', { lineHeight: '1.4', letterSpacing: '-0.01em', fontWeight: '600' }],
        metric: ['1.875rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '600' }],
        'metric-lg': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.03em', fontWeight: '600' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 0 0 1px rgba(15, 23, 42, 0.06)',
        cardHover: '0 4px 12px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.08)',
        inset: 'inset 0 0 0 1px rgba(15, 23, 42, 0.06)',
      },
      borderRadius: {
        card: '0.75rem',
      },
      animation: {
        'pulse-soft': 'pulseSoft 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
    },
  },
  plugins: [],
};
