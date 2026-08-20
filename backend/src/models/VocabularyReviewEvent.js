import { DataTypes } from 'sequelize'
import { sequelize } from '../database/sequelize.js'

export const REVIEW_TYPES = [
  'RECOGNITION',
  'CONTEXT',
  'GUIDED_RECALL',
  'PRODUCTION',
  'MORPHOLOGY',
]
export const REVIEW_RESULTS = ['CORRECT', 'PARTIAL', 'INCORRECT']

export const VocabularyReviewEvent = sequelize.define(
  'VocabularyReviewEvent',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    vocabularyId: { type: DataTypes.INTEGER, allowNull: false },
    reviewType: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isIn: [REVIEW_TYPES] },
    },
    result: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isIn: [REVIEW_RESULTS] },
    },
    previousStage: { type: DataTypes.STRING, allowNull: false },
    resultingStage: { type: DataTypes.STRING, allowNull: false },
    responseTimeMs: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 },
    },
    exerciseId: { type: DataTypes.INTEGER, allowNull: true },
    sourceKey: { type: DataTypes.STRING, allowNull: true },
    metadata: { type: DataTypes.JSON, allowNull: true },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'vocabulary_review_events',
    timestamps: false,
    indexes: [
      { fields: ['userId', 'reviewedAt'] },
      { fields: ['vocabularyId', 'reviewedAt'] },
    ],
  },
)
