const requiredCases = [
  { id: 'nominative', label: 'Nominativo' },
  { id: 'genitive', label: 'Genitivo' },
  { id: 'dative', label: 'Dativo' },
  { id: 'accusative', label: 'Acusativo' },
  { id: 'ablative', label: 'Ablativo' },
  { id: 'vocative', label: 'Vocativo' },
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

export function buildDeclensionPrompt(
  declension,
  { chapterFrom = 1, chapterTo = 35 } = {},
) {
  const responseShape = {
    declension: declension.id,
    word: 'nominativo singular, genitivo singular',
    meaning: 'traduccion breve al español',
    gender: 'masculino, femenino o neutro',
    table: requiredCases.map((item) => ({
      id: item.id,
      label: item.label,
      singular: 'forma latina',
      plural: 'forma latina',
    })),
    sentences: Array.from({ length: 10 }, (_, index) => ({
      text: `oracion latina ${index + 1} con un unico espacio ____`,
      hint: 'caso y numero pedidos',
      answer: 'forma exacta que completa el espacio',
      caseId: requiredCases[index % requiredCases.length].id,
      number: index < requiredCases.length ? 'singular' : 'plural',
    })),
  }

  return [
    'Quiero crear una practica de declinaciones para una app educativa de latin.',
    '',
    `Genera un sustantivo regular de la ${declension.label}.`,
    `Debe pertenecer inequívocamente a esa declinacion (${declension.description}).`,
    `No uses la palabra modelo "${declension.model}"; elige otra palabra apropiada para estudiantes.`,
    `El sustantivo y el vocabulario de las oraciones deben pertenecer o ser adecuados a Lingua Latina per se illustrata, capítulos ${chapterFrom} al ${chapterTo}.`,
    '',
    'Reglas para la tabla:',
    '- Incluye las 12 formas: los seis casos en singular y plural.',
    '- Usa este orden: nominativo, genitivo, dativo, acusativo, ablativo y vocativo.',
    '- Conserva exactamente los id de caso indicados en el formato.',
    '- Usa formas latinas correctas y coherentes con el genero del sustantivo.',
    '- Marca obligatoriamente todas las vocales largas con macron: ā, ē, ī, ō, ū, ȳ.',
    '- No reemplaces los macrones por tildes agudas en el JSON de respuesta.',
    '',
    'Reglas para las oraciones:',
    '- Genera exactamente 10 oraciones breves en latin.',
    '- Cada oracion debe contener exactamente un espacio escrito como ____.',
    '- El espacio se completa con una forma del mismo sustantivo generado.',
    '- Incluye variedad de casos y de numero.',
    '- hint debe indicar el caso y el numero necesarios.',
    '- answer debe contener solo la forma latina que completa el espacio.',
    '- caseId debe ser uno de los id de la tabla y number debe ser singular o plural.',
    `- Evita oraciones ambiguas y mantén el vocabulario dentro del alcance de los capítulos ${chapterFrom} al ${chapterTo}.`,
    '- Escribe tambien las vocales largas de las oraciones con macron.',
    '',
    'Devuelve solamente JSON valido, sin Markdown, explicaciones ni comentarios.',
    'Respeta exactamente esta estructura y reemplaza todos los textos de ejemplo:',
    JSON.stringify(responseShape, null, 2),
  ].join('\n')
}

export function readDeclensionExerciseFromPastedJson(text, expectedDeclensionId) {
  let parsed

  try {
    parsed = JSON.parse(getJsonText(text))
  } catch {
    throw new Error('El contenido pegado no es un JSON valido.')
  }

  const exercise = parsed.declensionExercise || parsed

  if (!exercise || typeof exercise !== 'object' || Array.isArray(exercise)) {
    throw new Error('El JSON debe contener un objeto de practica de declinacion.')
  }

  if (exercise.declension !== expectedDeclensionId) {
    throw new Error('La respuesta de la IA no corresponde a la declinacion seleccionada.')
  }

  const word = requireText(exercise.word, 'word')
  const meaning = requireText(exercise.meaning, 'meaning')
  const gender = requireText(exercise.gender, 'gender')

  if (!Array.isArray(exercise.table) || exercise.table.length !== requiredCases.length) {
    throw new Error('La tabla debe incluir exactamente los seis casos.')
  }

  const tableById = new Map(exercise.table.map((row) => [row?.id, row]))
  const table = requiredCases.map((requiredCase) => {
    const row = tableById.get(requiredCase.id)

    if (!row) {
      throw new Error(`Falta el caso ${requiredCase.label}.`)
    }

    return {
      ...requiredCase,
      singular: requireText(row.singular, `${requiredCase.id}.singular`),
      plural: requireText(row.plural, `${requiredCase.id}.plural`),
    }
  })

  if (!table.some((row) => hasMacron(row.singular) || hasMacron(row.plural))) {
    throw new Error('La tabla debe marcar las vocales largas con macrones.')
  }

  if (!Array.isArray(exercise.sentences) || exercise.sentences.length !== 10) {
    throw new Error('La practica debe incluir exactamente 10 oraciones.')
  }

  const sentences = exercise.sentences.map((sentence, index) => {
    const text = requireText(sentence?.text, `sentences[${index}].text`)
    const hint = requireText(sentence?.hint, `sentences[${index}].hint`)
    const answer = requireText(sentence?.answer, `sentences[${index}].answer`)
    const caseId = requireText(sentence?.caseId, `sentences[${index}].caseId`)
    const number = requireText(sentence?.number, `sentences[${index}].number`)

    if ((text.match(/____/g) || []).length !== 1) {
      throw new Error(`La oracion ${index + 1} debe contener un unico espacio ____.`)
    }

    const targetRow = table.find((row) => row.id === caseId)

    if (!targetRow || !['singular', 'plural'].includes(number)) {
      throw new Error(`La oracion ${index + 1} tiene un caso o numero invalido.`)
    }

    const canonicalAnswer = targetRow[number]

    if (normalizeLatin(answer) !== normalizeLatin(canonicalAnswer)) {
      throw new Error(`La respuesta de la oracion ${index + 1} no coincide con su caso.`)
    }

    return { text, hint, answer: canonicalAnswer, caseId, number }
  })

  return { word, meaning, gender, table, sentences }
}
