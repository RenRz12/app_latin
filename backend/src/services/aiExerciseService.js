import { env } from '../config/env.js'
import { mockExercisesByTopic } from '../data/exerciseCatalog.js'
import { AppError } from '../utils/AppError.js'
import { normalizeVocabularyWord } from '../utils/vocabularyWords.js'

const vocabularyMockWords = [
  ['puella', 'niña'],
  ['puer', 'niño'],
  ['rosa', 'rosa'],
  ['aqua', 'agua'],
  ['via', 'camino'],
  ['villa', 'casa de campo'],
  ['servus', 'esclavo'],
  ['dominus', 'señor'],
  ['amicus', 'amigo'],
  ['familia', 'familia'],
  ['māter', 'madre'],
  ['pater', 'padre'],
  ['frāter', 'hermano'],
  ['soror', 'hermana'],
  ['fīlius', 'hijo'],
  ['fīlia', 'hija'],
  ['liber', 'libro'],
  ['mēnsa', 'mesa'],
  ['porta', 'puerta'],
  ['hortus', 'jardín'],
  ['urbs', 'ciudad'],
  ['rēx', 'rey'],
  ['mīles', 'soldado'],
  ['magister', 'maestro'],
  ['discipulus', 'alumno'],
  ['canis', 'perro'],
  ['equus', 'caballo'],
  ['sōl', 'sol'],
  ['lūna', 'luna'],
  ['mare', 'mar'],
  ['mōns', 'monte'],
  ['flūmen', 'río'],
  ['nāvis', 'barco'],
  ['terra', 'tierra'],
  ['caelum', 'cielo'],
  ['ignis', 'fuego'],
  ['ventus', 'viento'],
  ['tempus', 'tiempo'],
  ['corpus', 'cuerpo'],
  ['manus', 'mano'],
]

const exerciseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    prompt: {
      type: 'string',
      description: 'Instruccion breve para el estudiante.',
    },
    question: {
      type: 'string',
      description: 'Consigna o frase del ejercicio.',
    },
    options: {
      type: 'array',
      description:
        'Opciones de respuesta. Usar 4 opciones para opcion multiple.',
      items: {
        type: 'string',
      },
      minItems: 0,
      maxItems: 4,
    },
    correctAnswer: {
      type: 'string',
      description: 'Respuesta correcta exacta.',
    },
    explanation: {
      type: 'string',
      description: 'Explicacion pedagogica breve en español.',
    },
  },
  required: ['prompt', 'question', 'options', 'correctAnswer', 'explanation'],
}

const adaptiveExerciseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    exercises: {
      type: 'array',
      minItems: 1,
      maxItems: 50,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          targetVocabularyIds: {
            type: 'array',
            items: { type: 'integer' },
            minItems: 1,
          },
          exerciseType: {
            type: 'string',
            enum: [
              'VOCABULARY_MULTIPLE_CHOICE',
              'CONTEXT_MEANING',
              'TRANSLATION_LA_ES',
              'TRANSLATION_ES_LA',
              'INFLECTION_COMPLETION',
              'INFLECTION_MULTIPLE_CHOICE',
              'GUIDED_RECALL',
              'LEMMA_IDENTIFICATION',
              'MORPHOLOGY_PRODUCTION',
              'FREE_PRODUCTION',
            ],
          },
          prompt: { type: 'string' },
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' }, maxItems: 6 },
          answer: { type: 'string' },
          acceptableAnswers: { type: 'array', items: { type: 'string' } },
          explanation: { type: 'string' },
          grammarTargets: { type: 'array', items: { type: 'string' } },
          targetForm: { type: 'string' },
          usedVocabulary: { type: 'array', items: { type: 'integer' } },
        },
        required: [
          'targetVocabularyIds',
          'exerciseType',
          'prompt',
          'question',
          'options',
          'answer',
          'acceptableAnswers',
          'explanation',
          'grammarTargets',
          'targetForm',
          'usedVocabulary',
        ],
      },
    },
  },
  required: ['exercises'],
}

function createVocabularyMockExercise(exerciseType, excludedVocabularyWords) {
  const excluded = new Set(excludedVocabularyWords)
  const wordIndex = vocabularyMockWords.findIndex(
    ([latin]) => !excluded.has(normalizeVocabularyWord(latin)),
  )

  if (wordIndex === -1) {
    throw new AppError(
      'No quedan palabras nuevas en el catalogo local. Genera el prompt para obtener vocabulario nuevo.',
      409,
    )
  }

  const [latin, spanish] = vocabularyMockWords[wordIndex]
  const explanation = `${latin} significa ${spanish}.`

  if (exerciseType === 'translation_es_la') {
    return {
      prompt: 'Escribe la palabra en latin.',
      question: spanish,
      options: [],
      correctAnswer: latin,
      explanation,
      source: 'mock',
    }
  }

  if (exerciseType === 'translation_la_es') {
    return {
      prompt: 'Escribe el significado en español.',
      question: latin,
      options: [],
      correctAnswer: spanish,
      explanation,
      source: 'mock',
    }
  }

  const distractors = [1, 2, 3].map(
    (offset) =>
      vocabularyMockWords[(wordIndex + offset) % vocabularyMockWords.length][1],
  )

  return {
    prompt: 'Elige la traducción correcta.',
    question: latin,
    options: [spanish, ...distractors],
    correctAnswer: spanish,
    explanation,
    source: 'mock',
  }
}

function createMockExercise({
  topic,
  exerciseType,
  excludedVocabularyWords = [],
}) {
  if (topic === 'vocabulary') {
    return createVocabularyMockExercise(exerciseType, excludedVocabularyWords)
  }

  return {
    ...mockExercisesByTopic[topic],
    source: 'mock',
  }
}

function getRulesByExerciseType(exerciseType) {
  const rules = {
    multiple_choice: [
      '- Devuelve exactamente 4 opciones.',
      '- La respuesta correcta debe aparecer dentro de options.',
      '- Las opciones incorrectas deben ser plausibles, pero claramente incorrectas.',
    ],
    fill_blank: [
      '- La pregunta debe incluir un espacio en blanco marcado como ____.',
      '- options debe ser un array vacio.',
      '- correctAnswer debe contener solamente la palabra o forma que completa el espacio.',
    ],
    conjugation: [
      '- La pregunta debe pedir conjugar un verbo en una forma especifica.',
      '- Usa el formato: "verbo -> tiempo, voz, persona y numero".',
      '- options debe ser un array vacio.',
      '- correctAnswer debe contener solamente la forma conjugada.',
    ],
    transformation: [
      '- La pregunta debe partir de una oracion base y pedir transformarla.',
      '- Usa el formato: "oracion base -> transformacion solicitada".',
      '- La transformacion solicitada debe usar exclusivamente el tema gramatical pedido.',
      '- No mezcles otros tiempos verbales dentro del mismo set de ejercicios.',
      '- Si el tema pedido es preterito perfecto, usa solo preterito perfecto activo o pasivo.',
      '- Si el tema pedido es preterito imperfecto, usa solo preterito imperfecto activo o pasivo.',
      '- Si el tema pedido es presente, usa solo presente activo o pasivo.',
      '- options debe ser un array vacio.',
      '- correctAnswer debe contener la oracion completa transformada y correctamente escrita.',
      '- explanation debe explicar brevemente que cambio verbal, de voz, de caso o de estructura se realizo.',
    ],
    translation_la_es: [
      '- La pregunta debe pedir traducir una frase breve de latin a español.',
      '- La pregunta debe estar en latin.',
      '- options debe ser un array vacio.',
      '- correctAnswer debe ser una traduccion modelo breve en español.',
    ],
    translation_es_la: [
      '- La pregunta debe pedir traducir una frase breve de español a latin.',
      '- La pregunta debe estar en español.',
      '- options debe ser un array vacio.',
      '- correctAnswer debe ser una traduccion modelo breve en latin.',
    ],
  }

  return rules[exerciseType] || rules.translation_la_es
}

function getRulesByTopic(topic) {
  if (topic !== 'vocabulary') return []

  return [
    '- Evalua vocabulario, no una estructura gramatical ni una conjugacion.',
    '- Trabaja con una palabra latina aislada y su significado principal en español.',
    '- Si el tipo es translation_la_es, question debe ser una palabra latina y correctAnswer su significado en español.',
    '- Si el tipo es translation_es_la, question debe ser una palabra española y correctAnswer su equivalente latino.',
  ]
}

function buildPrompt({
  topic,
  topicLabel,
  exerciseType,
  vocabularyScope,
  excludedVocabularyWords = [],
}) {
  return [
    'Genera un ejercicio de latin para una app educativa.',
    '',
    `Tema gramatical: ${topicLabel || topic}`,
    `Referencia de vocabulario: ${vocabularyScope.book}`,
    `Alcance permitido: capitulos ${vocabularyScope.fromChapter} al ${vocabularyScope.toChapter}`,
    `Descripcion del alcance: ${vocabularyScope.description}`,
    `Tipo de ejercicio: ${exerciseType}`,
    '',
    'Reglas:',
    '- Usa solamente vocabulario y estructuras compatibles con el alcance de capitulos indicado.',
    '- No uses vocabulario que aparezca por primera vez despues del capitulo maximo permitido.',
    '- La explicacion debe estar en español claro.',
    '- Evita contenido ambiguo o demasiado avanzado para el nivel.',
    ...(topic === 'vocabulary'
      ? [
          `- La palabra objetivo debe haber sido introducida entre los capitulos ${vocabularyScope.fromChapter} y ${vocabularyScope.toChapter}; no elijas como respuesta palabras basicas de capitulos anteriores.`,
          '- Elige una palabra latina que no haya sido practicada anteriormente.',
          ...(excludedVocabularyWords.length > 0
            ? [
                `- No uses ninguna de estas palabras: ${excludedVocabularyWords.join(', ')}.`,
              ]
            : []),
        ]
      : []),
    ...getRulesByExerciseType(exerciseType),
    ...getRulesByTopic(topic),
  ].join('\n')
}

function extractResponseText(openaiResponse) {
  if (typeof openaiResponse.output_text === 'string') {
    return openaiResponse.output_text
  }

  const message = openaiResponse.output?.find((item) => item.type === 'message')
  const textItem = message?.content?.find((item) => item.type === 'output_text')

  return textItem?.text
}

function validateGeneratedExercise(exercise, exerciseType) {
  const hasRequiredStrings =
    typeof exercise.prompt === 'string' &&
    typeof exercise.question === 'string' &&
    typeof exercise.correctAnswer === 'string' &&
    typeof exercise.explanation === 'string'

  if (!hasRequiredStrings || !Array.isArray(exercise.options)) {
    throw new AppError('La IA devolvio un ejercicio con formato invalido.', 502)
  }

  if (exerciseType === 'multiple_choice' && exercise.options.length !== 4) {
    throw new AppError(
      'La IA no devolvio 4 opciones para opcion multiple.',
      502,
    )
  }

  if (
    exercise.options.length > 0 &&
    !exercise.options.includes(exercise.correctAnswer)
  ) {
    throw new AppError(
      'La respuesta correcta no aparece entre las opciones.',
      502,
    )
  }
}

async function requestOpenAiExercise(params) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.aiModel,
      input: [
        {
          role: 'developer',
          content:
            'Eres un profesor de latin. Devuelve solo un ejercicio valido siguiendo el esquema JSON.',
        },
        {
          role: 'user',
          content: buildPrompt(params),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'latin_exercise',
          strict: true,
          schema: exerciseSchema,
        },
      },
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new AppError(`OpenAI no pudo generar el ejercicio: ${errorBody}`, 502)
  }

  const openaiResponse = await response.json()
  const responseText = extractResponseText(openaiResponse)

  if (!responseText) {
    throw new AppError('OpenAI no devolvio texto para el ejercicio.', 502)
  }

  const exercise = JSON.parse(responseText)
  validateGeneratedExercise(exercise, params.exerciseType)

  return {
    ...exercise,
    source: 'openai',
  }
}

export async function generateExerciseWithAi(params) {
  const shouldUseOpenAi = env.aiProvider === 'openai' && env.openaiApiKey

  if (!shouldUseOpenAi) {
    return createMockExercise(params)
  }

  try {
    return await requestOpenAiExercise(params)
  } catch (error) {
    if (!env.aiFallbackToMock) {
      throw error
    }

    console.warn(`Usando ejercicio mock por error de IA: ${error.message}`)
    return createMockExercise(params)
  }
}

function createAdaptiveMockExercise(target) {
  const meaning = target.meaning || target.lemma
  const id = target.id ?? target.vocabularyId
  const grammarTargets = target.grammarTarget ?? target.grammarFocus ?? []
  const common = {
    targetVocabularyIds: [id],
    exerciseType: target.exerciseType,
    options: [],
    acceptableAnswers: [],
    explanation: `Ejercicio local para practicar ${target.lemma}.`,
    grammarTargets,
    targetForm: target.lemma,
    usedVocabulary: [id],
  }

  const multipleChoiceOptions = [
    meaning,
    'río',
    'puerta',
    'soldado',
    'camino',
    'casa',
  ]
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 4)

  if (target.exerciseType === 'VOCABULARY_MULTIPLE_CHOICE') {
    return {
      ...common,
      prompt: 'Elegí el significado principal.',
      question: target.lemma,
      options: multipleChoiceOptions,
      answer: meaning,
    }
  }
  if (target.exerciseType === 'CONTEXT_MEANING') {
    return {
      ...common,
      prompt: 'Escribí el significado de la palabra señalada.',
      question: `In sententiā appāret «${target.lemma}». ¿Qué significa?`,
      answer: meaning,
    }
  }
  if (target.exerciseType === 'TRANSLATION_LA_ES') {
    return {
      ...common,
      prompt: 'Traducí al español.',
      question: `${target.lemma}.`,
      answer: meaning,
    }
  }
  if (target.exerciseType === 'GUIDED_RECALL') {
    return {
      ...common,
      prompt: 'Recuperá el lema latino con la pista dada.',
      question: `${meaning} → ${target.lemma.slice(0, 1)}____`,
      answer: target.lemma,
    }
  }
  if (target.exerciseType === 'INFLECTION_COMPLETION') {
    return {
      ...common,
      prompt: `Completá la forma de la palabra que significa «${meaning}».`,
      question: `____ ← ${grammarTargets.join(', ')} (lema: ${target.lemma})`,
      answer: target.lemma,
    }
  }
  if (target.exerciseType === 'TRANSLATION_ES_LA') {
    return {
      ...common,
      prompt: 'Traducí al latín.',
      question: meaning,
      answer: target.lemma,
    }
  }
  if (target.exerciseType === 'INFLECTION_MULTIPLE_CHOICE') {
    return {
      ...common,
      prompt: `Elegí la forma solicitada: ${grammarTargets.join(', ')}.`,
      question: `${target.lemma}: forma correcta`,
      options: [target.lemma, `${target.lemma}m`, `${target.lemma}s`, `${target.lemma}e`],
      answer: target.lemma,
    }
  }
  if (target.exerciseType === 'LEMMA_IDENTIFICATION') {
    return {
      ...common,
      prompt: 'Identificá el lema de la forma presentada.',
      question: target.lemma,
      answer: target.lemma,
    }
  }
  if (target.exerciseType === 'FREE_PRODUCTION') {
    return {
      ...common,
      prompt: `Escribí una oración breve que use ${target.lemma}.`,
      question: `Usá ${target.lemma} con este foco: ${grammarTargets.join(', ')}.`,
      answer: `${target.lemma} est.`,
    }
  }
  return {
    ...common,
    prompt: `Producí la forma con este foco: ${grammarTargets.join(', ')}.`,
    question: `${target.lemma} → ${grammarTargets.join(', ')}`,
    answer: target.lemma,
  }
}

async function requestOpenAiAdaptiveExercises(generationRequest, prompt) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.aiModel,
      input: [
        {
          role: 'developer',
          content:
            'Materializás un plan de práctica ya decidido por el backend. No tomes decisiones curriculares y devolvé solo JSON válido.',
        },
        { role: 'user', content: prompt },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'adaptive_latin_exercises',
          strict: true,
          schema: adaptiveExerciseSchema,
        },
      },
    }),
  })
  if (!response.ok) {
    const errorBody = await response.text()
    throw new AppError(
      `OpenAI no pudo materializar el plan adaptativo: ${errorBody}`,
      502,
    )
  }
  const openaiResponse = await response.json()
  const responseText = extractResponseText(openaiResponse)
  if (!responseText)
    throw new AppError('OpenAI no devolvió ejercicios adaptativos.', 502)
  return JSON.parse(responseText)
}

export async function generateAdaptiveExercisesWithAi(
  generationRequest,
  prompt,
) {
  const shouldUseOpenAi = env.aiProvider === 'openai' && env.openaiApiKey
  if (!shouldUseOpenAi) {
    return {
      exercises: generationRequest.targetVocabulary.map(createAdaptiveMockExercise),
      source: 'adaptive_mock',
    }
  }

  try {
    return {
      ...(await requestOpenAiAdaptiveExercises(generationRequest, prompt)),
      source: 'openai',
    }
  } catch (error) {
    if (!env.aiFallbackToMock) throw error
    console.warn(
      `Usando ejercicios adaptativos locales por error de IA: ${error.message}`,
    )
    return {
      exercises: generationRequest.targetVocabulary.map(createAdaptiveMockExercise),
      source: 'adaptive_mock',
    }
  }
}

const openAnswerEvaluationSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['CORRECT', 'PARTIAL', 'INCORRECT'] },
    result: { type: 'string', enum: ['CORRECT', 'PARTIAL', 'INCORRECT'] },
    label: { type: 'string' },
    errorTypes: {
      type: 'array',
      items: {
        type: 'string',
        enum: [
          'WRONG_MEANING', 'WRONG_CASE', 'WRONG_NUMBER', 'WRONG_GENDER',
          'WRONG_PERSON', 'WRONG_TENSE', 'WRONG_VOICE', 'WRONG_LEMMA',
          'SPELLING', 'MACRON_ONLY', 'WORD_ORDER', 'INCOMPLETE_RESPONSE',
        ],
      },
    },
    rationale: { type: 'string' },
  },
  required: ['status', 'result', 'label', 'errorTypes', 'rationale'],
}

function localOpenAnswerEvaluation(answerData) {
  if (
    answerData.exerciseType === 'FREE_PRODUCTION' &&
    normalizeVocabularyWord(answerData.userAnswer).includes(
      normalizeVocabularyWord(answerData.targetForm),
    )
  ) {
    return {
      status: 'PARTIAL',
      result: 'PARTIAL',
      label: 'La palabra objetivo está presente; la oración requiere revisión docente',
      errorTypes: [],
      rationale: 'El modo local no valida sintaxis libre.',
    }
  }
  return {
    status: 'INCORRECT',
    result: 'INCORRECT',
    label: 'La respuesta no coincide con las variantes validadas',
    errorTypes: [
      answerData.exerciseType === 'TRANSLATION_LA_ES'
        ? 'WRONG_MEANING'
        : 'WRONG_LEMMA',
    ],
    rationale: 'No hay evaluador semántico configurado.',
  }
}

export async function evaluateOpenVocabularyAnswerWithAi(answerData) {
  const shouldUseOpenAi = env.aiProvider === 'openai' && env.openaiApiKey
  if (!shouldUseOpenAi) return localOpenAnswerEvaluation(answerData)

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.aiModel,
        input: [
          {
            role: 'developer',
            content:
              'Evaluás una respuesta abierta de latín. Juzgá únicamente la palabra target y el foco gramatical declarado. Los macrones son opcionales. No penalices vocabulario auxiliar salvo que impida comprender la respuesta.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              exerciseType: answerData.exerciseType,
              question: answerData.question,
              targetForm: answerData.targetForm,
              grammarTargets: answerData.grammarTargets,
              modelAnswer: answerData.expectedAnswer,
              acceptableAnswers: answerData.acceptableAnswers,
              userAnswer: answerData.userAnswer,
            }),
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'vocabulary_answer_evaluation',
            strict: true,
            schema: openAnswerEvaluationSchema,
          },
        },
      }),
    })
    if (!response.ok) throw new Error(`OpenAI respondió ${response.status}.`)
    const responseText = extractResponseText(await response.json())
    if (!responseText) throw new Error('OpenAI no devolvió una evaluación.')
    return JSON.parse(responseText)
  } catch (error) {
    if (!env.aiFallbackToMock) throw error
    return localOpenAnswerEvaluation(answerData)
  }
}
