import { DataTypes } from 'sequelize'
import { sequelize } from '../database/sequelize.js'

export const PracticeSession = sequelize.define(
  'PracticeSession',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    practiceKind: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    practiceLabel: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    detailLabel: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'completed',
      validate: {
        isIn: [['in_progress', 'completed']],
      },
    },
    correctAnswers: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    totalAnswers: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    accuracy: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    activityData: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    sessionMode: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'LEGACY',
      validate: {
        isIn: [['LEGACY', 'NORMAL', 'BACKLOG_SCREENING']],
      },
    },
    currentBook: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    currentReadingChapter: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 1, max: 35 },
    },
    sessionSize: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 1, max: 50 },
    },
    planData: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'practice_sessions',
    timestamps: false,
  },
)
