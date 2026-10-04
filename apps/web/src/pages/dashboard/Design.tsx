import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Upload, Trash2, Check, Loader2 } from 'lucide-react';
import { riferoService } from '@/services/riferos';
import { uploadService, type UploadFolder } from '@/services/uploads';
import { ApiError, apiAssetUrl } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { PageLoader, Spinner, ErrorState } from '@/components/ui/misc';
import { ToggleRow } from '@/components/owner/List';
import { VerifiedBadge } from '@/components/brand/VerifiedBadge';
import { RiferoTheme } from '@/components/brand/RiferoTheme';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';

const TEMPLATES = [
  { value: 'classic', label: 'Clásico' },
  { value: 'moderno', label: 'Moderno' },
];
const DEFAULT_PRIMARY = '#0A8F5A';
const DEFAULT_SECONDARY = '#0f172a';

interface DesignState {
  publicName: string;
  logoUrl: string;
  coverUrl: string;
  primaryColor: string;
  secondaryColor: string;
  templateKey: string;
  logoScale: number;
  logoGlow: boolean;
  publicDarkMode: boolean;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function ImageUploader({
  label,
  value,
  folder,
  aspect,
  onChange,
}: {
  label: string;
  value: string;
  folder: UploadFolder;
  aspect: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona una imagen válida');
      return;
    }
    setUploading(true);
    try {
      const { url } = await uploadService.image(file, folder);
      onChange(url);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo subir la imagen');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className={cn('relative grid w-full place-items-center overflow-hidden rounded-card bg-rf-fill', aspect)}>
        {value ? (
          <img src={apiAssetUrl(value)} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-rf-tertiary">
            <ImagePlus className="h-7 w-7" />
            <span className="text-caption">Sin imagen</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 grid place-items-center bg-white/70" role="status" aria-label="Subiendo imagen">
            <Spinner />
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="flex-1"
          disabled={uploading}
          loading={uploading}
          loadingText="Subiendo…"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-[18px] w-[18px]" />
          {value ? 'Cambiar' : 'Subir imagen'}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-rf-danger active:bg-rf-danger/10"
            disabled={uploading}
            onClick={() => onChange('')}
          >
            <Trash2 className="h-[18px] w-[18px]" />
            Quitar
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}

export default function Design() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['rifero', 'me'],
    queryFn: () => riferoService.me(),
  });
  const profile = data?.profile;

  const [state, setState] = useState<DesignState>({
    publicName: '',
    logoUrl: '',
    coverUrl: '',
    primaryColor: DEFAULT_PRIMARY,
    secondaryColor: DEFAULT_SECONDARY,
    templateKey: 'classic',
    logoScale: 100,
    logoGlow: false,
    publicDarkMode: false,
  });
  const [status, setStatus] = useState<SaveStatus>('idle');
  const initRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();
  // Último estado aún no confirmado por el servidor (debounce en curso o error).
  const pendingRef = useRef<DesignState | null>(null);

  useEffect(() => {
    if (profile && !initRef.current) {
      initRef.current = true;
      setState({
        publicName: profile.publicName ?? '',
        logoUrl: profile.logoUrl ?? '',
        coverUrl: profile.coverUrl ?? '',
        primaryColor: profile.primaryColor || DEFAULT_PRIMARY,
        secondaryColor: profile.secondaryColor || DEFAULT_SECONDARY,
        templateKey: profile.templateKey || 'classic',
        logoScale: profile.logoScale ?? 100,
        logoGlow: profile.logoGlow ?? false,
        publicDarkMode: profile.publicDarkMode ?? false,
      });
    }
  }, [profile]);

  // Guarda y actualiza la caché (la vista previa detrás se actualiza al instante).
  // `silent` se usa en el flush de salida: el componente ya no está en pantalla.
  const save = async (next: DesignState, silent = false) => {
    if (!silent) setStatus('saving');
    try {
      const res = await riferoService.update({
        publicName: next.publicName || undefined,
        logoUrl: next.logoUrl,
        coverUrl: next.coverUrl,
        primaryColor: next.primaryColor,
        secondaryColor: next.secondaryColor,
        templateKey: next.templateKey,
        logoScale: next.logoScale,
        logoGlow: next.logoGlow,
        publicDarkMode: next.publicDarkMode,
      });
      queryClient.setQueryData(['rifero', 'me'], res);
      // El tema de la página pública lo lee la query ['public-rifero']; invalidarla
      // hace que el cambio de modo oscuro se refleje sin recargar.
      void queryClient.invalidateQueries({ queryKey: ['public-rifero'] });
      pendingRef.current = null;
      if (!silent) {
        setStatus('saved');
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setStatus('idle'), 1800);
      }
    } catch (e) {
      if (!silent) {
        setStatus('error');
        toast.error(e instanceof ApiError ? e.message : 'No se pudo guardar. Revisa tu conexión.');
      }
    }
  };

  // Cambia un campo y programa el auto-guardado (debounce).
  const update = (patch: Partial<DesignState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      pendingRef.current = next;
      setStatus('saving');
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void save(next), 700);
      return next;
    });
  };

  const retry = () => {
    if (pendingRef.current) void save(pendingRef.current);
  };

  // Al salir de la pantalla con un guardado pendiente, dispararlo de inmediato
  // (antes el cleanup cancelaba el debounce y los últimos cambios se perdían).
  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      clearTimeout(savedTimerRef.current);
      if (pendingRef.current) void save(pendingRef.current, true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Si cierran o recargan la pestaña con cambios sin confirmar, avisar.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  if (isLoading) return <PageLoader label="Cargando apariencia..." />;

  if (isError && !profile) {
    return (
      <ErrorState title="No pudimos cargar tu apariencia" onRetry={() => void refetch()} retrying={isFetching} />
    );
  }

  const publicName = state.publicName || 'Tu nombre';

  return (
    <div>
      {/* Estado de guardado: píldora flotante siempre visible (sin repetir el
          título — el título grande ya dice "Apariencia"). */}
      <div className="pointer-events-none sticky top-2 z-20 -mb-9 flex h-9 justify-end" aria-live="polite">
        <span className="pointer-events-auto">
          <SaveIndicator status={status} onRetry={retry} />
        </span>
      </div>
      <p className="mb-5 pr-36 text-callout text-rf-secondary">
        Personaliza tu página. Se guarda solo mientras editas.
      </p>

      {/* Vista previa */}
      <Card className="mb-5 overflow-hidden">
        <CardContent className="p-3">
          <RiferoTheme primaryColor={state.primaryColor} secondaryColor={state.secondaryColor}>
            <div className="overflow-hidden rounded-control">
              <div
                className="relative h-24 w-full bg-cover bg-center"
                style={{
                  backgroundColor: 'var(--rifero-secondary)',
                  backgroundImage: state.coverUrl ? `url(${apiAssetUrl(state.coverUrl)})` : undefined,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </div>
              <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: 'var(--rifero-primary)', color: '#fff' }}>
                <div
                  className="flex shrink-0 items-center justify-center"
                  style={{
                    width: (48 * state.logoScale) / 100,
                    height: (48 * state.logoScale) / 100,
                    filter: state.logoGlow
                      ? 'drop-shadow(0 0 5px rgba(255,255,255,0.9)) drop-shadow(0 0 12px color-mix(in srgb, var(--rifero-primary) 45%, #ffffff))'
                      : undefined,
                  }}
                >
                  {state.logoUrl ? (
                    <img src={apiAssetUrl(state.logoUrl)} alt="Logo" className="h-full w-full object-contain" />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-lg font-black ring-2 ring-white/30">
                      {publicName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate text-base font-extrabold">{publicName}</h3>
                  {profile?.verified && <VerifiedBadge size={15} className="text-white" />}
                </div>
              </div>
            </div>
          </RiferoTheme>
        </CardContent>
      </Card>

      {/* Nombre */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Nombre público</CardTitle>
          <CardDescription>Así aparece el título de tu página.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            value={state.publicName}
            placeholder="Rifas Don José"
            aria-label="Nombre público"
            autoCapitalize="words"
            enterKeyHint="done"
            onChange={(e) => update({ publicName: e.target.value })}
          />
        </CardContent>
      </Card>

      {/* Imágenes */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Imágenes</CardTitle>
          <CardDescription>Tu logo y la portada.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <ImageUploader label="Logo" value={state.logoUrl} folder="logos" aspect="aspect-square max-w-[150px]" onChange={(url) => update({ logoUrl: url })} />
            <p className="mt-1.5 text-caption text-rf-secondary">
              Recomendado: <strong className="font-semibold text-rf-label">PNG con fondo transparente</strong> para que se
              vea sin recuadro.
            </p>
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="logoScale" className="mb-0">
                  Tamaño del logo
                </Label>
                <span className="text-callout font-semibold tabular-nums text-rf-secondary">{state.logoScale}%</span>
              </div>
              <input
                id="logoScale"
                type="range"
                min={50}
                max={250}
                step={5}
                value={state.logoScale}
                onChange={(e) => update({ logoScale: Number(e.target.value) })}
                className="mt-2 h-11 w-full cursor-pointer"
                style={{ accentColor: state.primaryColor }}
              />
            </div>
            <div className="-mx-4 mt-2 border-t border-rf-separator">
              <ToggleRow
                id="logoGlow"
                title="Glow detrás del logo"
                description="Halo de tu color de marca. Ideal para logos PNG con fondo transparente."
                checked={state.logoGlow}
                onCheckedChange={(v) => update({ logoGlow: v })}
              />
            </div>
          </div>
          <ImageUploader label="Portada" value={state.coverUrl} folder="covers" aspect="aspect-[16/9]" onChange={(url) => update({ coverUrl: url })} />
        </CardContent>
      </Card>

      {/* Colores y plantilla */}
      <Card>
        <CardHeader>
          <CardTitle>Colores y estilo</CardTitle>
          <CardDescription>Los colores de tu marca.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <ColorField label="Color principal" value={state.primaryColor} onChange={(v) => update({ primaryColor: v })} />
            <ColorField label="Color secundario" value={state.secondaryColor} onChange={(v) => update({ secondaryColor: v })} />
          </div>
          <div>
            <Label htmlFor="templateKey">Plantilla</Label>
            <Select id="templateKey" value={state.templateKey} onChange={(e) => update({ templateKey: e.target.value })}>
              {TEMPLATES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="-mx-4 border-t border-rf-separator">
            <ToggleRow
              id="publicDarkMode"
              title="Modo oscuro"
              description="Define cómo ven tu página los visitantes. Apagado = fondo claro (blanco)."
              checked={state.publicDarkMode}
              onCheckedChange={(v) => update({ publicDarkMode: v })}
              switchLabel="Modo oscuro de la página pública"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = `color-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2.5">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-[50px] w-16 shrink-0 cursor-pointer rounded-control border-0 bg-rf-fill p-1.5"
        />
        <span className="text-callout font-medium uppercase tabular-nums text-rf-secondary">{value}</span>
      </div>
    </div>
  );
}

function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status === 'saving')
    return (
      <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-rf-surface px-3 text-caption font-semibold text-rf-secondary shadow-raised">
        <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
      </span>
    );
  if (status === 'saved')
    return (
      <span className="rf-gem rf-gem-raised inline-flex h-9 shrink-0 animate-rf-fade-in items-center gap-1.5 rounded-full px-3 text-caption font-semibold">
        <Check className="h-4 w-4" /> Guardado
      </span>
    );
  if (status === 'error')
    return (
      <button
        type="button"
        onClick={onRetry}
        className="rf-press inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-rf-danger px-4 text-caption font-semibold text-white shadow-raised"
      >
        No se guardó · Reintentar
      </button>
    );
  // En reposo no se muestra nada: la descripción de la pantalla ya avisa
  // que el guardado es automático.
  return null;
}
