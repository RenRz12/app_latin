import {
  ADAPTIVE_EXERCISE_TYPES,
  ADAPTIVE_REVIEW_CONFIG,
} from '../config/adaptiveReviewConfig.js'

const SKILL_FIELDS = {
  recognition: 'recognitionScore',
  production: 'productionScore',
  morphology: 'morphologyScore',
}

const PRIMARY_SKILL = {
  VOCABULARY_MULTIPLE_CHOICE: 'RECOGNITION',
  CONTEXT_MEANING: 'RECOGNITION',
  TRANSLATION_LA_ES: 'RECOGNITION',
  TRANSLATION_ES_LA: 'PRODUCTION',
  INFLECTION_COMPLETION: 'MORPHOLOGY',
  INFLECTION_MULTIPLE_CHOICE: 'MORPHOLOGY',
  GUIDED_RECALL: 'PRODUCTION',
  LEMMA_IDENTIFICATION: 'MORPHOLOGY',
  MORPHOLOGY_PRODUCTION: 'MORPHOLOGY',
  FREE_PRODUCTION: 'PRODUCTION',
}

export function getVocabularyExerciseEvidence(exerciseType) {
  const evidence = ADAPTIVE_REVIEW_CONFIG.exerciseEvidence.types[exerciseType]
  if (!ADAPTIVE_EXERCISE_TYPES.includes(exerciseType) || !evidence) {
    throw Object.assign(new Error('El tipo de ejercicio adaptativo no es válido.'), {
      statusCode: 400,
    })
  }
  return evidence
}

export function getPrimaryVocabularySkill(exerciseType) {
  getVocabularyExerciseEvidence(exerciseType)
  return PRIMARY_SKILL[exerciseType]
}

function clamp(value) {
  return Math.min(100, Math.max(0, value))
}

function errorSeverity(errorTypes) {
  if (!errorTypes?.length) return 1
  const penalties = ADAPTIVE_REVIEW_CONFIG.exerciseEvidence.errorPenalty
  return Math.max(
    0,
    ...errorTypes.map((errorType) => penalties[errorType] ?? 1),
  )
}

export function applyVocabularyExerciseResult(
  progress,
  exerciseType,
  result,
  { errorTypes = [], morphologyEvaluated = true } = {},
) {
  const evidence = getVocabularyExerciseEvidence(exerciseType)
  const base = ADAPTIVE_REVIEW_CONFIG.exerciseEvidence.resultBase[result]
  if (base == null) {
    throw Object.assign(new Error('El resultado del ejercicio no es válido.'), {
      statusCode: 400,
    })
  }

  const severity = result === 'CORRECT' ? 1 : errorSeverity(errorTypes)
  const scoreAdjustments = {}
  const resultingScores = {}
  for (const [skill, weight] of Object.entries(evidence)) {
    if (skill === 'morphology' && !morphologyEvaluated) continue
    const field = SKILL_FIELDS[skill]
    const adjustment = Number((base * weight * severity).toFixed(2))
    scoreAdjustments[field] = adjustment
    resultingScores[field] = clamp(
      Number(progress?.[field] || 0) + adjustment,
    )
  }

  return {
    evaluatedSkill: getPrimaryVocabularySkill(exerciseType),
    evaluatedSkills: Object.keys(scoreAdjustments).map((field) =>
      field.replace('Score', '').toUpperCase(),
    ),
    evidenceWeight: Math.max(...Object.values(evidence)),
    scoreAdjustments,
    resultingScores,
  }
}
