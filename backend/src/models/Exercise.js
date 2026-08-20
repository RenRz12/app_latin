import { DataTypes } from 'sequelize'
import { sequelize } from '../database/sequelize.js'

export const Exercise = sequelize.define(
  'Exercise',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    topic: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    vocabularyLevel: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    vocabularyChapterFrom: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    vocabularyChapterTo: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
    },
    exerciseType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    prompt: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    question: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    options: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    correctAnswer: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    explanation: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    source: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'mock',
    },
    sessionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    targetVocabularyIds: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    adaptiveExerciseType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    grammarTargets: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    usedVocabulary: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    generationMetadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: 'exercises',
  },
)
