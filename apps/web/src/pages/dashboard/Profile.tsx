import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Copy, Eye, Plus, Trash2, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import {
  updateRiferoSchema,
  DEFAULT_FAQS,
  PHONE_COUNTRIES,
  type FaqItemDTO,
  type RiferoProfileDTO,
} from '@riffast/shared';
import { riferoService } from '@/services/riferos';
import { ApiError } from '@/lib/api';
import { PanelIntro, StickyBar, IconButton } from '@/components/owner/PanelKit';
import { ListGroup, ListRow } from '@/components/owner/List';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLoader, ErrorState } from '@/components/ui/misc';
import { VerifiedBadge } from '@/components/brand/VerifiedBadge';
import { toast } from 'sonner';

// Sólo los campos públicos editables en esta pantalla (el nombre se edita en Apariencia).
const profileFormSchema = updateRiferoSchema.pick({
  description: true,
  whatsapp: true,
  whatsappCountry: true,
  whatsappName: true,
  facebook: true,
  instagram: true,
  tiktok: true,
});
type ProfileForm = z.infer<typeof profileFormSchema>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-callout text-rf-danger">
      {message}
    </p>
  );
}

export default function Profile() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['rifero', 'me'],
    queryFn: () => riferoService.me(),
  });
  const profile = data?.profile;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      description: '',
      whatsapp: '',
      whatsappCountry: 'MX',
      whatsappName: '',
      facebook: '',
      instagram: '',
      tiktok: '',
    },
  });

  useEffect(() => {
    if (profile) {
      reset({
        description: profile.description ?? '',
        whatsapp: profile.whatsapp ?? '',
        whatsappCountry: profile.whatsappCountry === 'US' ? 'US' : 'MX',
        whatsappName: profile.whatsappName ?? '',
        facebook: profile.facebook ?? '',
        instagram: profile.instagram ?? '',
        tiktok: profile.tiktok ?? '',
      });
    }
  }, [profile, reset]);

  const mutation = useMutation({
    mutationFn: (values: ProfileForm) => riferoService.update(values),
    onSuccess: (res) => {
      toast.success('Perfil actualizado');
      queryClient.setQueryData(['rifero', 'me'], res);
      void queryClient.invalidateQueries({ queryKey: ['rifero', 'me'] });
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : 'Algo salió mal');
    },
  });

  // Single-tenant: la página pública del rifero es la raíz del propio dominio.
  const publicUrl = window.location.origin.replace(/^https?:\/\//, '');

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      toast.success('Enlace copiado');
    } catch {
      toast.error('No se pudo copiar el enlace');
    }
  };

  if (isLoading) return <PageLoader label="Cargando tu perfil..." />;
  if (isError && !profile) {
    return <ErrorState title="No pudimos cargar tu perfil" onRetry={() => void refetch()} retrying={isFetching} />;
  }

  const socialInput = { autoComplete: 'off', autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false } as const;

  return (
    <div>
      <PanelIntro description="Estos son los datos que verán tus compradores en tu página de rifas." />

      {/* Página pública + verificación */}
      <ListGroup header="Tu página pública" footer="Comparte este enlace para que la gente compre tus boletos.">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="min-w-0 flex-1 py-1.5">
            <p className="truncate text-body font-medium text-rf-label">{publicUrl}</p>
            {profile?.verified && (
              <Badge variant="info" className="mt-1">
                <VerifiedBadge size={14} />
                Verificado
              </Badge>
            )}
          </div>
          <IconButton icon={Copy} label="Copiar enlace" tone="accent" onClick={copyUrl} />
        </div>
        <ListRow icon={Eye} iconTone="neutral" title="Ver mi página" href="/" external />
      </ListGroup>

      {/* Formulario de datos públicos */}
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))}>
        <ListGroup header="Datos públicos">
          <div className="space-y-5 px-4 py-4">
            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="Cuéntale a la gente quién eres y por qué confiar en tus rifas."
                aria-invalid={!!errors.description}
                {...register('description')}
              />
              <FieldError message={errors.description?.message} />
            </div>

            <div>
              <Label htmlFor="whatsapp">WhatsApp de contacto</Label>
              {/* País + número: la bandera define la lada (+52/+1) con la que se
                  arman los enlaces de WhatsApp de toda la página pública. */}
              <div className="flex gap-2">
                <div className="w-[124px] shrink-0">
                  <Select aria-label="País del número" {...register('whatsappCountry')}>
                    {PHONE_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} +{c.dialCode}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex-1">
                  <Input
                    id="whatsapp"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="55 1234 5678"
                    enterKeyHint="next"
                    aria-invalid={!!errors.whatsapp}
                    {...register('whatsapp')}
                  />
                </div>
              </div>
              <FieldError message={errors.whatsapp?.message} />
              <p className="mt-1.5 text-caption text-rf-secondary">
                Aquí te escribirán tus compradores. Si tu número es de USA, elige 🇺🇸 +1.
              </p>
            </div>

            <div>
              <Label htmlFor="whatsappName">
                ¿Quién atiende este WhatsApp? <span className="font-normal text-rf-secondary">(opcional)</span>
              </Label>
              <Input
                id="whatsappName"
                maxLength={60}
                placeholder="Ej. Karen"
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="next"
                aria-invalid={!!errors.whatsappName}
                {...register('whatsappName')}
              />
              <FieldError message={errors.whatsappName?.message} />
              <p className="mt-1.5 text-caption text-rf-secondary">
                Se muestra en tu página («Te atiende Karen») y en el saludo del mensaje que te envían.
              </p>
            </div>
          </div>
        </ListGroup>

        <ListGroup header="Redes sociales" footer="Opcional. Pega el enlace o usuario de cada red.">
          <div className="space-y-5 px-4 py-4">
            <div>
              <Label htmlFor="facebook">Facebook</Label>
              <Input
                id="facebook"
                inputMode="url"
                placeholder="facebook.com/turifa"
                enterKeyHint="next"
                aria-invalid={!!errors.facebook}
                {...socialInput}
                {...register('facebook')}
              />
              <FieldError message={errors.facebook?.message} />
            </div>
            <div>
              <Label htmlFor="instagram">Instagram</Label>
              <Input
                id="instagram"
                placeholder="@turifa"
                enterKeyHint="next"
                aria-invalid={!!errors.instagram}
                {...socialInput}
                {...register('instagram')}
              />
              <FieldError message={errors.instagram?.message} />
            </div>
            <div>
              <Label htmlFor="tiktok">TikTok</Label>
              <Input
                id="tiktok"
                placeholder="@turifa"
                enterKeyHint="done"
                aria-invalid={!!errors.tiktok}
                {...socialInput}
                {...register('tiktok')}
              />
              <FieldError message={errors.tiktok?.message} />
            </div>
          </div>
        </ListGroup>

        {/* Barra de guardar fija mientras se edita el formulario. */}
        <StickyBar dirty={isDirty} className="mb-0 lg:mb-0">
          <Button
            type="submit"
            className="w-full"
            loading={mutation.isPending}
            loadingText="Guardando…"
            disabled={!isDirty || mutation.isPending}
          >
            Guardar cambios
          </Button>
        </StickyBar>
      </form>

      {/* Preguntas frecuentes (sección independiente con su propio guardar) */}
      {profile && <FaqEditor profile={profile} />}
    </div>
  );
}

// ── Editor de preguntas frecuentes ───────────────────────────
// Las preguntas de la sección "Preguntas frecuentes" de la página pública.
// Mientras el rifero no guarde las suyas se muestran las de fábrica
// (DEFAULT_FAQS), que también precargan este editor como punto de partida.
function FaqEditor({ profile }: { profile: RiferoProfileDTO }) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<FaqItemDTO[]>(() =>
    profile.faqs.length > 0 ? profile.faqs.map((f) => ({ ...f })) : DEFAULT_FAQS.map((f) => ({ ...f })),
  );
  const [dirty, setDirty] = useState(false);

  const save = useMutation({
    mutationFn: (faqs: FaqItemDTO[]) => riferoService.update({ faqs }),
    onSuccess: (res) => {
      toast.success('Preguntas frecuentes guardadas');
      queryClient.setQueryData(['rifero', 'me'], res);
      void queryClient.invalidateQueries({ queryKey: ['rifero', 'me'] });
      setDirty(false);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudieron guardar las preguntas'),
  });

  const update = (i: number, patch: Partial<FaqItemDTO>) => {
    setItems((cur) => cur.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
    setDirty(true);
  };
  const remove = (i: number) => {
    setItems((cur) => cur.filter((_, idx) => idx !== i));
    setDirty(true);
  };
  const move = (i: number, dir: -1 | 1) => {
    setItems((cur) => {
      const next = [...cur];
      const j = i + dir;
      if (j < 0 || j >= next.length) return cur;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
    setDirty(true);
  };
  const add = () => {
    setItems((cur) => [...cur, { q: '', a: '' }]);
    setDirty(true);
  };
  const restoreDefaults = () => {
    setItems(DEFAULT_FAQS.map((f) => ({ ...f })));
    setDirty(true);
  };

  const invalid = items.some((f) => f.q.trim().length < 3 || f.a.trim().length < 3);

  const submit = () => {
    if (invalid) {
      toast.error('Completa la pregunta y la respuesta de cada elemento (o elimínalo).');
      return;
    }
    save.mutate(items.map((f) => ({ q: f.q.trim(), a: f.a.trim() })));
  };

  return (
    <ListGroup
      header="Preguntas frecuentes"
      footer="Aparecen al final de tu página pública. Puedes editarlas, reordenarlas o agregar nuevas (máximo 10)."
      className="mt-8"
    >
      <div className="space-y-3 px-4 py-4">
        {items.length === 0 && (
          <p className="rounded-control bg-rf-fill p-4 text-center text-callout text-rf-secondary">
            Sin preguntas propias: tu página mostrará las preguntas de fábrica.
          </p>
        )}
        {items.map((f, i) => (
          <div key={i} className="rounded-control bg-rf-fill/60 p-3 ring-1 ring-inset ring-rf-separator">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-callout font-semibold tabular-nums text-rf-secondary">Pregunta {i + 1}</span>
              <div className="flex items-center">
                <IconButton
                  icon={ChevronUp}
                  label="Subir"
                  tone="accent"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                />
                <IconButton
                  icon={ChevronDown}
                  label="Bajar"
                  tone="accent"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                />
                <IconButton
                  icon={Trash2}
                  label="Eliminar pregunta"
                  tone="accent"
                  className="text-rf-danger active:bg-rf-danger/10"
                  onClick={() => remove(i)}
                />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor={`faq-q-${i}`}>Pregunta</Label>
                <Input
                  id={`faq-q-${i}`}
                  value={f.q}
                  maxLength={120}
                  placeholder="¿Cómo participo?"
                  className="bg-rf-surface"
                  enterKeyHint="next"
                  onChange={(e) => update(i, { q: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={`faq-a-${i}`}>Respuesta</Label>
                <Textarea
                  id={`faq-a-${i}`}
                  rows={2}
                  value={f.a}
                  maxLength={600}
                  placeholder="Explica el paso a paso con tus palabras."
                  className="bg-rf-surface"
                  onChange={(e) => update(i, { a: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={add} disabled={items.length >= 10}>
            <Plus className="h-[18px] w-[18px]" />
            Agregar pregunta
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={restoreDefaults}>
            <RotateCcw className="h-[18px] w-[18px]" />
            Restaurar predeterminadas
          </Button>
        </div>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          loading={save.isPending}
          loadingText="Guardando…"
          disabled={!dirty || save.isPending}
          onClick={submit}
        >
          Guardar preguntas
        </Button>
      </div>
    </ListGroup>
  );
}
