import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Info, Plus, Trash2, Upload } from 'lucide-react';
import { paymentMethodSchema, PHONE_COUNTRIES, type PaymentMethodInput } from '@riffast/shared';
import { riferoService } from '@/services/riferos';
import { ApiError } from '@/lib/api';
import { PanelIntro, PANEL_CARD, StickyBar } from '@/components/owner/PanelKit';
import { ListGroup, ToggleRow } from '@/components/owner/List';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PageLoader, ErrorState } from '@/components/ui/misc';
import { BankCard } from '@/components/public/BankCard';
import { BANKS, detectBank } from '@/lib/banks';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';

const MAX_METHODS = 6;

const emptyMethod = (): PaymentMethodInput => ({
  id: (crypto.randomUUID?.() ?? `m${Date.now()}`).slice(0, 13),
  bank: '',
  holderName: '',
  clabe: '',
  cardNumber: '',
  handle: '',
  concept: '',
  instructions: '',
});

// Editor de UN método: vista previa en vivo de la tarjeta del banco + campos.
function MethodEditor({
  method,
  index,
  onChange,
  onRemove,
}: {
  method: PaymentMethodInput;
  index: number;
  onChange: (m: PaymentMethodInput) => void;
  onRemove: () => void;
}) {
  const set = (k: keyof PaymentMethodInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...method, [k]: e.target.value });

  // Los monederos de EE. UU. (Zelle, Cash App, Venmo, PayPal) no cobran a una
  // CLABE ni a una tarjeta, sino a un usuario: el editor cambia los campos según
  // el método que escriba el rifero.
  const theme = detectBank(method.bank);
  const wallet = theme.handleLabel;
  const id = (k: string) => `${k}-${method.id}`;

  return (
    <section className={cn(PANEL_CARD, 'p-4 sm:p-5')} aria-label={`Método de pago ${index + 1}`}>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-callout font-semibold text-rf-secondary">Método {index + 1}</p>
        <button
          type="button"
          onClick={onRemove}
          className="-mr-2 inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-callout font-semibold text-rf-danger outline-none transition-opacity active:opacity-50 focus-visible:ring-2 focus-visible:ring-rf-accent/45"
        >
          <Trash2 className="h-4 w-4" /> Quitar
        </button>
      </div>

      {/* Vista previa en vivo */}
      <div className="mx-auto mb-5 max-w-sm">
        <BankCard
          method={{
            ...method,
            bank: method.bank || 'Tu banco',
            holderName: method.holderName || 'NOMBRE DEL TITULAR',
            instructions: null, // las instrucciones van abajo, no en la preview
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={id('bank')}>Banco o método</Label>
          <Input
            id={id('bank')}
            placeholder="BBVA, Banorte, OXXO, Nu…"
            list="riffast-banks"
            value={method.bank}
            onChange={set('bank')}
            autoComplete="off"
            enterKeyHint="next"
          />
          <p className="mt-1.5 text-caption text-rf-secondary">La tarjeta toma los colores del banco automáticamente.</p>
        </div>
        <div>
          <Label htmlFor={id('holder')}>Titular de la cuenta</Label>
          <Input
            id={id('holder')}
            placeholder="José Pérez García"
            value={method.holderName ?? ''}
            onChange={set('holderName')}
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="next"
          />
        </div>
        {wallet ? (
          <div className="sm:col-span-2">
            <Label htmlFor={id('handle')}>{wallet.es}</Label>
            <Input
              id={id('handle')}
              placeholder={theme.handlePlaceholder}
              value={method.handle ?? ''}
              onChange={set('handle')}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
            />
            <p className="mt-1.5 text-caption text-rf-secondary">Es a donde te van a enviar el dinero en {theme.name}.</p>
          </div>
        ) : (
          <>
            <div>
              <Label htmlFor={id('clabe')}>CLABE interbancaria</Label>
              <Input
                id={id('clabe')}
                inputMode="numeric"
                placeholder="18 dígitos"
                value={method.clabe ?? ''}
                onChange={set('clabe')}
                autoComplete="off"
                enterKeyHint="next"
              />
            </div>
            <div>
              <Label htmlFor={id('card')}>Número de tarjeta</Label>
              <Input
                id={id('card')}
                inputMode="numeric"
                placeholder="16 dígitos"
                value={method.cardNumber ?? ''}
                onChange={set('cardNumber')}
                autoComplete="off"
                enterKeyHint="next"
              />
            </div>
          </>
        )}
        <div>
          <Label htmlFor={id('concept')}>Concepto / referencia</Label>
          <Input
            id={id('concept')}
            placeholder="Ej. Rifa + tu folio"
            value={method.concept ?? ''}
            onChange={set('concept')}
            autoComplete="off"
            enterKeyHint="next"
          />
        </div>
        <div>
          <Label htmlFor={id('instr')}>Nota de este método (opcional)</Label>
          <Input
            id={id('instr')}
            placeholder="Ej. Solo depósitos en efectivo"
            value={method.instructions ?? ''}
            onChange={set('instructions')}
            autoComplete="off"
            enterKeyHint="done"
          />
        </div>
      </div>
    </section>
  );
}

export default function Payments() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['rifero', 'me'],
    queryFn: () => riferoService.me(),
  });
  const profile = data?.profile;
  const planAllowsProof = profile?.activePlan?.allowProofUpload ?? false;

  const [methods, setMethods] = useState<PaymentMethodInput[]>([]);
  const [payWhatsapp, setPayWhatsapp] = useState('');
  const [payWhatsappCountry, setPayWhatsappCountry] = useState<'MX' | 'US'>('MX');
  const [payWhatsappName, setPayWhatsappName] = useState('');
  const [payInstructions, setPayInstructions] = useState('');
  const [allowProofUpload, setAllowProofUpload] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!profile || loaded) return;
    // paymentMethods ya viene con el fallback legado sintetizado por el backend.
    setMethods(
      (profile.paymentMethods ?? []).map((m) => ({
        id: m.id === 'legacy' ? emptyMethod().id : m.id,
        bank: m.bank ?? '',
        holderName: m.holderName ?? '',
        clabe: m.clabe ?? '',
        cardNumber: m.cardNumber ?? '',
        handle: m.handle ?? '',
        concept: m.concept ?? '',
        instructions: m.instructions ?? '',
      })),
    );
    setPayWhatsapp(profile.payWhatsapp ?? '');
    setPayWhatsappCountry(profile.payWhatsappCountry === 'US' ? 'US' : 'MX');
    setPayWhatsappName(profile.payWhatsappName ?? '');
    setPayInstructions(profile.payInstructions ?? '');
    setAllowProofUpload(planAllowsProof ? profile.allowProofUpload : false);
    setLoaded(true);
  }, [profile, planAllowsProof, loaded]);

  const touch = () => setDirty(true);

  const mutation = useMutation({
    mutationFn: () => {
      const first = methods[0];
      return riferoService.update({
        paymentMethods: methods,
        payWhatsapp,
        payWhatsappCountry,
        payWhatsappName,
        payInstructions,
        ...(planAllowsProof ? { allowProofUpload } : {}),
        // Espejo del primer método en los campos legados (compatibilidad).
        payBank: first?.bank ?? '',
        payHolderName: first?.holderName ?? '',
        payClabe: first?.clabe ?? '',
        payCardNumber: first?.cardNumber ?? '',
        payConcept: first?.concept ?? '',
      });
    },
    onSuccess: (res) => {
      toast.success('Datos de pago guardados');
      queryClient.setQueryData(['rifero', 'me'], res);
      void queryClient.invalidateQueries({ queryKey: ['rifero', 'me'] });
      setDirty(false);
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : 'Algo salió mal');
    },
  });

  const save = () => {
    for (let i = 0; i < methods.length; i++) {
      const r = paymentMethodSchema.safeParse(methods[i]);
      if (!r.success) {
        toast.error(`Método ${i + 1}: ${r.error.issues[0]?.message ?? 'datos inválidos'}`);
        return;
      }
    }
    mutation.mutate();
  };

  if (isLoading) return <PageLoader label="Cargando tus datos de pago..." />;
  if (isError && !profile) {
    return (
      <ErrorState title="No pudimos cargar tus datos de pago" onRetry={() => void refetch()} retrying={isFetching} />
    );
  }

  return (
    <div>
      <PanelIntro description="Configura cómo te van a pagar tus compradores." />

      {/* Sugerencias de bancos para el autocompletado */}
      <datalist id="riffast-banks">
        {BANKS.map((b) => (
          <option key={b.id} value={b.name} />
        ))}
      </datalist>

      <div className={cn(PANEL_CARD, 'mb-6 flex gap-3 p-4')}>
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-rf-accent" />
        <div>
          <p className="text-body font-semibold text-rf-label">El pago es directo a ti</p>
          <p className="mt-0.5 text-callout text-rf-secondary">
            El comprador te paga directamente con estos datos. Riffast no cobra ni procesa el dinero en esta versión: tú
            recibes el pago y confirmas la orden.
          </p>
        </div>
      </div>

      {/* ── Métodos de pago (tarjetas) ── */}
      <h2 className="mb-2 px-4 text-caption font-medium uppercase tracking-[0.02em] text-rf-secondary">Métodos de pago</h2>
      <div className="space-y-3">
        {methods.map((m, i) => (
          <MethodEditor
            key={m.id}
            method={m}
            index={i}
            onChange={(next) => {
              setMethods((arr) => arr.map((x) => (x.id === m.id ? next : x)));
              touch();
            }}
            onRemove={() => {
              setMethods((arr) => arr.filter((x) => x.id !== m.id));
              touch();
            }}
          />
        ))}

        {methods.length < MAX_METHODS && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              setMethods((arr) => [...arr, emptyMethod()]);
              touch();
            }}
          >
            <Plus className="h-5 w-5" />
            {methods.length === 0 ? 'Agregar mi primer método de pago' : 'Agregar otro método'}
          </Button>
        )}
      </div>

      {/* ── Generales ── */}
      <ListGroup header="Para todos los métodos" footer="Estos datos aplican sin importar a qué cuenta te paguen.">
        <div className="space-y-5 px-4 py-4">
          <div>
            <Label htmlFor="payWhatsapp">WhatsApp para enviar comprobantes</Label>
            {/* País + número: la bandera define la lada (+52/+1) del enlace de WhatsApp. */}
            <div className="flex gap-2">
              <div className="w-[124px] shrink-0">
                <Select
                  aria-label="País del número"
                  value={payWhatsappCountry}
                  onChange={(e) => {
                    setPayWhatsappCountry(e.target.value === 'US' ? 'US' : 'MX');
                    touch();
                  }}
                >
                  {PHONE_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} +{c.dialCode}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex-1">
                <Input
                  id="payWhatsapp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="55 1234 5678"
                  enterKeyHint="next"
                  value={payWhatsapp}
                  onChange={(e) => {
                    setPayWhatsapp(e.target.value);
                    touch();
                  }}
                />
              </div>
            </div>
            <p className="mt-1.5 text-caption text-rf-secondary">Si lo dejas vacío, se usa tu WhatsApp de contacto (Perfil).</p>
          </div>
          <div>
            <Label htmlFor="payWhatsappName">
              ¿Quién recibe los comprobantes? <span className="font-normal text-rf-secondary">(opcional)</span>
            </Label>
            <Input
              id="payWhatsappName"
              maxLength={60}
              placeholder="Ej. Karen"
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="next"
              value={payWhatsappName}
              onChange={(e) => {
                setPayWhatsappName(e.target.value);
                touch();
              }}
            />
            <p className="mt-1.5 text-caption text-rf-secondary">El comprador verá a quién le está escribiendo al enviar su pago.</p>
          </div>
          <div>
            <Label htmlFor="payInstructions">Instrucciones generales de pago</Label>
            <Textarea
              id="payInstructions"
              rows={3}
              placeholder="Ej. Realiza tu transferencia y envíame el comprobante por WhatsApp para confirmar tus boletos."
              value={payInstructions}
              onChange={(e) => {
                setPayInstructions(e.target.value);
                touch();
              }}
            />
          </div>
        </div>
      </ListGroup>

      {/* Comprobantes en la plataforma */}
      <ListGroup
        header="Comprobantes en la plataforma"
        footer={!planAllowsProof ? 'Mejora tu plan para que tus compradores suban su comprobante en la plataforma.' : undefined}
      >
        <ToggleRow
          id="allowProofUploadPay"
          icon={Upload}
          title="Subir comprobante en su orden"
          description={
            planAllowsProof
              ? 'Si lo activas, el comprador podrá adjuntar la foto de su pago.'
              : 'Tu plan actual no incluye esta función.'
          }
          checked={allowProofUpload}
          onCheckedChange={(v) => {
            setAllowProofUpload(v);
            touch();
          }}
          disabled={!planAllowsProof}
          switchLabel="Permitir subir comprobante"
        />
      </ListGroup>

      {/* Barra de guardar fija, pegada al fondo del área de scroll del panel. */}
      <StickyBar dirty={dirty}>
        <Button
          type="button"
          className="w-full"
          loading={mutation.isPending}
          loadingText="Guardando…"
          disabled={!dirty || mutation.isPending}
          onClick={save}
        >
          Guardar datos de pago
        </Button>
      </StickyBar>
    </div>
  );
}
