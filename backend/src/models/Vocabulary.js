import { DataTypes } from 'sequelize'
import { sequelize } from '../database/sequelize.js'

export const VOCABULARY_IMPORT_STATUSES = ['VERIFIED', 'NEEDS_REVIEW']

export const Vocabulary = sequelize.define(
  'Vocabulary',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    lemma: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    normalizedLemma: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    meaningEs: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    partOfSpeech: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'UNKNOWN',
    },
    homographKey: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '',
    },
    firstAppearanceChapter: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 35 },
    },
    nominative: DataTypes.STRING,
    genitive: DataTypes.STRING,
    gender: DataTypes.STRING,
    declension: DataTypes.STRING,
    principalParts: DataTypes.JSON,
    conjugation: DataTypes.STRING,
    adjectiveForms: DataTypes.JSON,
    morphologyData: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    importStatus: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'NEEDS_REVIEW',
      validate: { isIn: [VOCABULARY_IMPORT_STATUSES] },
    },
    sourceReference: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Familia Romana — Index Vocabulorum',
    },
  },
  {
    tableName: 'vocabulary',
    indexes: [
      {
        unique: true,
        fields: ['normalizedLemma', 'partOfSpeech', 'homographKey'],
        name: 'vocabulary_unique_lemma_pos_homograph',
      },
      { fields: ['firstAppearanceChapter'] },
    ],
  },
)
