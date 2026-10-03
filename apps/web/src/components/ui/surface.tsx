import { createContext, useContext } from 'react';

// Superficie en la que se pinta un componente compartido (botón, campo,
// diálogo…). El administrador la provee para que esos componentes tomen su
// estilo (estética Apple) y para que lo que se abre en portal —diálogos y
// hojas— se monte DENTRO del panel y herede sus tokens (`.rf-admin`).
// Sin proveedor = página pública: los componentes se ven como siempre.
interface Surface {
  kind: 'admin';
  /** Nodo del panel donde se montan los portales (null antes del primer render). */
  container: HTMLElement | null;
}

const SurfaceContext = createContext<Surface | null>(null);

export const SurfaceProvider = SurfaceContext.Provider;

/** Superficie del administrador sin nodo propio (login, pantallas de carga). */
export const ADMIN_SURFACE: Surface = { kind: 'admin', container: null };

/** ¿El componente se está pintando dentro del administrador? */
export function useAdminSurface(): boolean {
  return useContext(SurfaceContext)?.kind === 'admin';
}

/** Contenedor para portales (diálogos, hojas); undefined = <body>. */
export function usePortalContainer(): HTMLElement | undefined {
  return useContext(SurfaceContext)?.container ?? undefined;
}
