import { Op } from 'sequelize'
import {
  ADAPTIVE_REVIEW_CONFIG,
  SOURCE_BUCKETS,
} from '../config/adaptiveReviewConfig.js'
import { UserVocabularyProgress } from '../models/UserVocabularyProgress.js'
import { Vocabulary } from '../models/Vocabulary.js'
import { VocabularyChapter } from '../models/VocabularyChapter.js'
import { VocabularyReviewEvent } from '../models/VocabularyReviewEvent.js'
import { isPracticeReadyVocabulary } from '../utils/vocabularyEligibility.js'

const DAY_MS = 24 * 60 * 60 * 1000

function numeric(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function daysBetween(later, earlier) {
  if (!earlier) return null
  return Math.max(0, (later.getTime() - new Date(earlier).getTime()) / DAY_MS)
}

function plain(model) {
  return model?.get ? model.get({ plain: true }) : model
}

function blankProgress() {
  return {
    learningStage: 'NEW',
    recognitionScore: 0,
    productionScore: 0,
    morphologyScore: 0,
    timesReviewed: 0,
    lapseCount: 0,
    currentStreak: 0,
    nextReviewAt: null,
    lastReviewedAt: null,
  }
}

function summarizeRecentEvents(events = []) {
  const summary = {
    correct: 0,
    partial: 0,
    incorrect: 0,
    incorrectByType: {},
  }
  for (const event of events) {
    if (event.result === 'CORRECT') summary.correct += 1
    else if (event.result === 'PARTIAL') summary.partial += 1
    else if (event.result === 'INCORRECT') {
      summary.incorrect += 1
      summary.incorrectByType[event.reviewType] =
        (summary.incorrectByType[event.reviewType] || 0) + 1
    }
  }
  return summary
}

export function classifyVocabularyBucket({
  vocabulary,
  progress,
  currentChapter,
  now,
}) {
  const state = progress || blankProgress()
  const firstChapter = numeric(vocabulary.firstAppearanceChapter, 1)
  const isDue = state.nextReviewAt && new Date(state.nextReviewAt) <= now
  if (isDue) return 'DUE'

  if (
    firstChapter >=
    currentChapter - ADAPTIVE_REVIEW_CONFIG.currentChapterWindow
  ) {
    return 'CURRENT'
  }

  const consolidated =
    ['PRODUCTION', 'MASTERED'].includes(state.learningStage) &&
    numeric(state.productionScore) >= 65
  if (!consolidated || numeric(state.timesReviewed) < 4) return 'BACKLOG'

  return 'MAINTENANCE'
}

export function calculateVocabularyPriority(candidate, context) {
  const { priority } = ADAPTIVE_REVIEW_CONFIG
  const state = candidate.progress || blankProgress()
  const recent = candidate.recent || summarizeRecentEvents()
  const now = context.now
  const currentChapter = context.currentChapter
  const firstChapter = numeric(candidate.vocabulary.firstAppearanceChapter, 1)
  const scoreGap = Math.max(
    0,
    numeric(state.recognitionScore) - numeric(state.productionScore),
  )
  const daysSinceReview = daysBetween(now, state.lastReviewedAt)
  const overdueDays = state.nextReviewAt
    ? Math.max(
        0,
        (now.getTime() - new Date(state.nextReviewAt).getTime()) / DAY_MS,
      )
    : 0
  const chapterDistance = Math.abs(currentChapter - firstChapter)
  const occurrenceCount = numeric(
    candidate.vocabulary.morphologyData?.rawOccurrences,
    1,
  )
  const chapterCount = candidate.vocabulary.chapters?.length || 1

  let score = priority.bucketBase[candidate.sourceBucket]
  score += priority.stageNeed[state.learningStage] ?? priority.stageNeed.NEW
  score += Math.min(
    priority.maximumOverdueBonus,
    overdueDays * priority.overduePerDay,
  )
  score += (100 - numeric(state.recognitionScore)) * priority.recognitionDeficit
  score += (100 - numeric(state.productionScore)) * priority.productionDeficit
  score += (100 - numeric(state.morphologyScore)) * priority.morphologyDeficit
  score += scoreGap * priority.productionGap
  score += numeric(state.lapseCount) * priority.lapse
  score += recent.incorrect * priority.recentIncorrect
  score += recent.correct * priority.recentCorrect
  score += Math.max(
    priority.maximumStreakDiscount,
    numeric(state.currentStreak) * priority.streak,
  )
  score += state.lastReviewedAt
    ? Math.min(
        priority.maximumTimeBonus,
        daysSinceReview * priority.daysSinceReview,
      )
    : priority.neverReviewed
  if (chapterDistance === 0) score += priority.currentChapter
  else if (chapterDistance === 1) score += priority.previousChapter
  else if (chapterDistance <= 3) score += priority.nearbyChapter
  score += Math.log2(occurrenceCount + chapterCount + 1) * priority.frequency

  return Number(score.toFixed(2))
}

function selectionReason(candidate) {
  const state = candidate.progress || blankProgress()
  if (candidate.sourceBucket === 'DUE') return 'DUE_REVIEW'
  if (
    candidate.recent.incorrect > candidate.recent.correct &&
    candidate.recent.incorrect > 0
  ) {
    return 'RECENT_LAPSE'
  }
  if (
    numeric(state.recognitionScore) >= 70 &&
    numeric(state.recognitionScore) - numeric(state.productionScore) >= 25
  ) {
    return 'LOW_PRODUCTION'
  }
  if (candidate.sourceBucket === 'CURRENT') return 'CURRENT_CHAPTER'
  if (candidate.sourceBucket === 'BACKLOG' && !candidate.hasProgress) {
    return 'BACKLOG_SCREENING'
  }
  if (candidate.sourceBucket === 'BACKLOG') return 'BACKLOG'
  return 'MAINTENANCE'
}

export function allocateBucketSlots(sessionSize, distribution) {
  const allocation = {}
  const fractions = []
  let allocated = 0
  for (const bucket of SOURCE_BUCKETS) {
    const exact = sessionSize * (distribution[bucket] || 0)
    allocation[bucket] = Math.floor(exact)
    allocated += allocation[bucket]
    fractions.push({ bucket, fraction: exact - allocation[bucket] })
  }
  fractions.sort(
    (left, right) =>
      right.fraction - left.fraction ||
      SOURCE_BUCKETS.indexOf(left.bucket) -
        SOURCE_BUCKETS.indexOf(right.bucket),
  )
  for (let index = 0; allocated < sessionSize; index += 1, allocated += 1) {
    allocation[fractions[index % fractions.length].bucket] += 1
  }
  return allocation
}

function sortCandidates(candidates) {
  return [...candidates].sort(
    (left, right) =>
      right.priorityScore - left.priorityScore ||
      left.vocabulary.id - right.vocabulary.id,
  )
}

function adaptivelyDisplace(selected, remaining, sessionSize) {
  const { displacementMargin, maximumDisplacementRatio } =
    ADAPTIVE_REVIEW_CONFIG.priority
  const maxReplacements = Math.ceil(sessionSize * maximumDisplacementRatio)
  const result = [...selected]
  const bucketCounts = result.reduce((counts, item) => {
    counts[item.sourceBucket] = (counts[item.sourceBucket] || 0) + 1
    return counts
  }, {})
  let replacements = 0

  for (const challenger of sortCandidates(remaining)) {
    if (replacements >= maxReplacements) break
    const replaceable = result
      .filter(
        (item) =>
          item.sourceBucket !== 'DUE' && bucketCounts[item.sourceBucket] > 1,
      )
      .sort((left, right) => left.priorityScore - right.priorityScore)[0]
    if (
      !replaceable ||
      challenger.priorityScore < replaceable.priorityScore + displacementMargin
    ) {
      continue
    }
    result.splice(result.indexOf(replaceable), 1, challenger)
    bucketCounts[replaceable.sourceBucket] -= 1
    bucketCounts[challenger.sourceBucket] =
      (bucketCounts[challenger.sourceBucket] || 0) + 1
    replacements += 1
  }
  return result
}

function improvePartOfSpeechVariety(selected, candidates) {
  const availableParts = new Set(
    candidates.map((candidate) => candidate.vocabulary.partOfSpeech),
  )
  const desiredVariety = Math.min(3, availableParts.size)
  const result = [...selected]
  const selectedIds = new Set(
    result.map((candidate) => candidate.vocabulary.id),
  )
  const represented = new Set(
    result.map((candidate) => candidate.vocabulary.partOfSpeech),
  )
  if (represented.size >= desiredVariety) return result

  for (const missingPart of [...availableParts].filter(
    (part) => !represented.has(part),
  )) {
    const challenger = sortCandidates(
      candidates.filter(
        (candidate) =>
          candidate.vocabulary.partOfSpeech === missingPart &&
          !selectedIds.has(candidate.vocabulary.id),
      ),
    )[0]
    if (!challenger) continue
    const partCounts = result.reduce((counts, candidate) => {
      const part = candidate.vocabulary.partOfSpeech
      counts[part] = (counts[part] || 0) + 1
      return counts
    }, {})
    const bucketCounts = result.reduce((counts, candidate) => {
      counts[candidate.sourceBucket] = (counts[candidate.sourceBucket] || 0) + 1
      return counts
    }, {})
    const replaceable = [...result]
      .filter(
        (candidate) =>
          partCounts[candidate.vocabulary.partOfSpeech] > 1 &&
          candidate.sourceBucket !== 'DUE' &&
          candidate.sourceBucket === challenger.sourceBucket &&
          bucketCounts[candidate.sourceBucket] > 1,
      )
      .sort((left, right) => left.priorityScore - right.priorityScore)[0]
    if (
      !replaceable ||
      challenger.priorityScore +
        ADAPTIVE_REVIEW_CONFIG.priority.varietyPriorityTolerance <
        replaceable.priorityScore
    ) {
      continue
    }
    result.splice(result.indexOf(replaceable), 1, challenger)
    selectedIds.delete(replaceable.vocabulary.id)
    selectedIds.add(challenger.vocabulary.id)
    represented.add(missingPart)
    if (represented.size >= desiredVariety) break
  }
  return result
}

export function selectVocabularyCandidates({
  vocabulary,
  progressByVocabularyId = new Map(),
  eventsByVocabularyId = new Map(),
  currentChapter,
  sessionSize,
  mode = 'NORMAL',
  now = new Date(),
}) {
  const distribution = ADAPTIVE_REVIEW_CONFIG.distributions[mode]
  if (!distribution) throw new Error(`Modo adaptativo desconocido: ${mode}`)

  const candidates = vocabulary.map((wordModel) => {
    const word = plain(wordModel)
    const progressModel = progressByVocabularyId.get(word.id)
    const progress = plain(progressModel) || blankProgress()
    const recent = summarizeRecentEvents(
      eventsByVocabularyId.get(word.id) || [],
    )
    const sourceBucket = classifyVocabularyBucket({
      vocabulary: word,
      progress,
      currentChapter,
      now,
    })
    const candidate = {
      vocabulary: word,
      progress,
      recent,
      hasProgress: Boolean(progressModel),
      sourceBucket,
    }
    candidate.priorityScore = calculateVocabularyPriority(candidate, {
      currentChapter,
      now,
    })
    candidate.reason = selectionReason(candidate)
    return candidate
  })

  const buckets = Object.fromEntries(
    SOURCE_BUCKETS.map((bucket) => [
      bucket,
      sortCandidates(
        candidates.filter((candidate) => candidate.sourceBucket === bucket),
      ),
    ]),
  )
  const allocation = allocateBucketSlots(sessionSize, distribution)
  const selected = []
  const selectedIds = new Set()
  for (const bucket of SOURCE_BUCKETS) {
    for (const candidate of buckets[bucket].slice(0, allocation[bucket])) {
      selected.push(candidate)
      selectedIds.add(candidate.vocabulary.id)
    }
  }

  const remaining = sortCandidates(
    candidates.filter((candidate) => !selectedIds.has(candidate.vocabulary.id)),
  )
  for (const candidate of remaining) {
    if (selected.length >= sessionSize) break
    selected.push(candidate)
    selectedIds.add(candidate.vocabulary.id)
  }

  const unselected = candidates.filter(
    (candidate) => !selectedIds.has(candidate.vocabulary.id),
  )
  const displaced = adaptivelyDisplace(selected, unselected, sessionSize)
  return sortCandidates(
    improvePartOfSpeechVariety(displaced, candidates),
  ).slice(0, sessionSize)
}

export async function selectAdaptiveVocabulary({
  userId,
  currentChapter,
  chapterFrom = 1,
  chapterTo = currentChapter,
  sessionSize,
  mode = 'NORMAL',
  now = new Date(),
}) {
  const recentStart = new Date(
    now.getTime() - ADAPTIVE_REVIEW_CONFIG.recentEventWindowDays * DAY_MS,
  )
  const [vocabulary, progressRows, recentEvents] = await Promise.all([
    Vocabulary.findAll({
      where: {
        firstAppearanceChapter: { [Op.between]: [chapterFrom, chapterTo] },
      },
      include: [
        {
          model: VocabularyChapter,
          as: 'chapters',
          where: { chapter: { [Op.lte]: currentChapter } },
          required: true,
        },
      ],
      order: [['id', 'ASC']],
    }),
    UserVocabularyProgress.findAll({ where: { userId } }),
    VocabularyReviewEvent.findAll({
      where: { userId, reviewedAt: { [Op.gte]: recentStart } },
      order: [['reviewedAt', 'DESC']],
    }),
  ])
  const progressByVocabularyId = new Map(
    progressRows.map((row) => [row.vocabularyId, row]),
  )
  const eventsByVocabularyId = new Map()
  for (const event of recentEvents) {
    const events = eventsByVocabularyId.get(event.vocabularyId) || []
    events.push(plain(event))
    eventsByVocabularyId.set(event.vocabularyId, events)
  }

  return selectVocabularyCandidates({
    vocabulary: vocabulary.filter(isPracticeReadyVocabulary),
    progressByVocabularyId,
    eventsByVocabularyId,
    currentChapter,
    sessionSize,
    mode,
    now,
  })
}
