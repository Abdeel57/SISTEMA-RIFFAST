import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CircleAlert, KeyRound, MessageCircle } from 'lucide-react';
import { loginSchema, buildWhatsappLink, type LoginInput } from '@riffast/shared';
import { authService } from '@/services/auth';
import { useAuthStore } from '@/store/auth';
import { ApiError } from '@/lib/api';
import { track, identify } from '@/lib/analytics';
import { playIntro, afterIntro } from '@/lib/intro';
import { webEnv } from '@/lib/env';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { LoginShell } from './LoginShell';
import { LoginField } from './LoginField';
import './login.css';

export default function Login() {
  useDocumentTitle('Inicia sesión');
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  // Error del servidor (usuario o contraseña incorrectos, sin conexión…):
  // se muestra junto al formulario, no en un aviso flotante que se pierde.
  const [serverError, setServerError] = useState<string | null>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  // «¿Olvidaste tu contraseña?» abre una ayuda breve dentro del boleto.
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { usuario: '', password: '' },
  });

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) => authService.login(input),
    onSuccess: ({ user }) => {
      // Entrada al panel con la intro de Riffast: tapa la transición y sale
      // cuando el panel ya cargó su perfil y métricas (ver lib/intro).
      playIntro();
      setUser(user);
      identify(user.id, { role: user.role });
      track('login_completed');
      afterIntro(() => toast.success(`¡Hola de nuevo, ${user.name.split(' ')[0]}!`));
      navigate('/admin/inicio', { replace: true });
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : 'No pudimos iniciar sesión. Revisa tu conexión e inténtalo de nuevo.');
    },
  });

  // Con el teclado abierto, mantener el botón «Iniciar sesión» a la vista: al
  // encogerse la ventana visible, se desplaza lo justo para mostrarlo.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement && active.form) {
        submitRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  // Al abrir la ayuda, que se vea completa (en celulares bajos queda abajo).
  useEffect(() => {
    if (!helpOpen) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    helpRef.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [helpOpen]);

  const usuarioField = register('usuario', { onChange: () => setServerError(null) });
  const passwordField = register('password', { onChange: () => setServerError(null) });

  // La contraseña nueva la da quien entregó el acceso: al vendedor, el
  // administrador de la página; al administrador, Riffast (por WhatsApp, solo
  // si el número está configurado).
  const riffastWa = webEnv.riffastWhatsapp
    ? buildWhatsappLink(
        webEnv.riffastWhatsapp,
        `¡Hola Riffast! 👋 Olvidé mi contraseña del administrador de ${window.location.host}.`,
      )
    : null;

  return (
    <LoginShell>
      <h1 id="login-title" className="text-heading text-rf-label">
        Inicia sesión
      </h1>
      <p className="mt-1 text-balance text-callout text-rf-secondary">Entra al administrador de tu página de rifas.</p>

      <form
        onSubmit={handleSubmit((data) => {
          setServerError(null);
          loginMutation.mutate(data);
        })}
        className="mt-5"
        noValidate
        aria-labelledby="login-title"
      >
        <LoginField
          id="usuario"
          label="Usuario"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          error={errors.usuario?.message}
          aria-invalid={!!errors.usuario}
          aria-describedby={errors.usuario ? 'usuario-error' : undefined}
          {...usuarioField}
          onKeyDown={(e) => {
            // «Siguiente» del teclado: pasar a la contraseña en vez de enviar.
            if (e.key === 'Enter') {
              e.preventDefault();
              setFocus('password');
            }
          }}
        />

        <LoginField
          id="password"
          label="Contraseña"
          password
          className="mt-3"
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          error={errors.password?.message}
          aria-invalid={!!errors.password || !!serverError}
          aria-describedby={errors.password ? 'password-error' : serverError ? 'login-error' : undefined}
          {...passwordField}
        />

        {serverError && (
          <p
            id="login-error"
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-control bg-[#FDEEEF] px-3.5 py-3 text-callout font-medium text-rf-danger"
          >
            <CircleAlert aria-hidden className="mt-px h-5 w-5 shrink-0" />
            {serverError}
          </p>
        )}

        <Button
          ref={submitRef}
          type="submit"
          className="rf-login-submit mt-5 h-[52px] w-full scroll-mb-16 rounded-full shadow-[0_1px_2px_rgb(16_41_31/0.12)] focus-visible:ring-rf-accent"
          loading={loginMutation.isPending}
          loadingText="Iniciando sesión…"
        >
          Iniciar sesión
        </Button>

        <button
          type="button"
          onClick={() => setHelpOpen((open) => !open)}
          aria-expanded={helpOpen}
          aria-controls="ayuda"
          className="rf-login-forgot rf-login-ring"
        >
          ¿Olvidaste tu contraseña?
        </button>
        <div id="ayuda" ref={helpRef} hidden={!helpOpen} className="rf-login-help">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-rf-accent/10 text-rf-accent">
            <KeyRound aria-hidden className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-callout font-semibold text-rf-label">Pide una contraseña nueva</p>
            <p className="mt-0.5 text-callout text-[#5E5E63]">
              Si eres vendedor, pídesela al administrador de tu página. Si eres el administrador, escríbele a Riffast.
            </p>
            {riffastWa && (
              <a href={riffastWa} target="_blank" rel="noopener noreferrer" className="rf-login-wa rf-login-ring">
                <MessageCircle aria-hidden className="h-[18px] w-[18px]" />
                Escribir a Riffast
              </a>
            )}
          </div>
        </div>
      </form>
    </LoginShell>
  );
}
