import { getVerbFamiliesForTense } from '../data/verbTenseOptions.js'

const requiredPersons = [
  { id: 'first', label: '1.ª persona' },
  { id: 'second', label: '2.ª persona' },
  { id: 'third', label: '3.ª persona' },
]

function getJsonText(text) {
  const trimmedText = text.trim()
  const fencedMatch = trimmedText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fencedMatch ? fencedMatch[1] : trimmedText
}

function requireText(value, fieldName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Falta el campo de texto "${fieldName}".`)
  }

  return value.trim()
}

function requireString(value, fieldName) {
  if (typeof value !== 'string') {
    throw new Error(`Falta el campo de texto "${fieldName}".`)
  }
  return value
}

function normalizeLatin(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
}

function hasMacron(value) {
  return /[āēīōūȳ]/i.test(value)
}

function getActivityData(session) {
  if (!session?.activityData) return null

  try {
    return typeof session.activityData === 'string'
      ? JSON.parse(session.activityData)
      : session.activityData
  } catch {
    return null
  }
}

export function getVerbLemma(principalParts) {
  return typeof principalParts === 'string' ? principalParts.split(',')[0].trim() : ''
}

export function normalizeVerbLemma(value) {
  return normalizeLatin(getVerbLemma(value) || value).replace(/[^a-z]/g, '')
}

export function getPracticedVerbLemmas(sessions) {
  const practicedVerbs = new Map()

  sessions.forEach((session) => {
    if (session.practiceKind !== 'verb_tense') return

    const activity = getActivityData(session)
    const verbs = activity?.exercise?.verbs

    if (!Array.isArray(verbs)) return

    verbs.forEach((verb) => {
      const lemma = getVerbLemma(verb?.principalParts)
      const normalizedLemma = normalizeVerbLemma(lemma)
      if (lemma && normalizedLemma && !practicedVerbs.has(normalizedLemma)) {
        practicedVerbs.set(normalizedLemma, lemma)
      }
    })
  })

  return [...practicedVerbs.values()]
}

export function buildVerbTensePrompt(
  tense,
  {
    includePassive = false,
    excludedVerbs = [],
    chapterFrom = 1,
    chapterTo = 35,
  } = {},
) {
  const families = getVerbFamiliesForTense(tense.id)
  const sentenceCount = 10
  const responseShape = {
    tense: tense.id,
    includePassive,
    verbs: families.map((family) => ({
      family: family.id,
      principalParts: 'partes principales del verbo con macrones',
      meaning: 'traducción breve al español',
      table: requiredPersons.map((person) => ({
        id: person.id,
        label: person.label,
        singular: 'forma activa latina',
        plural: 'forma activa latina',
        ...(includePassive
          ? {
              passiveSingular: 'forma pasiva latina',
              passivePlural: 'forma pasiva latina',
            }
          : {}),
      })),
    })),
    sentences: Array.from({ length: sentenceCount }, (_, index) => {
      const voice = includePassive && index % 3 === 0 ? 'passive' : 'active'

      return {
        spanishBefore: 'parte de la oración española anterior al verbo ',
        spanishVerb: 'verbo o perífrasis verbal en español',
        spanishAfter: ' parte posterior de la oración',
        hint: 'verbo, voz, persona y número pedidos',
        answer: 'solamente la forma verbal latina exacta',
        verbNumber: (index % families.length) + 1,
        personId: requiredPersons[index % requiredPersons.length].id,
        number: index % 2 === 0 ? 'singular' : 'plural',
        voice,
      }
    }),
  }

  const voiceRules = includePassive
    ? [
        'Voz y modo: voces activa y pasiva, modo indicativo.',
        '- Para cada persona incluye singular y plural activos en singular/plural, y pasivos en passiveSingular/passivePlural.',
        '- En el pretérito perfecto pasivo usa las formas perifrásticas completas en masculino; haz concordar el participio en singular o plural.',
        '- En las oraciones mezcla ambas voces e incluye al menos cuatro oraciones pasivas.',
        '- voice debe ser active o passive y debe coincidir con la forma de answer.',
      ]
    : [
        'Voz y modo: solo voz activa, modo indicativo.',
        '- No incluyas passiveSingular ni passivePlural.',
        '- Todas las oraciones deben usar voice "active".',
      ]

  return [
    'Quiero crear una práctica de conjugación para una app educativa de latín.',
    '',
    `Tiempo solicitado: ${tense.promptLabel}.`,
    voiceRules[0],
    `Alcance de vocabulario: Lingua Latina per se illustrata, capítulos ${chapterFrom} al ${chapterTo}.`,
    '',
    `Genera exactamente ${families.length} verbos distintos, uno para cada familia:`,
    ...families.map(
      (family) => `- ${family.label}; usa family "${family.id}": ${family.rule}.`,
    ),
    '- Usa verbos clásicos frecuentes y con un paradigma completo.',
    '- Evita verbos deponentes, defectivos e impersonales.',
    ...(includePassive
      ? ['- Elige únicamente verbos transitivos que admitan voz pasiva personal.']
      : []),
    '- Incluye las partes principales necesarias para reconocer el presente y el perfecto.',
    ...(excludedVerbs.length
      ? [
          `- No uses ninguno de estos verbos ya practicados: ${excludedVerbs.join(', ')}.`,
        ]
      : []),
    '- No repitas un mismo verbo dentro de esta práctica.',
    `- Tanto los verbos como el vocabulario de las oraciones deben pertenecer o ser adecuados a los capítulos ${chapterFrom} al ${chapterTo}.`,
    '',
    'Reglas para cada tabla:',
    `- Conjuga cada verbo solamente en ${tense.promptLabel}.`,
    '- Incluye las seis personas: 1.ª, 2.ª y 3.ª en singular y plural.',
    '- Conserva exactamente los id first, second y third.',
    ...voiceRules.slice(1, includePassive ? 3 : 2),
    '- Marca obligatoriamente todas las vocales largas con macrón: ā, ē, ī, ō, ū, ȳ.',
    '- No reemplaces los macrones por tildes agudas en el JSON de respuesta.',
    '',
    'Reglas para el repaso:',
    `- Genera exactamente ${sentenceCount} oraciones breves en español para traducir únicamente el verbo al latín.`,
    '- Usa todos los verbos y presenta cada uno en por lo menos dos oraciones.',
    '- Divide cada oración española en spanishBefore, spanishVerb y spanishAfter.',
    '- spanishVerb debe contener únicamente el verbo o la perífrasis verbal española que la interfaz mostrará destacada.',
    '- spanishBefore y spanishAfter contienen el resto de la oración y pueden ser cadenas vacías.',
    '- No uses Markdown, asteriscos, guiones bajos ni un espacio ____ para destacar el verbo.',
    '- La oración española completa debe corresponder inequívocamente con persona, número, tiempo y voz solicitados.',
    '- Usa distintas personas y números.',
    ...voiceRules.slice(includePassive ? 3 : 2),
    `- verbNumber debe estar entre 1 y ${families.length} y señalar el verbo usado.`,
    '- personId debe ser first, second o third; number debe ser singular o plural.',
    '- hint debe indicar el verbo, la voz, la persona y el número necesarios.',
    '- answer debe contener solamente la forma verbal latina exacta de su tabla, nunca la oración completa.',
    '- Escribe todas las vocales largas de answer con macrón.',
    '- Evita oraciones ambiguas.',
    '',
    'Devuelve solamente JSON válido, sin Markdown, explicaciones ni comentarios.',
    'Respeta exactamente esta estructura y reemplaza todos los textos de ejemplo:',
    JSON.stringify(responseShape, null, 2),
  ].join('\n')
}

export function readVerbTenseExerciseFromPastedJson(
  text,
  expectedTenseId,
  { includePassive = false, excludedVerbs = [] } = {},
) {
  let parsed

  try {
    parsed = JSON.parse(getJsonText(text))
  } catch {
    throw new Error('El contenido pegado no es un JSON válido.')
  }

  const exercise = parsed.verbTenseExercise || parsed
  const families = getVerbFamiliesForTense(expectedTenseId)

  if (!exercise || typeof exercise !== 'object' || Array.isArray(exercise)) {
    throw new Error('El JSON debe contener un objeto de práctica verbal.')
  }

  if (exercise.tense !== expectedTenseId) {
    throw new Error('La respuesta de la IA no corresponde al tiempo verbal seleccionado.')
  }

  if (Boolean(exercise.includePassive) !== includePassive) {
    throw new Error(
      includePassive
        ? 'La respuesta de la IA debe incluir las voces activa y pasiva.'
        : 'La respuesta de la IA debe incluir solamente la voz activa.',
    )
  }

  if (!Array.isArray(exercise.verbs) || exercise.verbs.length !== families.length) {
    throw new Error(`La práctica debe incluir exactamente ${families.length} verbos.`)
  }

  const excludedLemmaSet = new Set(excludedVerbs.map(normalizeVerbLemma).filter(Boolean))
  const importedLemmaSet = new Set()

  const verbs = families.map((family, familyIndex) => {
    const verb = exercise.verbs.find((item) => item?.family === family.id)

    if (!verb) {
      throw new Error(`Falta un verbo de la familia ${family.label}.`)
    }

    const principalParts = requireText(
      verb.principalParts,
      `verbs[${familyIndex}].principalParts`,
    )
    const lemma = getVerbLemma(principalParts)
    const normalizedLemma = normalizeVerbLemma(lemma)

    if (!normalizedLemma) {
      throw new Error(`No se pudo reconocer el verbo ${familyIndex + 1}.`)
    }

    if (excludedLemmaSet.has(normalizedLemma)) {
      throw new Error(`El verbo ${lemma} ya fue practicado. Pídele a la IA otro verbo.`)
    }

    if (importedLemmaSet.has(normalizedLemma)) {
      throw new Error(`El verbo ${lemma} está repetido dentro de la práctica.`)
    }
    importedLemmaSet.add(normalizedLemma)

    if (!Array.isArray(verb.table) || verb.table.length !== requiredPersons.length) {
      throw new Error(`La tabla del verbo ${familyIndex + 1} debe tener tres personas.`)
    }

    const tableById = new Map(verb.table.map((row) => [row?.id, row]))
    const table = requiredPersons.map((person) => {
      const row = tableById.get(person.id)

      if (!row) {
        throw new Error(`Falta ${person.label} en la tabla del verbo ${familyIndex + 1}.`)
      }

      const importedRow = {
        ...person,
        singular: requireText(row.singular, `verbs[${familyIndex}].${person.id}.singular`),
        plural: requireText(row.plural, `verbs[${familyIndex}].${person.id}.plural`),
      }

      if (includePassive) {
        importedRow.passiveSingular = requireText(
          row.passiveSingular,
          `verbs[${familyIndex}].${person.id}.passiveSingular`,
        )
        importedRow.passivePlural = requireText(
          row.passivePlural,
          `verbs[${familyIndex}].${person.id}.passivePlural`,
        )
      }

      return importedRow
    })

    const tableValues = table.flatMap((row) =>
      includePassive
        ? [row.singular, row.plural, row.passiveSingular, row.passivePlural]
        : [row.singular, row.plural],
    )

    if (!tableValues.some(hasMacron)) {
      throw new Error(`La tabla del verbo ${familyIndex + 1} debe incluir los macrones.`)
    }

    return {
      family: family.id,
      familyLabel: family.label,
      principalParts,
      meaning: requireText(verb.meaning, `verbs[${familyIndex}].meaning`),
      table,
    }
  })

  if (!Array.isArray(exercise.sentences) || exercise.sentences.length < 10) {
    throw new Error('La práctica debe incluir por lo menos 10 oraciones.')
  }

  let passiveSentenceCount = 0
  const sentences = exercise.sentences.map((sentence, index) => {
    const spanishBefore = requireString(
      sentence?.spanishBefore,
      `sentences[${index}].spanishBefore`,
    )
    const spanishVerb = requireText(
      sentence?.spanishVerb,
      `sentences[${index}].spanishVerb`,
    )
    const spanishAfter = requireString(
      sentence?.spanishAfter,
      `sentences[${index}].spanishAfter`,
    )
    const hint = requireText(sentence?.hint, `sentences[${index}].hint`)
    const answer = requireText(sentence?.answer, `sentences[${index}].answer`)
    const verbNumber = Number(sentence?.verbNumber)
    const personId = requireText(sentence?.personId, `sentences[${index}].personId`)
    const number = requireText(sentence?.number, `sentences[${index}].number`)
    const voice = sentence?.voice || 'active'

    if ([spanishBefore, spanishVerb, spanishAfter].some((value) => /\*\*|__|____/.test(value))) {
      throw new Error(`La oración ${index + 1} debe separar el verbo sin usar Markdown.`)
    }

    if (!Number.isInteger(verbNumber) || verbNumber < 1 || verbNumber > verbs.length) {
      throw new Error(
        `La oración ${index + 1} debe indicar un verbNumber entre 1 y ${verbs.length}.`,
      )
    }

    if (!['active', 'passive'].includes(voice) || (!includePassive && voice !== 'active')) {
      throw new Error(`La oración ${index + 1} tiene una voz inválida.`)
    }

    const targetRow = verbs[verbNumber - 1].table.find((row) => row.id === personId)

    if (!targetRow || !['singular', 'plural'].includes(number)) {
      throw new Error(`La oración ${index + 1} tiene una persona o número inválido.`)
    }

    const answerKey = voice === 'passive'
      ? number === 'singular'
        ? 'passiveSingular'
        : 'passivePlural'
      : number
    const canonicalAnswer = targetRow[answerKey]

    if (normalizeLatin(answer) !== normalizeLatin(canonicalAnswer)) {
      throw new Error(`La respuesta de la oración ${index + 1} no coincide con su persona y voz.`)
    }

    if (voice === 'passive') passiveSentenceCount += 1

    return {
      text: `${spanishBefore}${spanishVerb}${spanishAfter}`,
      spanishBefore,
      spanishVerb,
      spanishAfter,
      hint,
      answer: canonicalAnswer,
      verbNumber,
      personId,
      number,
      voice,
    }
  })

  if (includePassive && passiveSentenceCount < 4) {
    throw new Error('La práctica debe incluir por lo menos cuatro oraciones en voz pasiva.')
  }

  return { tense: expectedTenseId, includePassive, verbs, sentences }
}
