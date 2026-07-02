# Backend App Latin

API en Express para generar y guardar ejercicios de latin. Por ahora usa ejercicios de prueba; la idea es que el mismo flujo pueda conectarse despues a una IA sin cambiar el contrato con el frontend.

## Idea del flujo

El frontend le pide al backend un ejercicio con tres datos principales:

```json
{
  "topic": "presente",
  "vocabularyLevel": 1,
  "exerciseType": "multiple_choice"
}
```

La idea final es que esos datos se usen para construir un pedido claro a una IA:

1. `topic`: indica el tema gramatical que debe practicar el estudiante.
2. `vocabularyLevel`: limita el vocabulario permitido para que el ejercicio no sea demasiado dificil.
3. `exerciseType`: indica el formato del ejercicio, por ejemplo opcion multiple, completar o traduccion.

Flujo actual:

```text
Frontend
  -> POST /api/exercises/generate
  -> Controller
  -> Service
  -> Ejercicio mock
  -> Repository
  -> SQLite
  -> Respuesta JSON al frontend
```

Flujo esperado con IA:

```text
Frontend
  -> POST /api/exercises/generate
  -> Controller
  -> Service
  -> AI Service
  -> Repository
  -> SQLite
  -> Respuesta JSON al frontend
```

En el futuro, `src/services/exerciseService.js` va a seguir controlando la validacion y el flujo general, pero la generacion real del contenido deberia moverse a un servicio especializado, por ejemplo `src/services/aiExerciseService.js`. Ese servicio recibiria `topic`, `vocabularyLevel`, `exerciseType` y vocabulario permitido, llamaria a la IA, validaria que la respuesta tenga el formato correcto y devolveria un ejercicio listo para guardar.

## Arquitectura

```text
src/
  app.js
  config/
  controllers/
  data/
  database/
  middlewares/
  models/
  repositories/
  routes/
  services/
  utils/
```

Responsabilidades:

- `routes`: define las URLs disponibles.
- `controllers`: recibe requests y devuelve responses.
- `services`: contiene la logica de negocio.
- `repositories`: habla con los modelos y la base de datos.
- `models`: define tablas Sequelize.
- `database`: configura SQLite y sincronizacion.
- `data`: datos temporales o catalogos internos.

## Ejecutar

Desde esta carpeta:

```powershell
npm install
npm run db:sync
npm run dev
```

El backend queda disponible en:

```text
http://localhost:3001
```

## Endpoints

### Salud del servidor

```http
GET /api/health
```

Ejemplo con PowerShell:

```powershell
Invoke-WebRequest -Uri "http://localhost:3001/api/health" -UseBasicParsing
```

### Generar ejercicio

```http
POST /api/exercises/generate
```

Body:

```json
{
  "topic": "presente",
  "vocabularyLevel": 1,
  "exerciseType": "multiple_choice"
}
```

Ejemplo con PowerShell:

```powershell
$body = @{
  topic = "presente"
  vocabularyLevel = 1
  exerciseType = "multiple_choice"
} | ConvertTo-Json

Invoke-WebRequest `
  -Uri "http://localhost:3001/api/exercises/generate" `
  -Method POST `
  -Body $body `
  -ContentType "application/json" `
  -UseBasicParsing
```

### Ver ejercicios guardados

```http
GET /api/exercises
```

Ejemplo:

```powershell
Invoke-WebRequest -Uri "http://localhost:3001/api/exercises" -UseBasicParsing
```

## Valores aceptados

Temas:

```text
presente, perfecto, imperfecto, declinaciones
```

Niveles:

```text
1, 2, 3, 4
```

Tipos de ejercicio:

```text
multiple_choice, fill_blank, translation
```
