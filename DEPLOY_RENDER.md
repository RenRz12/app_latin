# Publicar App Latin en Render

La aplicación se despliega como un único servicio web de Node. Express sirve tanto la API
como el frontend compilado, y SQLite queda dentro de un disco persistente de Render.

## Por qué esta configuración usa un servicio pago

Render no admite discos persistentes en servicios gratuitos. Sin el disco, el historial,
el progreso y la configuración se perderían al reiniciar o volver a desplegar la aplicación.
El archivo `render.yaml` usa el plan `starter` y un disco de 1 GB, suficiente para esta
aplicación personal. No se necesita PostgreSQL mientras exista un único usuario y una sola
instancia del servidor.

## Primer despliegue

1. Sube este repositorio a GitHub, GitLab o Bitbucket. No subas `backend/.env` ni los archivos
   de `backend/data/`: pueden contener claves y datos personales.
2. En Render elige **New > Blueprint** y conecta el repositorio.
3. Render leerá `render.yaml` y mostrará el servicio `app-latin` con su disco.
4. Cuando solicite `APP_PASSWORD`, escribe una contraseña privada de al menos 10 caracteres.
   `SESSION_SECRET` se genera automáticamente y no debes compartirlo.
5. Aplica el Blueprint y espera a que `/api/health` indique que el servicio está disponible.

La primera ejecución crea la base y carga automáticamente las 1.729 entradas de vocabulario
incluidas en `backend/seed/familia-romana-vocabulary.json`.

## Historial local existente

La base `backend/data/app-latin.sqlite` está excluida de Git deliberadamente porque contiene
tu historial personal. Por eso, un despliegue nuevo empieza sin estadísticas ni prácticas
anteriores. Si quieres trasladarlas, conserva ese archivo y realiza una transferencia única
al disco de Render siguiendo la guía oficial de transferencia de archivos a discos. Hazlo
antes de empezar a usar la versión publicada y configura `DATABASE_STORAGE` para apuntar al
archivo transferido dentro de `/var/data`.

## Uso diario

- Abre la dirección `https://<tu-servicio>.onrender.com` desde cualquier dispositivo.
- Ingresa `APP_PASSWORD`. La sesión dura 30 días en ese navegador.
- El botón **Salir** cierra la sesión del dispositivo actual.
- Los cambios enviados a la rama conectada se despliegan nuevamente sin borrar el disco.

## Variables opcionales para generación directa con IA

El Blueprint conserva el modo manual actual. Si quieres que el backend llame directamente a
OpenAI, define en Render `AI_PROVIDER=openai` y agrega `OPENAI_API_KEY` como secreto. Nunca
escribas la clave en `render.yaml` ni la subas al repositorio.

## Desarrollo local

En local `APP_PASSWORD` puede quedar vacío; en ese caso no aparece la pantalla de acceso.
Para probarla, define `APP_PASSWORD` y `SESSION_SECRET` en `backend/.env`. Vite redirige
automáticamente `/api` al backend de `http://localhost:3001`.
