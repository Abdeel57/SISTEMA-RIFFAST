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
      aria-label={title}
      className="grid h-11 min-w-11 shrink-0 place-items-center rounded-[10px] px-1.5 text-rf-label outline-none transition-colors active:bg-rf-fill-strong focus-visible:ring-2 focus-visible:ring-rf-accent/45"
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
    <div className="overflow-hidden rounded-control bg-rf-fill transition-shadow focus-within:ring-2 focus-within:ring-rf-accent/40">
      {/* Barra de formato: dos filas (formato y colores) que se desplazan de lado
          si no caben, en vez de crecer a cuatro renglones en celular. */}
      <div role="toolbar" aria-label="Formato del texto" className="border-b border-rf-separator px-1">
        <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto">
        <ToolBtn title="Negrita" onAction={() => exec('bold')}>
          <Bold className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn title="Cursiva" onAction={() => exec('italic')}>
          <Italic className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn title="Subrayado" onAction={() => exec('underline')}>
          <Underline className="h-4 w-4" />
        </ToolBtn>

        <span className="mx-1 h-6 w-px shrink-0 bg-rf-separator" />

        <ToolBtn title="Alinear a la izquierda" onAction={() => exec('justifyLeft')}>
          <AlignLeft className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn title="Centrar" onAction={() => exec('justifyCenter')}>
          <AlignCenter className="h-4 w-4" />
        </ToolBtn>

        <span className="mx-1 h-6 w-px shrink-0 bg-rf-separator" />

        {SIZES.map((s, i) => (
          <ToolBtn key={s.value} title={['Texto chico', 'Texto normal', 'Texto grande'][i]} onAction={() => exec('fontSize', s.value)}>
            <span style={{ fontSize: `${0.7 + i * 0.28}rem`, lineHeight: 1, fontWeight: 800 }}>{s.label}</span>
          </ToolBtn>
        ))}

        <span className="mx-1 h-6 w-px shrink-0 bg-rf-separator" />

        <ToolBtn title="Quitar formato" onAction={() => exec('removeFormat')}>
          <Eraser className="h-4 w-4" />
        </ToolBtn>
      </div>

        <div className="no-scrollbar flex items-center overflow-x-auto border-t border-rf-separator">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={`Color ${c}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec('foreColor', c)}
              className="group grid h-11 w-11 shrink-0 place-items-center outline-none"
              aria-label={`Color ${c}`}
            >
              <span
                className="block h-6 w-6 rounded-full ring-1 ring-black/10 transition-transform group-active:scale-90 group-focus-visible:ring-2 group-focus-visible:ring-rf-accent"
                style={{ backgroundColor: c }}
              />
            </button>
          ))}
        </div>
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
        className={cn('rt-editor min-h-[170px] px-4 py-3 text-body text-rf-label outline-none')}
      />
    </div>
  );
}
