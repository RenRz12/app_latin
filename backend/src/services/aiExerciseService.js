import { env } from '../config/env.js'
import { mockExercisesByTopic } from '../data/exerciseCatalog.js'
import { AppError } from '../utils/AppError.js'

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
      description: 'Opciones de respuesta. Usar 4 opciones para opcion multiple.',
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
      description: 'Explicacion pedagogica breve en espanol.',
    },
  },
  required: ['prompt', 'question', 'options', 'correctAnswer', 'explanation'],
}

function createMockExercise(topic) {
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
    translation: [
      '- La pregunta debe pedir traducir una frase breve.',
      '- options debe ser un array vacio.',
      '- correctAnswer debe ser una traduccion modelo breve.',
    ],
  }

  return rules[exerciseType] || rules.multiple_choice
}

function buildPrompt({ topic, topicLabel, vocabularyLevel, exerciseType, vocabularyScope }) {
  return [
    'Genera un ejercicio de latin para una app educativa.',
    '',
    `Tema gramatical: ${topicLabel || topic}`,
    `Nivel de vocabulario interno: ${vocabularyLevel}`,
    `Referencia de vocabulario: ${vocabularyScope.book}`,
    `Alcance permitido: capitulos ${vocabularyScope.fromChapter} al ${vocabularyScope.toChapter}`,
    `Descripcion del alcance: ${vocabularyScope.description}`,
    `Tipo de ejercicio: ${exerciseType}`,
    '',
    'Reglas:',
    '- Usa solamente vocabulario y estructuras compatibles con el alcance de capitulos indicado.',
    '- No uses vocabulario que aparezca por primera vez despues del capitulo maximo permitido.',
    '- La explicacion debe estar en espanol claro.',
    '- Evita contenido ambiguo o demasiado avanzado para el nivel.',
    ...getRulesByExerciseType(exerciseType),
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
    throw new AppError('La IA no devolvio 4 opciones para opcion multiple.', 502)
  }

  if (exercise.options.length > 0 && !exercise.options.includes(exercise.correctAnswer)) {
    throw new AppError('La respuesta correcta no aparece entre las opciones.', 502)
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
    return createMockExercise(params.topic)
  }

  try {
    return await requestOpenAiExercise(params)
  } catch (error) {
    if (!env.aiFallbackToMock) {
      throw error
    }

    console.warn(`Usando ejercicio mock por error de IA: ${error.message}`)
    return createMockExercise(params.topic)
  }
}
