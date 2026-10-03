import type { PaymentMethodDTO } from '@bismark/shared';
import { BankCard } from '@/components/public/BankCard';

// Datos de pago del rifero (mismo shape en lookup y en la rifa).
export interface PaymentInfo {
  holderName: string | null;
  bank: string | null;
  clabe: string | null;
  cardNumber: string | null;
  concept: string | null;
  instructions: string | null;
  whatsapp: string | null;
  /** Varios métodos (tarjetas por banco). Si falta, se sintetiza uno con los campos planos. */
  methods?: PaymentMethodDTO[];
}

export const paymentHasData = (p: PaymentInfo): boolean =>
  !!(p.methods?.length || p.holderName || p.bank || p.clabe || p.cardNumber || p.concept || p.instructions);

// Lista de métodos a mostrar: los del rifero o, como compatibilidad, uno armado
// con los campos planos legados.
function methodsOf(p: PaymentInfo): PaymentMethodDTO[] {
  if (p.methods && p.methods.length > 0) return p.methods;
  if (p.holderName || p.bank || p.clabe || p.cardNumber) {
    return [
      {
        id: 'flat',
        bank: p.bank ?? 'Transferencia',
        holderName: p.holderName,
        clabe: p.clabe,
        cardNumber: p.cardNumber,
        concept: p.concept,
        instructions: null,
      },
    ];
  }
  return [];
}

// Métodos de pago del rifero como tarjetas bancarias (tematizadas por banco).
export function PaymentCard({ pay }: { pay: PaymentInfo }) {
  if (!paymentHasData(pay)) return null;
  const methods = methodsOf(pay);

  return (
    <div className="space-y-3.5">
      {methods.map((m) => (
        <BankCard key={m.id} method={m} />
      ))}

      {pay.instructions && (
        <p className="whitespace-pre-line rounded-xl bg-muted/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          {pay.instructions}
        </p>
      )}
    </div>
  );
}
