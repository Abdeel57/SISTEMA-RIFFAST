import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAdminSurface } from '@/components/ui/surface';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] select-none',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
        // CTA de marca (igual que .btn-verde de la landing): verde vivo con texto noche.
        brand: 'bg-brand-electric text-brand-ink hover:bg-brand shadow-lg shadow-brand-electric/30',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/85',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        success: 'bg-emerald-600 text-white hover:bg-emerald-700',
      },
      size: {
        default: 'h-11 px-5 py-2',
        sm: 'h-9 rounded-lg px-3 text-xs',
        lg: 'h-12 px-8 text-base rounded-2xl',
        xl: 'h-14 px-8 text-base rounded-2xl',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

// Botón del ADMINISTRADOR (estética Apple). Tres niveles por pantalla:
//   primario   → default / brand / success: relleno verde (uno por vista).
//   secundario → secondary / outline: tono suave del verde.
//   de texto   → ghost / link: solo texto en verde.
// Misma altura (50 px; 44 px el compacto), radio de 12 px y espaciado en todo
// el panel. Estados: presionado (se hunde), foco (anillo), deshabilitado y
// cargando (spinner + texto, p. ej. «Guardando…», sin permitir doble toque).
const adminButtonVariants = cva(
  'rf-press inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold outline-none focus-visible:ring-2 focus-visible:ring-rf-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-40 aria-busy:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-rf-accent text-white active:bg-rf-accent-pressed',
        brand: 'bg-rf-accent text-white active:bg-rf-accent-pressed',
        success: 'bg-rf-accent text-white active:bg-rf-accent-pressed',
        secondary: 'bg-rf-accent/10 text-rf-accent active:bg-rf-accent/[0.16]',
        outline: 'bg-rf-accent/10 text-rf-accent active:bg-rf-accent/[0.16]',
        destructive: 'bg-rf-danger text-white',
        ghost: 'bg-transparent text-rf-accent active:bg-rf-accent/10',
        link: 'h-auto bg-transparent px-0 text-rf-accent underline-offset-4 active:opacity-60',
      },
      size: {
        default: 'h-[50px] px-5 text-body',
        lg: 'h-[50px] px-6 text-body',
        xl: 'h-[50px] px-6 text-body',
        sm: 'h-11 px-4 text-callout',
        icon: 'h-11 w-11 text-body',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  /** Texto mientras carga (p. ej. «Guardando…»). Si no se da, se conserva el texto. */
  loadingText?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, loadingText, children, disabled, ...props }, ref) => {
    const admin = useAdminSurface();
    const Comp = asChild ? Slot : 'button';
    const classes = admin
      ? cn(adminButtonVariants({ variant, size }), className)
      : cn(buttonVariants({ variant, size, className }));
    return (
      <Comp
        className={classes}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className={cn('animate-spin', admin ? 'h-[18px] w-[18px]' : 'h-4 w-4')} />
            {loadingText ?? children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants, adminButtonVariants };
