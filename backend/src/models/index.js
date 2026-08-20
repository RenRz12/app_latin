import { Exercise } from './Exercise.js'
import { PracticeSession } from './PracticeSession.js'
import { ProfileSettings } from './ProfileSettings.js'
import { ReadingProgress } from './ReadingProgress.js'
import { User } from './User.js'
import { UserVocabularyProgress } from './UserVocabularyProgress.js'
import { Vocabulary } from './Vocabulary.js'
import { VocabularyChapter } from './VocabularyChapter.js'
import { VocabularyReviewEvent } from './VocabularyReviewEvent.js'

User.hasMany(ReadingProgress, { foreignKey: 'userId', onDelete: 'CASCADE' })
ReadingProgress.belongsTo(User, { foreignKey: 'userId' })

Vocabulary.hasMany(VocabularyChapter, {
  as: 'chapters',
  foreignKey: 'vocabularyId',
  onDelete: 'CASCADE',
})
VocabularyChapter.belongsTo(Vocabulary, { foreignKey: 'vocabularyId' })

User.hasMany(UserVocabularyProgress, {
  foreignKey: 'userId',
  onDelete: 'CASCADE',
})
Vocabulary.hasMany(UserVocabularyProgress, {
  foreignKey: 'vocabularyId',
  onDelete: 'CASCADE',
})
UserVocabularyProgress.belongsTo(User, { foreignKey: 'userId' })
UserVocabularyProgress.belongsTo(Vocabulary, { foreignKey: 'vocabularyId' })

User.hasMany(VocabularyReviewEvent, {
  foreignKey: 'userId',
  onDelete: 'CASCADE',
})
Vocabulary.hasMany(VocabularyReviewEvent, {
  foreignKey: 'vocabularyId',
  onDelete: 'CASCADE',
})
VocabularyReviewEvent.belongsTo(User, { foreignKey: 'userId' })
VocabularyReviewEvent.belongsTo(Vocabulary, { foreignKey: 'vocabularyId' })

User.hasMany(PracticeSession, { foreignKey: 'userId', onDelete: 'SET NULL' })
PracticeSession.belongsTo(User, { foreignKey: 'userId' })
PracticeSession.hasMany(Exercise, {
  as: 'exercises',
  foreignKey: 'sessionId',
  onDelete: 'SET NULL',
})
Exercise.belongsTo(PracticeSession, { foreignKey: 'sessionId' })
Exercise.hasMany(VocabularyReviewEvent, {
  foreignKey: 'exerciseId',
  onDelete: 'SET NULL',
})
VocabularyReviewEvent.belongsTo(Exercise, { foreignKey: 'exerciseId' })

export const models = {
  Exercise,
  PracticeSession,
  ProfileSettings,
  ReadingProgress,
  User,
  UserVocabularyProgress,
  Vocabulary,
  VocabularyChapter,
  VocabularyReviewEvent,
}
