import { Op } from "sequelize";
import { ReadingProgress } from "../models/ReadingProgress.js";
import { UserVocabularyProgress } from "../models/UserVocabularyProgress.js";
import { Vocabulary } from "../models/Vocabulary.js";
import { VocabularyChapter } from "../models/VocabularyChapter.js";
import { DEFAULT_LOCAL_USER_ID } from "./localUserService.js";

function parseChapter(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 35
    ? parsed
    : fallback;
}

export async function listVocabulary({ chapterFrom = 1, chapterTo = 35 } = {}) {
  const from = parseChapter(chapterFrom, 1);
  const to = parseChapter(chapterTo, 35);
  if (from > to) {
    throw Object.assign(
      new Error("El capítulo inicial no puede superar al final."),
      {
        statusCode: 400,
      },
    );
  }

  return Vocabulary.findAll({
    include: [
      {
        model: VocabularyChapter,
        as: "chapters",
        where: { chapter: { [Op.between]: [from, to] } },
        required: true,
      },
    ],
    order: [
      ["firstAppearanceChapter", "ASC"],
      ["normalizedLemma", "ASC"],
    ],
  });
}

export async function listVocabularyProgress(
  userId = DEFAULT_LOCAL_USER_ID,
  dueOnly = false,
) {
  const where = { userId };
  if (dueOnly) where.nextReviewAt = { [Op.lte]: new Date() };

  return UserVocabularyProgress.findAll({
    where,
    include: [{ model: Vocabulary }],
    order: [
      ["nextReviewAt", "ASC"],
      ["updatedAt", "ASC"],
    ],
  });
}

export async function getReadingProgress(userId = DEFAULT_LOCAL_USER_ID) {
  const [progress] = await ReadingProgress.findOrCreate({
    where: { userId, book: "Familia Romana" },
    defaults: { userId, book: "Familia Romana", currentChapter: 1 },
  });
  return progress;
}

export async function updateReadingProgress(
  currentChapter,
  userId = DEFAULT_LOCAL_USER_ID,
) {
  const chapter = parseChapter(currentChapter, null);
  if (!chapter) {
    throw Object.assign(new Error("El capítulo debe estar entre 1 y 35."), {
      statusCode: 400,
    });
  }

  const progress = await getReadingProgress(userId);
  return progress.update({ currentChapter: chapter, lastReadAt: new Date() });
}

function average(values) {
  if (!values.length) return 0;
  return (
    Math.round(
      (values.reduce((sum, value) => sum + value, 0) / values.length) * 100,
    ) / 100
  );
}

function percentage(value, total) {
  return total ? Math.round((value / total) * 10000) / 100 : 0;
}

function calculateMasteryScore(progress) {
  return (
    Math.round(
      (Number(progress.recognitionScore || 0) * 0.3 +
        Number(progress.productionScore || 0) * 0.45 +
        Number(progress.morphologyScore || 0) * 0.25) *
        100,
    ) / 100
  );
}

function summarizeChapterBands(chapters) {
  const groups = [];
  for (const chapter of chapters) {
    const label =
      chapter.coverage >= 70
        ? "MOSTLY_CONSOLIDATED"
        : chapter.coverage >= 30
          ? "PARTIAL"
          : "NEW";
    const previous = groups.at(-1);
    if (
      previous?.status === label &&
      previous.toChapter === chapter.chapter - 1
    ) {
      previous.toChapter = chapter.chapter;
    } else {
      groups.push({
        fromChapter: chapter.chapter,
        toChapter: chapter.chapter,
        status: label,
      });
    }
  }
  return groups;
}

export async function getVocabularyMetrics(
  userId = DEFAULT_LOCAL_USER_ID,
  now = new Date(),
  range = {},
) {
  const readingProgress = await getReadingProgress(userId);
  const chapterFrom = parseChapter(range.chapterFrom, 1);
  const chapterTo = parseChapter(
    range.chapterTo,
    readingProgress.currentChapter,
  );
  if (chapterFrom > chapterTo) {
    throw Object.assign(
      new Error("El capítulo inicial no puede superar al final."),
      { statusCode: 400 },
    );
  }
  const [vocabulary, progressRows] = await Promise.all([
    Vocabulary.findAll({
      where: {
        firstAppearanceChapter: { [Op.between]: [chapterFrom, chapterTo] },
      },
      attributes: [
        "id",
        "lemma",
        "meaningEs",
        "partOfSpeech",
        "firstAppearanceChapter",
      ],
      raw: true,
    }),
    UserVocabularyProgress.findAll({ where: { userId }, raw: true }),
  ]);
  const progressById = new Map(
    progressRows.map((progress) => [progress.vocabularyId, progress]),
  );
  const counts = { NEW: 0, LEARNING: 0, PRODUCTION: 0, MASTERED: 0, DUE: 0 };
  let consolidatedCount = 0;
  const scores = { recognition: [], production: [], morphology: [] };
  const chapters = Array.from(
    { length: chapterTo - chapterFrom + 1 },
    (_value, index) => ({
      chapter: chapterFrom + index,
      total: 0,
      consolidated: 0,
      backlog: 0,
    }),
  );
  const chaptersByNumber = new Map(
    chapters.map((chapter) => [chapter.chapter, chapter]),
  );

  for (const word of vocabulary) {
    const progress = progressById.get(word.id);
    const stage = progress?.learningStage || "NEW";
    if (stage === "NEW") counts.NEW += 1;
    else if (
      ["RECOGNITION", "CONTEXT_RECOGNITION", "GUIDED_RECALL"].includes(stage)
    ) {
      counts.LEARNING += 1;
    } else if (stage === "PRODUCTION") counts.PRODUCTION += 1;
    else if (stage === "MASTERED") counts.MASTERED += 1;
    if (progress?.nextReviewAt && new Date(progress.nextReviewAt) <= now)
      counts.DUE += 1;

    scores.recognition.push(Number(progress?.recognitionScore || 0));
    scores.production.push(Number(progress?.productionScore || 0));
    scores.morphology.push(Number(progress?.morphologyScore || 0));

    const chapter = chaptersByNumber.get(word.firstAppearanceChapter);
    chapter.total += 1;
    const consolidated =
      ["PRODUCTION", "MASTERED"].includes(stage) &&
      Number(progress?.productionScore || 0) >= 65;
    if (consolidated) {
      chapter.consolidated += 1;
      consolidatedCount += 1;
    } else chapter.backlog += 1;
  }

  const chapterCoverage = chapters.map((chapter) => ({
    ...chapter,
    coverage: chapter.total
      ? Math.round((chapter.consolidated / chapter.total) * 10000) / 100
      : 0,
  }));
  const eligibleVocabulary = vocabulary.length;
  const learnedCount = eligibleVocabulary - counts.NEW;
  const practicedVocabulary = vocabulary
    .map((word) => {
      const progress = progressById.get(word.id);
      if (!progress || Number(progress.timesReviewed || 0) === 0) return null;

      return {
        vocabularyId: word.id,
        lemma: word.lemma,
        meaning: word.meaningEs,
        partOfSpeech: word.partOfSpeech,
        chapterOrigin: word.firstAppearanceChapter,
        learningStage: progress.learningStage,
        masteryPercentage: calculateMasteryScore(progress),
        recognitionScore: Number(progress.recognitionScore || 0),
        productionScore: Number(progress.productionScore || 0),
        morphologyScore: Number(progress.morphologyScore || 0),
        timesReviewed: Number(progress.timesReviewed || 0),
        currentStreak: Number(progress.currentStreak || 0),
        lastReviewedAt: progress.lastReviewedAt,
      };
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        right.masteryPercentage - left.masteryPercentage ||
        right.productionScore - left.productionScore ||
        right.recognitionScore - left.recognitionScore ||
        left.lemma.localeCompare(right.lemma, "la"),
    );

  return {
    readingProgress: {
      book: readingProgress.book,
      currentChapter: readingProgress.currentChapter,
    },
    vocabularyCoverage: {
      chapterFrom,
      chapterTo,
      eligibleVocabulary,
      counts,
      status: {
        learned: {
          count: learnedCount,
          percentage: percentage(learnedCount, eligibleVocabulary),
        },
        consolidated: {
          count: consolidatedCount,
          percentage: percentage(consolidatedCount, eligibleVocabulary),
        },
        mastered: {
          count: counts.MASTERED,
          percentage: percentage(counts.MASTERED, eligibleVocabulary),
        },
        notStarted: {
          count: counts.NEW,
          percentage: percentage(counts.NEW, eligibleVocabulary),
        },
      },
      averageScores: {
        recognition: average(scores.recognition),
        production: average(scores.production),
        morphology: average(scores.morphology),
      },
      backlogByChapter: chapterCoverage.map(({ chapter, backlog }) => ({
        chapter,
        backlog,
      })),
      chapterCoverage,
      consolidationBands: summarizeChapterBands(chapterCoverage),
      strongestVocabulary: practicedVocabulary.slice(0, 10),
    },
  };
}
