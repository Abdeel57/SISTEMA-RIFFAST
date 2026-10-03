import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1280px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        // Paleta oficial Riffast (landing riffast): verde de la suerte sobre
        // blanco/papel y "noche" (verde casi negro), menta como acento.
        //   DEFAULT  → verde legible sobre blanco (texto, fondos con texto blanco).
        //   electric → verde vivo de los CTA (lleva texto `ink`, no blanco).
        brand: {
          DEFAULT: '#0A8F5A', // --verde-2
          electric: '#10C65F', // --verde
          clover: '#00B86B', // verde del trébol del logotipo
          deep: '#0B3D2E', // --bosque
          ink: '#03120C', // --noche
          sky: '#8DF7BC', // --menta
          mint: '#8DF7BC', // --menta
          paper: '#F1F5F2', // --papel
          gold: '#F5A623', // ámbar puntual (premios); no es color de identidad
          dark: '#0B2219', // --noche-2
        },
        // Estados de boleto (TicketGrid)
        ticket: {
          available: '#22c55e',
          reserved: '#eab308',
          pending: '#f97316',
          paid: '#3b82f6',
          held: '#111827',
          cancelled: '#9ca3af',
          winner: '#d4af37',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Georgia', 'serif'],
        // Titulares de impacto (hero): grotesca expandida, ancha y pesada.
        wide: ['"Archivo"', 'Inter', 'system-ui', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        ticket: ['"Space Mono"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { transform: 'translateY(12px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
        reveal: { from: { opacity: '0', transform: 'translateY(28px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        'float-slow': { '0%,100%': { transform: 'translateY(0) rotate(-6deg)' }, '50%': { transform: 'translateY(-14px) rotate(-6deg)' } },
        glow: { '0%,100%': { opacity: '0.55' }, '50%': { opacity: '1' } },
        shimmer: { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
        'spin-prize': { to: { transform: 'rotate(360deg)' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'fade-in-fast': { from: { opacity: '0' }, to: { opacity: '1' } },
        shine: {
          '0%': { transform: 'translateX(-100%)' },
          '60%, 100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'slide-up': 'slide-up 0.4s ease-out',
        'spin-slow': 'spin-slow 3s linear infinite',
        reveal: 'reveal 0.7s cubic-bezier(0.16,1,0.3,1) both',
        marquee: 'marquee 28s linear infinite',
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float-slow 8s ease-in-out infinite',
        glow: 'glow 4s ease-in-out infinite',
        shimmer: 'shimmer 6s linear infinite',
        'slide-in-right': 'slide-in-right 0.3s cubic-bezier(0.16,1,0.3,1)',
        'fade-in-fast': 'fade-in-fast 0.2s ease-out',
        shine: 'shine 3.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
