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
2. `vocabularyLevel`: indica el alcance de vocabulario de *Lingua Latina per se Illustrata: Familia Romana*.
3. `exerciseType`: indica el formato del ejercicio, por ejemplo opcion multiple, completar o traduccion.

Equivalencias de `vocabularyLevel`:

```text
1 -> vocabulario visto desde el capitulo 1 hasta el 5
2 -> vocabulario visto desde el capitulo 1 hasta el 10
3 -> vocabulario visto desde el capitulo 1 hasta el 15
4 -> vocabulario visto desde el capitulo 1 hasta el 20
```

El frontend envia el numero para mantener el contrato simple, pero el backend lo traduce a un alcance pedagogico antes de construir el prompt para la IA.

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
  -> AI Exercise Service
  -> Repository
  -> SQLite
  -> Respuesta JSON al frontend
```

`src/services/exerciseService.js` controla la validacion y el flujo general. La generacion real del contenido vive en `src/services/aiExerciseService.js`. Ese servicio recibe `topic`, `vocabularyLevel`, `exerciseType` y el alcance de vocabulario de *Lingua Latina*, llama a la IA si esta configurada, valida que la respuesta tenga el formato correcto y devuelve un ejercicio listo para guardar.

Si no hay IA configurada, el backend usa ejercicios mock. Esto permite seguir desarrollando frontend, base de datos y rutas sin depender de una API key.

Flujo manual sin pagar API:

```text
Frontend
  -> POST /api/exercises/prompt
  -> Backend devuelve prompt listo
  -> Usuario pega el prompt en ChatGPT
  -> ChatGPT devuelve JSON
  -> Usuario pega el JSON en la app
  -> POST /api/exercises/import
  -> Repository
  -> SQLite
```

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

## Configurar IA

Copiar `.env.example` a `.env` y ajustar los valores:

```env
PORT=3001
CLIENT_ORIGIN=http://127.0.0.1:5173
DATABASE_STORAGE=./data/app-latin.sqlite

AI_PROVIDER=mock
AI_MODEL=gpt-5.5
OPENAI_API_KEY=
AI_FALLBACK_TO_MOCK=true
```

Modo mock:

```env
AI_PROVIDER=mock
```

Modo OpenAI:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=tu_api_key
AI_MODEL=gpt-5.5
```

Con `AI_FALLBACK_TO_MOCK=true`, si la IA falla el backend responde con un ejercicio mock para no cortar el flujo de la app. Si queres que falle explicitamente cuando la IA falle:

```env
AI_FALLBACK_TO_MOCK=false
```

El servicio espera que la IA devuelva este formato:

```json
{
  "prompt": "Elegí la forma correcta del verbo en presente.",
  "question": "Puella rosam ____.",
  "options": ["amat", "amavit", "amabit", "amabant"],
  "correctAnswer": "amat",
  "explanation": "Puella es singular, por eso corresponde amat."
}
```

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

### Crear prompt para ChatGPT

```http
POST /api/exercises/prompt
```

Body:

```json
{
  "topic": "presente",
  "vocabularyLevel": 1,
  "exerciseType": "multiple_choice"
}
```

Respuesta:

```json
{
  "topic": "presente",
  "vocabularyLevel": 1,
  "exerciseType": "multiple_choice",
  "vocabularyScope": {
    "label": "Lingua Latina caps. 1-5"
  },
  "prompt": "Quiero crear ejercicios de latin..."
}
```

Ese `prompt` se copia y se pega en ChatGPT. El prompt pide 20 ejercicios para economizar el uso manual de la IA y funciona para `multiple_choice`, `fill_blank` y `translation`. ChatGPT debe devolver JSON con este formato:

```json
{
  "exercises": [
    {
      "prompt": "Elegi la forma correcta del verbo.",
      "question": "Puella rosam ____.",
      "options": ["amat", "amavit", "amabit", "amabant"],
      "correctAnswer": "amat",
      "explanation": "Amat es presente, tercera persona singular."
    }
  ]
}
```

Para `fill_blank` y `translation`, `options` debe ser un array vacio:

```json
{
  "options": []
}
```

### Importar ejercicios desde JSON

```http
POST /api/exercises/import
```

Body:

```json
{
  "topic": "presente",
  "vocabularyLevel": 1,
  "exerciseType": "multiple_choice",
  "exercises": [
    {
      "prompt": "Elegi la forma correcta del verbo.",
      "question": "Puella rosam ____.",
      "options": ["amat", "amavit", "amabit", "amabant"],
      "correctAnswer": "amat",
      "explanation": "Amat es presente, tercera persona singular."
    }
  ]
}
```

Los ejercicios importados se guardan con:

```json
{
  "source": "manual_chatgpt"
}
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

Niveles de vocabulario:

```text
1 = Lingua Latina caps. 1-5
2 = Lingua Latina caps. 1-10
3 = Lingua Latina caps. 1-15
4 = Lingua Latina caps. 1-20
```

Tipos de ejercicio:

```text
multiple_choice, fill_blank, translation
```
