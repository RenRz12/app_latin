import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import {
  createSessionToken,
  passwordMatches,
  verifySessionToken,
} from '../src/services/authService.js'
import { originIsAllowed } from '../src/config/cors.js'
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

test('CORS permite el propio dominio publicado y rechaza otros orígenes', () => {
  const publishedOrigin = 'https://app-latin.onrender.com'

  assert.equal(originIsAllowed(publishedOrigin, publishedOrigin), true)
  assert.equal(originIsAllowed(`${publishedOrigin}/`, publishedOrigin), true)
  assert.equal(originIsAllowed('http://127.0.0.1:5173'), true)
  assert.equal(originIsAllowed('https://sitio-no-permitido.example', publishedOrigin), false)
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
  const correctedEntries = new Map(
    seed.entries
      .filter((entry) => entry.morphologyData?.catalogCorrection)
      .map((entry) => [entry.normalizedLemma, entry]),
  )
  assert.deepEqual(
    [...correctedEntries.keys()].sort(),
    ['anulus', 'consistere', 'hortus', 'lilium', 'nasus'],
  )
  assert.equal(
    seed.entries.some((entry) =>
      ['corisistere', 'honus', 'inulus', 'mium', 'nasusim'].includes(
        entry.normalizedLemma,
      ),
    ),
    false,
  )
  assert.equal(correctedEntries.get('anulus').lemma, 'ānulus')
  assert.equal(correctedEntries.get('lilium').meaningEs, 'lirio')
})

test('el Blueprint usa PostgreSQL externo y protege la aplicación', async () => {
  const blueprint = await readFile(new URL('../../render.yaml', import.meta.url), 'utf8')
  const rootPackage = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  )
  const frontendPackage = JSON.parse(
    await readFile(new URL('../../frontend/package.json', import.meta.url), 'utf8'),
  )
  const backendPackage = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  )
  assert.match(blueprint, /buildCommand: npm run render-build/)
  assert.match(blueprint, /startCommand: npm start/)
  assert.match(blueprint, /healthCheckPath: \/api\/health/)
  assert.match(blueprint, /plan: free/)
  assert.match(blueprint, /DATABASE_URL[\s\S]*sync: false/)
  assert.match(blueprint, /DATABASE_SSL[\s\S]*value: true/)
  assert.match(blueprint, /APP_PASSWORD[\s\S]*sync: false/)
  assert.doesNotMatch(blueprint, /DATABASE_STORAGE/)
  assert.doesNotMatch(blueprint, /mountPath:/)
  assert.match(rootPackage.scripts['render-build'], /backend install --omit=dev/)
  assert.equal(rootPackage.scripts.start, 'npm --prefix backend start')
  assert.ok(backendPackage.dependencies.pg)
  assert.ok(backendPackage.dependencies['pg-hstore'])
  assert.match(frontendPackage.scripts.build, /inlineBuildAssets\.mjs/)
})
