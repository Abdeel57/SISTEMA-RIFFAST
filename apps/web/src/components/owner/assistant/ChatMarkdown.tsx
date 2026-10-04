import { Fragment, type ReactNode } from 'react';

// Markdown mínimo y SEGURO para las respuestas del asistente: negritas, listas
// y links. Se arma con elementos de React (nunca innerHTML), así que cualquier
// HTML que venga en el texto se muestra escapado. Los links internos
// (/admin/...) navegan con el router y cierran la hoja.

interface Props {
  text: string;
  onInternalLink: (path: string) => void;
}

const INLINE = /(\*\*[^*\n]+\*\*)|(\[[^\]\n]+\]\([^)\s]+\))|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?¡¿"'])/g;

function linkFor(url: string, label: ReactNode, key: string, onInternalLink: (p: string) => void): ReactNode {
  const cls = 'font-semibold text-rf-accent underline decoration-rf-accent/40 underline-offset-2';
  if (url.startsWith('/admin')) {
    return (
      <button key={key} type="button" className={cls} onClick={() => onInternalLink(url)}>
        {label}
      </button>
    );
  }
  if (/^https?:\/\//i.test(url) || (url.startsWith('/') && !url.startsWith('//'))) {
    return (
      <a key={key} href={url} target="_blank" rel="noopener noreferrer" className={`${cls} break-all`}>
        {label}
      </a>
    );
  }
  // Cualquier otro esquema (javascript:, data:…) se muestra como texto.
  return <Fragment key={key}>{label}</Fragment>;
}

function inline(text: string, keyBase: string, onInternalLink: (p: string) => void): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const key = `${keyBase}-${i++}`;
    if (m[1]) {
      out.push(
        <strong key={key} className="font-semibold">
          {m[1].slice(2, -2)}
        </strong>,
      );
    } else if (m[2]) {
      const [, label, url] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(m[2]) ?? [];
      out.push(linkFor(url ?? '', label ?? m[2], key, onInternalLink));
    } else if (m[3]) {
      out.push(linkFor(m[3], m[3], key, onInternalLink));
    }
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block = { kind: 'p'; lines: string[] } | { kind: 'ul' | 'ol'; items: string[] };

function blocks(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const last = out[out.length - 1];
    if (ul || ol) {
      const kind = ul ? 'ul' : 'ol';
      const item = (ul ?? ol)![1];
      if (last && last.kind === kind) last.items.push(item);
      else out.push({ kind, items: [item] });
    } else if (!line.trim()) {
      out.push({ kind: 'p', lines: [] });
    } else if (last && last.kind === 'p' && last.lines.length) {
      last.lines.push(line);
    } else {
      out.push({ kind: 'p', lines: [line] });
    }
  }
  return out.filter((b) => (b.kind === 'p' ? b.lines.length > 0 : b.items.length > 0));
}

export function ChatMarkdown({ text, onInternalLink }: Props) {
  return (
    <div className="space-y-2 break-words">
      {blocks(text).map((b, bi) => {
        if (b.kind === 'p') {
          return (
            <p key={bi}>
              {b.lines.map((l, li) => (
                <Fragment key={li}>
                  {li > 0 && <br />}
                  {inline(l, `${bi}-${li}`, onInternalLink)}
                </Fragment>
              ))}
            </p>
          );
        }
        const List = b.kind === 'ul' ? 'ul' : 'ol';
        return (
          <List key={bi} className={b.kind === 'ul' ? 'list-disc space-y-1 pl-5' : 'list-decimal space-y-1 pl-5'}>
            {b.items.map((it, ii) => (
              <li key={ii}>{inline(it, `${bi}-${ii}`, onInternalLink)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
