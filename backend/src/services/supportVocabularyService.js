import { Op } from 'sequelize'
import { ADAPTIVE_REVIEW_CONFIG } from '../config/adaptiveReviewConfig.js'
import { UserVocabularyProgress } from '../models/UserVocabularyProgress.js'
import { Vocabulary } from '../models/Vocabulary.js'
import { VocabularyChapter } from '../models/VocabularyChapter.js'

export async function selectSupportVocabulary({
  userId,
  readingChapter,
  targetVocabularyIds,
  limit = ADAPTIVE_REVIEW_CONFIG.maximumSupportVocabulary,
}) {
  const targetIds = new Set(targetVocabularyIds)
  const [vocabulary, progressRows] = await Promise.all([
    Vocabulary.findAll({
      include: [
        {
          model: VocabularyChapter,
          as: 'chapters',
          where: { chapter: { [Op.lte]: readingChapter } },
          required: true,
        },
      ],
    }),
    UserVocabularyProgress.findAll({ where: { userId } }),
  ])
  const progressById = new Map(
    progressRows.map((progress) => [progress.vocabularyId, progress]),
  )

  return vocabulary
    .filter((word) => !targetIds.has(word.id))
    .map((word) => {
      const progress = progressById.get(word.id)
      const known =
        progress &&
        (progress.recognitionScore >= 60 ||
          ['GUIDED_RECALL', 'PRODUCTION', 'MASTERED'].includes(
            progress.learningStage,
          ))
      const safeFallback =
        !progress &&
        word.importStatus === 'VERIFIED' &&
        word.firstAppearanceChapter <= Math.max(1, readingChapter - 2)
      return { word, progress, known, safeFallback }
    })
    .filter((candidate) => candidate.known || candidate.safeFallback)
    .sort((left, right) => {
      if (left.known !== right.known) return left.known ? -1 : 1
      const recognitionDifference =
        Number(right.progress?.recognitionScore || 0) -
        Number(left.progress?.recognitionScore || 0)
      return (
        recognitionDifference ||
        left.word.firstAppearanceChapter - right.word.firstAppearanceChapter ||
        left.word.id - right.word.id
      )
    })
    .slice(0, limit)
    .map(({ word }) => ({
      vocabularyId: word.id,
      lemma: word.lemma,
      meaning: word.meaningEs,
      partOfSpeech: word.partOfSpeech,
      firstAppearanceChapter: word.firstAppearanceChapter,
    }))
}
