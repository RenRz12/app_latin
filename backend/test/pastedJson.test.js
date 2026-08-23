import assert from 'node:assert/strict'
import { test } from 'node:test'

import { readExercisesFromPastedJson } from '../../frontend/src/utils/exerciseImport.js'
import { parsePastedJson } from '../../frontend/src/utils/pastedJson.js'

test('acepta JSON copiado desde un teléfono con espacios y caracteres invisibles', () => {
  const pasted =
    '\uFEFF```json\u00A0\n{\u200B"exercises": [{"question": "nauta", "correctAnswer": "marinero"}]}\n```'

  const exercises = readExercisesFromPastedJson(pasted)

  assert.equal(exercises.length, 1)
  assert.equal(exercises[0].question, 'nauta')
})

test('acepta un bloque JSON aunque el portapapeles incluya texto de la IA', () => {
  const pasted = [
    'Aquí tienes la respuesta solicitada:',
    '```json',
    '{"exercises":[{"question":"avis","correctAnswer":"ave"}]}',
    '```',
    'Espero que te sirva.',
  ].join('\n')

  assert.equal(readExercisesFromPastedJson(pasted)[0].correctAnswer, 'ave')
})

test('recupera las comillas tipográficas introducidas por el teclado móvil', () => {
  const pasted = '{“exercises”:[{“question”:“arbor”,“correctAnswer”:“árbol”}]}'

  assert.equal(readExercisesFromPastedJson(pasted)[0].question, 'arbor')
})

test('sigue rechazando contenido que no contiene JSON', () => {
  assert.throws(() => parsePastedJson('esto no es JSON'), /no es un JSON válido/i)
})
