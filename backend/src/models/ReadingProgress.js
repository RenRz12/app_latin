import { DataTypes } from 'sequelize'
import { sequelize } from '../database/sequelize.js'

export const ReadingProgress = sequelize.define(
  'ReadingProgress',
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
    book: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Familia Romana',
    },
    currentChapter: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: { min: 1, max: 35 },
    },
    lastReadAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: 'reading_progress',
    indexes: [
      {
        unique: true,
        fields: ['userId', 'book'],
        name: 'reading_progress_unique_user_book',
      },
    ],
  },
)
