import { sequelize } from './sequelize.js'
import '../models/index.js'

try {
  await sequelize.sync({ alter: true })
  console.log('Base de datos sincronizada correctamente.')
  await sequelize.close()
} catch (error) {
  console.error('No se pudo sincronizar la base de datos.', error)
  process.exit(1)
}
