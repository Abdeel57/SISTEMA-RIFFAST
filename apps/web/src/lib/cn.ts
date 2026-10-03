import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge debe conocer los tokens propios de tailwind.config.ts; si no,
// p. ej. toma `text-body` (tamaño) por un color y borra el `text-white` del botón.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['title', 'heading', 'body', 'callout', 'caption'] }],
      shadow: [{ shadow: ['card', 'raised', 'float', 'sheet'] }],
    },
    theme: {
      borderRadius: ['control', 'card', 'sheet'],
      spacing: ['gutter', 'navbar', 'tabbar'],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
