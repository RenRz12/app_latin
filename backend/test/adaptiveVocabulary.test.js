import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";

process.env.DATABASE_STORAGE = ":memory:";

const { sequelize } = await import("../src/database/sequelize.js");
const { models } = await import("../src/models/index.js");
const {
  importVocabularyEntries,
  validateImportedVocabulary,
  validateVocabularyPayload,
} = await import("../src/services/vocabularyImportService.js");
const { calculateVocabularyProgressUpdate, recordVocabularyReview } =
  await import("../src/services/vocabularyProgressService.js");
const { getVocabularyMetrics } =
  await import("../src/services/adaptiveVocabularyService.js");

function vocabularyEntry(overrides = {}) {
  return {
    lemma: "puella",
    normalizedLemma: "puella",
    meaningEs: null,
    partOfSpeech: "NOUN",
    homographKey: "",
    firstAppearanceChapter: 1,
    nominative: "puella",
    genitive: "-ae",
    gender: "f",
    declension: null,
    principalParts: null,
    conjugation: null,
    adjectiveForms: null,
    morphologyData: { indexEntry: "puella -ae f" },
    importStatus: "VERIFIED",
    sourceReference: "Familia Romana — Index Vocabulorum",
    chapters: [{ chapter: 1, firstOccurrenceLine: 3 }],
    ...overrides,
  };
}

before(async () => {
  await sequelize.sync({ force: true });
});

beforeEach(async () => {
  await sequelize.truncate({ cascade: true, restartIdentity: true });
});

after(async () => {
  await sequelize.close();
});

test("importa lemas únicos con una relación M:N entre vocabulario y capítulos", async () => {
  const entries = [
    vocabularyEntry({
      chapters: [
        { chapter: 1, firstOccurrenceLine: 3 },
        { chapter: 2, firstOccurrenceLine: 18 },
      ],
    }),
    vocabularyEntry({
      lemma: "puellaris",
      normalizedLemma: "puellaris",
      firstAppearanceChapter: 2,
      chapters: [{ chapter: 2, firstOccurrenceLine: 44 }],
    }),
  ];

  const imported = await importVocabularyEntries(entries);
  assert.equal(imported.wordsCreated, 2);
  assert.equal(imported.chapterLinksCreated, 3);
  assert.equal(await models.Vocabulary.count(), 2);
  assert.equal(await models.VocabularyChapter.count(), 3);

  const validation = await validateImportedVocabulary();
  assert.equal(validation.valid, true);
});

test("mīles, mīlitem y mīlitibus se conservan como un solo lema", async () => {
  const entry = vocabularyEntry({
    lemma: "mīles",
    normalizedLemma: "miles",
    nominative: "mīles",
    genitive: "mīlitis",
    firstAppearanceChapter: 12,
    morphologyData: {
      indexEntry: "mīles -itis m",
      sourceForms: ["mīles", "mīlitem", "mīlitibus"],
    },
    chapters: [{ chapter: 12, firstOccurrenceLine: 4 }],
  });

  await importVocabularyEntries([entry]);
  assert.equal(await models.Vocabulary.count(), 1);
  assert.equal((await models.Vocabulary.findOne()).normalizedLemma, "miles");
});

test("una palabra de los capítulos X, XI y XIV conserva tres relaciones y primer capítulo X", async () => {
  const entry = vocabularyEntry({
    firstAppearanceChapter: 10,
    chapters: [
      { chapter: 10, firstOccurrenceLine: 7 },
      { chapter: 11, firstOccurrenceLine: 20 },
      { chapter: 14, firstOccurrenceLine: 3 },
    ],
  });

  await importVocabularyEntries([entry]);
  const word = await models.Vocabulary.findOne();
  assert.equal(word.firstAppearanceChapter, 10);
  assert.equal(await models.VocabularyChapter.count(), 3);
});

test("rechaza claves canónicas repetidas dentro de una misma extracción", () => {
  const errors = validateVocabularyPayload([
    vocabularyEntry(),
    vocabularyEntry(),
  ]);
  assert.equal(
    errors.some((error) => error.includes("clave canónica duplicada")),
    true,
  );
});

test("la reimportación es idempotente", async () => {
  const entries = [vocabularyEntry()];
  await importVocabularyEntries(entries);
  const secondImport = await importVocabularyEntries(entries);

  assert.equal(secondImport.wordsCreated, 0);
  assert.equal(secondImport.wordsUpdated, 0);
  assert.equal(secondImport.wordsUnchanged, 1);
  assert.equal(secondImport.chapterLinksCreated, 0);
  assert.equal(await models.Vocabulary.count(), 1);
  assert.equal(await models.VocabularyChapter.count(), 1);
});

test("la reimportación no borra una traducción añadida manualmente", async () => {
  const entries = [vocabularyEntry()];
  await importVocabularyEntries(entries);
  const word = await models.Vocabulary.findOne();
  await word.update({ meaningEs: "muchacha" });

  await importVocabularyEntries(entries);
  assert.equal((await word.reload()).meaningEs, "muchacha");
});

test("mantiene independiente el progreso de cada usuario", async () => {
  const [firstUser, secondUser] = await Promise.all([
    models.User.create({ displayName: "Primera persona" }),
    models.User.create({ displayName: "Segunda persona" }),
  ]);
  await importVocabularyEntries([vocabularyEntry()]);
  const word = await models.Vocabulary.findOne();

  await recordVocabularyReview({
    userId: firstUser.id,
    vocabularyId: word.id,
    reviewType: "RECOGNITION",
    result: "CORRECT",
  });

  assert.equal(
    await models.UserVocabularyProgress.count({
      where: { userId: firstUser.id },
    }),
    1,
  );
  assert.equal(
    await models.UserVocabularyProgress.count({
      where: { userId: secondUser.id },
    }),
    0,
  );
});

test("puntúa reconocimiento, producción y morfología por separado", async () => {
  const user = await models.User.create({ displayName: "Estudiante" });
  await importVocabularyEntries([vocabularyEntry()]);
  const word = await models.Vocabulary.findOne();

  await recordVocabularyReview({
    userId: user.id,
    vocabularyId: word.id,
    reviewType: "RECOGNITION",
    result: "CORRECT",
  });
  const { progress } = await recordVocabularyReview({
    userId: user.id,
    vocabularyId: word.id,
    reviewType: "PRODUCTION",
    result: "PARTIAL",
  });

  assert.equal(progress.recognitionScore, 12);
  assert.equal(progress.productionScore, 4);
  assert.equal(progress.morphologyScore, 0);
  assert.equal(await models.VocabularyReviewEvent.count(), 2);
});

test("un recuerdo correcto guarda la fecha de recuperación exitosa", async () => {
  const user = await models.User.create({ displayName: "Estudiante" });
  await importVocabularyEntries([vocabularyEntry()]);
  const word = await models.Vocabulary.findOne();
  const reviewedAt = new Date("2026-08-14T12:00:00.000Z");

  const { progress } = await recordVocabularyReview({
    userId: user.id,
    vocabularyId: word.id,
    reviewType: "GUIDED_RECALL",
    result: "CORRECT",
    reviewedAt,
  });

  assert.equal(progress.successfulRecall, 1);
  assert.equal(
    progress.lastSuccessfulRecallAt.toISOString(),
    reviewedAt.toISOString(),
  );
  assert.equal(progress.lastReviewedAt.toISOString(), reviewedAt.toISOString());
  assert.ok(progress.nextReviewAt > reviewedAt);
});

test("un error de recuperación registra el evento y el lapso sin borrar el historial", async () => {
  const user = await models.User.create({ displayName: "Estudiante" });
  await importVocabularyEntries([vocabularyEntry()]);
  const word = await models.Vocabulary.findOne();
  const first = await recordVocabularyReview({
    userId: user.id,
    vocabularyId: word.id,
    reviewType: "GUIDED_RECALL",
    result: "CORRECT",
  });
  const second = await recordVocabularyReview({
    userId: user.id,
    vocabularyId: word.id,
    reviewType: "GUIDED_RECALL",
    result: "INCORRECT",
  });

  assert.equal(second.progress.failedRecall, 1);
  assert.equal(second.progress.lapseCount, 1);
  assert.ok(
    second.progress.reviewIntervalDays <= first.progress.reviewIntervalDays,
  );
  assert.equal(await models.VocabularyReviewEvent.count(), 2);
});

test("un acierto amplía el intervalo y un error lo reduce sin borrar el progreso", () => {
  const now = new Date("2026-08-14T12:00:00.000Z");
  const current = {
    learningStage: "GUIDED_RECALL",
    recognitionScore: 70,
    productionScore: 45,
    morphologyScore: 30,
    timesSeen: 8,
    timesReviewed: 8,
    successfulRecognition: 4,
    failedRecognition: 1,
    successfulRecall: 3,
    failedRecall: 1,
    correctProduction: 1,
    failedProduction: 0,
    correctMorphology: 1,
    failedMorphology: 0,
    currentStreak: 2,
    longestStreak: 3,
    lapseCount: 1,
    reviewIntervalDays: 6,
    easeFactor: 2.3,
  };
  const correct = calculateVocabularyProgressUpdate(
    current,
    { reviewType: "GUIDED_RECALL", result: "CORRECT" },
    now,
  );
  const incorrect = calculateVocabularyProgressUpdate(
    { ...current, reviewIntervalDays: correct.reviewIntervalDays },
    { reviewType: "GUIDED_RECALL", result: "INCORRECT" },
    now,
  );

  assert.ok(correct.reviewIntervalDays > current.reviewIntervalDays);
  assert.ok(incorrect.reviewIntervalDays < correct.reviewIntervalDays);
  assert.ok(incorrect.productionScore > 0);
  assert.equal(incorrect.learningStage, "GUIDED_RECALL");
  assert.ok(correct.nextReviewAt > now);
});

test("calcula porcentajes de dominio y ordena el vocabulario más sólido", async () => {
  const user = await models.User.create({ displayName: "Estudiante" });
  await models.ReadingProgress.create({
    userId: user.id,
    book: "Familia Romana",
    currentChapter: 4,
  });
  await importVocabularyEntries([
    vocabularyEntry({ lemma: "puella", normalizedLemma: "puella" }),
    vocabularyEntry({ lemma: "servus", normalizedLemma: "servus" }),
    vocabularyEntry({ lemma: "via", normalizedLemma: "via" }),
    vocabularyEntry({ lemma: "hortus", normalizedLemma: "hortus" }),
  ]);
  const words = await models.Vocabulary.findAll({ order: [["id", "ASC"]] });

  await models.UserVocabularyProgress.bulkCreate([
    {
      userId: user.id,
      vocabularyId: words[0].id,
      learningStage: "MASTERED",
      recognitionScore: 96,
      productionScore: 92,
      morphologyScore: 84,
      timesReviewed: 12,
    },
    {
      userId: user.id,
      vocabularyId: words[1].id,
      learningStage: "PRODUCTION",
      recognitionScore: 82,
      productionScore: 70,
      morphologyScore: 62,
      timesReviewed: 8,
    },
    {
      userId: user.id,
      vocabularyId: words[2].id,
      learningStage: "RECOGNITION",
      recognitionScore: 45,
      productionScore: 8,
      morphologyScore: 0,
      timesReviewed: 2,
    },
  ]);

  const metrics = await getVocabularyMetrics(user.id);
  const coverage = metrics.vocabularyCoverage;

  assert.equal(coverage.eligibleVocabulary, 4);
  assert.deepEqual(coverage.status.learned, { count: 3, percentage: 75 });
  assert.deepEqual(coverage.status.consolidated, { count: 2, percentage: 50 });
  assert.deepEqual(coverage.status.mastered, { count: 1, percentage: 25 });
  assert.equal(coverage.strongestVocabulary.length, 3);
  assert.equal(coverage.strongestVocabulary[0].lemma, "puella");
  assert.ok(
    coverage.strongestVocabulary[0].masteryPercentage >
      coverage.strongestVocabulary[1].masteryPercentage,
  );
});
