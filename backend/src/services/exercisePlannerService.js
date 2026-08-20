import { ADAPTIVE_EXERCISE_TYPES } from '../config/adaptiveReviewConfig.js'

const BASIC_RECOGNITION_TYPES = new Set([
  'VOCABULARY_MULTIPLE_CHOICE',
  'CONTEXT_MEANING',
])

const STAGE_PREFERENCES = {
  NEW: ['VOCABULARY_MULTIPLE_CHOICE', 'CONTEXT_MEANING'],
  RECOGNITION: [
    'CONTEXT_MEANING',
    'TRANSLATION_LA_ES',
    'INFLECTION_MULTIPLE_CHOICE',
  ],
  CONTEXT_RECOGNITION: [
    'TRANSLATION_LA_ES',
    'GUIDED_RECALL',
    'INFLECTION_COMPLETION',
  ],
  GUIDED_RECALL: [
    'GUIDED_RECALL',
    'TRANSLATION_ES_LA',
    'INFLECTION_COMPLETION',
  ],
  PRODUCTION: [
    'TRANSLATION_ES_LA',
    'MORPHOLOGY_PRODUCTION',
    'FREE_PRODUCTION',
  ],
  MASTERED: [
    'FREE_PRODUCTION',
    'TRANSLATION_ES_LA',
    'MORPHOLOGY_PRODUCTION',
    'CONTEXT_MEANING',
  ],
}

const WEAKNESS_PREFERENCES = {
  RECOGNITION: [
    'CONTEXT_MEANING',
    'VOCABULARY_MULTIPLE_CHOICE',
    'TRANSLATION_LA_ES',
  ],
  PRODUCTION: [
    'TRANSLATION_ES_LA',
    'GUIDED_RECALL',
    'INFLECTION_COMPLETION',
    'FREE_PRODUCTION',
  ],
  MORPHOLOGY: [
    'INFLECTION_COMPLETION',
    'MORPHOLOGY_PRODUCTION',
    'INFLECTION_MULTIPLE_CHOICE',
    'LEMMA_IDENTIFICATION',
  ],
}

function score(progress, field) {
  return Number(progress?.[field] || 0)
}

export function getWeakestVocabularySkill(progress) {
  const skills = [
    ['RECOGNITION', score(progress, 'recognitionScore')],
    ['PRODUCTION', score(progress, 'productionScore')],
    ['MORPHOLOGY', score(progress, 'morphologyScore')],
  ].sort((left, right) => left[1] - right[1])
  return skills[1][1] - skills[0][1] >= 12 ? skills[0][0] : 'BALANCED'
}

function recentFailureFallback(recent = {}) {
  const incorrect = recent.incorrectByType || {}
  const productionFailures =
    Number(incorrect.PRODUCTION || 0) +
    Number(incorrect.GUIDED_RECALL || 0)
  const morphologyFailures = Number(incorrect.MORPHOLOGY || 0)
  if (productionFailures >= 2) {
    return ['GUIDED_RECALL', 'INFLECTION_COMPLETION', 'CONTEXT_MEANING']
  }
  if (morphologyFailures >= 2) {
    return ['INFLECTION_MULTIPLE_CHOICE', 'LEMMA_IDENTIFICATION']
  }
  return null
}

function selectVaried(preferences, recentExerciseTypes, typeCounts, seed) {
  const valid = preferences.filter((type) => ADAPTIVE_EXERCISE_TYPES.includes(type))
  const lastTwo = recentExerciseTypes.slice(-2)
  return valid
    .map((type, index) => ({
      type,
      index,
      count: Number(typeCounts[type] || 0),
      repeated: lastTwo.length === 2 && lastTwo.every((item) => item === type),
    }))
    .sort(
      (left, right) =>
        Number(left.repeated) - Number(right.repeated) ||
        left.count - right.count ||
        ((left.index - seed + valid.length) % valid.length) -
          ((right.index - seed + valid.length) % valid.length),
    )[0]?.type || 'CONTEXT_MEANING'
}

export function selectVocabularyExerciseType(
  progress,
  {
    recent = {},
    itemIndex = 0,
    screening = false,
    recentExerciseTypes = [],
    typeCounts = {},
  } = {},
) {
  if (screening) {
    return selectVaried(
      ['VOCABULARY_MULTIPLE_CHOICE', 'CONTEXT_MEANING'],
      recentExerciseTypes,
      typeCounts,
      itemIndex,
    )
  }

  const recognition = score(progress, 'recognitionScore')
  const production = score(progress, 'productionScore')
  const morphology = score(progress, 'morphologyScore')
  const fallback = recentFailureFallback(recent)
  let preferences

  if (fallback) preferences = fallback
  else if (recognition >= 90 && production < 60) {
    preferences = WEAKNESS_PREFERENCES.PRODUCTION
  } else if (recognition >= 80 && production >= 70 && morphology < 55) {
    preferences = WEAKNESS_PREFERENCES.MORPHOLOGY
  } else if (recognition < 45 && production < 35 && morphology < 35) {
    preferences = ['VOCABULARY_MULTIPLE_CHOICE', 'CONTEXT_MEANING']
  } else {
    const weakness = getWeakestVocabularySkill(progress)
    preferences =
      weakness === 'BALANCED'
        ? STAGE_PREFERENCES[progress?.learningStage || 'NEW']
        : WEAKNESS_PREFERENCES[weakness]
  }

  if (recognition >= 80 && !recent.incorrect) {
    const advanced = preferences.filter((type) => !BASIC_RECOGNITION_TYPES.has(type))
    if (advanced.length) preferences = advanced
  }
  return selectVaried(
    preferences,
    recentExerciseTypes,
    typeCounts,
    itemIndex % Math.max(1, preferences.length),
  )
}

export const selectExerciseType = selectVocabularyExerciseType

function selectGrammarTargets(vocabulary, exerciseType, itemIndex) {
  if (exerciseType === 'VOCABULARY_MULTIPLE_CHOICE') return ['lexical_meaning']
  if (exerciseType === 'CONTEXT_MEANING') return ['meaning_in_context']
  if (exerciseType === 'TRANSLATION_LA_ES') return ['contextual_comprehension']
  if (exerciseType === 'LEMMA_IDENTIFICATION') return ['lemma_identification']

  const partOfSpeech = vocabulary.partOfSpeech
  if (partOfSpeech === 'VERB') {
    const persons = ['first_person', 'second_person', 'third_person']
    const numbers = ['singular', 'plural']
    return [
      'present_active',
      persons[itemIndex % persons.length],
      numbers[Math.floor(itemIndex / persons.length) % numbers.length],
    ]
  }
  if (partOfSpeech === 'NOUN' || partOfSpeech === 'ADJECTIVE') {
    const cases = ['nominative', 'accusative', 'genitive', 'dative', 'ablative']
    const numbers = ['singular', 'plural']
    return [
      cases[itemIndex % cases.length],
      numbers[Math.floor(itemIndex / cases.length) % numbers.length],
      partOfSpeech === 'ADJECTIVE' ? 'agreement' : 'nominal_morphology',
    ]
  }
  return exerciseType === 'FREE_PRODUCTION'
    ? ['controlled_sentence']
    : ['lemma_recall']
}

export function planExercisesForVocabulary(candidates) {
  const recentExerciseTypes = []
  const typeCounts = {}
  return candidates.map((candidate, itemIndex) => {
    const screening = candidate.reason === 'BACKLOG_SCREENING'
    const selectedExerciseType = selectVocabularyExerciseType(candidate.progress, {
      recent: candidate.recent,
      itemIndex,
      screening,
      recentExerciseTypes,
      typeCounts,
    })
    recentExerciseTypes.push(selectedExerciseType)
    typeCounts[selectedExerciseType] = (typeCounts[selectedExerciseType] || 0) + 1

    return {
      vocabularyId: candidate.vocabulary.id,
      lemma: candidate.vocabulary.lemma,
      normalizedLemma: candidate.vocabulary.normalizedLemma,
      meaning: candidate.vocabulary.meaningEs,
      partOfSpeech: candidate.vocabulary.partOfSpeech,
      morphologyReference: {
        nominative: candidate.vocabulary.nominative,
        genitive: candidate.vocabulary.genitive,
        gender: candidate.vocabulary.gender,
        declension: candidate.vocabulary.declension,
        principalParts: candidate.vocabulary.principalParts,
        conjugation: candidate.vocabulary.conjugation,
        adjectiveForms: candidate.vocabulary.adjectiveForms,
        sourceForms: candidate.vocabulary.morphologyData?.sourceForms || [],
      },
      chapterOrigin: candidate.vocabulary.firstAppearanceChapter,
      sourceBucket: candidate.sourceBucket,
      practiceMode: screening ? 'BACKLOG_SCREENING' : 'STANDARD',
      learningStage: candidate.progress.learningStage || 'NEW',
      weakestSkill: getWeakestVocabularySkill(candidate.progress),
      recognitionScore: Number(candidate.progress.recognitionScore || 0),
      productionScore: Number(candidate.progress.productionScore || 0),
      morphologyScore: Number(candidate.progress.morphologyScore || 0),
      selectedExerciseType,
      grammarTargets: selectGrammarTargets(
        candidate.vocabulary,
        selectedExerciseType,
        itemIndex,
      ),
      priorityScore: candidate.priorityScore,
      reason: candidate.reason,
    }
  })
}
