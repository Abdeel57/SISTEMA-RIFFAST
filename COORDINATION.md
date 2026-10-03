# 🤝 Tablero de coordinación — FASE 1 (dos agentes en paralelo)

> **Dos agentes editan este repo a la vez** (Claude Code + otro chat de Cursor).
> Para no pisarnos: **lee este archivo antes de tocar código**, reclama tu feature
> en la tabla, marca estado al terminar y lista los archivos que tocaste.
> Si vas a editar un archivo marcado de otro dueño, primero anótalo aquí.

**Última actualización:** Claude — sesión de implementación FASE 1.

---

## 👷 División de trabajo

- **Claude → backend / servidor / infra / config / docs.**
  (API, Prisma, endpoints, correo, CSRF, scripts de build, `.env.example`, README)
- **Cursor → frontend / React UI.**
  (páginas y componentes en `apps/web/src`, manifest, init de Sentry/analítica en el cliente)

Regla de oro: **un archivo, un dueño a la vez.** Los puntos de integración son
**contratos** (abajo): yo entrego el endpoint/URL/env, tú lo consumes en la UI.

---

## 📋 Estado de los features de FASE 1

| # | Feature | Backend (Claude) | Frontend (Cursor) | Estado |
|---|---------|------------------|-------------------|--------|
| 1 | Recuperación de contraseña | ✅ **HECHO + probado** | ✅ `RecoverPassword.tsx` (hecho por Cursor) | **COMPLETO** |
| 2 | Aviso de órdenes nuevas al rifero | ✅ email (Cursor, inline en reserve) + ✅ `GET /notifications/summary` (Claude, registrado) | ⬜ badge en tuerca/Órdenes (consumir `/notifications/summary`) | **backend listo** |
| 3 | Open Graph dinámico (preview al compartir) | ✅ `GET /s/r/:slug` y `/s/r/:slug/e:n` (Claude, registrado + probado) | ⬜ `buildShareUrl` + botones de compartir | **backend listo** |
| 4 | Revisión de seguridad + CSRF | ✅ CSRF (Cursor) **verificado en runtime por Claude** + ✅ `SECURITY-REVIEW.md` (Claude) | — (sin impacto si el origen es el permitido) | **COMPLETO** |
| 5 | Íconos PNG PWA + Sentry + analítica | ✅ íconos+`og-default` (Cursor) · ✅ **Sentry backend** (`lib/sentry.ts`+error-handler, Cursor) **verificado por Claude** | ✅ `@sentry/react` + PostHog env (Cursor) · ⬜ init Sentry/PostHog en `main.tsx` (Cursor) | **casi listo** |

Leyenda: ✅ hecho · 🟡 en curso · ⬜ pendiente · ⛔ bloqueado

---

## 🔌 Contratos de integración (lo que Claude entrega y Cursor consume)

### Feature 1 — Recuperación de contraseña (LISTO)
Backend ya disponible y probado:
- `POST /auth/forgot-password` body `{ email }` → siempre `200 { ok: true }` (no revela si existe).
- `POST /auth/reset-password` body `{ token, password, confirmPassword }` → `200 { ok: true }` o `400` si el token venció/ya se usó.
- Schemas: `forgotPasswordSchema`, `resetPasswordSchema` (en `@riffast/shared`).
- Servicios: `authService.forgotPassword`, `authService.resetPassword`.
- Email: `mailer.ts`, driver `log` en dev (el enlace se imprime en la consola de la API). En prod usar `RESEND_API_KEY`.
- Enlace del correo: `${PUBLIC_WEB_URL}/recuperar?token=...` → tu página `RecoverPassword` ya lo maneja. ✔️

### Feature 2 — Aviso de órdenes nuevas (contador/badge)
Claude entrega:
- `GET /notifications/summary` (requiere sesión de rifero) →
  ```json
  { "pendingOrders": 3, "pendingProofs": 1, "total": 4 }
  ```
  - `pendingOrders`: órdenes en estado `RESERVED`/`PENDING` del rifero.
  - `pendingProofs`: comprobantes en estado `PENDING` por revisar.
  - `total`: suma para el badge.
- Servicio sugerido: agregar `notificationsService.summary()` en `apps/web/src/services/` (Cursor).
- **Cursor:** mostrar el badge (punto/número) en el botón de tuerca (abrir admin) y en el item "Órdenes" del `AdminDrawer`. Polling con react-query `refetchInterval: 30000`.
- El correo al rifero (nueva orden) lo dispara el backend automáticamente; no requiere UI.

### Feature 3 — Open Graph dinámico (preview al compartir)
Claude entrega endpoints que devuelven **HTML con meta tags OG** + redirección al SPA:
- `GET /s/r/:slug` → preview de la página del rifero.
- `GET /s/r/:slug/e:eventNumber` → preview de una rifa (título, premio, imagen).
- **Cursor:** los botones de **compartir** (WhatsApp/copiar enlace) deben compartir la **URL de la API** `/s/...`, no la del SPA, para que WhatsApp/Facebook lean el preview.
  - Helper sugerido en `apps/web/src/lib/site.ts`: `buildShareUrl(slug, eventNumber?)` → `${API_URL}/s/r/${slug}` (+ `/e${n}`).
  - En dev no se ve preview (WhatsApp no alcanza localhost); en prod sí (`VITE_API_URL` = Railway).

### Feature 4 — CSRF
Claude agrega un guard de CSRF en mutaciones **autenticadas por cookie** (POST/PATCH/PUT/DELETE):
se valida el header `Origin`/`Referer` contra la allowlist (mismo criterio que CORS).
- **Impacto en frontend:** ninguno si las peticiones salen del mismo origen permitido (el cliente ya manda `Origin` automáticamente). Los endpoints **públicos** (apartar, subir comprobante) NO se ven afectados.
- Si algo se rompe con 403 `csrf`, avísame aquí.

### Feature 5 — Íconos PNG + Sentry + analítica
Claude entrega:
- Íconos PNG en `apps/web/public/` (`icon-192.png`, `icon-512.png`, `maskable-512.png`, `apple-touch-icon.png`) generados desde el SVG.
- Sentry backend (gated por `SENTRY_DSN`).
- Env del cliente a usar (Cursor los cablea en `main.tsx`/manifest):
  - `VITE_SENTRY_DSN` — init de `@sentry/react` solo si está presente.
  - `VITE_ANALYTICS_SRC` + `VITE_ANALYTICS_DOMAIN` — script de analítica (Plausible/Umami) cargado solo si está presente.
- **Cursor:** actualizar `vite.config.ts` (manifest icons → PNG) e `index.html` (`apple-touch-icon` → PNG) cuando los PNG existan; init de Sentry/analítica en `main.tsx`.

---

## 📝 Bitácora de archivos tocados

### Claude
- `apps/api/src/config/env.ts` (email, sentry, publicApiUrl)
- `apps/api/src/lib/mailer.ts` (nuevo: drivers log/resend, plantillas, `escapeHtml`)
- `apps/api/src/lib/codes.ts` (hashToken, newResetToken)
- `apps/api/src/modules/auth/auth.routes.ts` (forgot/reset)
- `apps/api/src/modules/notifications/notifications.routes.ts` (nuevo: `GET /notifications/summary`)
- `apps/api/src/modules/og/og.routes.ts` (nuevo: Open Graph `/s/r/...`)
- `apps/api/src/app.ts` (registro de notifications + og) ⚠️ *Cursor también edita app.ts*
- `apps/api/prisma/schema.prisma` + migración `password_reset_tokens`
- `packages/shared/src/schemas.ts` (forgot/reset schemas)
- `SECURITY-REVIEW.md` (nuevo) · `COORDINATION.md` (este archivo)

### Cursor (según lo observado)
- `apps/web/src/pages/auth/RecoverPassword.tsx`, `Login.tsx`, `App.tsx` (ruta `/recuperar`)
- `apps/api/src/modules/tickets/tickets.routes.ts` (email de nueva orden, inline)
- `apps/api/src/middlewares/csrf.ts` + `apps/api/src/lib/origins.ts` (CSRF) + refactor CORS en `app.ts`
- `apps/web/scripts/gen-icons.mjs` + PNGs en `apps/web/public/` (incl. `og-default.png`)
- `@sentry/react` en `apps/web/package.json`
- Feature `logoScale` (schema + types + updateRiferoSchema) — **en curso, build roto** (ver Alertas)
- `apps/web/src/pages/public/PublicRaffle.tsx`, `PublicRifero.tsx`, `apps/api/.env.example`

---

## ✅ Estado de integración (verificado por Claude)

- **`npm run typecheck` (shared + api + web) PASA (exit 0).** Build de producción verde.
- `logoScale` (Cursor): ✅ resuelto — serializer + migración aplicada (runtime devuelve `logoScale:100`).
- Sentry backend (Cursor): ✅ `@sentry/node` instalado, init gated + captura en error-handler. API arranca sano (no-op sin DSN).
- Endpoints verificados en runtime por Claude: recuperación (E2E), `/notifications/summary`, OG `/s/r/...`, CSRF.

## 🔜 Pendiente (todo en zona frontend de Cursor)

- Badge de avisos en tuerca/Órdenes → consumir `GET /notifications/summary` (poll 30s).
- `buildShareUrl` + botones de compartir → usar `/s/r/:slug(/e:n)` de la API.
- Init de Sentry (`@sentry/react`) y PostHog en `main.tsx`, gated por env.

## ⚠️ Zonas calientes (coordinar antes de tocar)
- `apps/web/src/App.tsx` — **dueño: Cursor** (rutas). Claude no lo toca.
- `apps/web/src/services/*` — Cursor. Claude solo define el contrato aquí.
- `apps/api/src/app.ts` — **dueño: Claude** (registro de módulos, hooks). Cursor no lo toca.
- `vite.config.ts`, `index.html`, `apps/web/public/*` — Cursor cablea; Claude solo genera los PNG.
- `.env.example` (api/web) y `README.md` — **dueño: Claude**.
