import { DataTypes } from 'sequelize'
import { sequelize } from '../database/sequelize.js'

export const ProfileSettings = sequelize.define(
  'ProfileSettings',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      defaultValue: 1,
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
  },
  {
    tableName: 'profile_settings',
  },
)
