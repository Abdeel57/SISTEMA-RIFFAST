# 🧪 Sesión 3 (Claude Code) — QA / Verificación + Lanzamiento (Fase 0)

> Tercer participante. Para **no chocar** con las otras dos sesiones, mantengo mi
> bitácora **aquí** (no edito `COORDINATION.md`, que es muy activo) y solo creo
> archivos **nuevos** en carpetas propias.

## ⏭️ Para retomar (snapshot 2026-06-11)
App completa, **re-temada a la identidad oficial** (azul #1A4DFF / tinta #0A0A0A / menta #4DFFA3, ref.
bismarkdigital.com) y landing pulida con capturas reales del sistema. Typecheck verde en 3 paquetes.
Esta sesión sumó: re-tema landing+auth · titular hero Archivo expandida + **boleto rojo SVG “RIFAS”** ·
capturas reales (hero perfil/showcase rifa+boletera/admin Inicio+Órdenes, `?v=3/4`) · bento 3 tarjetas
con mini-UIs animadas (pausa fuera de viewport) · **planes premium** (Pro tinta central, rosetón en
Verificado) · **burbuja WhatsApp** (`wa.me/5216629480105`) · **métodos de pago multi-banco** (17 bancos
MX, BankCard realista, preview en vivo) · admin con checklist/4 tabs/compartir/éxito al crear/intro 1ª
vez · móvil sin zoom + flotantes hide-on-scroll · VerifiedBadge rosetón · perfil compacto (rifa+CTA en
un pantallazo) · fixes críticos (expiración con comprobante, confirmar RESERVED, stale tailwind config).
⚠️ Tras tocar `tailwind.config.ts`: **reiniciar Vite** (no recarga config).

**Falta para lanzar (igual que antes):**
1. **Producción (solo usuario):** Railway (PG+Volume+API) · Netlify · DNS bismark.com + api · Resend ·
   env prod. Runbook `qa/DEPLOY-RAILWAY.md`. **Sembrar la cuenta demo en prod** (la landing enlaza
   `/r/rifasdelasuerte`).
2. **Decisión grande:** pasarela de suscripciones (MercadoPago/Stripe) + webhook — hoy es manual.
3. **Cursor:** init Sentry/PostHog en `main.tsx` · botones compartir con OG `/s/r/:slug`.
4. **Calidad:** verificación de email · Vitest+Playwright · backups · (opcional) tipografía Geist.
- **Próximo paso (usuario elige):** (a) pasarela, (b) email verif, (c) tests — o seguir puliendo UI.
- **Demo:** rifa GMC DENALI 2026 (sorteo 1 jul 2026) · 3 métodos de pago (BBVA/OXXO/Nu) · órdenes de
  prueba expiran a las 2h → re-sembrar con `qa/seed-demo-orders.mjs` antes de enseñar el sistema.

## Mi carril
- **Verificación de integración:** corro typecheck (shared+api+web) + `qa/smoke.mjs`
  contra el API vivo cuando hay cambios grandes, y reporto roturas.
- **Fase 0 (lanzamiento)** que NO está en el board de Fase 1:
  - Páginas **legales** (Términos / Aviso de Privacidad).
  - Checklist de **deploy** / verificación final.
  - **Pruebas** automatizadas (smoke).

## Archivos que poseo (solo nuevos)
- `qa/*` (esta carpeta).
- `apps/web/src/pages/legal/Terms.tsx`, `apps/web/src/pages/legal/Privacy.tsx`.

## NO toco (de otras sesiones)
`COORDINATION.md`, `App.tsx`, `apps/web/src/services/*`, páginas públicas, `apps/api/src/*`
(módulos, `env.ts`, `schemas.ts`, `app.ts`), `README.md`, `.env.example`, `netlify.toml`,
`vite.config.ts`, `index.html`, `apps/web/public/*`.

## Solicitud al frontend (Cursor)
Cuando puedas, cablear (las páginas **ya existen y compilan**, solo falta ruta + enlaces):
- En `App.tsx` (lazy): `/terminos` → `@/pages/legal/Terms`, `/privacidad` → `@/pages/legal/Privacy`.
- Enlazar en `Register.tsx` (checkbox de Términos / Aviso de Privacidad) y en el footer de la landing.

## Cómo correr mi verificación
```bash
node qa/smoke.mjs          # API debe estar en http://localhost:4000
npm run typecheck          # shared + api + web
```

## Bitácora de verificación
- ✅ Typecheck integrado **VERDE** (shared + api + web). API `health 200`.
  Migración `password_reset_tokens` aplicada. Endpoints nuevos respondiendo
  (`/orders/pending-count`, OG `/s/...`, notificaciones).
- 🛠️ **Regresión detectada y resuelta por QA:** la migración `rifero_logo_scale`
  estaba creada pero **no aplicada** → login daba 500. Apliqué `prisma migrate deploy`
  (no destructivo). Smoke de vuelta a **13 ok / 0 fallos**.
- 🚀 **Deploy a Railway (ambos servicios) preparado** — solo faltan tus variables:
  - `deploy/Dockerfile.api`, `deploy/Dockerfile.web`, `deploy/static-server.mjs` (sin deps), `.dockerignore`.
  - **Variables separadas (paste-ready):** `deploy/railway.backend.env` · `deploy/railway.web.env`.
  - Runbook: `qa/DEPLOY-RAILWAY.md`.
  - Servidor estático probado: SPA fallback, caché inmutable de assets, `sw.js` no-cache, headers de seguridad, 404 OK.
- 🐛 **Fix (a pedido del usuario):** `/panel` mostraba un `OwnerPreview` viejo en vez de la
  página pública mejorada. Lo unifiqué:
  - `apps/web/src/pages/public/PublicRifero.tsx` → **edit aditivo**: prop opcional `previewData`
    (si llega, no hace fetch público; lo usa el panel para verse aunque no haya plan). ⚠️ *toqué
    archivo de la otra sesión; es aditivo y no cambia el comportamiento público.*
  - `apps/web/src/components/owner/OwnerShell.tsx` (mío) → ahora arma los datos del dueño y
    renderiza `<PublicRifero previewData=… />` + banner "Vista previa" + tuerca.
  - `OwnerPreview.tsx` quedó **sin uso** (lo dejé en su lugar; idealmente se borra luego).
  - Verificado: typecheck VERDE + captura de `/panel` muestra la página mejorada.
- 🎨 **Rediseño del administrador (móvil), a pedido del usuario:**
  - `apps/web/src/components/owner/AdminDrawer.tsx` (mío) → **menú inferior** de 3 pestañas
    (Órdenes · Rifas · Más), barra superior limpia (título + “Cerrar”), **sin iconos decorativos**.
    Conservé el badge de pendientes (`useNotificationsSummary`).
  - `apps/web/src/components/owner/MoreMenu.tsx` (nuevo, mío) → hub “Más” por categorías
    (Tu página / Cobros / Tu negocio / Cuenta), tipo ajustes, sin iconos (solo chevron).
  - Sin tocar `App.tsx`: “Más” es estado interno del drawer, no ruta.
  - *Nota:* las tarjetas dentro de Rifas/Órdenes (botones Editar/Boletos/Sorteo, etc.) aún
    tienen iconos funcionales — están en archivos de la sesión frontend (Cursor).
- 🧹 **Quitar iconos en tarjetas (a pedido del usuario)** — ⚠️ *toqué archivos de la sesión frontend:*
  - `apps/web/src/pages/dashboard/RafflesList.tsx` → sin iconos (Ticket/Plus/Pencil/Grid3x3/Trophy/Send/Users/CalendarClock). Botones y badges en texto.
  - `apps/web/src/pages/dashboard/Orders.tsx` → sin iconos (Phone/Clock/CheckCircle2/XCircle/Ban/Download/ImageIcon/QrCode/Receipt). **Conservé `WhatsAppButton`.**
  - Lógica intacta (solo quité iconos). Typecheck VERDE. Pendiente (si el usuario quiere): Resumen/Reportes/Pagos/Perfil/Apariencia/Ajustes.
- 🧩 **Formularios + nav (a pedido del usuario):**
  - `apps/web/src/components/owner/AdminDrawer.tsx` (mío) → **iconos solo en el bottom nav**
    (Receipt/Ticket/Menu), el único lugar con iconos.
  - `apps/web/src/components/ui/form-section.tsx` (nuevo, mío) → `FormSection` + `Field`
    reutilizables con el estilo de la página de rifas (tarjeta + título display + campos espaciados).
  - `apps/web/src/pages/dashboard/RaffleForm.tsx` (⚠️ archivo frontend) → reescrito como
    **asistente de 4 pasos** (Tu rifa · Boletos · Imágenes · Fechas y reglas) con barra de
    progreso, validación por paso (`trigger`), sin iconos. Quité el preview lateral pesado;
    ejemplo de boleto inline. Lógica de guardado intacta. Typecheck VERDE.
  - *Pendiente (si el usuario quiere):* aplicar `FormSection`/`Field` a Perfil/Pagos/Ajustes/Apariencia/Onboarding.
- 🐛 **BUG CRÍTICO “no se pueden crear rifas” — RESUELTO (a pedido del usuario):**
  - **Causa raíz:** en `packages/shared/src/schemas.ts` las imágenes usaban `z.string().url()`,
    que **rechaza rutas relativas** `/uploads/…` que devuelve el storage local (volumen Railway).
    Al subir foto del premio (o logo/portada en onboarding/Apariencia) la validación tronaba → 400.
  - **Fix:** ⚠️ *toqué `schemas.ts` (sesión backend).* Agregué validador `imageUrl` (acepta
    `https://…` **o** `/uploads/…`) y reemplacé los 5 usos de `.url()` de imagen:
    `createRaffleSchema.images`, `onboardingSchema.logoUrl/coverUrl`, `updateRiferoSchema.logoUrl/coverUrl`.
    *Esto también arregla subir logo/portada del perfil.* Backend ya tomó el cambio (POST /raffles → 201 con imagen).
  - **Verificado e2e** (`qa/diag-create-img.mjs`, Chrome headless): login → asistente → sube PNG
    (`POST /uploads-api/image → 201`) → **`POST /raffles → 201`** (rifas E4/E5) → toast “Rifa creada”, 0 errores de campo.
- 🧹 **Alinear formulario con la página de la rifa (a pedido del usuario):** el form pedía
  cosas que **no aparecen** en `PublicRaffle.tsx`. La página usa: `prize`, `drawDate`, `description`,
  `terms`, `maxTicketsPerOrder` y el **pago del perfil** (`paymentProfile`). NO usa `startDate`,
  `endDate`, `reserveMinutes`, `useDigitalDraw` ni `allowWinnerPublication`.
  - `apps/web/src/pages/dashboard/RaffleForm.tsx` (⚠️ archivo frontend) → **quité del UI**:
    Inicia/Termina (`startDate`/`endDate`), Tiempo de apartado (`reserveMinutes`) y los 2 switches
    (Publicar ganador / Sorteo digital). Paso 4 ahora “**Sorteo y pago**” = Fecha del sorteo + Términos + Instrucciones de pago.
  - **Comportamiento preservado:** `reserveMinutes` ahora usa el **default global** del rifero
    (`profile.defaultReserveMinutes`, configurable en *Más → Ajustes*); `allowWinnerPublication`/`useDigitalDraw`
    quedan en defaults sensatos y se preservan al editar (siguen en `defaultValues`/`reset`).
    El hint de pago aclara que si se deja vacío se muestran los *Datos de pago* del perfil.
  - Typecheck VERDE + e2e VERDE con el form recortado (rifa E5).
- 🔓 **Nuevo modelo de plan: crear/personalizar libre, plan sólo gatea lo público (a pedido del usuario):**
  El usuario quiere poder **crear rifas y personalizar el perfil SIN plan**; lo único que el plan
  debe limitar es **hacer pública** la página (publicar/compartir el link). Un visitante sin plan
  del rifero ve “Próximamente” y no puede comprar.
  - ⚠️ *Toqué archivos de la sesión backend* (`apps/api/src/lib/plan.ts`, `apps/api/src/modules/raffles/raffles.routes.ts`):
    - `POST /raffles` y la edición estructural (renumerar borradores) **ya NO exigen plan** — se quitó `assertCanCreateRaffle`/`assertActivePlan`/`assertTicketLimit` del alta y de la edición.
    - El límite del plan se movió a **publicar**: nuevo `assertCanPublishRaffle(riferoId, raffleId, totalTickets)` en `plan.ts` (reemplaza a `assertCanCreateRaffle`) → valida plan activo + boletos por rifa + nº de rifas **públicas** (status PUBLISHED) a la vez. `POST /raffles/:id/publish` lo usa.
    - Quité el import muerto `getPlanContext` de `raffles.routes.ts`.
  - `apps/web/src/pages/dashboard/RaffleForm.tsx` (⚠️ frontend): el `onError` ya no muestra el
    mensaje engañoso “Activa un plan para crear más rifas” (crear ya no da 402). Mensaje genérico.
  - **Lo que YA estaba bien y no toqué** (sólo lo verifiqué): `PATCH /riferos/me` y onboarding no
    están gateados (personalizar perfil ya era libre); el público devuelve `active:false` sin plan
    y el front muestra “Esta página aún no está activa… preparando sus rifas”; comprar/boletos/pagos
    siguen gateados por plan (`tickets`/`payments` routes). Banner del panel ya dice lo correcto
    (“Activa un plan para que tu página sea pública”).
  - **Verificado e2e** (`qa/diag-noplan-create.mjs`, cuenta nueva SIN plan): `POST /raffles → 201` ✅ ·
    `publish → 402` ✅ · público `active:false` ✅. Cuenta de prueba eliminada.
- ✅ **Texto enriquecido en la descripción — RESUELTO y verificado (a pedido del usuario):**
  La sesión frontend (Cursor) metió un `RichTextEditor` (negritas/color/alineación/tamaño) para la
  descripción de la rifa + sanitizador, pero lo dejó a medias y rompía el typecheck en dos momentos:
  1) `PublicRaffle.tsx` usaba `isRichHtml`/`sanitizeHtml` sin import → mientras revisaba, Cursor agregó
     `apps/web/src/lib/sanitizeHtml.ts` (sanitizador nativo con `DOMParser`, sin dompurify) + el import.
  2) `RaffleForm.tsx` usaba `<RichTextEditor>` sin import (`TS2304`) y un `onChange` con `any` implícito.
  Iba a agregar el import yo, pero Cursor lo añadió (línea 20) en paralelo. **Typecheck web ahora VERDE
  (exit 0)**; `shared`+`api` también.
  - **Verificación de runtime** (`qa/diag-richtext-public.mjs`, Chrome headless): la página pública de
    una rifa **monta sin crashear** y la descripción enriquecida **renderiza con formato**: en una rifa
    nueva con `<b><font color size>` el `.rt-content` muestra el texto y `negrita=true`. (Los `401` de
    consola son el chequeo de sesión del visitante — benignos y pre-existentes, aparecen igual en E1.)
  - *No toqué `PublicRaffle.tsx`, `rich-text.tsx` ni `sanitizeHtml.ts`* (son de la sesión frontend); sólo
    verifiqué. Limpié la rifa de prueba.
- ⏱️ **Cronómetro al sorteo bajo la imagen (a pedido del usuario):**
  - `apps/web/src/components/public/RaffleCountdown.tsx` (**nuevo, mío**): cuenta regresiva
    días/horas/min/seg en vivo (setInterval 1s) con estilo oscuro “rifa norteña” (cards
    `bg-white/[0.05] ring-white/10`, label en `--rifero-primary`). Si la rifa está FINISHED/CANCELLED
    o la fecha ya pasó → muestra sólo la fecha del sorteo (`formatDateTimeMX`). Si no hay fecha → no
    renderiza. Props: `{ drawDate, status }` (usa el enum `RaffleStatus` de shared).
  - ⚠️ *2 ediciones mínimas en `apps/web/src/pages/public/PublicRaffle.tsx` (sesión frontend):* import
    del componente + `<RaffleCountdown drawDate={raffle.drawDate} status={raffle.status} />` insertado
    entre `</header>` y la tabla de precios (justo debajo de la imagen).
  - **Verificado e2e** (`qa/diag-countdown.mjs`): futuro → `05 DÍAS 03 HORAS 26 MIN 57→56 SEG` (corre
    en vivo, 0 errores); pasado → `FECHA DEL SORTEO · 7 jun 2026` (sólo fecha). Typecheck web VERDE.
    Rifas de prueba eliminadas.
- 📅 **Fecha del sorteo ahora OBLIGATORIA (a pedido del usuario):** el contador no salía en una rifa
  real porque tenía `drawDate: null` (se creó sin fecha). El formulario **sí guardaba** bien la fecha
  (verificado); el hueco era que se podía dejar vacía.
  - `apps/web/src/pages/dashboard/RaffleForm.tsx` (⚠️ frontend): `drawLocal` ahora es **requerido** en
    `onSubmit` (crear y editar) → si está vacío, bloquea con error “Indica la fecha y hora del sorteo.”
    y manda al paso 4. Estado `drawError` + `error` en el `Field`; se limpia al escribir. Hint actualizado.
  - **Verificado e2e** (`qa/diag-form-date.mjs`): sin fecha → ✅ bloqueado con error; con fecha →
    `POST /raffles 201` con `drawDate` persistido. Typecheck web VERDE.
  - *Pendiente del usuario:* las rifas viejas con `drawDate: null` (p. ej. “GRAN SORTEO EN EFECTIVO” de
    *Rifas Jazvi*) necesitan editarse una vez para ponerles fecha y que aparezca el contador.
- 🎨 **Contador en fondo blanco + fechas a sorteos activos (a pedido del usuario):**
  - `apps/web/src/components/public/RaffleCountdown.tsx` (mío): pasado de bloque negro (`bg-zinc-950`)
    a **fondo claro** (`bg-background`, tarjetas `bg-muted/40` con borde, números `text-foreground`,
    etiqueta en `--rifero-primary`). En modo claro la sección queda `rgb(255,255,255)` (verificado).
  - Puse **fechas futuras a los 2 sorteos activos** (PUBLISHED) para que se vea el contador:
    GRAN SORTEO (Jazvi /rifastusuerte E1) → 15 jul 2026, 8 pm · Camioneta (demo /rifasdelasuerte E2)
    → 1 jul 2026, 8 pm. (El iPhone demo está FINISHED → muestra sólo la fecha, correcto.)
  - **Verificado** (Chrome headless, `prefers-color-scheme: light`): ambas páginas muestran el contador
    en vivo sobre fondo blanco, sin errores.
  - 🩹 **Integración con la sombra de la imagen (a pedido del usuario):** el contador era un bloque
    blanco aparte y cortaba la sombra que se desborda del marco de la imagen. Solución: el componente
    ahora es **transparente** (sin `bg-background`, hereda el blanco del hero) y se movió **dentro del
    `<header>`** (entre la imagen y `</header>`) en `PublicRaffle.tsx`, con `pt-6` para dar aire a la
    sombra. Verificado con captura: la sombra fluye sin corte y todo comparte un solo fondo blanco.
- 🔎 **Revisión de bugs (a pedido del usuario):** typecheck (shared+api+web) VERDE, smoke 13/0, barrido
  de runtime de 8 páginas públicas (sin pageerrors). Dos agentes auditaron el flujo de compra y el
  render de texto enriquecido. Hallazgos y acciones:
  - 🔴 **BUG CRÍTICO — orden con comprobante se auto-expiraba (CORREGIDO):** al subir comprobante, los
    boletos pasaban a `PENDING_PAYMENT` pero la **orden seguía `RESERVED`** con su `expiresAt`; el job
    `releaseExpiredReservations` vencía esa orden y **liberaba los boletos del comprador que ya pagó**.
    ⚠️ *Toqué backend:* `apps/api/src/modules/payments/payments.routes.ts` (al subir comprobante la orden
    pasa a `PENDING` y `expiresAt=null`) y `apps/api/src/jobs/expire-reservations.ts` (el job sólo vence
    `RESERVED`). Verificado que `mark-paid` acepta `PENDING` y que las listas/conteos del rifero ya lo
    incluyen. **Regresión probada** con el job real: orden con comprobante → PROTEGIDA; apartado vencido
    → expira+libera. ✅
  - 🟠 **Menor (CORREGIDO):** `reserveFormSchema` permite `nombres(60)+apellidos(60)` → `fullName` hasta
    121 > `buyerSchema.fullName.max(120)`. Subí el backend a `max(140)` en `packages/shared/src/schemas.ts`.
  - ✅ **Falsos positivos descartados:** la descripción del **rifero** es `Textarea` plano (no rich), así
    que renderizarla como texto plano en `PublicRifero.tsx` es correcto; `OwnerPreview.tsx` es código
    muerto. La descripción de **rifa** (única rich) se renderiza bien en `PublicRaffle.tsx`; ningún otro
    lugar la muestra. `max(8000)` alcanza para HTML. OG/meta limpian el HTML.
  - ✅ **Los 4 detalles de UX — CORREGIDOS (a pedido del usuario):**
    1. **Órdenes expiradas/rechazadas en la búsqueda por teléfono:** `apps/api/.../public.routes.ts`
       (lookup) ahora incluye `EXPIRED`/`REJECTED`. En `VerifyTickets.tsx`: `StatusPill` muestra
       “Vencida/Rechazada/Cancelada” (rojo) y `OrderCard` agrega nota explicativa + oculta la caja de
       boletos vacía. Verificado: lookup devuelve la orden EXPIRED.
    2. **Contador del recibo en vivo:** nuevo `apps/web/src/components/public/ReserveTimer.tsx` (mío)
       que corre cada segundo y, al vencer, avisa “tu apartado venció y los boletos se liberaron”.
       Reemplaza el bloque estático en `PublicRaffle.tsx` (quité `timeRemaining`/`Clock` sin uso).
    3. **Nombre de una sola palabra:** `apellidos` ahora opcional en `reserveFormSchema` (PublicRaffle),
       `fullName` se arma robusto (`[nombres,apellidos].filter(Boolean).join(' ')`), placeholder “(opcional)”.
    4. **`/auth/me` 401 en consola:** ahora es auth “suave” → 200 `{user:null}` sin sesión (sin
       `requireAuth`). Verificado: `/auth/me` → 200 y **0 `401` en consola** en landing/rifa/verificar.
    ⚠️ *Toqué backend* (`auth.routes.ts`, `public.routes.ts`) *y archivos frontend* (`PublicRaffle.tsx`,
    `VerifyTickets.tsx`, `services/auth.ts`). Typecheck (shared+api+web) VERDE, smoke 13/0, páginas sin
    pageerrors.
- 🚀 **Quick wins de conversión en la landing (a pedido del usuario, análisis 2026-06-10):**
  Análisis experto con capturas (desktop+móvil). Hallazgos corregidos:
  1. **“Entrar” oculto en móvil** (`hidden sm:block` en el nav) → ahora visible siempre. Un rifero que
     regresa no podía iniciar sesión desde el teléfono.
  2. **CTA secundario del hero** ahora es “**Mira una página de ejemplo**” → `/r/rifasdelasuerte` en
     pestaña nueva (mostrar el producto vivo > mockup). También enlazada en el footer (Producto).
     *Nota deploy:* la demo depende del seed — sembrar la cuenta demo en producción.
  3. **Rutas legales cableadas**: `/terminos` y `/privacidad` en `App.tsx` (⚠️ archivo Cursor, edición
     aditiva lazy). Footer con columna **Legal** y el checkbox de `Register.tsx` ahora enlaza ambas
     (pestaña nueva). “Hecho en México” movido a la barra del copyright.
  4. **Fix del `Reveal` invisible**: `useInView` ahora nace visible si no hay IntersectionObserver y
     tiene **failsafe de 2.5s** que revela todo aunque no haya scroll (antes una captura full-page salía
     EN BLANCO bajo el hero; riesgo para crawlers). Verificado: 0 elementos invisibles tras 3.5s sin scroll.
  5. Menores: `aria-expanded` en FAQ; nota de activación manual reencuadrada como beneficio
     (“Crea y configura todo gratis…”).
  Archivos: `Landing.tsx`, `Register.tsx`, `App.tsx` (⚠️ los tres zona Cursor, ediciones puntuales),
  `hooks/useInView.ts`. **Verificado**: typecheck VERDE; `/terminos` y `/privacidad` cargan; Entrar+CTA
  ejemplo+footer legal visibles en móvil (390px); failsafe OK. Tema claro intacto (body blanco).
  *Pendiente del análisis (no hecho aún):* prueba social/testimonios, JSON-LD FAQPage + meta description,
  pulir fold móvil (mockup casi no se asoma), ThemeToggle al nav, CI + Playwright.
- 🎨 **REDISEÑO COMPLETO de la landing — concepto “Boleto Dorado” (a pedido del usuario):**
  `apps/web/src/pages/Landing.tsx` reescrita (⚠️ zona Cursor). Dirección: artefacto de lotería premium —
  papel crema `#f7f3ea` en secciones claras (con fallback `dark:` al tema oscuro), tinta navy, oro como
  color del premio, seriales Space Mono y perforaciones de boleto. Cambios:
  1. **Producto real en vez de mockup:** capturé la demo con Chrome+sharp → `public/demo-rifero.webp` y
     `public/demo-rifa.webp` (~78 KB c/u). El teléfono del hero y una **nueva sección showcase** (“Así se
     ve una página hecha con Bismark”, 2 teléfonos inclinados) muestran píxeles reales + link a la demo.
  2. **Talón de stats perforado** (`.ticket-edge`) encimado al hero: 0% comisión · 100% directo · 10,000
     boletos · 24/7 (se quitó la débil “3 planes accesibles”).
  3. **Beneficios → bento asimétrico** (lg:grid-cols-6, spans 3/3/2/2/2/3/3) con **mini-UIs ilustrativas**
     en JSX: burbuja de orden WhatsApp, boleto QR verificado, fila “Confirmar pago”. Numeración 01-07.
  4. **“Cómo funciona” → banda editorial de tinta** con encabezado sticky a la izquierda y lista numerada
     en oro (01–07) con hilo conector.
  5. **Planes como boletos troquelados:** muescas laterales reales (círculos del color del fondo sobre la
     perforación punteada), “SERIE PRO-002” en Space Mono, popular en **oro** (antes azul).
  6. **CTA final = boleto dorado gigante:** gradiente oro, talón perforado vertical “Nº 000001 · ADMITE:
     1 RIFERO”, marca de agua “Nº1”, botón tinta. El momento memorable de la página.
  7. Extras: etiquetas de sección “FOLIO 0X — …”, serial gigante decorativo en el hero, **JSON-LD FAQPage**
     (rich results), “Ejemplo en vivo” en el nav, FAQ numerado. Conserva: copy, datos/planes de la API,
     lógica FAQ + aria-expanded, links demo/legales, Reveal con failsafe.
  - **Verificado:** typecheck VERDE · 0 pageerrors (móvil 390 y desktop 1366) · capturas QC de cada
    sección · **modo oscuro OK** (papel→fondo oscuro sin romperse). *Nota deploy:* los webp de demo son
    capturas estáticas — regenerarlas si cambia mucho el diseño de la página pública.
- 🎫 **Rediseño de Login/Registro — “Boleto de acceso” (a pedido del usuario):**
  - `apps/web/src/components/layout/AuthLayout.tsx` (compartido por Login/Registro/Recuperar):
    área del formulario sobre **papel crema** (`#f7f3ea`, fallback dark) y el formulario dentro de un
    **boleto troquelado**: cabecera con microetiqueta Space Mono (“★ BOLETO DE ACCESO/REGISTRO · Nº 000001”,
    prop opcional `ticketLabel` para no romper Recuperar), perforación punteada con **muescas laterales**,
    microcopy “★ Datos protegidos · Sin tarjeta ★” bajo la tarjeta. Panel lateral: stub decorativo ahora
    **dorado** (gradiente oro como el CTA de la landing), serial gigante `Nº001` de fondo, link “Inicio”
    ahora visible también en móvil.
  - `apps/web/src/components/ui/password-input.tsx` (**nuevo, mío**): campo con **mostrar/ocultar
    contraseña** (ojo, aria-label) — clave para usuarios no técnicos en móvil.
  - `Login.tsx` / `Register.tsx` (⚠️ zona Cursor): usan `PasswordInput` (login ×1, registro ×2),
    `ticketLabel`, CTA `rounded-full`; quité la línea de seguridad duplicada de Register (ahora vive en
    el layout). Lógica/validación/analytics intactas.
  - **Verificado:** typecheck VERDE · capturas (login desktop, registro móvil) · `/recuperar` hereda el
    rediseño sin errores · **flujo real**: ojo muestra/oculta (`text`↔`password`) y login demo → `/panel` ✅.
  - **Iteración (el usuario pidió campos menos “simples”):** nuevo
    `apps/web/src/components/ui/ticket-field.tsx` (mío) — `TicketField` + `ticketInputClass`:
    etiquetas estilo serial (Space Mono mayúsculas, tracking ancho) que **se encienden en azul al
    enfocar** (group-focus-within, también el icono), inputs h-12 **rellenos con tinte de papel**
    (`#fbf8f1`, hover/focus de marca, fallback dark `bg-muted/30`), y el checkbox de términos dentro de
    una **cajita punteada** de papel. `Login.tsx` y `Register.tsx` migrados a `TicketField` (se quitó
    `Label` directo); el link “¿Olvidaste tu contraseña?” va en la prop `right`. Typecheck VERDE,
    captura móvil con estado de foco verificada, login E2E sigue entrando al panel.
- 🪪 **Rediseño del perfil público del rifero (a pedido del usuario, plan validado antes):**
  `apps/web/src/pages/public/PublicRifero.tsx` (⚠️ zona Cursor) — sólo presentación, lógica/datos/tema
  por rifero intactos; el preview del panel (previewData) hereda gratis. Cambios (propuesta 1-6 aprobada):
  1. **Desktop deja de ser “móvil estirado”:** contenedor `lg:max-w-5xl` y el encabezado como **tarjeta
     blanca sobrepuesta a la portada** (`lg:-mt-12`): avatar izq, nombre+bio+redes alineados a la
     izquierda, **rail de acciones** der (“Ver rifas disponibles ↓” ancla `#rifas` + WhatsApp). En móvil
     queda el flujo centrado original (WhatsApp en la fila de redes `lg:hidden`).
  2. **Portada inteligente:** `lg:h-64` y, sin imagen, degradado del rifero + grano + patrón de puntos +
     luz radial (ya no bloque vacío).
  3. **Stats:** oculta las que van en 0, singular/plural (“1 Disponible”), “Finalizadas”→“Sorteos
     realizados”, números más grandes en lg.
  4. **Feed/Ganadores a 2 columnas en lg** (cuando hay >1; si hay 1, centrado `max-w-xl`).
  5. **FAQ numerado** (01-05, se enciende con el color del rifero al abrir) y ancho contenido.
  6. **Cierre de confianza:** tarjeta con pill “Rifero verificado”, link a Verificar boletos y PoweredBy.
  - 🐛 **Bug encontrado y arreglado durante QC:** el nombre (h1) quedaba **tapado por el overlay absoluto
    de la portada** (la tarjeta sube con `-mt` pero era estática → los absolutos pintan encima). Fix:
    `relative z-10` en la tarjeta. Diagnosticado con `elementFromPoint` (hit-test) en Chrome headless.
  - **Verificado:** typecheck VERDE · capturas desktop 1440 (tarjeta correcta con nombre/CTAs/stats) y
    móvil 390 (flujo original intacto) · 0 pageerrors.
  - **Iteración 2 (a pedido del usuario: “mejoras en TODO el perfil, pensadas para móvil”):**
    1. **`RafflePost` rediseñada móvil-primero:** se quitó la cabecera redundante (avatar+nombre del
       rifero que ya está arriba — la prop `rifero`/`MiniRifero` se eliminó); insignias **sobre la
       imagen** (chip de evento, badge Disponible/Finalizada); chip de urgencia “**Faltan N días**” /
       “Sortea mañana” (`daysToDraw`, estático) + fecha sobre degradado inferior; **talón de precio**
       punteado (POR BOLETO grande en el color del rifero · Vendidos x/y · %); placeholder sin imagen
       con degradado del rifero; CTA `size=lg rounded-xl` (tap target móvil).
    2. **`WinnerCard`:** 1er lugar en **oro con trofeo** (`#fff3d6`/`#8a5b00`), demás puestos en color
       del rifero; número de boleto en chip punteado; “1er lugar · E1 · …” en la etiqueta.
    3. **`SectionTitle`** acepta `count` → “Rifas disponibles (n)” y “Ganadores (n)” con chip.
    Typecheck VERDE · capturas móvil 390 y desktop 1440 limpias (0 pageerrors). (El pill “Estos sorteos
    son seguros” a mitad de página en las capturas es artefacto del fullPage con `position:fixed`;
    en uso real va pegado abajo.)
- 💳 **Métodos de pago como tarjetas bancarias reales (feature nueva, decisiones del usuario:
  varios métodos + logo real + estilo realista premium):**
  - **Shared:** `paymentMethodSchema` + `PaymentMethodInput` (zod) y `PaymentMethodDTO`;
    `updateRiferoSchema.paymentMethods` (array máx. 6); `methods?` en `paymentProfile` de
    `PublicRaffleDTO` (y por herencia recibo/boleto digital).
  - **Backend (⚠️ zona backend):** columna `RiferoProfile.paymentMethods Json?` + migración
    `rifero_payment_methods` (EPERM del DLL de Prisma resuelto deteniendo servers → generate → restart).
    Helper `riferoPaymentMethods()` en `serializers.ts` (parsea el JSON y **sintetiza un método con los
    campos pay\* legados** si la lista está vacía — back-compat total). Expuesto en: perfil propio,
    rifa pública, lookup por teléfono, recibo de reserva (`tickets.routes`) y boleto digital
    (`digital-tickets.routes`).
  - **Frontend:**
    - `lib/banks.tsx` (**nuevo, mío**): 17 temas mexicanos (BBVA, Banorte, Santander, Citibanamex, HSBC,
      Scotiabank, Banco Azteca, BanCoppel, Inbursa, Banregio, Nu, Hey, Klar, Mercado Pago, OXXO,
      Banco del Bienestar, SPEI) con degradado + wordmark/marca SVG fiel (llama Santander, hexágono HSBC,
      bloque OXXO) y `detectBank()` por palabras clave sin acentos; fallback genérico elegante.
    - `components/public/BankCard.tsx` (**nuevo, mío**): tarjeta realista — chip dorado SVG, contactless,
      grano + brillo diagonal, número en relieve agrupado 4-4-4-4, CLABE, titular, concepto como chip,
      **copiar-al-toque** en cada dato.
    - `PaymentCard.tsx` reescrito: lista de `BankCard` por método + instrucciones generales; back-compat
      con el shape plano. Beneficia a: modal Métodos de pago, Verificar boletos, página de pago y ahora
      también el **recibo de apartado** en `PublicRaffle.tsx` (reemplacé los PayRow manuales; borré
      `PayRow` sin uso).
    - `pages/dashboard/Payments.tsx` (⚠️ zona Cursor) reescrito: **varios métodos** con editor por método
      y **vista previa en vivo** de la tarjeta al escribir el banco (datalist con los 17), sección
      “Para todos los métodos” (WhatsApp/instrucciones/comprobantes) y guardado que **espeja el primer
      método a los campos pay\* legados**.
  - **Verificado:** typecheck VERDE (3 pkgs) · `qa/diag-payment-methods.mjs`: PATCH guarda 3 métodos →
    público rifa y lookup devuelven los 3 (BBVA, OXXO, Nu) · capturas: modal del comprador con las 3
    tarjetas tematizadas y panel del rifero con preview en vivo · smoke 13/0. Demo sembrado con
    BBVA+OXXO+Nu.
- 🔴 **BUG crítico del admin — no se podía confirmar el pago de un apartado (CORREGIDO):**
  Durante el análisis UX del panel (a pedido del usuario) encontré que `Orders.tsx:126` (⚠️ zona Cursor)
  tenía `isPending = status === 'PENDING'` → las órdenes **RESERVED** (apartado normal, el caso de
  siempre) NO mostraban “Marcar pagado/Rechazar/Cancelar”; sólo WhatsApp. El trabajo nº1 del rifero
  estaba roto. Fix: `'PENDING' || 'RESERVED'` (el backend `mark-paid` ya aceptaba ambos). **Verificado**
  con la orden real BSK-7CHBRL del usuario: los 3 botones aparecen.
- 🧭 **Mejoras de UX del administrador (las 6 del análisis, aprobadas por el usuario):**
  1. **Checklist “Primeros pasos” en Inicio** (`Home.tsx` ⚠️ Cursor): ① Datos de pago (done si
     `paymentMethods.length>0`) → ② Crear rifa → ③ Publicar → ④ Compartir link (navigator.share/copy,
     flag `bsk-shared-page` en localStorage). Contador n/4, ✓ verdes tachados, desaparece al completarse.
  2. **Acción primaria por estado en la tarjeta de rifa** (`RafflesList.tsx` ⚠️ Cursor): DRAFT→“Publicar
     rifa” (ya existía), PUBLISHED→**“Compartir rifa”** (share nativo móvil / copiar con `buildRaffleUrl`),
     FINISHED→“Ver resultado público”. El slug viene de `['rifero','me']` cacheado.
  3. **Pestaña “Inicio” en el bottom nav** (`AdminDrawer.tsx` mío): 4 tabs Inicio/Órdenes/Rifas/Más con
     active-state correcto (antes el Resumen quedaba huérfano y marcaba “Más”).
  4. **Stats del Resumen legibles** (`Home.tsx`): “Por cobrar / Pagadas / Vendidos / Ingresos / Rifas
     activas / Sorteos” (antes se truncaban: “Órdenes p…” ×2 idénticas).
  5. **Pantalla de éxito al crear rifa** (`RaffleForm.tsx` ⚠️ Cursor): tras crear ya no te bota a la
     lista; muestra “¡Tu rifa está lista!” + **Publicar ahora** (mutation con manejo 402) → al publicar
     cambia a **Compartir mi rifa** + “Ver cómo se ve” (sólo si publicada; un draft no es público) +
     “Ir a mis rifas”.
  6. **Bienvenida de primera vez** (`OwnerShell.tsx` mío): overlay “👋 ¡Esta es tu página!” que explica
     la tuerca y ofrece “Abrir mi administrador” / “Ver mi página primero” (flag `bsk-admin-intro`).
  **Verificado** (Chrome móvil 390): intro visible y navega a Inicio · checklist “3/4” con ✓ verdes ·
  4 tabs con Inicio activo · “Compartir rifa” en publicada y “Ver resultado” en finalizada · stats sin
  truncar · 0 pageerrors · typecheck VERDE.
- 📱 **Optimización móvil: zoom en formularios + flotantes que “se deslizan” (a pedido del usuario):**
  1. **Auto-zoom de iOS al enfocar campos (desencuadre):** `index.html` viewport pasó de
     `maximum-scale=5` a **`maximum-scale=1`** (mata el auto-zoom de input; el pellizco para ampliar
     sigue funcionando desde iOS 10) + **`interactive-widget=resizes-content`** (el teclado de Android
     redimensiona en vez de tapar campos). Refuerzo en `index.css`: en `max-width:767px` TODOS los
     controles (`input/select/textarea/[contenteditable]`) usan `font-size:max(16px,1em)` — cubre
     buscadores chicos y el editor de texto enriquecido sin importar la clase Tailwind.
  2. **Tuerca y sello “Estos sorteos son seguros” deslizándose al scrollear:** era el salto inherente de
     los `position:fixed` anclados abajo cuando el navegador móvil colapsa la barra de URL (el viewport
     crece y el elemento “persigue” el nuevo borde). Solución: hook nuevo
     `hooks/useHideOnScroll.ts` (mío) — los flotantes **se esconden con transición al bajar** y
     reaparecen al subir o detenerse (500 ms): el salto ocurre mientras están ocultos y el contenido
     queda despejado al leer. Aplicado a `SafeSeal.tsx` (todas las páginas públicas) y a `FloatingGear`
     (`OwnerShell.tsx`), con `pointer-events-none` mientras está oculto.
  3. **Barrido de desbordamiento horizontal:** verificado 0px de overflow-x en perfil, rifa, login,
     registro y landing (otra causa típica de desencuadre).
  **Verificado** (Chrome móvil 390 touch): viewport correcto · overflow-x 0 en 5 páginas · input 16px ·
  SafeSeal: visible → bajando OCULTO → detenido REAPARECE → subiendo visible · typecheck VERDE.
- ✅ **Palomita de verificado premium (a pedido del usuario):** `components/brand/VerifiedBadge.tsx`
  reescrita — de círculo plano azul a **sello festoneado** (rosetón de 8 lóbulos, la forma universal de
  “verificado”) en SVG con **degradado de profundidad** (#60a5fa→#2563eb→#1e40af), **brillo superior**
  radial tipo cristal, palomita en trazo redondeado nítido, sombra sutil y `<title>` “Rifero verificado
  por Bismark” (tooltip). Ids de gradiente únicos por instancia (`useId` saneado — los “:” rompen
  `url()` en SVG). **Misma API** (className, size) → mejora automática en todos los usos: nombre del
  perfil, badge del avatar, sello SafeSeal, ganadores, footer. Verificado con captura @3x (avatar 26px
  y nombre 22px se ven nítidos). Typecheck VERDE.
  - *Iteración:* en el avatar del perfil se quitó el **círculo blanco** envolvente — ahora es sólo el
    sello (30px) directo sobre el borde del logo, con sombra propia más marcada (`PublicRifero.tsx`).
  - *Iteración 2:* mismo cambio en las barras de las páginas de compra — `RaffleBrandBar.tsx` (selección
    de boletos) y `RiferoTopBar.tsx` (verificar/pago): fuera el aro blanco, sello directo (17px) con
    sombra oscura. `VerifiedBadge` ahora acepta prop `style` (la barra posiciona el badge con top
    dinámico según el tamaño del logo).
- 🎨 **RE-TEMA a la identidad oficial de Bismark (a pedido del usuario — “Bismark no usa esos colores”,
  referencia: bismarkdigital.com):** extraje la paleta real del sitio con curl (markdown-fetch borra el
  CSS): **azul eléctrico `#1A4DFF`** (+`#4178FF`/`#0E37D6`), **tinta `#0A0A0A`**, tintes azul suave
  `#F5F7FF`/`#EEF3FF`, **menta `#4DFFA3`**, cielo `#6FA0FF`, ámbar puntual `#F5A623`; tipografía Geist
  (no migrada — sólo colores, como pidió). Cambios:
  - `tailwind.config.ts`: brand.DEFAULT `#2751fb`→`#1A4DFF`, deep/electric/ink actualizados, **nuevos
    tokens `brand-mint` y `brand-sky`**, gold re-apuntado a `#F5A623` (ya no identidad). Esto re-tema
    automáticamente TODOS los botones `variant=brand` de la app.
  - **Landing**: papel crema `#f7f3ea`→tinte azul `#F5F7FF`, bordes `#E3E9F8`, navy `#070b18`→`brand-ink`,
    TODOS los acentos dorados→**menta** (subrayado “rifas”, dots, marquee ★, folios oscuros, números de
    pasos, hilo conector, estrella footer), hairline del nav→azul, plan popular dorado→**azul** (pill
    menta), stub “¡Ganaste!” crema→blanco+menta, marcos de teléfono a tinta neutra, sombras
    `rgba(39,81,251)`→`rgba(26,77,255)`, y el **CTA final “boleto dorado”→“boleto Bismark” azul
    eléctrico** (gradiente electric→deep, botón blanco/tinta, etiqueta menta).
  - **Auth** (`AuthLayout`, `ticket-field`, Login/Register/Recover): mismo barrido — fondo `#F5F7FF`,
    inputs `#F8FAFF`/borde `#E3E9F8`, acentos gold→mint, boleto decorativo dorado→azul eléctrico.
  - **Defaults de rifero**: fallback `#2751fb`→`#1A4DFF` en RiferoTopBar/PaymentSection/RiferoPayment/
    Design (DEFAULT_PRIMARY) y RiferoTheme (`#1d4ed8`→`#1A4DFF`). `theme-color` meta y
    `text-gradient-brand` actualizados. `OwnerShell` PreviewBanner a ink+mint.
  - **Verificado:** typecheck VERDE · capturas desktop full/móvil/registro — todo lee como la familia
    bismarkdigital (blanco/tinta + azul + menta) · 0 pageerrors. *Pendiente opcional:* migrar tipografía
    a Geist para matchear 100% (hoy Bricolage/Jakarta/Space Mono).
- 📸 **Nuevas capturas del sistema + sección del administrador (a pedido del usuario):**
  - **Demo con banner de auto:** `coverUrl` del demo (`rifasdelasuerte`) ahora usa la foto Unsplash del
    auto de la rifa Camioneta (antes null → gradiente verde vacío).
  - **3 capturas reales regeneradas** (Chrome 390@2x → sharp webp q82 en `apps/web/public/`):
    `demo-rifero.webp` (perfil con banner de auto, 116 KB), **`demo-boletera.webp` (NUEVA, 100 KB)** —
    la cuadrícula de boletos EN ACCIÓN: panel “→ APARTAR ←” con boleto 0018 seleccionado, “1 BOLETO ·
    $200”, contador de disponibles y maquinita de la suerte (clic real en celdas vía puppeteer), y
    **`demo-admin.webp` (NUEVA, 44 KB)** — Inicio del admin: “Hola, Carlos”, checklist Primeros pasos
    3/4 con ✓ verdes, stats Por cobrar/Pagadas/Vendidos/$550 y nav de 4 tabs (intro saltada con
    localStorage). `demo-rifa.webp` queda sin uso en landing (no borrada).
  - **Landing:** el showcase ahora muestra **perfil + boletera** (bullets actualizados) y se agregó la
    **sección nueva “Folio 02 — El administrador · Manejarlo es así de sencillo”** (layout invertido:
    teléfono del admin a la izq en desktop, 3 bullets — guía de primeros pasos, “Marcar pagado” a un
    toque, ingresos de un vistazo — y CTA “Quiero mi administrador”). Folios renumerados 01-06.
  - **Verificado:** typecheck VERDE · captura full desktop con el flujo completo (ver página → comprar
    → administrar) · 0 pageerrors. *Nota:* regenerar las capturas si cambia mucho el diseño
    (`qa/diag-*`-style: login demo + puppeteer + sharp).
  - *Iteración (usuario): stats → insignias + rifa completa en un pantallazo.* En `PublicRifero.tsx`:
    se **eliminó la franja gorda de estadísticas** (tarjeta blanca de 3 columnas) y se reemplazó por
    **insignias compactas** bajo el nombre (“1 disponible · 1 sorteo realizado · 1 ganador”, chips
    text-[11px] con número en el color del rifero; ocultan los ceros; componente `Stat` borrado).
    `SectionTitle` rediseñado: **líneas decorativas degradadas a los lados** (más editorial, menos
    alto). Feed sube de mt-8/12 → mt-5/10. Resultado: ~90px menos antes de la rifa → la tarjeta
    completa con **“Comprar boletos”** entra en el pantallazo del demo. `demo-rifero.webp` regenerada
    a **390×968** (alto calculado para incluir el botón) — el teléfono del hero ahora muestra el
    recorrido completo (banner auto → perfil → insignias → rifa GMC → CTA). Typecheck VERDE · 0
    pageerrors · hero verificado.
  - *Iteración 2 (usuario): tarjeta de rifa ultracompacta.* En `RafflePost` (PublicRifero) se quitó el
    **talón de precio/vendidos completo y la barra de progreso** (no quiere exponer el total de boletos);
    el **precio va ahora a la derecha del título** (“Por boleto · $200”). Cuerpo final: título+premio |
    precio → botón. `pct` eliminado. **Resultado medido: el fondo del botón “Comprar boletos” queda en
    839px de un viewport de 844** → TODO el perfil + rifa + CTA caben en el primer pantallazo de un
    iPhone real. `demo-rifero.webp` regenerada a 390×859. Typecheck VERDE.
  - *Iteración 3 (usuario): recapturar con el diseño nuevo + cambiar el 2º teléfono del showcase.*
    `demo-rifero.webp` retomada (390×856, botón Comprar en 838px) con insignias/diseño compacto;
    **`demo-rifa.webp` regenerada como el INICIO de la rifa** (390×1020): título GMC DENALI 2026 +
    foto de la troca + “LISTA DE BOLETOS ABAJO” + **cuenta regresiva** (nuevo diseño de Cursor con
    segmentos y dos puntos) + “1 BOLETO POR $200” (alto calculado hasta esa fila). El showcase ahora
    muestra **perfil + inicio de rifa** (antes boletera); bullets actualizados; `demo-boletera.webp`
    eliminada. **Cache-busting `?v=3`** en las 4 imágenes demo de la landing (el usuario veía la
    versión vieja por caché del navegador). Typecheck VERDE · captura del showcase verificada.
  - *Iteración 4b (usuario): el teléfono izq. se veía alargado.* `demo-rifa.webp` re-capturada más
    corta: alto calculado hasta el pill “Sorteo · fecha” (fin de la cuenta regresiva, sin tabla de
    precios) → **390×758** vs 780 del derecho. Pareja proporcionada. Cache `?v=4`.
  - *Iteración 4 (corrección del usuario — yo había entendido al revés):* showcase final =
    **izquierda: inicio de la rifa GMC** (`demo-rifa.webp`, rotate -3°) y **derecha: boletera**
    (`demo-boletera.webp` re-capturada — boleto 0018 apartado, panel APARTAR, cuadrícula). El perfil
    (`demo-rifero.webp`) queda sólo en el teléfono del hero. Typecheck VERDE · captura verificada.
  - *Iteración 5 (usuario): la isla del iPhone tapaba el header/logo.* `PhoneReal` rediseñado: la isla
    ya no es un overlay absoluto sobre la captura — ahora vive en una **barra de estado propia**
    (franja negra h-6 con la píldora `#23262e` centrada) y la imagen empieza debajo. El logo del
    rifero se ve completo en los 5 teléfonos de la landing. Typecheck VERDE · verificado.
  - *Iteración 6 (usuario): el HERO vuelve a la isla flotante.* `PhoneReal` acepta `overlayIsland`:
    el teléfono del hero usa la isla superpuesta (la captura del perfil tiene aire arriba — el banner
    del auto — y se ve más limpio); showcase y admin conservan la barra de estado. Verificado.
- 🔠 **Titular del hero rediseñado (a pedido del usuario — “feo”, quería tipografía ANCHA con impacto):**
  - Fuente nueva **Archivo Expanded Black** (Google Fonts, eje `wdth@125`) → token `font-wide` en
    tailwind. H1 en **MAYÚSCULAS anchas** (`fontStretch:125%`), 1.7rem/2.7rem/3rem.
  - Fuera el subrayado garabato (helper `WORD` eliminado); “rifas” ahora es un **sticker menta**
    (`bg-brand-mint text-brand-ink`, -rotate-2, sombra menta) y “desde el celular” conserva el
    degradado azul. Look póster con impacto real.
  - 🐛 **Bug raíz encontrado:** el sticker salía transparente y `text-brand-ink` resolvía al ink VIEJO
    (#070b18) — **Vite tenía el `tailwind.config` cacheado de hace días** (los cambios de config no se
    recargan en caliente en este setup). **Reinicio del dev server** → `bg-brand-mint`, `font-wide` y el
    ink nuevo compilan en toda la app. *Lección: tras tocar `tailwind.config.ts`, reiniciar Vite.*
  - Verificado con capturas móvil 390 y desktop 1366: sticker menta sólido, tipografía ancha cargada.
  - *Iteración (idea del usuario, 3 preguntas confirmadas: rojo profundo + talón con serial + flotación
    sutil):* el sticker menta se reemplazó por **`TicketWord`** — un **boleto de rifa SVG** inline en el
    titular: cuerpo rojo profundo (gradiente #E04040→#B02323) con **dientes troquelados** (máscara de
    círculos en ambos lados), marco interior blanco, línea punteada de talón, **“RIFAS” en blanco**
    (Archivo 900 stretch 125%) y **serial “578271” rotado 90°** en el talón (Space Mono) — homenaje
    directo a la referencia del boleto clásico. Escala con la fuente (`h-[1.32em]`), flota con keyframe
    propio `ticket-float` (rotate -3°→-1.5°, ±4px) y sombra roja. Helper `WORD` ya eliminado antes.
    Typecheck VERDE · capturas móvil/desktop verificadas.
- 🎛️ **Bento de beneficios rediseñado (usuario: “más descriptivo gráficamente”; 3 preguntas
  confirmadas: mini-UIs dibujadas + jerarquía 3 grandes/4 compactas + micro-animaciones sutiles):**
  - **3 protagonistas** (lg:col-span-4) con mini-interfaces animadas:
    1. *WhatsApp*: conversación real — burbuja de orden con chips de boletos (0045/0112/0309), total,
       “10:42 ✓✓” y burbuja de **“escribiendo…” con 3 puntos animados** (keyframe `typing-dot`).
    2. *Boleto digital*: ticket negro con borde troquelado (`ticket-edge`), **QR dibujado en SVG** con
       **línea de escaneo menta** barriendo (keyframe `qr-scan`) y pill “✓ PAGADO”.
    3. *Tómbola*: **jaula punteada girando** (keyframe `drum-spin`, 12s) con 3 bolitas numeradas
       (azul/rojo/menta, flotando con `animate-float` desfasado) y trofeo al centro.
  - **4 compactas** (lg:col-span-3, layout horizontal icono+texto): Pagos directos, Tu marca,
    Administra desde el celular, Confianza que vende. Grid `lg:grid-cols-12`.
  - Keyframes nuevos en `index.css` (typing-dot, qr-scan, drum-spin) — respetan
    `prefers-reduced-motion` por la regla global. Iconos Palette/Smartphone/ShieldCheck re-añadidos,
    QrCode (lucide) eliminado (el QR ahora es SVG propio). MiniConfirm eliminado.
  - Typecheck VERDE · capturas desktop (fila de 3 + fila de 4) y móvil verificadas · 0 pageerrors.
  *(Nota: Cursor trabajó en paralelo — LogoMark nuevo en nav y BENTO previo reducido; reconstruí sobre
  su estado vigente.)*
  - *Iteración 2 (usuario: “muy cargado”, “más profesional”, “cuida equipos de baja potencia”):*
    **Fuera las 4 compactas** — el bento queda en **3 tarjetas** (md:grid-cols-3) con más aire (gap-5,
    p-6, rounded-3xl). Nuevo componente `BentoCard`: icono con **degradado azul de profundidad**
    (electric→deep + sombra), folio discreto, visual anclado abajo. **Rendimiento:** cada tarjeta usa
    `useInView` y aplica `.anim-paused` (animation-play-state: paused) cuando sale de pantalla — las
    micro-animaciones no queman CPU/GPU a ciegas; `PhoneReal` ahora carga **lazy + decoding=async**
    (sólo el hero queda eager). Iconos de las compactas removidos de imports.
- 💎 **Planes llevados al siguiente nivel (a pedido del usuario):** sección reescrita:
  - **Pro = pieza central**: tarjeta de **tinta** (bg-brand-ink) elevada con glow azul, pestaña superior
    menta “★ MÁS POPULAR”, checks menta y **CTA azul eléctrico con sombra luminosa**.
  - Básico/Verificado: blancas limpias con hover suave, checks azules, **CTA tinta**.
  - **Precios en Archivo expandida** (`font-wide`, 2.6rem, stretch 125%) — pegan fuerte.
  - El plan **Verificado muestra el rosetón `VerifiedBadge` real** junto a su nombre (amarre de producto).
  - Conservados: perforación con muescas, “Serie XXX-00N”, nota de activación. Import de VerifiedBadge
    agregado; `meta.icon` ya no se usa en la tarjeta (PLAN_META lo conserva).
  - Typecheck VERDE · captura verificada (Pro destaca al centro, jerarquía clara) · 0 pageerrors.
- 💬 **Burbuja flotante de WhatsApp en la landing (a pedido del usuario):** `WhatsAppFab` en
  `Landing.tsx` — verde oficial #25D366, `WhatsappIcon` real, label “¿Dudas? Escríbenos” (sm+; en
  móvil sólo icono), ping sutil, y **`useHideOnScroll`** (se esconde al bajar, reaparece al detenerse —
  consistente con tuerca/SafeSeal). **Número real extraído de bismarkdigital.com** con curl:
  `wa.me/5216629480105`, mensaje prellenado “Hola 👋 Vengo de la página de Bismark…”. Verificado:
  visible con href correcto · se oculta/reaparece al scrollear · 0 pageerrors · typecheck VERDE.
  - *Iteración (usuario): 2 pantallas en la sección del administrador.* Sembré **4 apartados realistas**
    en el demo vía el endpoint público (`qa/seed-demo-orders.mjs`, utilidad conservada — los apartados
    vencen a las 2h, re-correr si se quiere la demo “viva”) y capturé **`demo-ordenes.webp` (NUEVA)**:
    órdenes Apartadas con boletos chips, “$800 · Vence en 1h 59m”, botones **Marcar pagado/Rechazar/
    Cancelar/WhatsApp** y badge ④ en el tab Órdenes. La sección “El administrador” ahora muestra
    **2 teléfonos inclinados** (Inicio + Órdenes), espejo de la composición del showcase. Typecheck
    VERDE · captura de sección OK.
