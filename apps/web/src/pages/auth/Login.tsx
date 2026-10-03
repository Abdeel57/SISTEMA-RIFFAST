import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CircleAlert } from 'lucide-react';
import { loginSchema, type LoginInput } from '@riffast/shared';
import { authService } from '@/services/auth';
import { useAuthStore } from '@/store/auth';
import { ApiError } from '@/lib/api';
import { track, identify } from '@/lib/analytics';
import { playIntro, afterIntro } from '@/lib/intro';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

// Campos blancos sobre el fondo gris de la pantalla.
const FIELD = 'bg-rf-surface shadow-card focus:shadow-none';

export default function Login() {
  useDocumentTitle('Inicia sesión');
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  // Error del servidor (usuario o contraseña incorrectos, sin conexión…):
  // se muestra junto al formulario, no en un aviso flotante que se pierde.
  const [serverError, setServerError] = useState<string | null>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

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

  const usuarioField = register('usuario', { onChange: () => setServerError(null) });
  const passwordField = register('password', { onChange: () => setServerError(null) });

  return (
    <AuthLayout>
      <h1 className="mt-8 text-title text-rf-label">Inicia sesión</h1>
      <p className="mt-1 text-body text-rf-secondary">Entra al administrador de tu página de rifas.</p>

      <form
        onSubmit={handleSubmit((data) => {
          setServerError(null);
          loginMutation.mutate(data);
        })}
        className="mt-8 space-y-5"
        noValidate
      >
        <div>
          <Label htmlFor="usuario">Usuario</Label>
          <Input
            id="usuario"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            placeholder="Tu usuario"
            className={FIELD}
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
          {errors.usuario && (
            <p id="usuario-error" role="alert" className="mt-1.5 text-callout text-rf-danger">
              {errors.usuario.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="password">Contraseña</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="Tu contraseña"
            className={FIELD}
            aria-invalid={!!errors.password || !!serverError}
            aria-describedby={errors.password ? 'password-error' : serverError ? 'login-error' : undefined}
            {...passwordField}
          />
          {errors.password && (
            <p id="password-error" role="alert" className="mt-1.5 text-callout text-rf-danger">
              {errors.password.message}
            </p>
          )}
        </div>

        {serverError && (
          <p
            id="login-error"
            role="alert"
            className="flex items-start gap-2 rounded-control bg-rf-danger/[0.08] px-3.5 py-3 text-callout text-rf-danger"
          >
            <CircleAlert className="mt-px h-5 w-5 shrink-0" />
            {serverError}
          </p>
        )}

        <Button
          ref={submitRef}
          type="submit"
          className="w-full scroll-mb-6"
          loading={loginMutation.isPending}
          loadingText="Iniciando sesión…"
        >
          Iniciar sesión
        </Button>
      </form>
    </AuthLayout>
  );
}
