import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

process.env.DATABASE_STORAGE = ':memory:'
process.env.AI_PROVIDER = 'mock'

const { sequelize } = await import('../src/database/sequelize.js')
const { models } = await import('../src/models/index.js')
const {
  createAdaptivePracticeSession,
  generateAdaptiveSessionExercises,
  submitAdaptiveExerciseAnswer,
} = await import('../src/services/adaptivePracticeService.js')

const now = new Date('2026-08-20T12:00:00.000Z')
const day = 24 * 60 * 60 * 1000
const currentFile = fileURLToPath(import.meta.url)
const outputPath = path.resolve(
  path.dirname(currentFile),
  '../reports/adaptive-vocabulary-profiles.json',
)

const profiles = [
  {
    key: 'A',
    description: 'Reconocimiento alto, producción baja',
    progress: {
      learningStage: 'GUIDED_RECALL', recognitionScore: 95,
      productionScore: 30, morphologyScore: 55, timesReviewed: 6,
    },
  },
  {
    key: 'B',
    description: 'Reconocimiento y producción altos, morfología baja',
    progress: {
      learningStage: 'PRODUCTION', recognitionScore: 91,
      productionScore: 86, morphologyScore: 28, timesReviewed: 9,
    },
  },
  { key: 'C', description: 'Palabra completamente nueva', progress: null },
  {
    key: 'D',
    description: 'Palabra MASTERED vencida',
    progress: {
      learningStage: 'MASTERED', recognitionScore: 96,
      productionScore: 91, morphologyScore: 82, timesReviewed: 16,
      successfulRecall: 10, correctProduction: 6,
      currentStreak: 7, longestStreak: 9,
      nextReviewAt: new Date(now.getTime() - 5 * day),
      lastReviewedAt: new Date(now.getTime() - 40 * day),
    },
  },
  {
    key: 'E',
    description: 'Múltiples errores recientes de producción',
    progress: {
      learningStage: 'PRODUCTION', recognitionScore: 89,
      productionScore: 57, morphologyScore: 52, timesReviewed: 11,
      failedRecall: 3, failedProduction: 3, lapseCount: 3,
    },
    failures: 3,
  },
]

try {
  await sequelize.sync({ force: true })
  await models.ProfileSettings.create({
    id: 1,
    vocabularyChapterFrom: 10,
    vocabularyChapterTo: 15,
  })
  const words = []
  for (let index = 1; index <= 20; index += 1) {
    const word = await models.Vocabulary.create({
      lemma: `vocābulum${index}`,
      normalizedLemma: `vocabulum${index}`,
      meaningEs: `significado ${index}`,
      partOfSpeech: index % 4 === 0 ? 'VERB' : 'NOUN',
      firstAppearanceChapter: 10 + (index % 6),
      morphologyData: { sourceForms: [`vocābulum${index}`], rawOccurrences: index + 2 },
      importStatus: 'VERIFIED',
    })
    await models.VocabularyChapter.create({
      vocabularyId: word.id,
      chapter: word.firstAppearanceChapter,
    })
    words.push(word)
  }

  const report = []
  for (const profile of profiles) {
    const user = await models.User.create({ displayName: `Usuario ${profile.key}` })
    await models.ReadingProgress.create({
      userId: user.id,
      book: 'Familia Romana',
      currentChapter: 15,
    })
    if (profile.progress) {
      for (const word of words) {
        await models.UserVocabularyProgress.create({
          userId: user.id,
          vocabularyId: word.id,
          ...profile.progress,
        })
      }
    }
    if (profile.failures) {
      for (let index = 0; index < profile.failures; index += 1) {
        await models.VocabularyReviewEvent.create({
          userId: user.id,
          vocabularyId: words[0].id,
          reviewType: 'PRODUCTION',
          result: 'INCORRECT',
          previousStage: 'PRODUCTION',
          resultingStage: 'PRODUCTION',
          reviewedAt: new Date(now.getTime() - index * day),
        })
      }
    }

    const session = await createAdaptivePracticeSession({
      userId: user.id,
      sessionSize: 15,
      now,
    })
    const generated = await generateAdaptiveSessionExercises(session.id)
    const first = generated.exercises[0]
    const answerResult = await submitAdaptiveExerciseAnswer({
      exerciseId: first.id,
      userId: user.id,
      answer: first.answer,
      responseTimeMs: 2400,
      answeredAt: new Date(now.getTime() + 60_000),
    })
    const event = await models.VocabularyReviewEvent.findByPk(
      answerResult.progress[0].reviewEventId,
      { raw: true },
    )
    report.push({
      profile: profile.key,
      description: profile.description,
      selectedTypes: session.plan.items.map((item) => item.selectedExerciseType),
      weakestSkills: session.plan.items.map((item) => item.weakestSkill),
      firstExercise: first,
      firstAnswer: answerResult.evaluation,
      progressAfterAnswer: answerResult.progress[0],
      reviewEvidence: event.metadata,
    })
  }

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify({ generatedAt: now, profiles: report }, null, 2)}\n`)
  console.log(`Informe de cinco perfiles: ${outputPath}`)
  for (const item of report) {
    const counts = Object.groupBy(item.selectedTypes, (type) => type)
    console.log(`Usuario ${item.profile}: ${Object.entries(counts).map(([type, values]) => `${type}=${values.length}`).join(', ')}`)
  }
} finally {
  await sequelize.close()
}
