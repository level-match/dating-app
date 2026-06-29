/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Obsidian — deep, warm-leaning backgrounds (replaces pure navy)
        obsidian: {
          950: '#070611',
          900: '#0B0819',
          800: '#120D26',
          700: '#1A1335',
          600: '#241B47',
          500: '#2E235A',
        },
        // Champagne — warm honey/gold accent (replaces cool ocean cyan)
        champagne: {
          900: '#5C3F22',
          800: '#7A552F',
          700: '#9B6E3F',
          600: '#B8854D',
          500: '#D4A574',
          400: '#E8C7A0',
          300: '#F2DCB8',
          200: '#F8EAD0',
          100: '#FBF3E2',
        },
        // Bloom — dusty rose for warmth & inclusivity
        bloom: {
          700: '#8C4A56',
          600: '#B3656F',
          500: '#D4929B',
          400: '#E5B5B5',
          300: '#F1CFCB',
        },
        // Jade — sage green for fresh balance, hint of pride spectrum
        jade: {
          700: '#3F6E5A',
          600: '#5D9881',
          500: '#7BB59B',
          400: '#9BCBB4',
          300: '#BCDDCD',
        },
        // Lavender — cool violet whisper, soft contrast
        lavender: {
          700: '#5E4F82',
          600: '#7A6BA3',
          500: '#9789BD',
          400: '#B8A8D4',
          300: '#D4C8E5',
        },
        // Cream — warm primary text
        cream: {
          50:  '#FBF7EE',
          100: '#F5EDE0',
          200: '#E8DBC2',
          300: '#D4C3A0',
          400: '#9B92A8',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        serif:   ['"Fraunces"', 'Georgia', 'serif'],
        accent:  ['"Instrument Serif"', '"Fraunces"', 'Georgia', 'serif'],
        sans:    ['"Inter"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        // Iridescent spectrum — used as the inclusivity signature (subtle, premium)
        'prism': 'linear-gradient(96deg, #E8C7A0 0%, #E5B5B5 28%, #B8A8D4 58%, #9BCBB4 82%, #E8C7A0 100%)',
        'prism-soft': 'linear-gradient(96deg, rgba(232,199,160,0.7) 0%, rgba(229,181,181,0.7) 30%, rgba(184,168,212,0.7) 60%, rgba(155,203,180,0.7) 100%)',
        'champagne-shimmer': 'linear-gradient(105deg, #9B6E3F 0%, #E8C7A0 40%, #D4A574 65%, #9B6E3F 100%)',
        'aurora': 'radial-gradient(ellipse 80% 50% at 50% 50%, rgba(212,165,116,0.18) 0%, rgba(184,168,212,0.10) 35%, transparent 75%)',
      },
      animation: {
        'float':         'float 9s ease-in-out infinite',
        'float-delayed': 'float 9s ease-in-out 2.5s infinite',
        'float-slow':    'float 14s ease-in-out 4s infinite',
        'ambient-pulse': 'ambientPulse 7s ease-in-out infinite',
        'aurora-drift':  'auroraDrift 22s ease-in-out infinite',
        'grain':         'grain 0.5s steps(1) infinite',
        'marquee':       'marquee 50s linear infinite',
        'marquee-reverse': 'marqueeReverse 50s linear infinite',
        'shimmer':       'shimmer 6s ease-in-out infinite',
        'fade-up':       'fadeUp 0.9s cubic-bezier(0.16,1,0.3,1) forwards',
        'glow-pulse':    'glowPulse 5s ease-in-out infinite',
        'prism-shift':   'prismShift 12s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '33%':      { transform: 'translateY(-22px) rotate(0.6deg)' },
          '66%':      { transform: 'translateY(-10px) rotate(-0.6deg)' },
        },
        ambientPulse: {
          '0%, 100%': { opacity: '0.35', transform: 'scale(1)' },
          '50%':      { opacity: '0.65', transform: 'scale(1.1)' },
        },
        auroraDrift: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) rotate(0deg)', opacity: '0.55' },
          '33%':      { transform: 'translate3d(4%, -3%, 0) rotate(2deg)', opacity: '0.85' },
          '66%':      { transform: 'translate3d(-3%, 2%, 0) rotate(-1.5deg)', opacity: '0.7' },
        },
        grain: {
          '0%':   { transform: 'translate(0, 0)' },
          '20%':  { transform: 'translate(3%, 2%)' },
          '40%':  { transform: 'translate(2%, -1%)' },
          '60%':  { transform: 'translate(1%, -2%)' },
          '80%':  { transform: 'translate(3%, -3%)' },
          '100%': { transform: 'translate(0, 0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        marqueeReverse: {
          '0%': { transform: 'translateX(-50%)' },
          '100%': { transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        prismShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%':      { backgroundPosition: '100% 50%' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(28px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 22px rgba(212,165,116,0.15)' },
          '50%':      { boxShadow: '0 0 60px rgba(212,165,116,0.35), 0 0 110px rgba(184,168,212,0.18)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'soft':         '0 4px 24px rgba(7,6,17,0.35)',
        'glass':        '0 8px 32px rgba(7,6,17,0.45), inset 0 1px 0 rgba(245,237,224,0.06)',
        'glass-hover':  '0 18px 56px rgba(7,6,17,0.55), inset 0 1px 0 rgba(245,237,224,0.10)',
        'champagne-glow': '0 0 36px rgba(212,165,116,0.22)',
        'prism-glow':     '0 0 48px rgba(184,168,212,0.18), 0 0 24px rgba(232,199,160,0.15)',
      },
    },
  },
  plugins: [],
}
