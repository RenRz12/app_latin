import { DataTypes } from 'sequelize'
import { sequelize } from '../database/sequelize.js'

export const LEARNING_STAGES = [
  'NEW',
  'RECOGNITION',
  'CONTEXT_RECOGNITION',
  'GUIDED_RECALL',
  'PRODUCTION',
  'MASTERED',
]

export const UserVocabularyProgress = sequelize.define(
  'UserVocabularyProgress',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    vocabularyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    learningStage: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'NEW',
      validate: { isIn: [LEARNING_STAGES] },
    },
    recognitionScore: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0, max: 100 },
    },
    productionScore: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0, max: 100 },
    },
    morphologyScore: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0, max: 100 },
    },
    timesSeen: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    timesReviewed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    successfulRecognition: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    failedRecognition: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    successfulRecall: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    failedRecall: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    correctProduction: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    failedProduction: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    correctMorphology: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    failedMorphology: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    currentStreak: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    longestStreak: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lapseCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    consecutiveIncorrect: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    reviewIntervalDays: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 1,
    },
    easeFactor: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 2.3 },
    firstSeenAt: { type: DataTypes.DATE, allowNull: true },
    lastSeenAt: { type: DataTypes.DATE, allowNull: true },
    lastReviewedAt: { type: DataTypes.DATE, allowNull: true },
    lastSuccessfulRecallAt: { type: DataTypes.DATE, allowNull: true },
    lastCorrectAt: { type: DataTypes.DATE, allowNull: true },
    lastIncorrectAt: { type: DataTypes.DATE, allowNull: true },
    nextReviewAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: 'user_vocabulary_progress',
    indexes: [
      {
        unique: true,
        fields: ['userId', 'vocabularyId'],
        name: 'user_vocabulary_progress_unique_user_word',
      },
      { fields: ['userId', 'nextReviewAt'] },
      { fields: ['userId', 'learningStage'] },
    ],
  },
)
