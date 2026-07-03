/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ─── LEGACY — remove once all primary-* references are migrated ───
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        // ──────────────────────────────────────────────────────────────────

        // ── Brand identity ─────────────────────────────────────────────
        brand: 'var(--color-brand)',

        // ── CTA (primary action) ────────────────────────────────────────
        cta: {
          DEFAULT: 'var(--color-cta)',
          hover: 'var(--color-cta-hover)',
          surface: 'var(--color-cta-surface)',
          text: 'var(--color-cta-text)',
        },

        // ── Accent — Lilac & Mint ───────────────────────────────────────
        accent: {
          DEFAULT: 'var(--color-accent)',
          surface: 'var(--color-accent-surface)',
          text: 'var(--color-accent-text)',
        },
        mint: 'var(--color-mint)',

        // ── Semantic ────────────────────────────────────────────────────
        success: {
          DEFAULT: 'var(--color-success)',
          surface: 'var(--color-success-surface)',
          text: 'var(--color-success-text)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          surface: 'var(--color-warning-surface)',
          text: 'var(--color-warning-text)',
        },
        error: {
          DEFAULT: 'var(--color-error)',
          surface: 'var(--color-error-surface)',
          text: 'var(--color-error-text)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          surface: 'var(--color-info-surface)',
          text: 'var(--color-info-text)',
        },

        // ── Surfaces ────────────────────────────────────────────────────
        surface: {
          DEFAULT: 'var(--color-surface)',
          page: 'var(--color-bg)',
          alt: 'var(--color-surface-alt)',
        },

        // ── Text ────────────────────────────────────────────────────────
        text: {
          DEFAULT: 'var(--color-text)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          inverse: 'var(--color-text-inverse)',
        },

        // ── Borders ─────────────────────────────────────────────────────
        border: {
          subtle: 'var(--color-border-subtle)',
          DEFAULT: 'var(--color-border)',
          strong: 'var(--color-border-strong)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial'],
      },
    },
  },
  plugins: [],
}
