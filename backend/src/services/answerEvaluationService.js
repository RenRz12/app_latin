const LONG_VOWEL_MAP = {
  ā: 'a*', á: 'a*', à: 'a*', â: 'a*', ä: 'a*', ã: 'a*',
  ē: 'e*', é: 'e*', è: 'e*', ê: 'e*', ë: 'e*',
  ī: 'i*', í: 'i*', ì: 'i*', î: 'i*', ï: 'i*',
  ō: 'o*', ó: 'o*', ò: 'o*', ô: 'o*', ö: 'o*', õ: 'o*',
  ū: 'u*', ú: 'u*', ù: 'u*', û: 'u*', ü: 'u*',
  ȳ: 'y*', ý: 'y*', ÿ: 'y*',
}

const AI_ASSISTED_TYPES = new Set([
  'TRANSLATION_LA_ES',
  'TRANSLATION_ES_LA',
  'FREE_PRODUCTION',
])

function normalizeSpacing(value) {
  return String(value || '')
    .normalize('NFC')
    .toLocaleLowerCase('es-AR')
    .trim()
    .replace(/[.,;:!?¿¡"']/g, '')
    .replace(/\s+/g, ' ')
}

function normalizeLongVowels(value) {
  return [...normalizeSpacing(value)]
    .map((letter) => LONG_VOWEL_MAP[letter] || letter)
    .join('')
}

function normalizeWithoutMarks(value) {
  return normalizeSpacing(value).normalize('NFD').replace(/\p{M}/gu, '')
}

function wordsSorted(value) {
  return normalizeWithoutMarks(value).split(' ').sort().join(' ')
}

function levenshtein(left, right) {
  const rows = Array.from({ length: left.length + 1 }, () => [])
  for (let index = 0; index <= left.length; index += 1) rows[index][0] = index
  for (let index = 0; index <= right.length; index += 1) rows[0][index] = index
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] +
          (left[row - 1] === right[column - 1] ? 0 : 1),
      )
    }
  }
  return rows[left.length][right.length]
}

function incorrectErrorTypes(exerciseType, grammarTargets = []) {
  const errors = []
  if (['TRANSLATION_LA_ES', 'CONTEXT_MEANING', 'VOCABULARY_MULTIPLE_CHOICE'].includes(exerciseType)) {
    errors.push('WRONG_MEANING')
  } else if (exerciseType === 'LEMMA_IDENTIFICATION' || exerciseType === 'TRANSLATION_ES_LA') {
    errors.push('WRONG_LEMMA')
  }
  if (grammarTargets.some((target) => ['nominative', 'accusative', 'genitive', 'dative', 'ablative'].includes(target))) {
    errors.push('WRONG_CASE')
  }
  if (grammarTargets.some((target) => ['singular', 'plural'].includes(target))) {
    errors.push('WRONG_NUMBER')
  }
  if (grammarTargets.some((target) => target.includes('person'))) errors.push('WRONG_PERSON')
  if (grammarTargets.some((target) => ['present_active', 'imperfect_active', 'future_active', 'perfect_active'].includes(target))) {
    errors.push('WRONG_TENSE')
  }
  if (grammarTargets.some((target) => target.includes('passive'))) errors.push('WRONG_VOICE')
  return errors.length ? errors : ['WRONG_LEMMA']
}

export function getVocabularyEvaluationStrategy(exerciseType) {
  return AI_ASSISTED_TYPES.has(exerciseType) ? 'AI_ASSISTED' : 'DETERMINISTIC'
}

export function evaluateSubmittedAnswer(
  userAnswer,
  expectedAnswer,
  {
    acceptableAnswers = [],
    exerciseType = null,
    grammarTargets = [],
    targetForm = null,
    macronsRequired = false,
  } = {},
) {
  const normalizedAnswer = normalizeSpacing(userAnswer)
  if (!normalizedAnswer) {
    return { status: 'EMPTY', result: null, label: 'Sin respuesta', errorTypes: [] }
  }

  const expectedValues = [expectedAnswer, ...acceptableAnswers].filter(Boolean)
  if (expectedValues.some((value) => normalizedAnswer === normalizeSpacing(value))) {
    return { status: 'CORRECT', result: 'CORRECT', label: 'Respuesta correcta', errorTypes: [] }
  }
  if (expectedValues.some((value) => normalizeLongVowels(userAnswer) === normalizeLongVowels(value))) {
    return { status: 'CORRECT', result: 'CORRECT', label: 'Respuesta correcta', errorTypes: [] }
  }
  if (expectedValues.some((value) => normalizeWithoutMarks(userAnswer) === normalizeWithoutMarks(value))) {
    return macronsRequired
      ? {
          status: 'PARTIAL', result: 'PARTIAL',
          label: 'Respuesta incompleta: revisá las vocales largas',
          errorTypes: ['MACRON_ONLY'],
        }
      : {
          status: 'CORRECT', result: 'CORRECT',
          label: 'Respuesta correcta; los macrones se muestran como referencia',
          errorTypes: ['MACRON_ONLY'],
        }
  }

  if (
    targetForm &&
    normalizeWithoutMarks(userAnswer) === normalizeWithoutMarks(targetForm) &&
    !expectedValues.some((value) => normalizeWithoutMarks(value) === normalizeWithoutMarks(targetForm))
  ) {
    return {
      status: 'PARTIAL', result: 'PARTIAL',
      label: 'La palabra objetivo está bien, pero la respuesta está incompleta',
      errorTypes: ['INCOMPLETE_RESPONSE'],
    }
  }
  if (expectedValues.some((value) => wordsSorted(userAnswer) === wordsSorted(value))) {
    return {
      status: 'PARTIAL', result: 'PARTIAL', label: 'Las palabras son correctas; revisá el orden',
      errorTypes: ['WORD_ORDER'],
    }
  }
  if (
    expectedValues.some((value) => {
      const expected = normalizeWithoutMarks(value)
      const answer = normalizeWithoutMarks(userAnswer)
      return expected.length >= 4 && levenshtein(answer, expected) <= Math.min(2, Math.floor(expected.length / 4))
    })
  ) {
    return {
      status: 'PARTIAL', result: 'PARTIAL', label: 'Casi correcto; revisá la escritura',
      errorTypes: ['SPELLING'],
    }
  }
  return {
    status: 'INCORRECT', result: 'INCORRECT', label: 'Todavía no',
    errorTypes: incorrectErrorTypes(exerciseType, grammarTargets),
  }
}

export async function evaluateVocabularyExerciseAnswer(
  answerData,
  { semanticEvaluator = null } = {},
) {
  const deterministic = evaluateSubmittedAnswer(
    answerData.userAnswer,
    answerData.expectedAnswer,
    answerData,
  )
  const strategy = getVocabularyEvaluationStrategy(answerData.exerciseType)
  if (
    strategy === 'AI_ASSISTED' &&
    deterministic.result === 'INCORRECT' &&
    typeof semanticEvaluator === 'function'
  ) {
    return {
      ...(await semanticEvaluator(answerData)),
      strategy,
    }
  }
  return { ...deterministic, strategy }
}
