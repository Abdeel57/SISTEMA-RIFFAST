// Sanitizador de HTML para la descripción/cartel del rifero (texto enriquecido).
// Permite solo formato de texto seguro (negritas, color, alineación, listas) y
// elimina scripts, handlers on*, enlaces, imágenes, etc. Evita XSS al renderizar
// contenido del usuario con dangerouslySetInnerHTML.

const ALLOWED_TAGS = new Set([
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'S',
  'BR',
  'DIV',
  'P',
  'SPAN',
  'FONT',
  'UL',
  'OL',
  'LI',
  'H3',
  'H4',
]);

const ALLOWED_STYLE_PROPS = new Set([
  'color',
  'background-color',
  'text-align',
  'font-weight',
  'font-style',
  'text-decoration',
  'font-size',
]);

function sanitizeStyle(value: string): string {
  return value
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .filter((decl) => {
      const i = decl.indexOf(':');
      if (i < 0) return false;
      const prop = decl.slice(0, i).trim().toLowerCase();
      const val = decl.slice(i + 1).trim().toLowerCase();
      if (!ALLOWED_STYLE_PROPS.has(prop)) return false;
      if (/url\(|expression|javascript:|@import/.test(val)) return false;
      return true;
    })
    .join('; ');
}

function clean(node: Element): void {
  for (const el of Array.from(node.children)) {
    const tag = el.tagName.toUpperCase();
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME') {
      el.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      // Tag no permitido: conserva su texto/hijos (ya saneados) y quita el envoltorio.
      clean(el);
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name === 'style') {
        const safe = sanitizeStyle(attr.value);
        if (safe) el.setAttribute('style', safe);
        else el.removeAttribute('style');
      } else if (tag === 'FONT' && (name === 'color' || name === 'size')) {
        // <font color/size> que produce execCommand: permitido.
      } else {
        el.removeAttribute(attr.name);
      }
    }
    clean(el);
  }
}

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';
  const doc = new DOMParser().parseFromString(`<div>${dirty}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return '';
  clean(root);
  return root.innerHTML;
}

// ¿El contenido trae etiquetas HTML (editor enriquecido) o es texto plano (legado)?
export function isRichHtml(s: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(s);
}
