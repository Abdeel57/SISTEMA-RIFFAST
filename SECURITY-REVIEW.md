# 🔐 Revisión de seguridad — Bismark (FASE 1, lanzamiento público)

> Revisión del estado de seguridad antes del lanzamiento. Cubre autenticación,
> sesiones/cookies, CSRF, CORS, rate limiting, validación, archivos, secretos y
> cabeceras. Marca lo que está bien (✅), lo aceptable con nota (🟡) y lo
> recomendado para endurecer más (🔧).

Fecha: lanzamiento FASE 1 · Alcance: `apps/api` + `apps/web` + contrato compartido.

---

## Resumen ejecutivo

La base es sólida para un lanzamiento: contraseñas con bcrypt(12), sesión en
cookie `httpOnly` firmada (JWT), validación Zod en cada endpoint, rate limiting
en rutas sensibles, verificación de ownership por rifero, y ahora **protección
CSRF por verificación de `Origin`** (necesaria porque en producción las cookies
son cross-site `SameSite=None`). No se exponen datos del comprador en vistas
públicas. Quedan 3 recomendaciones de endurecimiento (ver al final), ninguna
bloqueante para el lanzamiento.

---

## Hallazgos por área

### 1. Autenticación y contraseñas — ✅
- `bcrypt` con **12 rounds** (`lib/auth.ts`). Adecuado.
- Login con mensaje genérico ("Correo o contraseña incorrectos") → no revela si el correo existe.
- Estados `SUSPENDED`/`DELETED` se manejan sin filtrar información.

### 2. Recuperación de contraseña — ✅ (nuevo en FASE 1)
- Token aleatorio de 256 bits (`randomBytes(32)`, base64url), **guardado hasheado** (sha256). El valor en claro sólo viaja en el enlace del correo.
- **De un solo uso** (`usedAt`) y con **expiración** (60 min por defecto). Al usarse se invalidan los demás tokens del usuario.
- `POST /auth/forgot-password` responde **siempre 200** → no permite enumerar correos.
- **Rate limit**: forgot 5/10min, reset 10/10min.
- Sólo cuentas `ACTIVE` pueden restablecer.

### 3. Sesiones y cookies — ✅ / 🟡
- Cookie `bsk_session` `httpOnly`, `secure` en prod, `SameSite` configurable (`none` en prod cross-site, `lax` en dev).
- JWT firmado, expiración 7 días.
- 🔧 **Limitación conocida (JWT stateless):** restablecer la contraseña **no invalida** sesiones existentes (un JWT ya emitido sigue válido hasta 7 días). Ver recomendación R1.

### 4. CSRF — ✅ (nuevo en FASE 1)
- Guard `onRequest` (`middlewares/csrf.ts`) que en métodos mutantes (POST/PATCH/PUT/DELETE) exige que `Origin` (o `Referer`) esté en la allowlist (`lib/origins.ts`, compartida con CORS).
- Verificado en runtime: Origin malicioso → 403; Origin/Referer permitido → pasa; método seguro → exento.
- 🟡 **Tradeoff documentado:** si **no** hay `Origin` **ni** `Referer`, se permite (clientes no-navegador: app móvil/curl). Es seguro porque un navegador **siempre** adjunta `Origin` en peticiones mutantes cross-site y no puede omitirlo; sin navegador no hay cookie ambiental que explotar. (Defensa basada en `Origin`, recomendada por OWASP.)

### 5. CORS — ✅
- `credentials: true` con allowlist explícita (`CORS_ORIGINS`) + comodín opcional de subdominios del dominio raíz (`CORS_ROOT_DOMAIN`). Sin `Origin` (same-origin/curl) se permite, pero CORS no concede credenciales a orígenes no listados.

### 6. Rate limiting — ✅
- Global desactivado; aplicado **por ruta** en las sensibles: login/registro (20/min), forgot (5/10min), reset (10/10min), apartar boletos (30/min), subir comprobante (15/min).

### 7. Validación de entrada — ✅
- **Zod** en cada endpoint vía `validate()`; errores centralizados en `error-handler.ts`.
- `bodyLimit` 2 MB para JSON; archivos por multipart con límites propios.

### 8. Subida de archivos — ✅
- Tipo MIME validado (allowlist) y tamaño (imágenes 5 MB, video 50 MB), con `file.truncated` para error amigable.
- No se guardan binarios en la BD; van a disco/`/uploads` o a un driver externo.

### 9. Open Graph dinámico (nuevo) — ✅
- El HTML que sirve `/s/r/...` **escapa** todos los valores interpolados (`escapeHtml`) → sin inyección por título/descripción/imagen de la rifa. La redirección usa `JSON.stringify` para el destino en el `<script>`.

### 10. Exposición de datos — ✅
- Las vistas públicas **no** exponen datos del comprador (nombre/teléfono). La PWA no cachea respuestas de la API.

### 11. Secretos y configuración — ✅ / 🔧
- En **producción** `JWT_SECRET` y `COOKIE_SECRET` son **obligatorios** (sin fallback inseguro). En dev hay fallback de desarrollo.
- 🔧 Asegurar que `JWT_SECRET`/`COOKIE_SECRET` sean largos y aleatorios en Railway (R3).

### 12. Cabeceras de seguridad — ✅
- `helmet` (nosniff, frameguard, referrer-policy, HSTS en prod). CSP la define el frontend en Netlify (`netlify.toml`).

---

## Recomendaciones de endurecimiento (no bloqueantes)

- **R1 — Invalidar sesiones al cambiar contraseña.** Agregar `passwordChangedAt` (o `tokenVersion`) al `User`, incluirlo en el JWT y verificarlo en `authenticate`. Así, restablecer la contraseña cierra sesiones activas. *Mitiga el caso de cuenta comprometida.*
- **R2 — `Content-Type` estricto en mutaciones JSON.** Considerar rechazar `POST/PATCH` con cookie que no sean `application/json` (defensa extra contra formularios cross-site, que sólo pueden enviar `text/plain`/`form-urlencoded`). Complementa al guard de `Origin`.
- **R3 — Secretos de producción.** Generar `JWT_SECRET` y `COOKIE_SECRET` de ≥ 48 chars aleatorios en Railway; nunca reusar los de `.env.example`.

---

## Checklist pre-lanzamiento

- [ ] `JWT_SECRET` / `COOKIE_SECRET` largos y únicos en producción (R3).
- [ ] `COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none`, `COOKIE_DOMAIN=.bismark.com` en prod.
- [ ] `CORS_ORIGINS` y `CORS_ROOT_DOMAIN` apuntando a los dominios reales.
- [ ] `RESEND_API_KEY` + dominio verificado (SPF/DKIM) para que los correos no caigan en spam.
- [ ] `SENTRY_DSN` (api) y `VITE_SENTRY_DSN` (web) configurados si se usa monitoreo.
- [ ] HTTPS en todo (cookies cross-site requieren `Secure`).
