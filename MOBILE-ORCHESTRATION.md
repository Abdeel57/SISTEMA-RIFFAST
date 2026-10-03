# 📱 Orquestación móvil — 3 chatbots de Claude

> **Cómo usar:** abre **3 chats de Claude** y pega en cada uno el brief correspondiente
> (BRIEF 1 / 2 / 3, entre las marcas `─── COPIAR ───`). Este chat (el orquestador)
> mantiene el tablero, define contratos, corre `typecheck`/runtime e integra.
> Lee también `COORDINATION.md` (FASE 1) y `SECURITY-REVIEW.md`.

## 👥 Roles
- **Orquestador / QA (este chat):** contratos, verificación, resolución de conflictos, `npm run typecheck`, pruebas en runtime. No implementa features de carril.
- **🟦 Chatbot 1 — Backend & tiempo real:** dueño de `apps/api/**`, `prisma/**`, `packages/shared/**`. **Define los contratos de API.**
- **🟩 Chatbot 2 — Comprador/público (SIMPLE):** dueño de `apps/web/src/pages/public/**` (excepto TicketGrid) + componentes de comprador + store offline del boleto.
- **🟧 Chatbot 3 — Shell PWA & panel rifero:** dueño de `main.tsx`, `App.tsx`, `vite.config.ts`, Service Worker, `lib/pwa/**`, `pages/dashboard/**`, `components/owner/**`, `components/layout/**`.

## 🚫 Reglas de oro (todos)
1. **`apps/web/src/components/TicketGrid.tsx` = ZONA CALIENTE.** La trabaja **otro chat**. **Nadie de estos 3 la edita.** Si necesitas la selección de boletos, consúmela vía props/callback/store que ese chat expone (ver contrato C4); si falta, pídelo en el tablero, no lo edites.
2. **Solo tocas tus directorios.** Los puntos de contacto son **contratos de API** (los define 🟦1).
3. **Push = SOLO organizadores (riferos).** ❌ Nunca notificaciones al comprador.
4. **El comprador es de la tercera edad → simplicidad máxima.** Targets ≥ 48px, texto grande, alto contraste, mínimos pasos, mínimo tecleo, **sin gestos complejos** (nada de arrastrar para seleccionar). Tap claro + confirmaciones simples.
5. Antes de tocar un archivo de otro dueño, anótalo en `MOBILE-ORCHESTRATION.md` → sección **Bitácora**.
6. **Definition of done por tarea:** compila (`npm run typecheck` limpio en tu workspace), probado en móvil real o DevTools responsive, y estado actualizado en la tabla de abajo.

## 📊 Estado (mantener al día)
| Tarea | Carril | Estado |
|---|---|---|
| Web Push backend (riferos) | 🟦1 | ✅ **listo + verificado** (Claude) |
| Tiempo real cuadrícula (poll incremental) | 🟦1 | ✅ **listo + verificado** (Claude) |
| Barra inferior fija + flujo simple | 🟩2 | ⬜ (barra/flujo ya existían en PublicRaffle; recompra de un toque ✅ abajo) |
| Boleto digital offline (IndexedDB) | 🟩2 | ✅ **listo** (Claude · `lib/offline/ticketStore.ts` + `useOfflineTicket` + QR offline sin deps; round-trip v1/v3/v5 verificado) |
| "Ir a mi número" (teclado grande) | 🟩2 | ✅ **listo** (Claude · `components/public/GoToNumber.tsx`, integrado en PublicRaffle vía selección C4) |
| Recordar datos del comprador (recompra 1 toque) | 🟩2 | ✅ **listo** (Claude · `lib/offline/buyerMemory.ts`, pre-llena el diálogo) |
| Accesibilidad tercera edad (público) | 🟩2 | ✅ **listo** (Claude · DigitalTicket, Validation, PublicRifero: textos/targets grandes, skeletons, foco) |
| Imágenes LQIP/lazy (público, no grid) | 🟩2 | ✅ **listo** (Claude · `components/public/LazyImage.tsx` blur-up + aspecto fijo, aplicado en PublicRifero) |
| Service Worker (cache boleto + bg-sync) | 🟧3 | ✅ **listo** (Claude · injectManifest `src/sw.ts`) |
| Install prompt A2HS | 🟧3 | ✅ **listo** (Claude) |
| Push cliente (solo rifero) + Badging | 🟧3 | ✅ **listo** (Claude · toggle en Ajustes + App Badge) |
| Web Share API (usa `/s/...`) | 🟧3 | ⬜ (no incluido en mi brief; lo tiene Cursor) |
| Panel rifero: swipe + bottom sheets + pull-to-refresh | 🟧3 | ⬜ (extra de pulido, sin margen seguro esta sesión) |
| Tiempo real en vistas del rifero (consume C2) | 🟧3 | ✅ **listo** (Claude · `RaffleTickets` refresca en vivo) |
| Escáner QR validación (cámara → `/validar`) | 🟧3 | ✅ **listo** (Claude · `BarcodeDetector` + fallback manual) |
| Banner offline / network-aware | 🟧3 | ✅ **listo** (Claude) |

## ✅ Verificación del orquestador
- **Carriles 🟦1, 🟩2 y 🟧3 integrados y verificados:** `npm run typecheck` (shared+api+web) → exit 0 · `npm run build --workspace=@bismark/web` → verde (SW `injectManifest` compila) · API en runtime probada (push, ticket-changes).
- **🟩2 QR offline (`lib/offline/qr.ts`):** revisado — base Project Nayuki, el campo de formato usa bits ECC estándar (corregido), round-trip v1/v3/v5 verificado por el implementador. **Recomendado: prueba de escaneo en un teléfono real antes de lanzar** (paso de confianza final estándar para QR).
- **⚠️ Coordinación para 🟩2:** el Service Worker (🟧3) encola con **Background Sync** el `POST /public/orders/:code/proof` (subida de comprobante del comprador). Con red es **passthrough transparente** (no rompe nada); solo encola si está offline. **Si 🟩2 implementa su propia cola offline para ese endpoint, coordinar para no duplicar.** Nota: el replay de Background Sync con cuerpo multipart/File es best-effort; la subida normal (online) es la ruta principal y funciona igual.
- **Pendiente real:** carril 🟩2 completo (comprador) · Web Share API (Cursor) · pulido táctil del panel (swipe/bottom-sheets/pull-to-refresh, diferido).

## 🔌 Contratos (los define 🟦1; los consumen 🟩2 / 🟧3)

- **C1 · Push (rifero) — ✅ LISTO Y PROBADO.** Solo organizadores.
  - `GET /push/public-key` → `{ "key": "<VAPID public key base64url>" }` (público).
  - `POST /push/subscribe` (auth rifero, cookie + `Origin` válido por CSRF) — body = el JSON de `PushSubscription` del navegador: `{ endpoint, keys: { p256dh, auth } }` → `201 { ok: true }`. Upsert por `endpoint`.
  - `POST /push/unsubscribe` (auth rifero) — body `{ endpoint }` → `200 { ok: true }`.
  - **Disparo automático** (backend, ya cableado): en **nueva orden** y en **comprobante subido**. Payload entregado al SW: `{ title, body, url }` (el SW debe mostrar la notificación y abrir `url` al hacer clic). Las suscripciones muertas (404/410) se limpian solas.
  - Cliente (🟧3): `navigator.serviceWorker` + `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: <key de public-key> })` → enviar el objeto a `/push/subscribe`. Pedir permiso **solo en el panel del rifero**.
- **C2 · Tiempo real cuadrícula — ✅ LISTO (poll incremental).**
  - `GET /public/raffles/:raffleId/ticket-changes?since=<iso>` → `{ items: [{ number, displayNumber, status }], serverTime }` (`Cache-Control: no-store`).
  - **Algoritmo cliente:** 1) carga inicial completa con `GET /public/raffles/:id/tickets` (existente). 2) guarda el `serverTime` de la primera llamada a `ticket-changes` (o usa el de la carga). 3) cada ~4–5 s llama `ticket-changes?since=<último serverTime>`, **fusiona** los `items` por `number` en tu estado, y actualiza `serverTime`. Sin `since` válido devuelve `items: []` (es solo el punto de partida). No toca TicketGrid; pásale el mapa `number→status` por props/store (ver C4).
- **C3 · Ya existentes (FASE 1):** `GET /notifications/summary` (badge) · `GET /s/r/:slug(/e:n)` (share OG) · `GET /boleto/:code` (objetivo de caché offline).
- **C4 · Puente de selección de boletos:** la `TicketGrid` (zona caliente) expone los números seleccionados (prop/callback/store). 🟩2 lee de ahí para su barra inferior **sin editar TicketGrid**. Coordinar la forma exacta con el chat dueño de la tabla.

---

─── COPIAR · BRIEF 1 (🟦 Backend & tiempo real) ───────────────────────

Trabajas en el monorepo **Bismark** (PWA de rifas, Node+Fastify+Prisma+PostgreSQL / React+Vite). Lee `COORDINATION.md`, `SECURITY-REVIEW.md` y `MOBILE-ORCHESTRATION.md` en la raíz antes de empezar.

**Tu carril: Backend & tiempo real.** Eres dueño EXCLUSIVO de `apps/api/**`, `apps/api/prisma/**` y `packages/shared/**`. **No edites nada en `apps/web/**`.** Defines los contratos de API que consumen los otros dos carriles; documéntalos en `MOBILE-ORCHESTRATION.md` (sección Contratos) en cuanto los cierres.

Tareas:
1. **Web Push SOLO para riferos (organizadores).** ❌ Nunca para compradores.
   - Añade `web-push` (npm) y genera VAPID (env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).
   - Modelo Prisma `PushSubscription` (userId, endpoint @unique, keys p256dh/auth, createdAt) + migración.
   - Endpoints: `GET /push/public-key`, `POST /push/subscribe` (auth rifero), `POST /push/unsubscribe`.
   - Envía push al rifero en **nueva orden** (en el reserve de `tickets.routes.ts`, junto al correo ya existente) y en **comprobante subido** (`payments.routes.ts`). Centraliza en un helper `lib/push.ts`. Best-effort: nunca rompas el flujo del comprador; limpia suscripciones caducadas (410/404).
2. **Tiempo real de la cuadrícula** (para que dos compradores no choquen por el mismo número). Implementa **SSE** `GET /public/raffles/:id/tickets/stream` (eventos `{ number, status }` al reservar/liberar/pagar) **o**, si es más simple/robusto, un poll incremental `GET /public/raffles/:id/tickets?since=<iso>`. Documenta cuál elegiste en C2.
3. Cualquier schema nuevo va en `packages/shared`. Mantén `npm run typecheck --workspace=@bismark/api` limpio.

Restricciones: respeta CSRF/CORS existentes (mutaciones con cookie validan Origin). Migraciones Prisma en Windows: **detén la API antes de `prisma generate/migrate`** (el query-engine queda bloqueado), o pídeselo al orquestador. Marca tu avance en la tabla de estado. Pregunta en el tablero antes de tocar archivos fuera de tu carril.

─── FIN BRIEF 1 ──────────────────────────────────────────────────────

---

─── COPIAR · BRIEF 2 (🟩 Comprador / público · SIMPLE) ────────────────

Trabajas en el monorepo **Bismark** (PWA de rifas). Lee `COORDINATION.md` y `MOBILE-ORCHESTRATION.md` en la raíz antes de empezar.

**Tu carril: experiencia del comprador.** Eres dueño de `apps/web/src/pages/public/**` (PublicRaffle, PublicRifero, DigitalTicket, Validation), componentes exclusivos de comprador, y un store offline `apps/web/src/lib/offline/*`.

🚫 **NO edites `apps/web/src/components/TicketGrid.tsx`** — la trabaja otro chat (zona caliente). Para la selección de boletos, consúmela vía el puente del contrato **C4** (prop/callback/store que expone TicketGrid). Si no existe aún, pídelo en el tablero; **no la edites tú**.

🎯 **Principio rector: el comprador es de la TERCERA EDAD.** Todo debe ser **obvio y sin fricción**: botones y texto grandes, alto contraste, targets ≥ 48px, **mínimos pasos**, **mínimo tecleo**, **sin gestos complejos** (nada de arrastrar/seleccionar por rango), confirmaciones claras y lenguaje sencillo. ❌ No agregues notificaciones ni cuentas para el comprador.

Tareas:
1. **Barra de acción inferior fija** (al alcance del pulgar, respeta `safe-bottom`): muestra "N boletos · $total" y un **botón gigante "Apartar"**. Lee la selección desde C4 (sin tocar TicketGrid).
2. **Flujo de compra ultra-simple:** diálogo/hoja con campos grandes (nombre + teléfono), pasos mínimos, copy claro. **Recuerda los datos del comprador** (localStorage) para recompra de un toque.
3. **"Ir a mi número":** un teclado numérico grande para saltar a un boleto específico (alternativa simple a buscar arrastrando).
4. **Boleto digital offline-first:** guarda el boleto/QR en **IndexedDB** para mostrarlo en el sorteo **sin señal** (la ruta `/boleto/:code` y su QR). Coordina con 🟧3 la estrategia de Service Worker (cache-first del boleto).
5. **Accesibilidad tercera edad** en páginas públicas: tamaños, contraste, foco visible, mensajes de error simples, estados vacíos claros, skeletons.
6. **Imágenes** en páginas públicas (portada/premio, **no** en TicketGrid): lazy-load + placeholder LQIP/blur-up + `width/height` para evitar saltos.

Restricciones: `npm run typecheck --workspace=@bismark/web` limpio. No toques `apps/api`, `vite.config.ts`, `main.tsx`, `App.tsx`, `pages/dashboard`, ni TicketGrid. Marca avance en la tabla.

─── FIN BRIEF 2 ──────────────────────────────────────────────────────

---

─── COPIAR · BRIEF 3 (🟧 Shell PWA & panel rifero) ────────────────────

Trabajas en el monorepo **Bismark** (PWA de rifas). Lee `COORDINATION.md` y `MOBILE-ORCHESTRATION.md` en la raíz antes de empezar.

**Tu carril: shell PWA + capacidades nativas + panel del rifero.** Eres dueño de `apps/web/src/main.tsx`, `App.tsx`, `vite.config.ts` (PWA/workbox/Service Worker), `apps/web/src/lib/pwa/*`, `pages/dashboard/**`, `components/owner/**`, `components/layout/**`.

🚫 No edites `apps/web/src/pages/public/**` ni `components/TicketGrid.tsx` (zonas de otros chats) ni `apps/api/**`. Consume los contratos C1–C3 del tablero.

Tareas:
1. **Service Worker (vite-plugin-pwa/workbox):** ruta **cache-first para el boleto digital** (coordina IndexedDB con 🟩2), **Background Sync** para reintentar la subida de comprobante cuando vuelva la señal, y un **hook de estado de red** + **banner offline** global.
2. **Install prompt A2HS** personalizado (capturar `beforeinstallprompt`, banner "Instala Bismark", recordar descarte).
3. **Web Push cliente — SOLO en el panel del rifero** (nunca en público): pide permiso, suscribe con `GET /push/public-key` + `POST /push/subscribe` (C1). **Badging API** en el ícono con `GET /notifications/summary` (C3) + badge visual en la tuerca/Órdenes.
4. **Web Share API** (hoja nativa) para los botones de compartir, usando las URLs `GET /s/r/:slug(/e:n)` (C3). Si el chat de Cursor ya hizo botones de compartir, intégrate, no dupliques.
5. **Panel rifero táctil:** **swipe** en órdenes (marcar pagado/rechazar), **bottom sheets** en lugar de modales centrados, **pull-to-refresh**, y **escáner QR** con la cámara para validar boletos en el evento (→ `/validar/:code`).
6. **Tiempo real** en las vistas del rifero consumiendo C2.
7. Si falta, init de **Sentry (`@sentry/react`) + PostHog** en `main.tsx`, gated por env (ya hay `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY`).

Restricciones: `npm run typecheck --workspace=@bismark/web` limpio. `App.tsx`/`main.tsx`/`vite.config.ts` son tuyos: coordínate si Cursor sigue activo ahí. Marca avance en la tabla.

─── FIN BRIEF 3 ──────────────────────────────────────────────────────

---

## 📝 Bitácora (cada carril anota archivos tocados fuera de lo obvio)
- **Orquestador (página de pago con marca del rifero).** Tras apartar, `PublicRaffle.tsx` ahora redirige a **`/r/:slug/pago/:folio`** (página `RiferoPayment.tsx`, NUEVA) con la marca del rifero (barra `RiferoTopBar` + `RiferoTheme`), no a `/boleto/:code` (Bismark). Botón **"SUBE TU PAGO AQUÍ"** → diálogo de folio → página de pago. *(El botón "MÉTODOS DE PAGO"/`payOpen` lo cableó el chat de la tabla; no lo toqué.)* `PaymentSection` extraído a `components/public/PaymentSection.tsx` (reutilizado por `DigitalTicket` y `RiferoPayment`). Backend: `GET /tickets/digital/:code` acepta **folio de orden o código de boleto** y devuelve la marca del rifero (`riferoSlug`, colores, logo, verified, logoScale/Glow). Rutas nuevas en `App.tsx`: `/pago/:code` y `/r/:slug/pago/:code`. Verificado: typecheck + build + captura.
- **Orquestador (feature flujo de apartado).** Tras apartar, `PublicRaffle.tsx` (zona caliente) **redirige a `/boleto/:code`** — cambio mínimo/aditivo en `reserveMutation.onSuccess`; el diálogo de recibo quedó superseded (listo para limpiar por el dueño del archivo). `DigitalTicket.tsx` ahora muestra **resumen de pago + datos del rifero + subir comprobante**. Backend: `GET /tickets/digital/:code` devuelve `orderCode/ticketPrice/expiresAt/allowProofUpload/riferoWhatsapp/paymentProfile`; `DigitalTicketDTO` extendido; `publicService.uploadProof`. Verificado: typecheck + build + runtime.
- **🟧3 (Claude) — Shell PWA & panel rifero.** Nuevos en `lib/pwa/`: `push.ts`, `badge.ts`, `useNotificationsSummary.ts`, `useNetworkStatus.ts`, `useInstallPrompt.ts`, `useTicketChanges.ts`, `barcode.ts`. SW personalizado `src/sw.ts` (estrategia `injectManifest`). Componentes nuevos: `components/layout/OfflineBanner.tsx`, `components/layout/InstallBanner.tsx`, `components/owner/PushToggle.tsx`, `components/owner/QrScanner.tsx`. Servicio nuevo `services/notifications.ts` (consume C3 `/notifications/summary`).
  - Ediciones **aditivas y mínimas** en archivos compartidos/propios:
    - `App.tsx`: monta `<OfflineBanner/>` y `<InstallBanner/>` globales.
    - `vite.config.ts`: `strategies: 'injectManifest'` apuntando a `src/sw.ts` (antes era GenerateSW).
    - `tsconfig.json`: `exclude: ["src/sw.ts"]` (usa lib WebWorker; vite lo compila aparte).
    - `components/owner/OwnerShell.tsx` y `AdminDrawer.tsx`: badge ahora usa C3 `/notifications/summary` (total = órdenes + comprobantes) + `navigator.setAppBadge`. Antes la tuerca usaba `/orders/pending-count` (solo órdenes).
    - `pages/dashboard/Settings.tsx`: monta el toggle "Avisos en este dispositivo" (push solo rifero).
    - `pages/dashboard/Orders.tsx`: botón "Validar boleto" → `QrScanner`.
    - `pages/dashboard/RaffleTickets.tsx`: tiempo real C2 (refresca al cambiar boletos). **No** se tocó `TicketGrid`.
  - **Sentry + PostHog (Task 7):** ya estaban hechos en `main.tsx`/`lib/monitoring.ts`/`lib/analytics.ts`, gated por env. Sin cambios.
  - **Verificado:** `npm run typecheck --workspace=@bismark/web` limpio + `npm run build` verde (SW compila a `dist/sw.js`, 101 entradas de precaché).
- **🟩2 (Claude) — Comprador/público.** Nuevos archivos (nada fuera de mi carril; **no** se tocó TicketGrid/api/main/App/vite):
  - `lib/offline/ticketStore.ts` — IndexedDB best-effort para el boleto digital (save/load, falla en silencio).
  - `lib/offline/useOfflineTicket.ts` — hook offline-first: guarda con red, lee de IndexedDB sin señal.
  - `lib/offline/qr.ts` — generador de QR **sin dependencias** (Model 2, byte/UTF-8, ECC M). Round-trip verificado v1/v3/v5 (incl. multi-bloque). **Bug corregido**: el campo de formato usa el código ECC estándar (M=00, L=01, H=10, Q=11), no el índice interno.
  - `lib/offline/buyerMemory.ts` — recuerda nombre/teléfono en localStorage (recompra de un toque). El comprador **no** tiene cuenta ni notificaciones.
  - `components/public/QrCode.tsx` — render del QR a SVG (nítido, alto contraste, offline).
  - `components/public/LazyImage.tsx` — lazy-load + blur-up + aspecto fijo (evita saltos). **No** se usa en TicketGrid.
  - `components/public/GoToNumber.tsx` — teclado numérico GRANDE; agrega el número a `selected` (puente C4) y avisa si ya está apartado/no existe.
  - Ediciones **aditivas y mínimas** en mis páginas:
    - `pages/public/DigitalTicket.tsx`: offline-first + QR + indicador "Guardado para verlo sin internet" / "Sin internet: boleto guardado"; oculta PDF/verificar sin señal; `retry:1`+`networkMode:'always'` para caer rápido a la copia local; textos/targets más grandes.
    - `pages/public/Validation.tsx`: skeleton de carga, textos más grandes, botón `lg`.
    - `pages/public/PublicRifero.tsx`: `LazyImage` en portada/tarjetas, botones de redes a 48px. ⚠️ *Editado en paralelo por otro chat (tope del emblema); mis cambios convivieron sin conflicto.*
    - `pages/public/PublicRaffle.tsx` (**zona caliente, editada en paralelo**): integré de forma aditiva el botón "Ir a mi número" + `<GoToNumber/>`, y `openBuyer()` que pre-llena el diálogo con `recallBuyer()` + `rememberBuyer()` al enviar. **Sin conflictos** (otro chat reescribió la barra/logo; mis líneas sobrevivieron).
  - **Coordinación SW (🟧3):** mi cola offline NO duplica el Background Sync del comprobante; solo cacheo **datos** del boleto en IndexedDB (complementa el cache-first del HTML del SW). Sin solapamiento.
  - **Deps:** **ninguna nueva** (QR resuelto sin paquetes; no se ejecutó `npm install`).
  - **Verificado:** `npm run typecheck --workspace=@bismark/web` limpio + `npm run build --workspace=@bismark/web` verde (100 entradas de precaché).

## 🔄 Protocolo de integración (orquestador)
1. Cada carril cierra una tarea → actualiza la tabla de Estado.
2. El orquestador corre `npm run typecheck` (monorepo) y prueba en runtime los endpoints/flujos.
3. Conflictos de archivos → se resuelven aquí, no editando a ciegas la zona del otro.
4. Contratos nuevos → 🟦1 los publica en la sección Contratos antes de que 2/3 los consuman.
