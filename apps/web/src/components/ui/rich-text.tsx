import { useEffect, useRef } from 'react';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, Eraser } from 'lucide-react';
import { sanitizeHtml } from '@/lib/sanitizeHtml';
import { cn } from '@/lib/cn';

// Paleta de colores para el cartel (texto enriquecido de la descripción).
const COLORS = ['#111827', '#16a34a', '#dc2626', '#2563eb', '#d97706', '#7c3aed', '#0891b2', '#db2777'];
const SIZES: { label: string; value: string }[] = [
  { label: 'A', value: '2' },
  { label: 'A', value: '4' },
  { label: 'A', value: '6' },
];

function ToolBtn({
  onAction,
  title,
  children,
}: {
  onAction: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      // mousedown: no soltar la selección del editor al hacer clic en la herramienta.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onAction}
      className="grid h-8 min-w-8 place-items-center rounded-md px-1.5 text-sm text-foreground transition-colors hover:bg-muted"
    >
      {children}
    </button>
  );
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

// Mini editor de texto enriquecido (negritas, color, alineación, tamaño).
export function RichTextEditor({ value, onChange, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Carga el valor externo (al abrir o al cargar la rifa) sin pisar el cursor al escribir.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const safe = sanitizeHtml(value || '');
    if (document.activeElement !== el && el.innerHTML !== safe) {
      el.innerHTML = safe;
    }
  }, [value]);

  const emit = () => onChange(ref.current?.innerHTML ?? '');

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    try {
      document.execCommand('styleWithCSS', false, 'true');
    } catch {
      /* algunos navegadores no lo soportan; no pasa nada */
    }
    document.execCommand(cmd, false, val);
    emit();
  };

  return (
    <div className="overflow-hidden rounded-xl border">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1.5">
        <ToolBtn title="Negrita" onAction={() => exec('bold')}>
          <Bold className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn title="Cursiva" onAction={() => exec('italic')}>
          <Italic className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn title="Subrayado" onAction={() => exec('underline')}>
          <Underline className="h-4 w-4" />
        </ToolBtn>

        <span className="mx-1 h-5 w-px bg-border" />

        <ToolBtn title="Alinear a la izquierda" onAction={() => exec('justifyLeft')}>
          <AlignLeft className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn title="Centrar" onAction={() => exec('justifyCenter')}>
          <AlignCenter className="h-4 w-4" />
        </ToolBtn>

        <span className="mx-1 h-5 w-px bg-border" />

        {SIZES.map((s, i) => (
          <ToolBtn key={s.value} title={['Texto chico', 'Texto normal', 'Texto grande'][i]} onAction={() => exec('fontSize', s.value)}>
            <span style={{ fontSize: `${0.7 + i * 0.28}rem`, lineHeight: 1, fontWeight: 800 }}>{s.label}</span>
          </ToolBtn>
        ))}

        <span className="mx-1 h-5 w-px bg-border" />

        <div className="flex flex-wrap items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={`Color ${c}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec('foreColor', c)}
              className="h-5 w-5 rounded-full border border-black/15 transition-transform hover:scale-110"
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>

        <span className="mx-1 h-5 w-px bg-border" />

        <ToolBtn title="Quitar formato" onAction={() => exec('removeFormat')}>
          <Eraser className="h-4 w-4" />
        </ToolBtn>
      </div>

      {/* Área editable */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        className={cn('rt-editor min-h-[170px] px-3 py-2.5 text-sm leading-relaxed outline-none')}
      />
    </div>
  );
}
