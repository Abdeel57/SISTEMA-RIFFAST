import { useEffect } from 'react';

// Actualiza el título de la pestaña (mejora UX y compartir enlaces).
export function useDocumentTitle(title: string | undefined | null): void {
  useEffect(() => {
    if (!title) return;
    const prev = document.title;
    document.title = title;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
