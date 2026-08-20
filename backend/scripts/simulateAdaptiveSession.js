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

const currentFile = fileURLToPath(import.meta.url)
const backendDirectory = path.resolve(path.dirname(currentFile), '..')
const outputPath = path.join(
  backendDirectory,
  'reports',
  'adaptive-session-example.json',
)
const now = new Date('2026-08-14T12:00:00.000Z')
const day = 24 * 60 * 60 * 1000

const vocabularySeed = [
  ['mīles', 'soldado', 12, 'NOUN'],
  ['urbs', 'ciudad', 13, 'NOUN'],
  ['flūmen', 'río', 10, 'NOUN'],
  ['nāvis', 'nave', 16, 'NOUN'],
  ['quercus', 'encina', 19, 'NOUN'],
  ['silva', 'bosque', 9, 'NOUN'],
  ['corpus', 'cuerpo', 11, 'NOUN'],
  ['vulnus', 'herida', 21, 'NOUN'],
  ['sanguis', 'sangre', 11, 'NOUN'],
  ['gladius', 'espada', 12, 'NOUN'],
  ['iter', 'camino', 18, 'NOUN'],
  ['porta', 'puerta', 7, 'NOUN'],
  ['tempestās', 'tempestad', 16, 'NOUN'],
  ['mercātor', 'mercader', 20, 'NOUN'],
  ['dēfendere', 'defender', 21, 'VERB'],
  ['navigāre', 'navegar', 16, 'VERB'],
  ['occurrere', 'salir al encuentro', 22, 'VERB'],
  ['conspicere', 'divisar', 22, 'VERB'],
  ['perīculum', 'peligro', 16, 'NOUN'],
  ['lītus', 'costa', 16, 'NOUN'],
  ['cōnsilium', 'plan', 17, 'NOUN'],
  ['proficīscī', 'partir', 22, 'VERB'],
  ['advenīre', 'llegar', 7, 'VERB'],
  ['audīre', 'oír', 3, 'VERB'],
  ['fortis', 'valiente', 26, 'ADJECTIVE'],
  ['ingēns', 'enorme', 26, 'ADJECTIVE'],
  ['subitus', 'repentino', 26, 'ADJECTIVE'],
  ['servāre', 'salvar', 26, 'VERB'],
]

async function seedScenario() {
  await models.ProfileSettings.create({
    id: 1,
    vocabularyChapterFrom: 1,
    vocabularyChapterTo: 26,
  })
  const user = await models.User.create({
    displayName: 'Demostración adaptativa',
  })
  await models.ReadingProgress.create({
    userId: user.id,
    book: 'Familia Romana',
    currentChapter: 26,
  })
  const words = []
  for (const [lemma, meaningEs, chapter, partOfSpeech] of vocabularySeed) {
    const word = await models.Vocabulary.create({
      lemma,
      normalizedLemma: lemma.normalize('NFD').replace(/\p{M}/gu, ''),
      meaningEs,
      partOfSpeech,
      firstAppearanceChapter: chapter,
      morphologyData: { rawOccurrences: (chapter % 7) + 2 },
      importStatus: 'VERIFIED',
    })
    await models.VocabularyChapter.create({ vocabularyId: word.id, chapter })
    words.push(word)
  }

  for (const word of words.slice(0, 4)) {
    await models.UserVocabularyProgress.create({
      userId: user.id,
      vocabularyId: word.id,
      learningStage: 'GUIDED_RECALL',
      recognitionScore: 88,
      productionScore: 32,
      morphologyScore: 25,
      timesReviewed: 6,
      lapseCount: 2,
      lastReviewedAt: new Date(now.getTime() - 8 * day),
      nextReviewAt: new Date(now.getTime() - 2 * day),
    })
  }
  for (const word of words.slice(20, 24)) {
    await models.UserVocabularyProgress.create({
      userId: user.id,
      vocabularyId: word.id,
      learningStage: 'MASTERED',
      recognitionScore: 96,
      productionScore: 90,
      morphologyScore: 78,
      timesReviewed: 14,
      currentStreak: 7,
      longestStreak: 9,
      lastReviewedAt: new Date(now.getTime() - 30 * day),
      nextReviewAt: new Date(now.getTime() + 5 * day),
    })
  }
  return user
}

try {
  await sequelize.sync({ force: true })
  const user = await seedScenario()
  const session = await createAdaptivePracticeSession({
    userId: user.id,
    sessionSize: 10,
    now,
  })
  const progressBefore = await models.UserVocabularyProgress.findAll({
    raw: true,
  })
  const generated = await generateAdaptiveSessionExercises(session.id)
  const progressAfterGeneration = await models.UserVocabularyProgress.findAll({
    raw: true,
  })

  const correctExercise = generated.exercises[0]
  const incorrectExercise = generated.exercises[1]
  const correctResult = await submitAdaptiveExerciseAnswer({
    exerciseId: correctExercise.id,
    userId: user.id,
    answer: correctExercise.answer,
    responseTimeMs: 2100,
    answeredAt: new Date(now.getTime() + 5 * 60 * 1000),
  })
  const incorrectResult = await submitAdaptiveExerciseAnswer({
    exerciseId: incorrectExercise.id,
    userId: user.id,
    answer: 'respuesta incorrecta',
    responseTimeMs: 4300,
    answeredAt: new Date(now.getTime() + 6 * 60 * 1000),
  })

  const report = {
    generatedAt: new Date().toISOString(),
    simulatedUser: { id: user.id, readingChapter: 26 },
    session: {
      id: session.id,
      mode: session.sessionMode,
      size: session.sessionSize,
      distribution: session.plan.distribution,
      items: session.plan.items,
    },
    selectionExplanation: Object.fromEntries(
      session.plan.items.map((item) => [
        item.lemma,
        {
          bucket: item.sourceBucket,
          reason: item.reason,
          priorityScore: item.priorityScore,
          exerciseType: item.selectedExerciseType,
        },
      ]),
    ),
    generationRequest: generated.generationRequest,
    prompt: generated.prompt,
    promptChecks: {
      exactTargetIds: generated.generationRequest.targetVocabulary.every(
        (target, index) =>
          target.id === session.plan.items[index].vocabularyId,
      ),
      macronsDisplayed:
        generated.generationRequest.requirements.useMacronsForDisplay,
      validJsonRequired: generated.generationRequest.requirements.validJsonOnly,
      userDataExcluded: !JSON.stringify(generated.generationRequest).includes(
        'userId',
      ),
      forbidsCurriculumChanges:
        generated.prompt.includes('No devuelvas scores') &&
        generated.prompt.includes('No devuelvas scores'),
    },
    generationDidNotChangeProgress:
      JSON.stringify(progressBefore) ===
      JSON.stringify(progressAfterGeneration),
    simulatedAnswers: {
      correct: correctResult,
      incorrect: incorrectResult,
    },
  }
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(`Sesión adaptativa simulada: ${session.id}`)
  console.log(
    session.plan.items
      .map(
        (item) =>
          `${item.lemma}: ${item.sourceBucket}/${item.reason} (${item.priorityScore}) → ${item.selectedExerciseType}`,
      )
      .join('\n'),
  )
  console.log(`Informe: ${outputPath}`)
} finally {
  await sequelize.close()
}
