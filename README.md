# Viajes con Karen · Backend (API)

Next.js (solo API) + PostgreSQL + Cloudinary. El sitio y el panel de administración (proyecto `agencia-viajes`, Vite + React) hablan con esta API.

## Puesta en marcha

Requisitos: Node 20 o más nuevo y PostgreSQL 14 o más nuevo.

```bash
npm install
cp .env.example .env        # (en Windows: copy .env.example .env) y completá los valores
```

1. **Base de datos**: creá una base vacía (por ejemplo `viajes_con_karen`) y poné su URL en `DATABASE_URL`.
2. **Secreto de sesión**: generá uno y pegalo en `JWT_SECRET`:
   `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
3. **Tablas**: `npm run db:migrate`
4. **Datos de ejemplo** (opcional): `npm run db:seed` (18 destinos y 22 viajes, sin imágenes).
5. **Usuario administrador**: `npm run admin:create -- karen@tudominio.com "UnaClaveLarga123" "Karen"`
   (mínimo 10 caracteres; si el e-mail ya existe, le cambia la contraseña).
6. **Cloudinary**: en tu cuenta copiá *Cloud name*, *API Key* y *API Secret* a `.env` (`CLOUDINARY_*`).
7. `npm run dev` → la API queda en `http://localhost:3000` (probá `http://localhost:3000/api/health`).
8. En el front (`agencia-viajes/.env`) poné `VITE_API_URL=http://localhost:3000` y reiniciá `npm run dev`.
   Y en el backend, `ALLOWED_ORIGINS` tiene que incluir la URL del front (por defecto `http://localhost:5173`).

Con eso el botón **Ingresar** del sitio entra al panel con el usuario del paso 5.

## Endpoints

Todo es JSON. “Admin” = requiere la cookie de sesión del login. Los errores de validación devuelven `422` con `{ "error": "...", "fields": { "campo": "mensaje" } }`.

| Método y ruta | Acceso | Qué hace |
|---|---|---|
| `GET /api/health` | público | Comprueba la conexión a la base |
| `POST /api/auth/login` `{email, password}` | público | Inicia sesión (cookie httpOnly). Máx. 8 intentos fallidos por 15 min |
| `POST /api/auth/logout` | público | Cierra sesión |
| `GET /api/auth/me` | admin | Datos de la sesión |
| `GET /api/catalogo` | público / admin | `{trips, destinations}`. Público: solo viajes activos. Admin: todo |
| `POST /api/viajes` | admin | Crea un viaje (cualquier categoría/alcance, con o sin oferta) |
| `GET/PUT /api/viajes/:id` | admin | Lee / edita un viaje |
| `PATCH /api/viajes/:id/estado` `{active}` | admin | Activa o desactiva (no se borra) |
| `PUT /api/viajes/:id/oferta` | admin | Pone o cambia la oferta (`{type:'discount',price,until?}` o `{type:'promo',label,note?,until?}`) |
| `DELETE /api/viajes/:id/oferta` | admin | Quita la oferta |
| `POST /api/viajes/:id/duplicar` | admin | Copia el viaje (desactivada y sin oferta) |
| `GET/POST /api/destinos` | admin | Lista / crea destinos |
| `PUT/DELETE /api/destinos/:id` | admin | Edita / elimina (409 si tiene viajes) |
| `POST /api/imagenes/firma` | admin | Firma para subir una imagen directo a Cloudinary |
| `POST /api/consultas` | público | Guarda una consulta de los formularios (máx. 6 por IP cada 10 min) |
| `GET /api/consultas` | admin | Lista las consultas |
| `PATCH/DELETE /api/consultas/:id` | admin | Cambia el estado (`nueva`/`atendida`) / elimina |

### Imágenes
El navegador pide una firma a `/api/imagenes/firma` y sube el archivo **directo a Cloudinary** (no pasa por este servidor); después guarda el link en el destino. Los links deben ser `https`. Si querés que al sacar una imagen de un destino (o borrarlo) también se borre de Cloudinary, poné `CLOUDINARY_DELETE_ORPHANS=true`: solo se borran imágenes de tu cuenta y tu carpeta que ningún otro destino use.

## Seguridad: qué hay y qué falta

Incluido: contraseñas con scrypt; sesión en cookie `httpOnly` firmada (JWT HS256, 7 días); consultas SQL parametrizadas; validación y límites de tamaño en el servidor; CORS solo para `ALLOWED_ORIGINS`; rechazo de pedidos que modifican datos desde otros orígenes y de cuerpos que no sean JSON (anti‑CSRF); freno de fuerza bruta en el login y antispam en consultas; el secreto de Cloudinary nunca sale del servidor.

Para tener en cuenta:
- Usá **HTTPS** en producción (la cookie pasa a `Secure` sola con `NODE_ENV=production`).
- Los límites de intentos viven en memoria de cada instancia. Con varias instancias o serverless, conviene uno compartido (Redis/Upstash).
- Hay un solo rol (administrador). No hay recuperación de contraseña: se cambia con `npm run admin:create`.
- La sesión no se puede revocar antes de vencer (cerrar sesión borra la cookie del navegador). Si sospechás que se filtró, cambiá `JWT_SECRET` (cierra todas las sesiones).
- `TRUST_PROXY=true` toma la IP de `x-forwarded-for`; dejalo en `false` si la API no está detrás de un proxy.

## Publicarlo
- **Cookies entre dominios:** lo más simple es que el front y la API compartan dominio (`www.tudominio.com` y `api.tudominio.com`) con `COOKIE_SAMESITE=lax` y `COOKIE_DOMAIN=.tudominio.com`. Si son dominios distintos: `COOKIE_SAMESITE=none` (exige HTTPS).
- `ALLOWED_ORIGINS` = la URL exacta del front en producción (sin barra final).
- Proveedores gratuitos de PostgreSQL (Neon, Supabase, Railway) piden `?sslmode=require` en `DATABASE_URL`. En serverless usá la URL *pooled/pooler* que dan.
- Para actualizar la base después: agregá un archivo nuevo en `db/migrations/` (`002_...sql`) y corré `npm run db:migrate`.

## Pruebas
`npm test` corre pruebas unitarias y de punta a punta (llaman a las rutas reales contra PostgreSQL). Necesitan el cliente `psql` y una base **vacía y descartable** llamada `vck_test` (las pruebas la borran y recrean; se niegan a correr en una base cuyo nombre no termine en `_test`). Se configuran con `TEST_PGHOST`, `TEST_PGPORT`, `TEST_PGUSER`, `TEST_PGPASSWORD` y `TEST_PGDATABASE`.
