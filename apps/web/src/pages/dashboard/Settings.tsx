import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Upload, Trophy, Sparkles, Users, Languages, Timer, RefreshCcw } from 'lucide-react';
import { updateRiferoSchema } from '@riffast/shared';
import { riferoService } from '@/services/riferos';
import { ApiError } from '@/lib/api';
import { PanelIntro, StickyBar, ChoiceChips } from '@/components/owner/PanelKit';
import { ListGroup, ListRow, ToggleRow } from '@/components/owner/List';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PageLoader, ErrorState } from '@/components/ui/misc';
import { PushToggle } from '@/components/owner/PushToggle';
import { toast } from 'sonner';

const settingsSchema = updateRiferoSchema.pick({
  defaultReserveMinutes: true,
  allowProofUpload: true,
  autoReleaseExpired: true,
  showWinners: true,
  useDigitalDraw: true,
  facebookPixelId: true,
  facebookDomainVerification: true,
  locale: true,
  currency: true,
});
type SettingsForm = z.infer<typeof settingsSchema>;

// Atajos de tiempo de apartado: escribir "1440" en un teléfono es tedioso.
const RESERVE_PRESETS = [
  { label: '1 hora', value: 60 },
  { label: '2 horas', value: 120 },
  { label: '6 horas', value: 360 },
  { label: '24 horas', value: 1440 },
  { label: '3 días', value: 4320 },
];

function humanMinutes(min: number): string {
  if (!min || Number.isNaN(min)) return '';
  if (min < 60) return `${min} minuto${min === 1 ? '' : 's'}`;
  if (min < 1440) {
    const h = Math.round((min / 60) * 10) / 10;
    return `${h} hora${h === 1 ? '' : 's'}`;
  }
  const d = Math.round((min / 1440) * 10) / 10;
  return `${d} día${d === 1 ? '' : 's'}`;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const profileQuery = useQuery({
    queryKey: ['rifero-me'],
    queryFn: riferoService.me,
  });
  const profile = profileQuery.data?.profile;
  const planAllowsProof = profile?.activePlan?.allowProofUpload ?? false;

  // Por defecto el tiempo de apartado solo aplica a rifas NUEVAS. Si se activa,
  // al guardar se sincroniza también con las rifas ya creadas (DRAFT/PUBLISHED).
  const [applyReserveToExisting, setApplyReserveToExisting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      defaultReserveMinutes: 120,
      allowProofUpload: false,
      autoReleaseExpired: true,
      showWinners: true,
      useDigitalDraw: false,
      facebookPixelId: '',
      facebookDomainVerification: '',
      locale: 'es',
      currency: 'MXN',
    },
  });

  useEffect(() => {
    if (profile) {
      reset({
        defaultReserveMinutes: profile.defaultReserveMinutes,
        allowProofUpload: profile.allowProofUpload,
        autoReleaseExpired: profile.autoReleaseExpired,
        showWinners: profile.showWinners,
        useDigitalDraw: profile.useDigitalDraw,
        facebookPixelId: profile.facebookPixelId ?? '',
        facebookDomainVerification: profile.facebookDomainVerification ?? '',
        locale: profile.locale,
        currency: profile.currency,
      });
    }
  }, [profile, reset]);

  const updateMutation = useMutation({
    mutationFn: (values: SettingsForm & { applyReserveToExisting?: boolean }) => riferoService.update(values),
    onSuccess: (res) => {
      toast.success(applyReserveToExisting ? 'Ajustes guardados y aplicados a tus rifas' : 'Ajustes guardados');
      void queryClient.invalidateQueries({ queryKey: ['rifero-me'] });
      void queryClient.invalidateQueries({ queryKey: ['raffles'] });
      setApplyReserveToExisting(false);
      reset({
        defaultReserveMinutes: res.profile.defaultReserveMinutes,
        allowProofUpload: res.profile.allowProofUpload,
        autoReleaseExpired: res.profile.autoReleaseExpired,
        showWinners: res.profile.showWinners,
        useDigitalDraw: res.profile.useDigitalDraw,
        facebookPixelId: res.profile.facebookPixelId ?? '',
        facebookDomainVerification: res.profile.facebookDomainVerification ?? '',
        locale: res.profile.locale,
        currency: res.profile.currency,
      });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Algo salió mal'),
  });

  const onSubmit = (values: SettingsForm) => {
    updateMutation.mutate({
      ...values,
      allowProofUpload: planAllowsProof ? values.allowProofUpload : false,
      applyReserveToExisting,
    });
  };

  if (profileQuery.isLoading) {
    return <PageLoader label="Cargando tus ajustes..." />;
  }
  if (profileQuery.isError && !profile) {
    return (
      <ErrorState
        title="No pudimos cargar tus ajustes"
        onRetry={() => void profileQuery.refetch()}
        retrying={profileQuery.isFetching}
      />
    );
  }

  const reserveNow = humanMinutes(Number(watch('defaultReserveMinutes')));

  return (
    <div>
      <PanelIntro description="Ajustes que se aplican por defecto a tus nuevas rifas." />

      {/* Acceso a Usuarios y Roles (administradores y vendedores). */}
      <ListGroup header="Equipo">
        <ListRow
          icon={Users}
          title="Usuarios y Roles"
          subtitle="Da acceso a administradores y vendedores, con su link de venta y métricas."
          onClick={() => navigate('/admin/usuarios')}
        />
      </ListGroup>

      {/* Avisos push del rifero (este dispositivo). El comprador no recibe push. */}
      <PushToggle />

      <form onSubmit={handleSubmit(onSubmit)}>
        <ListGroup header="Apartado">
          <div className="px-4 py-3">
            <Label htmlFor="defaultReserveMinutes" className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-rf-secondary" />
              Minutos para apartar un boleto
            </Label>
            <ChoiceChips
              label="Tiempos rápidos"
              options={RESERVE_PRESETS}
              value={watch('defaultReserveMinutes')}
              onChange={(v) => setValue('defaultReserveMinutes', v, { shouldDirty: true })}
            />
            <Input
              id="defaultReserveMinutes"
              type="number"
              inputMode="numeric"
              min={5}
              max={10080}
              enterKeyHint="done"
              className="mt-3"
              aria-invalid={!!errors.defaultReserveMinutes}
              {...register('defaultReserveMinutes', { valueAsNumber: true })}
            />
            <p className="mt-1.5 text-caption text-rf-secondary">
              Tiempo que un comprador tiene para pagar antes de que su apartado expire.
              {reserveNow && (
                <>
                  {' '}
                  Ahora: <span className="font-semibold text-rf-label">{reserveNow}</span>.
                </>
              )}
            </p>
            {errors.defaultReserveMinutes && (
              <p role="alert" className="mt-1.5 text-callout text-rf-danger">
                {errors.defaultReserveMinutes.message}
              </p>
            )}
          </div>
          {/* Por defecto el tiempo solo aplica a rifas nuevas. Este toggle lo
              sincroniza también con las rifas ya creadas (publicadas/borrador). */}
          <ToggleRow
            id="applyReserveToExisting"
            title="Aplicar también a mis rifas activas"
            description="Normalmente este tiempo solo aplica a rifas nuevas. Actívalo para actualizar también las que ya tienes publicadas o en borrador."
            checked={applyReserveToExisting}
            onCheckedChange={setApplyReserveToExisting}
          />
          {/* Interruptor maestro: liberar (o no) los boletos cuando vence el apartado. */}
          <Controller
            control={control}
            name="autoReleaseExpired"
            render={({ field }) => (
              <ToggleRow
                id="autoReleaseExpired"
                icon={RefreshCcw}
                title="Liberar boletos automáticamente"
                description={
                  <>
                    Cuando un apartado vence sin pago, sus boletos se liberan solos. Desactívalo para que{' '}
                    <strong className="font-semibold text-rf-label">nada se libere automáticamente</strong>: los
                    apartados no expiran y tú decides cuándo liberarlos.
                  </>
                }
                checked={field.value ?? true}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </ListGroup>

        <ListGroup header="Compras y ganadores">
          <Controller
            control={control}
            name="allowProofUpload"
            render={({ field }) => (
              <ToggleRow
                id="allowProofUpload"
                icon={Upload}
                title="Permitir subir comprobantes"
                description="Los compradores podrán adjuntar su comprobante de pago."
                checked={planAllowsProof ? !!field.value : false}
                onCheckedChange={field.onChange}
                disabled={!planAllowsProof}
                note={!planAllowsProof ? 'Tu plan actual no incluye esta función.' : undefined}
              />
            )}
          />
          <Controller
            control={control}
            name="showWinners"
            render={({ field }) => (
              <ToggleRow
                id="showWinners"
                icon={Trophy}
                title="Mostrar ganadores"
                description="Publica a los ganadores en tu página pública."
                checked={!!field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="useDigitalDraw"
            render={({ field }) => (
              <ToggleRow
                id="useDigitalDraw"
                icon={Sparkles}
                title="Usar sorteo digital"
                description="Realiza el sorteo dentro de Riffast de forma transparente."
                checked={!!field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </ListGroup>

        {/* ── Modo USA: idioma de lo que ve el comprador + moneda de cobro ── */}
        <ListGroup
          header="Modo USA"
          footer={
            <>
              El <strong className="font-semibold">título, la descripción, los términos y las preguntas frecuentes</strong>{' '}
              los escribes tú: si activas el modo USA, reescríbelos en inglés desde Rifas y Perfil. En Datos de pago ya
              puedes agregar Zelle, Cash App, Venmo y PayPal.
            </>
          }
        >
          <Controller
            control={control}
            name="locale"
            render={({ field }) => (
              <ToggleRow
                id="locale"
                icon={Languages}
                title="Modo USA (página en inglés)"
                description="Todo lo que ve el comprador pasa a inglés: la página, el boleto digital, los mensajes de WhatsApp y los correos. Las rifas se llaman giveaways. Tu panel sigue en español."
                checked={field.value === 'en'}
                onCheckedChange={(v) => {
                  field.onChange(v ? 'en' : 'es');
                  // La moneda acompaña al modo, pero se puede cambiar abajo.
                  setValue('currency', v ? 'USD' : 'MXN', { shouldDirty: true });
                }}
              />
            )}
          />
          <div className="px-4 py-3">
            <Label htmlFor="currency">Moneda de tus boletos</Label>
            <Select id="currency" {...register('currency')}>
              <option value="MXN">🇲🇽 Pesos mexicanos (MXN)</option>
              <option value="USD">🇺🇸 Dólares (USD)</option>
            </Select>
            <p className="mt-1.5 text-caption text-rf-secondary">
              Con la que cobras. Cambia cómo se ven los precios en tu página, en los correos y en el boleto digital.{' '}
              <strong className="font-semibold text-rf-label">No convierte cantidades</strong>: si cambias a dólares, un
              boleto de 50 pasa a costar 50 dólares.
            </p>
          </div>
        </ListGroup>

        {/* Pixel de Facebook (Meta): mide tus anuncios en la página pública. */}
        <ListGroup header="Meta (Facebook)">
          <div className="space-y-2 px-4 py-3">
            <Label htmlFor="facebookPixelId" className="mb-0">
              Pixel de Facebook
            </Label>
            <p className="text-caption text-rf-secondary">
              Pega el <strong className="font-semibold text-rf-label">ID del pixel</strong> que aparece en Meta Events
              Manager (solo números). Mide a los visitantes de tu página pública para tus anuncios. Déjalo vacío para no
              cargar ningún pixel.
            </p>
            <Input
              id="facebookPixelId"
              inputMode="numeric"
              placeholder="1234567890123456"
              autoComplete="off"
              enterKeyHint="next"
              aria-invalid={!!errors.facebookPixelId}
              {...register('facebookPixelId')}
            />
            {errors.facebookPixelId && (
              <p role="alert" className="text-callout text-rf-danger">
                {errors.facebookPixelId.message}
              </p>
            )}
            <p className="text-caption text-rf-secondary">
              Se registran: visitas <em>(PageView)</em>, ver una rifa <em>(ViewContent)</em>, elegir boletos{' '}
              <em>(AddToCart)</em>, abrir el formulario <em>(InitiateCheckout)</em> y, al dar clic en APARTAR,{' '}
              <strong className="font-semibold text-rf-label">Completar registro</strong> <em>(CompleteRegistration)</em>:
              ese es el evento de conversión con el que debes optimizar tus anuncios.
            </p>
            <p className="text-caption text-rf-secondary">
              La compra no se reporta como <em>Purchase</em> a propósito: el pago es manual y tú lo confirmas después,
              así que reportarlo como venta inflaría tus resultados y Meta optimizaría mal.
            </p>
          </div>
          <div className="space-y-2 px-4 py-3">
            <Label htmlFor="facebookDomainVerification" className="mb-0">
              Código de verificación del dominio
            </Label>
            <p className="text-caption text-rf-secondary">
              Es la <strong className="font-semibold text-rf-label">meta etiqueta</strong> con la que Meta comprueba que
              este sitio es tuyo. Sácala en Business Manager → Configuración del negocio → Seguridad de la marca →{' '}
              <strong className="font-semibold text-rf-label">Dominios</strong> → agrega tu dominio → «Verificación por
              meta etiqueta». Puedes pegar la etiqueta completa: se guarda solo el código.
            </p>
            <Input
              id="facebookDomainVerification"
              placeholder="ej. k8s2m1p9v3x7…"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              aria-invalid={!!errors.facebookDomainVerification}
              {...register('facebookDomainVerification')}
            />
            {errors.facebookDomainVerification && (
              <p role="alert" className="text-callout text-rf-danger">
                {errors.facebookDomainVerification.message}
              </p>
            )}
            <p className="text-caption text-rf-secondary">
              Sin esto no puedes reclamar tu dominio en Meta, y las conversiones de usuarios de iPhone se miden mal. Al
              guardar, la etiqueta tarda <strong className="font-semibold text-rf-label">hasta un minuto</strong> en
              aparecer en tu página; luego vuelve a Meta y pulsa «Verificar».
            </p>
          </div>
        </ListGroup>

        {/* Barra de guardar fija: siempre a la mano. */}
        <StickyBar dirty={isDirty || applyReserveToExisting}>
          <Button
            type="submit"
            className="w-full"
            loading={updateMutation.isPending}
            loadingText="Guardando…"
            disabled={!isDirty && !applyReserveToExisting}
          >
            Guardar cambios
          </Button>
        </StickyBar>
      </form>
    </div>
  );
}
