import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  getWeakestVocabularySkill,
  planExercisesForVocabulary,
  selectVocabularyExerciseType,
} from '../src/services/exercisePlannerService.js'
import { evaluateSubmittedAnswer } from '../src/services/answerEvaluationService.js'
import { applyVocabularyExerciseResult } from '../src/services/vocabularyExercisePolicyService.js'
import { calculateVocabularyProgressUpdate } from '../src/services/vocabularyProgressService.js'

function progress(overrides = {}) {
  return {
    learningStage: 'NEW',
    recognitionScore: 0,
    productionScore: 0,
    morphologyScore: 0,
    timesReviewed: 0,
    ...overrides,
  }
}

function candidate(id, progressData = progress(), recent = {}) {
  return {
    vocabulary: {
      id,
      lemma: `lemma${id}`,
      normalizedLemma: `lemma${id}`,
      meaningEs: `significado ${id}`,
      partOfSpeech: 'NOUN',
      firstAppearanceChapter: 10,
      morphologyData: { sourceForms: [] },
    },
    progress: progressData,
    recent,
    sourceBucket: 'BACKLOG',
    reason: 'NEEDS_FOUNDATION',
    priorityScore: 50,
  }
}

test('detecta producción como debilidad y evita opción múltiple con reconocimiento alto', () => {
  const state = progress({
    learningStage: 'GUIDED_RECALL',
    recognitionScore: 95,
    productionScore: 30,
    morphologyScore: 55,
  })
  assert.equal(getWeakestVocabularySkill(state), 'PRODUCTION')
  const selected = Array.from({ length: 8 }, (_, itemIndex) =>
    selectVocabularyExerciseType(state, { itemIndex }),
  )
  assert.equal(selected.includes('VOCABULARY_MULTIPLE_CHOICE'), false)
  assert.equal(
    selected.every((type) =>
      ['TRANSLATION_ES_LA', 'GUIDED_RECALL', 'INFLECTION_COMPLETION', 'FREE_PRODUCTION'].includes(type),
    ),
    true,
  )
})

test('prioriza morfología cuando reconocimiento y producción ya son sólidos', () => {
  const selected = Array.from({ length: 6 }, (_, itemIndex) =>
    selectVocabularyExerciseType(
      progress({
        learningStage: 'PRODUCTION',
        recognitionScore: 90,
        productionScore: 85,
        morphologyScore: 30,
      }),
      { itemIndex },
    ),
  )
  assert.equal(
    selected.every((type) =>
      ['INFLECTION_COMPLETION', 'MORPHOLOGY_PRODUCTION',
        'INFLECTION_MULTIPLE_CHOICE', 'LEMMA_IDENTIFICATION'].includes(type),
    ),
    true,
  )
})

test('una palabra nueva comienza con reconocimiento y contexto', () => {
  const selected = Array.from({ length: 6 }, (_, itemIndex) =>
    selectVocabularyExerciseType(progress(), { itemIndex }),
  )
  assert.equal(
    selected.every((type) =>
      ['VOCABULARY_MULTIPLE_CHOICE', 'CONTEXT_MEANING'].includes(type),
    ),
    true,
  )
})

test('un usuario que produce bien puede acelerar sin recorrer diez reconocimientos', () => {
  let state = progress()
  const sequence = [
    ['CONTEXT_MEANING', 'CONTEXT'],
    ['GUIDED_RECALL', 'GUIDED_RECALL'],
    ['TRANSLATION_ES_LA', 'PRODUCTION'],
  ]
  sequence.forEach(([exerciseType, reviewType], index) => {
    const evidence = applyVocabularyExerciseResult(state, exerciseType, 'CORRECT')
    state = {
      ...state,
      ...calculateVocabularyProgressUpdate(
        state,
        { reviewType, result: 'CORRECT', scoreAdjustments: evidence.scoreAdjustments },
        new Date(Date.UTC(2026, 7, 1 + index)),
      ),
    }
  })
  assert.equal(['CONTEXT_RECOGNITION', 'GUIDED_RECALL'].includes(state.learningStage), true)
  assert.ok(state.productionScore > 15)
})

test('los fallos repetidos en producción vuelven a formatos guiados sin tocar reconocimiento', () => {
  const state = progress({
    learningStage: 'PRODUCTION',
    recognitionScore: 92,
    productionScore: 61,
    morphologyScore: 58,
  })
  const type = selectVocabularyExerciseType(state, {
    recent: { incorrect: 3, incorrectByType: { PRODUCTION: 3 } },
  })
  assert.equal(['GUIDED_RECALL', 'INFLECTION_COMPLETION'].includes(type), true)
  const evidence = applyVocabularyExerciseResult(
    state,
    'TRANSLATION_ES_LA',
    'INCORRECT',
    { errorTypes: ['WRONG_LEMMA'] },
  )
  assert.equal(evidence.resultingScores.recognitionScore, undefined)
  assert.equal(state.recognitionScore, 92)
})

test('opción múltiple aísla reconocimiento y producción libre aporta más evidencia', () => {
  const state = progress({ recognitionScore: 40, productionScore: 20 })
  const multipleChoice = applyVocabularyExerciseResult(
    state,
    'VOCABULARY_MULTIPLE_CHOICE',
    'CORRECT',
  )
  const freeProduction = applyVocabularyExerciseResult(
    state,
    'FREE_PRODUCTION',
    'CORRECT',
  )
  assert.equal(multipleChoice.scoreAdjustments.productionScore, undefined)
  assert.ok(
    freeProduction.scoreAdjustments.productionScore >
      multipleChoice.scoreAdjustments.recognitionScore,
  )
})

test('la sesión mantiene diversidad cuando existen alternativas pedagógicas', () => {
  const plan = planExercisesForVocabulary(
    Array.from({ length: 12 }, (_, index) => candidate(index + 1)),
  )
  assert.ok(new Set(plan.map((item) => item.selectedExerciseType)).size > 1)
  assert.equal(
    plan.some(
      (item, index) =>
        index > 1 &&
        item.selectedExerciseType === plan[index - 1].selectedExerciseType &&
        item.selectedExerciseType === plan[index - 2].selectedExerciseType,
    ),
    false,
  )
})

test('la normalización acepta quercū y quercu salvo evaluación de cantidad', () => {
  assert.equal(evaluateSubmittedAnswer('quercu', 'quercū').result, 'CORRECT')
  assert.deepEqual(
    evaluateSubmittedAnswer('quercu', 'quercū', { macronsRequired: true }),
    {
      status: 'PARTIAL',
      result: 'PARTIAL',
      label: 'Respuesta incompleta: revisá las vocales largas',
      errorTypes: ['MACRON_ONLY'],
    },
  )
})
