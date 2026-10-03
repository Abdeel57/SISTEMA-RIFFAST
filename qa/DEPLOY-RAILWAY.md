# 🚀 Despliegue — Frontend en **Netlify** + Backend en **Railway**

Solo tienes que **pegar las variables** (ya separadas por servicio):

- Backend (Railway) → `deploy/railway.backend.env`
- Frontend (Netlify) → `deploy/netlify.web.env`

> ¿Front y back en dominios distintos afecta? **No es problema:** las cookies ya van en
> `SameSite=None; Secure` y el backend valida CORS/CSRF por `Origin`. Y el **OG dinámico
> (preview por rifa en WhatsApp) SÍ funciona en Netlify** vía `netlify/edge-functions/og.ts`.

---

## 0) Arquitectura
```
Railway:  Postgres (plugin)  +  Servicio API (Dockerfile.api)  +  Volume /data
Netlify:  Sitio web (SPA + edge function OG)  ← apps/web
```

## 1) Backend en Railway
1. New Project → **Deploy PostgreSQL**.
2. **New → Deploy from GitHub repo** → este repo. Settings → Build:
   - Builder: **Dockerfile** · Dockerfile Path: `deploy/Dockerfile.api`
3. Settings → **Volumes** → Add Volume, Mount path: **`/data`**.
4. **Variables → Raw Editor** → pega **`deploy/railway.backend.env`**, reemplaza los `REEMPLAZA-…`.
   - Secretos: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
5. Settings → **Networking → Generate Domain** → copia la URL del API (ej. `https://bismark-api.up.railway.app`).
6. Deploy → aplica migraciones solo. Verifica `https://TU-API.up.railway.app/health` → `{ ok: true }`.
7. **Seed (una vez)** — el API necesita los 3 planes. En el servicio → Shell / one-off:
   ```
   npm run db:seed --workspace=@bismark/api
   ```
   (Cambia `SEED_ADMIN_PASSWORD` antes.)

## 2) Frontend en Netlify
1. **Add new site → Import from Git** → este repo. Netlify lee **`netlify.toml`** (build, publish `apps/web/dist`, redirects SPA, headers y la **edge function OG**). No cambies eso.
2. **Site configuration → Environment variables** → agrega las de **`deploy/netlify.web.env`**.
   - **Imprescindible:** `VITE_API_URL = https://TU-API.up.railway.app` (la del paso 1.5).
3. **Deploy**. Copia la URL del sitio (ej. `https://tu-sitio.netlify.app`).
   > Las `VITE_*` se hornean en el build: si cambias `VITE_API_URL`, **redeploy** en Netlify.

## 3) Conectar web ↔ API
En **Railway → API → Variables**, pon la URL de Netlify:
```
CORS_ORIGINS=https://tu-sitio.netlify.app
PUBLIC_WEB_URL=https://tu-sitio.netlify.app
```
Redeploy el API.

## 4) Verificación
```
API_URL=https://TU-API.up.railway.app node qa/smoke.mjs     # 0 fallos
```
Luego abre el sitio Netlify → regístrate → crea rifa → aparta boletos.

---

## 5) (Recomendado) Dominio propio + subdominios de riferos
Con tu dominio `bismark.com`:
1. **Netlify**: agrega `bismark.com` y el **comodín** `*.bismark.com` (para `rifero.bismark.com`) como dominios del sitio (requiere DNS de Netlify o registros que ellos indiquen).
2. **Railway**: Custom Domain `api.bismark.com` en el servicio API.
3. **API (Railway) → Variables** (mismo dominio raíz = cookies más seguras):
   ```
   COOKIE_SAME_SITE=lax
   COOKIE_DOMAIN=.bismark.com
   CORS_ORIGINS=https://bismark.com
   CORS_ROOT_DOMAIN=bismark.com
   USE_SUBDOMAINS=true
   PUBLIC_WEB_URL=https://bismark.com
   PUBLIC_API_URL=https://api.bismark.com
   ```
4. **Web (Netlify) → Variables** (redeploy):
   ```
   VITE_API_URL=https://api.bismark.com
   VITE_USE_SUBDOMAINS=true
   ```

---

## 6) Alternativa: TODO en Railway (sin Netlify)
Si algún día quieres el front también en Railway, ya está listo:
`deploy/Dockerfile.web` + `deploy/static-server.mjs` + variables `deploy/railway.web.env`.
**Trade-off:** en Railway el **OG dinámico por-rifa no corre** (es edge de Netlify); los
enlaces mostrarían el OG genérico de Bismark.

## ⚠️ Notas
- Migraciones: automáticas en cada deploy del API.
- Activación de plan de un rifero: manual desde `/admin` en esta versión.
- Costos: Netlify (free tier generoso) + Railway por uso (API + Postgres + Volume).
