import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, FileText, FileBarChart, Receipt, Ticket, Users } from 'lucide-react';
import { RAFFLE_STATUS_LABELS } from '@riffast/shared';
import type { RaffleDTO } from '@riffast/shared';
import { raffleService } from '@/services/raffles';
import { reportService, type ReportType, type ReportFormat } from '@/services/payments';
import { ApiError } from '@/lib/api';
import { PanelIntro } from '@/components/owner/PanelKit';
import { IconTile, ListGroup } from '@/components/owner/List';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLoader, EmptyState, ErrorState } from '@/components/ui/misc';
import { toast } from 'sonner';

const REPORT_TYPES: { type: ReportType; label: string; icon: typeof Receipt }[] = [
  { type: 'orders', label: 'Órdenes', icon: Receipt },
  { type: 'tickets', label: 'Boletos', icon: Ticket },
  { type: 'buyers', label: 'Compradores', icon: Users },
];

function RaffleReportCard({ raffle }: { raffle: RaffleDTO }) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const download = async (type: ReportType, format: ReportFormat) => {
    const key = `${type}-${format}`;
    setDownloading(key);
    try {
      await reportService.download(raffle.id, type, format, raffle.eventLabel);
      toast.success('Reporte descargado');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo descargar el reporte');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <ListGroup
      header={
        <span className="flex items-center justify-between gap-2 normal-case tracking-normal">
          <span className="truncate">
            <span className="font-semibold text-rf-label">{raffle.eventLabel}</span> · {raffle.title}
          </span>
          <Badge variant="muted">{RAFFLE_STATUS_LABELS[raffle.status]}</Badge>
        </span>
      }
      footer={`${raffle.soldCount.toLocaleString('es-MX')} pagados · ${raffle.reservedCount.toLocaleString('es-MX')} apartados`}
    >
      {REPORT_TYPES.map(({ type, label, icon: Icon }) => (
        <div key={type} className="flex min-h-[56px] items-center gap-3 px-4 py-2">
          <IconTile icon={Icon} />
          <span className="min-w-0 flex-1 truncate text-body text-rf-label">{label}</span>
          <Button
            variant="secondary"
            size="sm"
            className="px-3"
            disabled={downloading !== null}
            loading={downloading === `${type}-excel`}
            onClick={() => download(type, 'excel')}
            aria-label={`Descargar ${label} en Excel`}
          >
            {downloading !== `${type}-excel` && <FileSpreadsheet className="h-[18px] w-[18px]" />}
            Excel
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="px-3"
            disabled={downloading !== null}
            loading={downloading === `${type}-pdf`}
            onClick={() => download(type, 'pdf')}
            aria-label={`Descargar ${label} en PDF`}
          >
            {downloading !== `${type}-pdf` && <FileText className="h-[18px] w-[18px]" />}
            PDF
          </Button>
        </div>
      ))}
    </ListGroup>
  );
}

export default function Reports() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['raffles', 'list'],
    queryFn: () => raffleService.list(),
  });
  const raffles = data?.items ?? [];

  if (isLoading) return <PageLoader label="Cargando tus reportes..." />;

  return (
    <div>
      <PanelIntro description="Descarga la información de tus rifas en Excel o PDF." />

      {isError ? (
        <ErrorState title="No pudimos cargar tus rifas" onRetry={() => void refetch()} retrying={isFetching} />
      ) : raffles.length === 0 ? (
        <EmptyState
          icon={<FileBarChart />}
          title="Aún no tienes rifas"
          description="Crea tu primera rifa para empezar a generar reportes."
        />
      ) : (
        <div>
          {raffles.map((raffle) => (
            <RaffleReportCard key={raffle.id} raffle={raffle} />
          ))}
        </div>
      )}
    </div>
  );
}
