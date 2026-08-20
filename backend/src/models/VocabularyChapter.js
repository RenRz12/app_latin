import { DataTypes } from 'sequelize'
import { sequelize } from '../database/sequelize.js'

export const VocabularyChapter = sequelize.define(
  'VocabularyChapter',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    vocabularyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    chapter: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 35 },
    },
    firstOccurrenceLine: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 1 },
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'vocabulary_chapters',
    timestamps: false,
    indexes: [
      {
        unique: true,
        fields: ['vocabularyId', 'chapter'],
        name: 'vocabulary_chapters_unique_word_chapter',
      },
      { fields: ['chapter'] },
    ],
  },
)
