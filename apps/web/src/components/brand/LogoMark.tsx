import { cn } from '@/lib/cn';
import cloverUrl from '@/assets/riffast-clover.svg';

// Símbolo oficial de Riffast: el trébol de cuatro boletos (verde #00B86B sobre
// transparente). Se lee bien tanto en superficies claras como oscuras, así que
// por defecto va a color:
//   variant="color" → trébol verde de marca (default).
//   variant="white" → trébol blanco (sobre fondos verdes o fotos).
export function LogoMark({
  className,
  variant = 'color',
}: {
  className?: string;
  variant?: 'color' | 'white';
}) {
  return (
    <img
      src={cloverUrl}
      alt="Riffast"
      draggable={false}
      className={cn(
        'block h-8 w-8 select-none object-contain',
        variant === 'white' && 'brightness-0 invert',
        className,
      )}
    />
  );
}
