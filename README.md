# Riffast — Página de Rifas (plantilla por cliente) 🎟️

Sitio web **PWA de rifas para UN solo organizador**. Cada cliente recibe su propia copia desplegada en Railway (backend + base de datos + frontend en **un solo servicio**). La página pública del rifero es la **página principal** del sitio; el administrador vive en **`/admin`** detrás de un inicio de sesión.

- **Mobile-first**, instalable como app (PWA), modo claro/oscuro.
- Pensada para público **mexicano**. WhatsApp como canal principal. Pagos manuales directos al organizador.
- Pie de página discreto **"Desarrollado por Riffast"** con enlace al WhatsApp de Riffast (configurable).

---

## 🗺️ Rutas del sitio

| Ruta | Qué es |
|------|--------|
| `/` | Página pública del rifero (perfil, rifas disponibles, ganadores, FAQ) |
| `/e1`, `/e2`, … | Detalle de cada rifa (apartar boletos) |
| `/verificar` | El comprador busca sus boletos por teléfono |
| `/boleto/:code` | Boleto digital con QR |
| `/validar/:code` | Validación pública de un boleto (día del sorteo) |
| `/login` | Inicio de sesión del administrador |
| `/admin` | Administrador del rifero (rifas, órdenes, pagos, diseño, reportes) |

No hay registro público, ni planes, ni landing: todo eso se eliminó. La cuenta del administrador la crea el seed automáticamente.

### Credenciales iniciales

| Usuario | Contraseña |
|---------|------------|
| `Riffast` | `admin123` |

Se pueden personalizar por cliente con las variables `ADMIN_USER` / `ADMIN_PASSWORD` (solo aplican la primera vez; el seed es idempotente y nunca pisa datos existentes).

---

## 🧱 Arquitectura

Monorepo con **npm workspaces**:

```
/apps
  /web    → Frontend PWA: React + Vite + TypeScript + Tailwind + React Router + TanStack Query + Zustand
  /api    → Backend: Node + TypeScript + Fastify + Prisma + PostgreSQL + Zod
/packages
  /shared → Tipos, enums, validaciones Zod y utilidades compartidas (contrato API)
```

- En producción la **API sirve también el frontend compilado** (`apps/web/dist`): un solo servicio, un solo dominio. La API vive bajo `/api`, los enlaces para compartir (Open Graph) bajo `/s/...` y las imágenes en `/uploads/...`.
- **Archivos** (logos, portadas, comprobantes) se guardan en **Postgres** en producción (`STORAGE_DRIVER=db`), así que sobreviven a los redeploys sin Volume. Almacenamiento configurable: `db` (default en prod), `local` (default en dev), `cloudinary` o `s3`.

---

## 🚀 Desarrollo local

```bash
# 1) Instalar dependencias
npm install

# 2) Variables de entorno
#    Windows PowerShell:
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
#    Bash/macOS/Linux:
#    cp apps/api/.env.example apps/api/.env && cp apps/web/.env.example apps/web/.env.local

# 3) Base local portátil + migraciones + seed (un solo comando)
npm run setup:local

# 4) Arrancar API + Web juntos
npm run dev                  # API :4000  ·  Web :5173

# Para detener la base local:
npm run db:local:stop
```

Entra a `http://localhost:5173/admin` con `Riffast` / `admin123`.

---

## ☁️ Desplegar una copia para un cliente (Railway)

Cada cliente = un proyecto de Railway con **2 cosas**: el servicio de la app y una base Postgres. **Todo** (datos, imágenes y comprobantes) vive en Postgres, así que **NO hay nada que se pierda al hacer redeploy** y **no hace falta Volume**.

1. **Crea un proyecto** en Railway y agrega el plugin **PostgreSQL**.
2. **Agrega un servicio** desde este repositorio (o un fork/copia por cliente). El `railway.json` de la raíz ya define todo:
   - Build: `npm install && npm run build` (compila shared + api + web en un solo servicio).
   - Start: migra la base → corre el seed (idempotente) → arranca la API (que también sirve el frontend).
3. **Variables del servicio** (pestaña Variables):
   - `DATABASE_URL` → **lo único indispensable.** Referencia al plugin Postgres: `${{ Postgres.DATABASE_URL }}`
   - Opcionales (recomendados por seguridad): `JWT_SECRET` y `COOKIE_SECRET` (secretos aleatorios de 32+ chars). Si no se definen, se derivan de `DATABASE_URL` de forma estable, así que el deploy funciona sin tocarlos y las sesiones no se invalidan entre redeploys.
   - Opcionales por cliente: `ADMIN_USER`, `ADMIN_PASSWORD`, `SITE_NAME` (nombre inicial de la página).
4. **Dominio**: genera el dominio público (o conecta el dominio del cliente, ej. `rifadeejemplo.com`).

Listo: la raíz del dominio muestra la página del rifero y `tudominio.com/admin` pide iniciar sesión. Cada vez que hagas redeploy, **los datos y las imágenes se conservan** (viven en Postgres).

> **Imágenes y comprobantes**: en producción se guardan automáticamente en Postgres (tabla `StoredAsset`, `STORAGE_DRIVER=db`) y se sirven en `/uploads/<key>`. Sobreviven a los deploys sin depender de un disco ni un Volume. En desarrollo local se usa disco (`apps/api/uploads/`).

> El WhatsApp del pie "Desarrollado por Riffast" se define **al compilar** con `VITE_RIFFAST_WHATSAPP` (en `apps/web/.env.production` o como variable del servicio en Railway).

---

## 🤖 Asistencia 24 h (chat con IA)

El botón verde de audífonos del administrador abre **Asistencia 24 h**. Con `AI_API_KEY` es un chat con IA que resuelve dudas, hace cambios por el rifero (siempre con una tarjeta de **Confirmar**) y agenda llamadas urgentes con el equipo. **Sin `AI_API_KEY` la hoja se queda como antes.**

### Variables (en `apps/api/.env` en local; en Railway, pestaña *Variables* del servicio)

```
AI_API_KEY=                     # la única obligatoria
# AI_PROVIDER= AI_MODEL= AI_BASE_URL= AI_VISION= AI_MAX_TOKENS= AI_TIMEOUT_MS=
ASISTENTE_MARCA=Riffast
ASISTENTE_HORARIO_LLAMADAS=de 9:00 a 21:00, hora del centro de México
# ASISTENTE_LIMITE_DIARIO=150
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
# ASISTENTE_WEBHOOK_URL=
```

| Variable | Para qué |
|---|---|
| `AI_API_KEY` | Clave del proveedor de IA. Es la única obligatoria y **nunca sale del servidor**. |
| `AI_PROVIDER` | Forzar proveedor: `anthropic`, `openai`, `gemini`, `openrouter`, `groq`, `deepseek`, `xai`, `mistral`, `cerebras` o `compatible`. |
| `AI_MODEL` | Cambiar el modelo (si el de por defecto ya no existe, el log lo dice: «pon AI_MODEL»). |
| `AI_BASE_URL` | Cualquier API compatible con OpenAI (Ollama, Together, Fireworks…), junto con `AI_PROVIDER=compatible`. |
| `AI_VISION` | `true`/`false` para forzar si el modelo lee fotos (tarjetas, capturas del banco). |
| `AI_MAX_TOKENS` / `AI_TIMEOUT_MS` | Por defecto 2048 y 60000. |
| `ASISTENTE_MARCA` | Nombre con el que se presenta el asistente y que llevan los avisos. |
| `ASISTENTE_HORARIO_LLAMADAS` | Horario que el bot promete para las llamadas. |
| `ASISTENTE_LIMITE_DIARIO` | Mensajes por cuenta cada 24 h (150 por defecto). |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Avisos al equipo al instante (llamadas 📞, reportes 📝, IA caída ⚠️). |
| `ASISTENTE_WEBHOOK_URL` | Opcional: los mismos avisos en JSON para WhatsApp, Make, n8n o un CRM. |

Cada aviso dice **de qué cliente y de qué página** viene (nombre de la página + `PUBLIC_WEB_URL` o el dominio de Railway), porque cada cliente es un despliegue aparte.

### Cambiar de proveedor de IA = cambiar `AI_API_KEY`

El proveedor se detecta por el prefijo de la clave; no hay que tocar código:

| Prefijo | Proveedor | Modelo por defecto | ¿Lee fotos? |
|---|---|---|---|
| `sk-ant-` | Anthropic | `claude-haiku-4-5-20251001` | sí |
| `sk-or-` | OpenRouter | `google/gemini-3.1-flash-lite` | sí |
| `AIza` o `AQ.` | Gemini (las claves nuevas de AI Studio empiezan con `AQ.Ab`) | `gemini-3.1-flash-lite` | sí |
| `gsk_` | Groq | `openai/gpt-oss-120b` | no |
| `xai-` | xAI | `grok-4-1-fast-non-reasoning` | sí |
| `csk-` | Cerebras | `gpt-oss-120b` | no |
| `sk-` + 32 hex | DeepSeek | `deepseek-chat` | no |
| otro `sk-` | OpenAI | `gpt-5.4-mini` | sí |
| sin prefijo | pon `AI_PROVIDER` (p. ej. `mistral` → `mistral-small-latest`) | | |

Al arrancar, el log muestra la línea `Asistencia 24 h: IA lista (proveedor=… modelo=… imágenes=…)` (sin la clave). Si la clave no se reconoce o el modelo no existe, el chat responde amable, ofrece **Pedir llamada** y llega una alerta al equipo (máximo una por hora).

**Una sola clave para todos los clientes en Railway.** Cada cliente es un *proyecto* de Railway, y las *Shared Variables* solo se comparten dentro de un mismo proyecto. Opciones:
- Lo normal: pon `AI_API_KEY` en las *Variables* del servicio de cada proyecto (al rotar la clave, se cambia en cada uno).
- Si juntas varios clientes en **un mismo proyecto** (un servicio + una base por cliente): en *Project Settings → Shared Variables* crea `AI_API_KEY` y en cada servicio agrega la variable `AI_API_KEY=${{shared.AI_API_KEY}}`. Así se cambia en un solo lugar.

### Crear el bot de Telegram (gratis, 3 minutos)

1. En Telegram abre **@BotFather** → `/newbot` → ponle nombre. Te da el **token** → `TELEGRAM_BOT_TOKEN`.
2. Escríbele cualquier mensaje a tu bot (o agrégalo al grupo del equipo y manda un mensaje ahí).
3. Abre `https://api.telegram.org/bot<TOKEN>/getUpdates` y copia `"chat":{"id": …}` → `TELEGRAM_CHAT_ID` (en grupos empieza con `-`).
4. Reinicia el servicio. Prueba con **Pedir llamada** en el chat: debe llegar «📞 LLAMADA URGENTE · Riffast».

### Editar el prompt y la guía

- **Prompt:** `apps/api/src/modules/assistant/prompt.md`. Todo lo de arriba de la línea «(— aquí termina la parte fija…)» es fijo (se cachea); lo de abajo es el contexto de cada mensaje. Las variables van como `{{NOMBRE}}`: si agregas una, rellénala en `prompt.ts`.
- **Guía del administrador:** `apps/api/src/modules/assistant/guia.md`, una sección `## clave` por tema (`primeros_pasos`, `rifas`, `boletos`, `ordenes`, `datos_pago`, `promociones`, `sorteo`, `pagina`, `equipo`, `ajustes`, `reportes`, `vender`, `problemas`). El bot la consulta antes de dar pasos; escríbela con los nombres exactos de los botones.
- Los dos archivos se leen en cada mensaje: no hace falta reiniciar. Después de editarlos corre `npm test` (falla si queda una variable sin rellenar o falta un tema).

### Qué puede hacer y qué no

- **Lee:** resumen, rifas, una rifa, datos de pago (solo administradores) y órdenes (el vendedor solo las suyas).
- **Cambia (con tarjeta de Confirmar, 30 min para confirmar):** crear rifa (borrador), editar rifa (sin total de boletos), publicar, agregar/quitar método de pago (valida tarjeta con Luhn y CLABE con su dígito de control; nunca guarda vencimiento ni CVV), marcar orden pagada (abre WhatsApp con el boleto, igual que en Órdenes) y liberar apartados.
- **Nunca:** sortear o deshacer sorteos, borrar rifas, tocar planes o cuentas ajenas. Los vendedores solo consultan.
- Todo cambio pasa por la **misma API que los botones**, con la sesión del usuario: mismas validaciones, permisos y efectos.

Código: `apps/api/src/modules/assistant/` (backend) y `apps/web/src/components/owner/assistant/` (chat).

---

## 🔧 Scripts útiles

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | API + Web en desarrollo |
| `npm run build` | Compila shared + api + web |
| `npm run typecheck` | Verifica tipos en los 3 paquetes |
| `npm test` | Pruebas del asistente (cliente de IA, agente, servicio, validaciones, prompt y guía) |
| `npm run db:migrate` | Migraciones en desarrollo |
| `npm run db:seed` | Crea el usuario administrador y el perfil (idempotente) |
| `npm run db:studio` | Prisma Studio (inspeccionar la base) |

---

## 📝 Notas

- El "usuario" de acceso se guarda en la columna `email` de la tabla `User` (en minúsculas). Para cambiar la contraseña de un cliente: actualiza `passwordHash` con un hash bcrypt nuevo (o borra el usuario y deja que el seed lo recree con `ADMIN_PASSWORD`).
- Las tablas `Plan`/`Subscription` del antiguo modelo SaaS siguen en el esquema pero **no se usan**; todos los límites y funciones están siempre activos.
- Web Push (avisos de nuevas órdenes al organizador) es opcional: genera claves con `npx web-push generate-vapid-keys` y define `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`.
