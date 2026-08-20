# Backend App Latin

> Para publicar la aplicación completa en Render, consulta
> [`../DEPLOY_RENDER.md`](../DEPLOY_RENDER.md). El despliegue recomendado sirve el frontend y
> la API desde un mismo servicio, protege el acceso con contraseña y conserva SQLite en un
> disco persistente.

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

Ese `prompt` se copia y se pega en ChatGPT. El prompt pide 20 ejercicios para economizar el uso manual de la IA y funciona para `multiple_choice`, `fill_blank`, `conjugation`, `transformation`, `translation_la_es` y `translation_es_la`. ChatGPT debe devolver JSON con este formato:

```json
{
  "exercises": [
    {
      "exerciseType": "multiple_choice",
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
multiple_choice
fill_blank
conjugation
transformation
translation_la_es
translation_es_la
```

## Vocabulario adaptativo de Familia Romana

El vocabulario canónico se extrae del `INDEX VOCABVLORVM` de *Familia Romana*. La tabla
`vocabulary` conserva un registro por lema y `vocabulary_chapters` lo relaciona con todos
los capítulos en los que aparece. Las traducciones españolas quedan vacías si no existe
una fuente verificable y las lecturas dudosas de la capa de texto del PDF se registran en
`reports/vocabulary-import-report.json`.

La lectura y el aprendizaje se almacenan por separado:

- `reading_progress` indica hasta qué capítulo llegó el usuario.
- `user_vocabulary_progress` mantiene etapa, scores independientes e intervalo de repaso.
- `vocabulary_review_events` conserva el historial de intentos sin sobrescribirlo.

Antes de importar, sincronizá el esquema y ejecutá una simulación:

```powershell
npm run db:sync
npm run vocabulary:dry-run -- --pdf "C:\ruta\Familia Romana.pdf" --python "C:\ruta\python.exe"
```

Si la simulación representa los capítulos I–XXXV, importá y comprobá la idempotencia
repitiendo el mismo comando:

```powershell
npm run vocabulary:import -- --pdf "C:\ruta\Familia Romana.pdf" --python "C:\ruta\python.exe"
npm run vocabulary:import -- --pdf "C:\ruta\Familia Romana.pdf" --python "C:\ruta\python.exe"
npm test
```

También se pueden definir `FAMILIA_ROMANA_PDF` y `PYTHON_BIN` para omitir esos argumentos.
El extractor requiere Python con `pdfplumber`.

Endpoints disponibles:

```text
GET  /api/vocabulary?chapterFrom=1&chapterTo=10
GET  /api/vocabulary/progress?userId=1&dueOnly=true
POST /api/vocabulary/:vocabularyId/reviews
GET  /api/vocabulary/users/:userId/reading-progress
PUT  /api/vocabulary/users/:userId/reading-progress
```

Ejemplo de repaso:

```json
{
  "userId": 1,
  "reviewType": "GUIDED_RECALL",
  "result": "CORRECT",
  "responseTimeMs": 3200
}
```

El servicio actualiza únicamente el score correspondiente a `reviewType`, guarda el evento
y calcula `nextReviewAt`. Un error acorta el intervalo y suma un lapso; solo una secuencia de
errores puede bajar una etapa. `MASTERED` exige varios éxitos y al menos siete días entre el
primer contacto y la evaluación que lo concede.

## Motor adaptativo de repaso

Una sesión adaptativa se construye en tres pasos independientes:

1. `reviewSchedulerService` selecciona palabras y calcula su prioridad.
2. `exercisePlannerService` asigna la habilidad y los focos gramaticales.
3. `exercisePromptBuilderService` produce un pedido estructurado y un prompt restrictivo.
4. `vocabularyExercisePolicyService` aplica evidencia ponderada solamente a las habilidades
   que el formato evaluó.

El planificador puede elegir entre diez formatos: opción múltiple léxica, significado en
contexto, traducción latín-español, traducción español-latín, completar flexión, opción
múltiple morfológica, recuperación guiada, identificación de lema, producción morfológica y
producción libre. `getWeakestVocabularySkill` y `selectVocabularyExerciseType` concentran la
decisión; los controladores no contienen reglas curriculares.

La distribución normal es 40 % vencidas, 30 % backlog, 20 % del capítulo actual o anterior
y 10 % mantenimiento. Si faltan candidatos en un grupo, los lugares se redistribuyen. Hasta
un 15 % de la sesión puede ser desplazado por palabras cuya prioridad supere en 25 puntos a
un objetivo menos urgente.

La prioridad suma de forma determinista:

- bucket y etapa actual;
- días de atraso;
- déficit de reconocimiento, producción y morfología;
- diferencia entre reconocimiento y producción;
- lapsos, errores y aciertos recientes;
- racha, tiempo desde el último repaso y cercanía al capítulo leído;
- frecuencia aproximada en el índice y cantidad de capítulos asociados.

Todas las constantes están en `src/config/adaptiveReviewConfig.js`.

Endpoints:

```text
POST /api/practice-sessions/adaptive
GET  /api/practice-sessions/adaptive/:sessionId
POST /api/practice-sessions/adaptive/:sessionId/prompt
POST /api/practice-sessions/adaptive/:sessionId/generate
POST /api/practice-sessions/adaptive/:sessionId/import
POST /api/practice-sessions/adaptive/exercises/:exerciseId/answer
GET  /api/vocabulary/due?userId=1
GET  /api/vocabulary/metrics?userId=1
```

Crear una sesión normal:

```json
{
  "userId": 1,
  "sessionSize": 20,
  "mode": "NORMAL"
}
```

Para revisar rápidamente palabras nunca practicadas de capítulos ya leídos se puede usar
`"mode": "BACKLOG_SCREENING"`. Dos aciertos de screening pueden acelerar una palabra hasta
`CONTEXT_RECOGNITION`, pero nunca hasta `MASTERED`.

El endpoint `prompt` conserva el flujo manual con otra IA. `import` acepta el JSON generado,
lo valida contra los IDs, habilidades, focos gramaticales y vocabulario permitidos, y recién
entonces guarda los ejercicios. `generate` utiliza el proveedor configurado o el generador
local de desarrollo. Ninguno de esos pasos modifica el progreso.

Solo `answer` crea `VocabularyReviewEvent` y actualiza los scores realmente evaluados. Los
pesos principales configurados son 1.0 para opción múltiple, 1.2 para contexto, 1.3 para
latín-español y opción morfológica, 1.6 para recuperación guiada, 1.7 para completar flexión,
2.0 para español-latín y producción morfológica, y 2.3 para producción libre. Los efectos
secundarios son menores y están declarados en la misma configuración.

El evento conserva tipo de ejercicio, habilidades evaluadas, errores tipificados, scores
anteriores y resultantes, peso, etapa anterior/resultante y tiempo de respuesta. Los macrones
se muestran siempre que existen; omitirlos se acepta salvo que la cantidad vocálica sea el
objetivo explícito. Los acentos agudos representan vocales largas.

Las prácticas de vocabulario del flujo manual también quedan conectadas con este progreso.
Al importar o generar un ejercicio, el backend resuelve su lema y guarda
`targetVocabularyIds`. Cuando la práctica se guarda, cada respuesta contestada crea un evento
idempotente: latín a español actualiza reconocimiento y español a latín actualiza producción.
Esto funciona tanto en sesiones terminadas como en borradores guardados.

Al iniciar el backend se recuperan automáticamente las prácticas antiguas que conservan sus
respuestas individuales. También puede ejecutarse manualmente, sin duplicar eventos:

```powershell
npm run vocabulary:backfill
```

Una sesión que solo conserve el acierto total no se atribuye a palabras concretas, porque no
existe evidencia suficiente para saber cuáles fueron acertadas.

Para ejecutar una demostración reproducible en una base temporal:

```powershell
npm run adaptive:demo
npm run adaptive:profiles
```

Los resultados quedan en `reports/adaptive-session-example.json` y
`reports/adaptive-vocabulary-profiles.json`. El segundo cubre cinco usuarios: producción
débil, morfología débil, palabra nueva, MASTERED vencida y errores recientes repetidos.
