import { DataTypes } from 'sequelize'
import { sequelize } from '../database/sequelize.js'

export const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Estudiante local',
    },
  },
  {
    tableName: 'users',
  },
)
