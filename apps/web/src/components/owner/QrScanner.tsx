import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, QrCode, ScanLine, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  createQrDetector,
  extractValidationCode,
  isBarcodeDetectorSupported,
} from '@/lib/pwa/barcode';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Escáner de QR para que el RIFERO valide boletos en el evento. Usa la API
 * nativa `BarcodeDetector` (sin dependencias). Si no está soportada o no hay
 * cámara, ofrece un fallback de captura manual del folio. Al detectar un QR
 * navega a `/validar/:code`.
 */
export function QrScanner({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const supported = isBarcodeDetectorSupported();

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const onFound = useCallback(
    (raw: string) => {
      const code = extractValidationCode(raw);
      if (!code) {
        toast.error('Ese código no parece un boleto válido.');
        return;
      }
      stop();
      onOpenChange(false);
      navigate(`/validar/${encodeURIComponent(code)}`);
    },
    [navigate, onOpenChange, stop],
  );

  useEffect(() => {
    if (!open || !supported) return;
    let cancelled = false;
    const detector = createQrDetector();
    if (!detector) {
      setError('No se pudo iniciar el lector de QR.');
      return;
    }

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0 && codes[0].rawValue) {
              onFound(codes[0].rawValue);
              return;
            }
          } catch {
            /* fotograma sin código: continuar */
          }
          rafRef.current = requestAnimationFrame(scan);
        };
        rafRef.current = requestAnimationFrame(scan);
      } catch {
        if (!cancelled) setError('No pudimos acceder a la cámara. Revisa los permisos.');
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, supported, onFound, stop]);

  // Cerrar libera la cámara.
  useEffect(() => {
    if (!open) stop();
  }, [open, stop]);

  const submitManual = () => {
    const code = extractValidationCode(manual);
    if (!code) {
      toast.error('Escribe un folio válido.');
      return;
    }
    onOpenChange(false);
    navigate(`/validar/${encodeURIComponent(code)}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Validar boleto
          </DialogTitle>
          <DialogDescription>
            {supported
              ? 'Apunta la cámara al código QR del boleto.'
              : 'Tu navegador no permite escanear con la cámara. Escribe el folio del boleto.'}
          </DialogDescription>
        </DialogHeader>

        {supported && !error && (
          <div className="relative overflow-hidden rounded-2xl bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="aspect-square w-full object-cover" playsInline muted />
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="h-2/3 w-2/3 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              <ScanLine className="absolute h-10 w-10 animate-pulse text-white/90" />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <Camera className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Fallback / alternativa: captura manual del folio */}
        <div className="flex flex-col gap-2">
          <label htmlFor="qr-manual" className="flex items-center gap-1.5 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            Folio del boleto
          </label>
          <div className="flex gap-2">
            <Input
              id="qr-manual"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Ej. ABC123"
              autoComplete="off"
              onKeyDown={(e) => e.key === 'Enter' && submitManual()}
            />
            <Button onClick={submitManual} disabled={!manual.trim()}>
              Validar
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
