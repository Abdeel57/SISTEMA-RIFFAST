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
        // ── Administrador (estética Apple) ──────────────────────────
        // Tokens del panel del rifero, definidos como canales RGB en index.css
        // (:root) para admitir opacidad (`bg-rf-accent/10`). Solo los usa el
        // administrador; las páginas públicas siguen con su paleta.
        rf: {
          bg: 'rgb(var(--rf-bg) / <alpha-value>)', // fondo agrupado #F5F5F7
          surface: 'rgb(var(--rf-surface) / <alpha-value>)', // tarjetas
          label: 'rgb(var(--rf-label) / <alpha-value>)', // texto principal
          secondary: 'rgb(var(--rf-secondary) / <alpha-value>)', // texto secundario
          tertiary: 'rgb(var(--rf-tertiary) / <alpha-value>)', // marcadores, chevrons
          separator: 'rgb(var(--rf-separator) / <alpha-value>)', // líneas finas
          fill: 'rgb(var(--rf-fill) / <alpha-value>)', // campos sobre tarjeta
          'fill-strong': 'rgb(var(--rf-fill-strong) / <alpha-value>)', // campos sobre fondo
          accent: 'rgb(var(--rf-accent) / <alpha-value>)', // verde de marca (único acento)
          'accent-pressed': 'rgb(var(--rf-accent-pressed) / <alpha-value>)',
          danger: 'rgb(var(--rf-danger) / <alpha-value>)',
          warning: 'rgb(var(--rf-warning) / <alpha-value>)',
          info: 'rgb(var(--rf-info) / <alpha-value>)',
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
        // Administrador: controles 12, tarjetas 16, hojas 20.
        control: '12px',
        card: '16px',
        sheet: '20px',
      },
      // Escala tipográfica fija del administrador (una sola familia, Inter).
      fontSize: {
        title: ['34px', { lineHeight: '41px', letterSpacing: '-0.022em', fontWeight: '700' }],
        heading: ['22px', { lineHeight: '28px', letterSpacing: '-0.016em', fontWeight: '700' }],
        body: ['17px', { lineHeight: '24px', letterSpacing: '-0.011em' }],
        callout: ['15px', { lineHeight: '20px', letterSpacing: '-0.006em' }],
        caption: ['13px', { lineHeight: '18px', letterSpacing: '0' }],
      },
      spacing: {
        // Márgenes y medidas fijas del administrador.
        gutter: '16px', // margen lateral en celular
        navbar: '44px', // barra superior compacta
        tabbar: '49px', // barra de pestañas (sin la zona segura)
      },
      boxShadow: {
        // Sombras mínimas: la tarjeta se separa del fondo por color, no por sombra.
        card: '0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 1px rgba(0, 0, 0, 0.02)',
        raised: '0 4px 16px -6px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.04)',
        float: '0 10px 28px -8px rgba(0, 0, 0, 0.28), 0 2px 6px rgba(0, 0, 0, 0.10)',
        sheet: '0 -6px 28px rgba(0, 0, 0, 0.10)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '250ms',
      },
      transitionTimingFunction: {
        ios: 'cubic-bezier(0.32, 0.72, 0, 1)',
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
        // Administrador: hojas que suben desde abajo, diálogos y fundidos.
        'rf-sheet-in': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'rf-sheet-out': { from: { transform: 'translateY(0)' }, to: { transform: 'translateY(100%)' } },
        'rf-pop-in': {
          from: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.97)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        'rf-pop-out': {
          from: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
          to: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.97)' },
        },
        'rf-fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'rf-fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'rf-rise': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
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
        'rf-sheet-in': 'rf-sheet-in 250ms cubic-bezier(0.32, 0.72, 0, 1)',
        'rf-sheet-out': 'rf-sheet-out 200ms cubic-bezier(0.32, 0.72, 0, 1)',
        'rf-pop-in': 'rf-pop-in 200ms cubic-bezier(0.32, 0.72, 0, 1)',
        'rf-pop-out': 'rf-pop-out 150ms ease-in',
        'rf-fade-in': 'rf-fade-in 200ms ease-out',
        'rf-fade-out': 'rf-fade-out 150ms ease-in',
        'rf-rise': 'rf-rise 250ms cubic-bezier(0.32, 0.72, 0, 1) both',
      },
    },
  },
  plugins: [],
} satisfies Config;
