import { ADAPTIVE_EXERCISE_TYPES } from '../config/adaptiveReviewConfig.js'
import { AppError } from '../utils/AppError.js'

const MULTIPLE_CHOICE_TYPES = new Set([
  'VOCABULARY_MULTIPLE_CHOICE',
  'INFLECTION_MULTIPLE_CHOICE',
])
const TARGET_IN_QUESTION = new Set([
  'VOCABULARY_MULTIPLE_CHOICE',
  'CONTEXT_MEANING',
  'TRANSLATION_LA_ES',
  'LEMMA_IDENTIFICATION',
])
const AI_ASSISTED_TYPES = new Set([
  'TRANSLATION_LA_ES',
  'TRANSLATION_ES_LA',
  'FREE_PRODUCTION',
])
const REQUIRES_SPANISH_TARGET_HINT = new Set([
  'INFLECTION_COMPLETION',
  'GUIDED_RECALL',
])

function unique(values) {
  return [...new Set(values)]
}

function grammarAvailableAtChapter(chapter) {
  const allowed = ['nominative', 'accusative', 'present_active']
  if (chapter >= 5) allowed.push('genitive', 'ablative', 'present_passive')
  if (chapter >= 6) allowed.push('imperfect_active', 'future_active')
  if (chapter >= 8) allowed.push('dative', 'imperfect_passive', 'future_passive')
  if (chapter >= 12) allowed.push('perfect_active')
  if (chapter >= 14) allowed.push('perfect_passive', 'participles')
  if (chapter >= 25) allowed.push('ACI', 'ablative_absolute')
  return allowed
}

function allowedGrammarForPlan(items, chapter) {
  return unique([
    'simple_classical_latin',
    'unambiguous_clause',
    ...grammarAvailableAtChapter(chapter),
    ...items.flatMap((item) => item.grammarTargets),
  ])
}

export function buildExerciseGenerationRequest(plan, supportVocabulary) {
  const targetIds = plan.items.map((item) => item.vocabularyId)
  if (new Set(targetIds).size !== targetIds.length) {
    throw new AppError('El plan adaptativo contiene objetivos repetidos.', 500)
  }
  if (
    plan.items.some(
      (item) => typeof item.meaning !== 'string' || !item.meaning.trim(),
    )
  ) {
    throw new AppError(
      'El plan contiene vocabulario pendiente de verificación. Crea una sesión nueva.',
      409,
    )
  }

  return {
    schemaVersion: 2,
    readingLevel: {
      book: plan.currentBook,
      chapter: plan.currentReadingChapter,
      targetChapterFrom: plan.targetChapterFrom,
      targetChapterTo: plan.targetChapterTo,
      recordedReadingChapter: plan.recordedReadingChapter,
    },
    targetVocabulary: plan.items.map((item) => ({
      id: item.vocabularyId,
      lemma: item.lemma,
      meaning: item.meaning,
      partOfSpeech: item.partOfSpeech,
      chapterOrigin: item.chapterOrigin,
      exerciseType: item.selectedExerciseType,
      evaluatedSkill: item.weakestSkill,
      grammarTarget: item.grammarTargets,
      morphologyReference: item.morphologyReference,
      evaluationMode: AI_ASSISTED_TYPES.has(item.selectedExerciseType)
        ? 'AI_ASSISTED'
        : 'DETERMINISTIC',
      practiceMode: item.practiceMode,
    })),
    supportVocabulary,
    allowedGrammar: allowedGrammarForPlan(
      plan.items,
      plan.currentReadingChapter,
    ),
    exerciseCount: plan.items.length,
    requirements: {
      useMacronsForDisplay: true,
      acceptAcuteAsLongVowel: true,
      macronsRequiredInAnswer: false,
      avoidUnknownVocabulary: true,
      avoidAmbiguity: true,
      exactTargetsOnly: true,
      validJsonOnly: true,
    },
  }
}

export function buildAdaptiveExercisePrompt(generationRequest) {
  const responseShape = {
    exercises: [
      {
        targetVocabularyIds: [123],
        exerciseType: 'INFLECTION_COMPLETION',
        prompt: 'Instrucción breve en español.',
        question: 'Oración o consigna concreta con ____ cuando corresponda.',
        options: [],
        answer: 'Respuesta modelo inequívoca.',
        acceptableAnswers: [],
        explanation: 'Explicación breve en español.',
        grammarTargets: ['ablative', 'singular'],
        targetForm: 'quercū',
        usedVocabulary: [123, 456],
      },
    ],
  }

  return [
    'Generá ejercicios de latín clásico materializando exactamente el plan estructurado.',
    'El backend ya eligió cada palabra, habilidad y tipo. No tomes decisiones curriculares.',
    '',
    'EXERCISE_GENERATION_REQUEST:',
    JSON.stringify(generationRequest, null, 2),
    '',
    'REGLAS OBLIGATORIAS:',
    `- Generá exactamente ${generationRequest.exerciseCount} ejercicios, uno por target y en el mismo orden.`,
    '- Generá exactamente el exerciseType solicitado y conservá grammarTargets.',
    '- La palabra target debe ser realmente necesaria para resolver el ejercicio.',
    '- No reemplaces el target por un sinónimo ni evalúes otra palabra como objetivo.',
    '- Usá preferentemente solo supportVocabulary; podés agregar palabras funcionales elementales.',
    '- Las palabras funcionales sin vocabularyId pueden aparecer en el texto, pero no deben agregarse a usedVocabulary.',
    '- No introduzcas vocabulario avanzado ni estructuras fuera de allowedGrammar.',
    '- La oración debe sonar natural en latín clásico y tener una respuesta inequívoca.',
    '- Usá macrones cuando existan en los datos, pero no los conviertas en objetivo salvo indicación expresa.',
    '- targetForm debe ser la forma exacta del target usada en question o answer.',
    '- usedVocabulary debe incluir el ID target y solo IDs del request.',
    '- En múltiple opción devolvé exactamente 4 opciones e incluí answer; en los demás tipos options debe estar vacío.',
    '- No reveles la respuesta en el enunciado de producción, excepto el lema cuando la consigna morfológica lo requiera.',
    '- En INFLECTION_COMPLETION y GUIDED_RECALL indicá explícitamente en español qué significa la palabra target; la pista debe aparecer en prompt o question.',
    '- acceptableAnswers solo contiene variantes igualmente válidas; answer sigue siendo la respuesta modelo.',
    '- No devuelvas scores, etapas, prioridades, intervalos ni decisiones de progreso.',
    '- Devolvé solamente JSON válido, sin Markdown, comentarios ni texto adicional.',
    '',
    'FORMATO EXACTO:',
    JSON.stringify(responseShape, null, 2),
  ].join('\n')
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('la')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function sameNumbers(left, right) {
  return (
    JSON.stringify([...left].map(Number).sort((a, b) => a - b)) ===
    JSON.stringify([...right].map(Number).sort((a, b) => a - b))
  )
}

function sameStrings(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())
}

function containsTargetSurface(exercise) {
  const surface = normalize(exercise.targetForm)
  if (!surface) return false
  const field = TARGET_IN_QUESTION.has(exercise.exerciseType)
    ? exercise.question
    : exercise.answer
  return normalize(field).includes(surface)
}

export function validateAdaptiveGeneratedExercises(payload, generationRequest) {
  if (!payload || !Array.isArray(payload.exercises)) {
    throw new AppError('La IA no devolvió una lista válida de ejercicios.', 502)
  }
  if (payload.exercises.length !== generationRequest.exerciseCount) {
    throw new AppError(
      `La IA devolvió ${payload.exercises.length} ejercicios; se esperaban ${generationRequest.exerciseCount}.`,
      502,
    )
  }

  const targets = generationRequest.targetVocabulary
  const allowedVocabularyIds = new Set([
    ...targets.map((target) => Number(target.id)),
    ...generationRequest.supportVocabulary.map((word) => Number(word.vocabularyId)),
  ])
  const seenTargets = new Set()
  const signatures = new Set()

  payload.exercises.forEach((exercise, index) => {
    const target = targets[index]
    const requiredStrings = [
      'prompt',
      'question',
      'answer',
      'explanation',
      'targetForm',
    ]
    if (
      requiredStrings.some(
        (field) => typeof exercise[field] !== 'string' || !exercise[field].trim(),
      ) ||
      !Array.isArray(exercise.options) ||
      !Array.isArray(exercise.acceptableAnswers) ||
      !Array.isArray(exercise.targetVocabularyIds) ||
      !Array.isArray(exercise.grammarTargets) ||
      !Array.isArray(exercise.usedVocabulary)
    ) {
      throw new AppError(`El ejercicio adaptativo ${index + 1} tiene formato inválido.`, 502)
    }
    if (!ADAPTIVE_EXERCISE_TYPES.includes(exercise.exerciseType)) {
      throw new AppError(`El ejercicio adaptativo ${index + 1} tiene un tipo inválido.`, 502)
    }
    if (!sameNumbers(exercise.targetVocabularyIds, [target.id])) {
      throw new AppError(`El ejercicio adaptativo ${index + 1} cambió su palabra objetivo.`, 502)
    }
    if (seenTargets.has(Number(target.id))) {
      throw new AppError(`La IA repitió el objetivo ${target.id}.`, 502)
    }
    seenTargets.add(Number(target.id))
    if (exercise.exerciseType !== target.exerciseType) {
      throw new AppError(`El ejercicio adaptativo ${index + 1} cambió el tipo solicitado.`, 502)
    }
    if (!sameStrings(exercise.grammarTargets, target.grammarTarget)) {
      throw new AppError(`El ejercicio adaptativo ${index + 1} cambió el foco gramatical.`, 502)
    }
    if (
      !exercise.usedVocabulary.includes(Number(target.id)) ||
      exercise.usedVocabulary.some((id) => !allowedVocabularyIds.has(Number(id)))
    ) {
      throw new AppError(`El ejercicio adaptativo ${index + 1} usó vocabulario no permitido.`, 502)
    }
    if (!containsTargetSurface(exercise)) {
      throw new AppError(`El ejercicio adaptativo ${index + 1} no utiliza realmente la palabra objetivo.`, 502)
    }
    if (
      REQUIRES_SPANISH_TARGET_HINT.has(exercise.exerciseType) &&
      target.meaning &&
      !normalize(`${exercise.prompt} ${exercise.question}`).includes(
        normalize(target.meaning),
      )
    ) {
      throw new AppError(
        `El ejercicio adaptativo ${index + 1} no indica en español qué palabra debe completarse.`,
        502,
      )
    }
    const multipleChoice = MULTIPLE_CHOICE_TYPES.has(exercise.exerciseType)
    if (
      (multipleChoice &&
        (exercise.options.length !== 4 || !exercise.options.includes(exercise.answer))) ||
      (!multipleChoice && exercise.options.length !== 0)
    ) {
      throw new AppError(`El ejercicio adaptativo ${index + 1} tiene opciones incompatibles.`, 502)
    }
    const signature = `${exercise.exerciseType}|${normalize(exercise.question)}`
    if (signatures.has(signature)) {
      throw new AppError('La IA devolvió ejercicios duplicados.', 502)
    }
    signatures.add(signature)
  })

  return payload.exercises
}
