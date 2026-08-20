import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildVerbTensePrompt,
  readVerbTenseExerciseFromPastedJson,
} from '../../frontend/src/utils/verbTenseImport.js'
import {
  buildCombinedPracticePrompt,
  readCombinedPracticeFromPastedJson,
} from '../../frontend/src/utils/combinedPractice.js'
import { verbTenseOptions } from '../../frontend/src/data/verbTenseOptions.js'

const present = verbTenseOptions.find((tense) => tense.id === 'present')

function verb(family, principalParts, stem) {
  return {
    family,
    principalParts,
    meaning: `significado de ${stem}`,
    table: [
      { id: 'first', label: '1.ª persona', singular: `${stem}ō`, plural: `${stem}āmus` },
      { id: 'second', label: '2.ª persona', singular: `${stem}ās`, plural: `${stem}ātis` },
      { id: 'third', label: '3.ª persona', singular: `${stem}at`, plural: `${stem}ant` },
    ],
  }
}

test('el repaso verbal pide oraciones españolas con el verbo separado', () => {
  const prompt = buildVerbTensePrompt(present, { chapterFrom: 10, chapterTo: 15 })
  assert.match(prompt, /spanishBefore/)
  assert.match(prompt, /spanishVerb/)
  assert.match(prompt, /solamente la forma verbal latina/i)

  const verbs = [
    verb('present_first', 'amō, amāre, amāvī, amātum', 'am'),
    verb('present_second', 'moneō, monēre, monuī, monitum', 'mon'),
    verb('present_third', 'legō, legere, lēgī, lēctum', 'leg'),
    verb('present_fourth', 'audiō, audīre, audīvī, audītum', 'aud'),
  ]
  const sentences = Array.from({ length: 10 }, (_, index) => {
    const verbNumber = (index % verbs.length) + 1
    const personId = ['first', 'second', 'third'][index % 3]
    const number = index % 2 === 0 ? 'singular' : 'plural'
    const row = verbs[verbNumber - 1].table.find((item) => item.id === personId)
    return {
      spanishBefore: `Los estudiantes ${index + 1} `,
      spanishVerb: 'escuchan',
      spanishAfter: ' al maestro.',
      hint: `${personId}, ${number}, activa`,
      answer: row[number],
      verbNumber,
      personId,
      number,
      voice: 'active',
    }
  })
  const parsed = readVerbTenseExerciseFromPastedJson(
    JSON.stringify({ tense: 'present', includePassive: false, verbs, sentences }),
    'present',
  )
  assert.equal(parsed.sentences.length, 10)
  assert.equal(parsed.sentences[0].spanishVerb, 'escuchan')
  assert.equal(parsed.sentences[0].answer, verbs[0].table[0].singular)
})

test('la práctica combinada valida rango, objetivos y formas presentes', () => {
  const prompt = buildCombinedPracticePrompt(10, 15, 'mixed')
  assert.match(prompt, /capítulos 10 al 15/i)
  assert.match(prompt, /español a latín/i)
  assert.match(prompt, /al menos dos oraciones a cada uno/i)

  const sentenceMarkers = [
    'primero', 'segundo', 'tercero', 'cuarto', 'quinto',
    'sexto', 'séptimo', 'octavo', 'noveno', 'décimo',
  ]
  const combinedPractice = {
    direction: 'es_la',
    chapterFrom: 10,
    chapterTo: 15,
    verbTense: 'mixed',
    sentences: Array.from({ length: 10 }, (_, index) => ({
      verbTense: ['present', 'imperfect', 'perfect', 'future'][index % 4],
      spanish: `El ${sentenceMarkers[index]} soldado ve la ciudad.`,
      latin: `Mīles urbem videt.`,
      acceptableAnswers: [],
      targetVocabulary: [
        { lemma: 'urbs', meaning: 'ciudad', form: 'urbem' },
      ],
      explanation: 'Urbem es acusativo singular de urbs.',
    })),
  }
  const parsed = readCombinedPracticeFromPastedJson(
    JSON.stringify({ combinedPractice }),
    10,
    15,
    'mixed',
  )
  assert.equal(parsed.exercises.length, 10)
  assert.equal(parsed.exercises[0].correctAnswer.includes('urbem'), true)
  assert.deepEqual(
    new Set(parsed.exercises.map((exercise) => exercise.verbTense)),
    new Set(['present', 'imperfect', 'perfect', 'future']),
  )

  combinedPractice.sentences[0].targetVocabulary[0].form = 'quercū'
  assert.throws(
    () => readCombinedPracticeFromPastedJson(
      JSON.stringify({ combinedPractice }),
      10,
      15,
      'mixed',
    ),
    /no aparece en la respuesta latina/i,
  )
})

test('la práctica combinada permite concentrar las oraciones en futuro', () => {
  const prompt = buildCombinedPracticePrompt(10, 15, 'future')
  assert.match(prompt, /diez oraciones deben usar futuro/i)

  const sentenceMarkers = [
    'primero', 'segundo', 'tercero', 'cuarto', 'quinto',
    'sexto', 'séptimo', 'octavo', 'noveno', 'décimo',
  ]

  const combinedPractice = {
    direction: 'es_la',
    chapterFrom: 10,
    chapterTo: 15,
    verbTense: 'future',
    sentences: Array.from({ length: 10 }, (_, index) => ({
      verbTense: 'future',
      spanish: `Mañana el ${sentenceMarkers[index]} viajero verá la ciudad.`,
      latin: 'Cras viātor urbem vidēbit.',
      acceptableAnswers: [],
      targetVocabulary: [
        { lemma: 'urbs', meaning: 'ciudad', form: 'urbem' },
      ],
      explanation: 'Vidēbit está en futuro y urbem es acusativo singular.',
    })),
  }

  const parsed = readCombinedPracticeFromPastedJson(
    JSON.stringify({ combinedPractice }),
    10,
    15,
    'future',
  )
  assert.equal(parsed.combinedVerbTense, 'future')
  assert.equal(parsed.exercises.every((exercise) => exercise.verbTense === 'future'), true)

  combinedPractice.sentences[0].verbTense = 'present'
  assert.throws(
    () => readCombinedPracticeFromPastedJson(
      JSON.stringify({ combinedPractice }),
      10,
      15,
      'future',
    ),
    /no usa Futuro/i,
  )
})
