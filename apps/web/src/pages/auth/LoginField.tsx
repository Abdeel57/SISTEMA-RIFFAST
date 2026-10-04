import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';

// Campo del inicio de sesión con etiqueta flotante, solo CSS (login.css): la
// etiqueta va DESPUÉS del campo (placeholder " ") y sube de 17 a 13 px al
// enfocar, al tener texto o con el autocompletado. El texto se queda en 17 px
// para que iOS no haga zoom. Es exclusivo del login: Input y PasswordInput de
// components/ui también los usa el comprador y no se tocan.
//   - error: error PROPIO del campo (validación). Lo pinta de rojo y muestra el
//     aviso con id `${id}-error`. aria-invalid/aria-describedby llegan por props.
//   - password: botón para mostrar u ocultar la contraseña.
interface LoginFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'placeholder'> {
  id: string;
  label: string;
  error?: string;
  password?: boolean;
}

export const LoginField = forwardRef<HTMLInputElement, LoginFieldProps>(
  ({ id, label, error, password = false, type = 'text', className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className={className}>
        <div className="rf-login-field">
          <input
            ref={ref}
            id={id}
            type={password ? (visible ? 'text' : 'password') : type}
            placeholder=" "
            data-error={!!error}
            className={cn('rf-login-input', password && 'rf-login-input--password')}
            {...props}
          />
          <label htmlFor={id} className="rf-login-label">
            {label}
          </label>
          {password && (
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              aria-pressed={visible}
              aria-controls={id}
              className="rf-login-eye rf-login-ring"
            >
              {visible ? (
                <EyeOff aria-hidden className="h-[22px] w-[22px]" />
              ) : (
                <Eye aria-hidden className="h-[22px] w-[22px]" />
              )}
            </button>
          )}
        </div>
        {error && (
          <p id={`${id}-error`} role="alert" className="mx-4 mt-2 text-callout text-rf-danger">
            {error}
          </p>
        )}
      </div>
    );
  },
);
LoginField.displayName = 'LoginField';
