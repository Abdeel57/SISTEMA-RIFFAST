// Prompt del asistente (prompt.md) y guía del administrador (guia.md).
// El prompt se arma en dos partes: FIJA (cacheable) y CONTEXTO (cada mensaje).
import { readFileSync } from 'node:fs';

const PROMPT_FILE = new URL('./prompt.md', import.meta.url);
const GUIDE_FILE = new URL('./guia.md', import.meta.url);
export const PROMPT_SEPARATOR = '(— aquí termina la parte fija; lo de abajo es el contexto —)';

export interface FixedVars {
  MARCA: string;
  NOTA_IMAGENES: string;
  HORARIO_LLAMADAS: string;
}

export interface ContextVars {
  NOMBRE: string;
  ROL: string;
  URL_PAGINA: string;
  PLAN: string;
  TELEFONO: string;
  FECHA_HORA: string;
  ZONA: string;
  MONEDA: string;
  DATOS_PAGO: string;
  RIFAS: string;
}

export const NOTA_SIN_IMAGENES = '- Ahora mismo no puedes ver imágenes: si manda una foto, pídele que escriba los datos.';

// Los archivos se leen en cada uso: editar el .md no requiere reiniciar.
function readText(url: URL): string {
  return readFileSync(url, 'utf8').replace(/\r\n/g, '\n');
}

export function splitPrompt(text: string): { fijo: string; contexto: string } {
  const clean = text.replace(/^<!--[\s\S]*?-->\s*/, '');
  const idx = clean.indexOf(PROMPT_SEPARATOR);
  if (idx < 0) throw new Error(`prompt.md: falta la línea separadora "${PROMPT_SEPARATOR}"`);
  return {
    fijo: clean.slice(0, idx).trim(),
    contexto: clean.slice(idx + PROMPT_SEPARATOR.length).trim(),
  };
}

export function fillTemplate(template: string, vars: object): string {
  const values = vars as Record<string, string>;
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match,
  );
}

export function buildSystemPrompt(fixed: FixedVars, context: ContextVars, text = readText(PROMPT_FILE)): { fijo: string; variable: string } {
  const { fijo, contexto } = splitPrompt(text);
  return {
    // Una línea vacía de NOTA_IMAGENES no debe dejar huecos dobles.
    fijo: fillTemplate(fijo, fixed).replace(/\n{3,}/g, '\n\n'),
    variable: fillTemplate(contexto, context),
  };
}

// ── Guía del administrador ───────────────────────────────────────────
export const GUIDE_TOPICS = [
  'primeros_pasos',
  'rifas',
  'boletos',
  'ordenes',
  'datos_pago',
  'promociones',
  'sorteo',
  'pagina',
  'equipo',
  'ajustes',
  'reportes',
  'vender',
  'problemas',
] as const;
export type GuideTopic = (typeof GUIDE_TOPICS)[number];

// Secciones "## clave" de guia.md, con la marca ya rellenada.
export function parseGuide(text: string, marca: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const parts = text.replace(/\r\n/g, '\n').split(/^## ([a-z_]+)[ \t]*$/m);
  for (let i = 1; i < parts.length; i += 2) {
    sections[parts[i]] = fillTemplate(parts[i + 1].trim(), { MARCA: marca });
  }
  return sections;
}

export function guideSection(topic: string, marca: string, text = readText(GUIDE_FILE)): string | null {
  return parseGuide(text, marca)[topic] ?? null;
}

export function readGuideText(): string {
  return readText(GUIDE_FILE);
}
