import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import {
  createSessionToken,
  passwordMatches,
  verifySessionToken,
} from '../src/services/authService.js'
import { validateVocabularyPayload } from '../src/services/vocabularyImportService.js'

test('la sesión privada detecta alteraciones y vencimiento', () => {
  const secret = 'un-secreto-de-prueba-suficientemente-largo'
  const now = Date.UTC(2026, 7, 20, 12)
  const token = createSessionToken({ now, secret, durationDays: 30 })

  assert.equal(verifySessionToken(token, { now, secret }), true)
  assert.equal(
    verifySessionToken(`${token.slice(0, -1)}x`, { now, secret }),
    false,
  )
  assert.equal(
    verifySessionToken(token, { now: now + 31 * 86400000, secret }),
    false,
  )
  assert.equal(passwordMatches('contraseña segura', 'contraseña segura'), true)
  assert.equal(passwordMatches('incorrecta', 'contraseña segura'), false)
})

test('el despliegue incluye una semilla completa de Familia Romana', async () => {
  const seed = JSON.parse(
    await readFile(
      new URL('../seed/familia-romana-vocabulary.json', import.meta.url),
      'utf8',
    ),
  )
  assert.equal(seed.entries.length, 1729)
  assert.deepEqual(validateVocabularyPayload(seed.entries), [])
  assert.deepEqual(
    new Set(seed.entries.flatMap((entry) => entry.chapters.map((item) => item.chapter))),
    new Set(Array.from({ length: 35 }, (_value, index) => index + 1)),
  )
})

test('el Blueprint conserva SQLite en el disco y protege la aplicación', async () => {
  const blueprint = await readFile(new URL('../../render.yaml', import.meta.url), 'utf8')
  const rootPackage = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  )
  assert.match(blueprint, /buildCommand: npm run render-build/)
  assert.match(blueprint, /startCommand: npm start/)
  assert.match(blueprint, /healthCheckPath: \/api\/health/)
  assert.match(blueprint, /DATABASE_STORAGE[\s\S]*\/var\/data\/app-latin\.sqlite/)
  assert.match(blueprint, /APP_PASSWORD[\s\S]*sync: false/)
  assert.match(blueprint, /mountPath: \/var\/data/)
  assert.match(rootPackage.scripts['render-build'], /backend install/)
  assert.equal(rootPackage.scripts.start, 'npm --prefix backend start')
})
