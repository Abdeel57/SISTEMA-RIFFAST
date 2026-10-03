import { apiUpload, apiDownload } from '@/lib/api';
import type { PaymentProofDTO } from '@bismark/shared';

export const paymentService = {
  uploadProof: (orderCode: string, file: File) =>
    apiUpload<{ proof: PaymentProofDTO }>(`/public/orders/${orderCode}/proof`, file),
};

export type ReportType = 'orders' | 'tickets' | 'buyers';
export type ReportFormat = 'excel' | 'pdf';

export const reportService = {
  download: (raffleId: string, type: ReportType, format: ReportFormat, eventLabel: string) => {
    const ext = format === 'excel' ? 'xlsx' : 'pdf';
    const names: Record<ReportType, string> = { orders: 'ordenes', tickets: 'boletos', buyers: 'compradores' };
    return apiDownload(
      `/reports/raffles/${raffleId}/${type}`,
      `${names[type]}-${eventLabel}.${ext}`,
      { format },
    );
  },
};
