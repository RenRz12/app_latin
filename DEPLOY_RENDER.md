# Publicar App Latin en Render

La aplicación se despliega como un servicio web gratuito de Node. Express sirve tanto la API
como el frontend compilado y los datos se guardan en una base PostgreSQL externa de Neon.

## Por qué PostgreSQL está separado de Render

Render no admite discos persistentes en servicios web gratuitos y su PostgreSQL gratuito
vence a los 30 días. Neon ofrece PostgreSQL persistente sin ese vencimiento. Por eso
`render.yaml` mantiene la aplicación en el plan `free` y recibe la conexión mediante
`DATABASE_URL`.

## Crear la base gratuita en Neon

1. Crea una cuenta en [Neon](https://console.neon.tech/) y un proyecto nuevo.
2. Elige una región cercana a la de tu servicio de Render.
3. En **Connect**, copia la cadena de conexión agrupada (_pooled connection string_).
4. Conserva esa cadena como un secreto. No la escribas en Git ni en ningún archivo público.

## Primer despliegue

1. Sube este repositorio a GitHub, GitLab o Bitbucket. No subas `backend/.env` ni los archivos
   de `backend/data/`: pueden contener claves y datos personales.
2. En Render elige **New > Blueprint** y conecta el repositorio.
3. Render leerá `render.yaml` y mostrará el servicio gratuito `app-latin`.
4. Cuando solicite `DATABASE_URL`, pega la cadena de conexión de Neon completa.
5. Cuando solicite `APP_PASSWORD`, escribe una contraseña privada de al menos 10 caracteres.
   `SESSION_SECRET` se genera automáticamente y no debes compartirlo.
6. Aplica el Blueprint y espera a que `/api/health` indique que el servicio está disponible.

Si creaste el servicio manualmente en vez de usar **New > Blueprint**, revisa estos valores
en **Settings > Build & Deploy**:

```text
Service Type: Web Service
Runtime: Node
Root Directory: vacío
Build Command: npm run render-build
Start Command: npm start
Health Check Path: /api/health
```

No configures `frontend` ni `backend` como Root Directory: el despliegue necesita ambos y
los comandos se ejecutan desde la raíz del repositorio.

Si el servicio ya existe, agrega manualmente en **Environment**:

```text
DATABASE_URL=<cadena copiada desde Neon>
DATABASE_SSL=true
```

Elimina `DATABASE_STORAGE` si estaba configurada. Guarda los cambios y vuelve a desplegar.

La primera ejecución crea la base y carga automáticamente las 1.729 entradas de vocabulario
incluidas en `backend/seed/familia-romana-vocabulary.json`.

## Datos existentes en SQLite

La base `backend/data/app-latin.sqlite` está excluida de Git deliberadamente porque contiene
tu historial personal. Un PostgreSQL nuevo empieza sin estadísticas ni prácticas anteriores,
aunque carga automáticamente el catálogo de vocabulario. No borres el archivo SQLite: puede
usarse para una transferencia única antes de comenzar a guardar actividad en Neon.

## Uso diario

- Abre la dirección `https://<tu-servicio>.onrender.com` desde cualquier dispositivo.
- Ingresa `APP_PASSWORD`. La sesión dura 30 días en ese navegador.
- El botón **Salir** cierra la sesión del dispositivo actual.
- Los despliegues, reinicios y accesos desde otros dispositivos utilizan la misma base Neon.

## Variables opcionales para generación directa con IA

El Blueprint conserva el modo manual actual. Si quieres que el backend llame directamente a
OpenAI, define en Render `AI_PROVIDER=openai` y agrega `OPENAI_API_KEY` como secreto. Nunca
escribas la clave en `render.yaml` ni la subas al repositorio.

## Desarrollo local

En local, si no defines `DATABASE_URL`, la aplicación continúa usando
`backend/data/app-latin.sqlite`. `APP_PASSWORD` puede quedar vacío; en ese caso no aparece la
pantalla de acceso. Para probar PostgreSQL localmente, define `DATABASE_URL` y
`DATABASE_SSL=false`. Vite redirige automáticamente `/api` al backend de
`http://localhost:3001`.
