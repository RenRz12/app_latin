const sentenceCount = 10

export const combinedVerbTenseOptions = [
  {
    id: 'mixed',
    label: 'Mixta',
    description: 'Incluye presente, pretérito imperfecto, pretérito perfecto y futuro.',
  },
  { id: 'present', label: 'Presente', description: 'Las diez oraciones usan presente.' },
  {
    id: 'imperfect',
    label: 'Pretérito imperfecto',
    description: 'Las diez oraciones usan pretérito imperfecto.',
  },
  {
    id: 'perfect',
    label: 'Pretérito perfecto',
    description: 'Las diez oraciones usan pretérito perfecto.',
  },
  { id: 'future', label: 'Futuro', description: 'Las diez oraciones usan futuro.' },
]

const individualVerbTenses = combinedVerbTenseOptions
  .filter((option) => option.id !== 'mixed')
  .map((option) => option.id)

function requireVerbTense(value, field, allowMixed = false) {
  const allowed = allowMixed
    ? combinedVerbTenseOptions.map((option) => option.id)
    : individualVerbTenses
  if (!allowed.includes(value)) {
    throw new Error(`El campo "${field}" contiene un tiempo verbal no válido.`)
  }
  return value
}

export function getCombinedVerbTenseLabel(tenseId) {
  return combinedVerbTenseOptions.find((option) => option.id === tenseId)?.label || 'Mixta'
}

function getJsonText(text) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1] : trimmed
}

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Falta el campo de texto "${field}".`)
  }
  return value.trim()
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es-AR')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildCombinedPracticePrompt(
  chapterFrom,
  chapterTo,
  selectedVerbTense = 'mixed',
) {
  const verbTense = requireVerbTense(selectedVerbTense, 'verbTense', true)
  const verbTenseLabel = getCombinedVerbTenseLabel(verbTense)
  const exampleTenses = verbTense === 'mixed'
    ? Array.from({ length: sentenceCount }, (_, index) => individualVerbTenses[index % 4])
    : Array.from({ length: sentenceCount }, () => verbTense)
  const responseShape = {
    combinedPractice: {
      direction: 'es_la',
      chapterFrom,
      chapterTo,
      verbTense,
      sentences: Array.from({ length: sentenceCount }, (_, index) => ({
        verbTense: exampleTenses[index],
        spanish: `oración breve en español ${index + 1}`,
        latin: 'traducción modelo completa en latín con macrones',
        acceptableAnswers: [],
        targetVocabulary: [
          {
            lemma: 'lema latino introducido dentro del rango',
            meaning: 'significado usado en la oración española',
            form: 'forma exacta del lema presente en latin',
          },
        ],
        explanation: 'explicación breve de vocabulario y gramática en español',
      })),
    },
  }

  return [
    'Quiero crear una práctica combinada para una app educativa de latín.',
    '',
    'Dirección: español a latín.',
    'Libro de referencia: Lingua Latina per se Illustrata: Familia Romana.',
    `Alcance seleccionado: capítulos ${chapterFrom} al ${chapterTo}.`,
    `Tiempo verbal seleccionado: ${verbTenseLabel}.`,
    '',
    `Genera exactamente ${sentenceCount} oraciones breves y naturales en español para traducir al latín.`,
    ...(verbTense === 'mixed'
      ? [
          '- Usa solamente estos cuatro tiempos del indicativo: presente, pretérito imperfecto, pretérito perfecto y futuro.',
          '- Incluye los cuatro tiempos y dedica al menos dos oraciones a cada uno.',
          '- Distribuye las dos oraciones restantes entre cualquiera de esos cuatro tiempos.',
        ]
      : [
          `- Las diez oraciones deben usar ${verbTenseLabel.toLocaleLowerCase('es-AR')} de indicativo.`,
        ]),
    '- verbTense debe indicar el tiempo de cada oración usando exactamente present, imperfect, perfect o future.',
    '- La oración española debe dejar claro el tiempo verbal que corresponde en latín.',
    `- Cada oración debe evaluar entre una y tres palabras cuyo primer capítulo sea del ${chapterFrom} al ${chapterTo}.`,
    `- No uses como objetivo vocabulario que aparezca por primera vez antes del capítulo ${chapterFrom} ni después del ${chapterTo}.`,
    `- El resto de la oración puede usar vocabulario auxiliar sencillo de capítulos anteriores al ${chapterTo}.`,
    '- Utiliza estructuras gramaticales compatibles con ese punto de Familia Romana.',
    '- Evita oraciones ambiguas y traducciones con demasiadas soluciones posibles.',
    '- latin debe ser una traducción modelo completa y natural en latín clásico.',
    '- acceptableAnswers debe contener solamente variantes completas igualmente válidas; puede estar vacío.',
    '- Conserva los macrones en latin, acceptableAnswers y targetVocabulary.form.',
    '- targetVocabulary debe identificar los lemas realmente evaluados, su significado y la forma exacta usada.',
    '- Cada targetVocabulary.form debe aparecer literalmente dentro de latin.',
    '- No repitas una misma oración ni uses siempre el mismo vocabulario objetivo.',
    '- explanation debe explicar brevemente la elección léxica y las formas latinas, en español claro.',
    '',
    'Devuelve solamente JSON válido, sin Markdown, comentarios ni texto adicional.',
    'Respeta exactamente esta estructura:',
    JSON.stringify(responseShape, null, 2),
  ].join('\n')
}

export function readCombinedPracticeFromPastedJson(
  text,
  chapterFrom,
  chapterTo,
  selectedVerbTense = 'mixed',
) {
  let parsed
  try {
    parsed = JSON.parse(getJsonText(text))
  } catch {
    throw new Error('El contenido pegado no es un JSON válido.')
  }

  const practice = parsed.combinedPractice || parsed
  if (!practice || practice.direction !== 'es_la') {
    throw new Error('La práctica combinada debe traducir de español a latín.')
  }
  const expectedVerbTense = requireVerbTense(selectedVerbTense, 'verbTense', true)
  const importedVerbTense = requireVerbTense(practice.verbTense, 'verbTense', true)
  if (importedVerbTense !== expectedVerbTense) {
    throw new Error(
      `La práctica debe corresponder al tiempo verbal ${getCombinedVerbTenseLabel(expectedVerbTense)}.`,
    )
  }
  if (
    Number(practice.chapterFrom) !== Number(chapterFrom) ||
    Number(practice.chapterTo) !== Number(chapterTo)
  ) {
    throw new Error(
      `La práctica debe corresponder a los capítulos ${chapterFrom} al ${chapterTo}.`,
    )
  }
  if (!Array.isArray(practice.sentences) || practice.sentences.length !== sentenceCount) {
    throw new Error(`La práctica debe incluir exactamente ${sentenceCount} oraciones.`)
  }

  const signatures = new Set()
  const verbTenseCounts = Object.fromEntries(
    individualVerbTenses.map((tenseId) => [tenseId, 0]),
  )
  const exercises = practice.sentences.map((sentence, index) => {
    const sentenceVerbTense = requireVerbTense(
      sentence?.verbTense,
      `sentences[${index}].verbTense`,
    )
    if (expectedVerbTense !== 'mixed' && sentenceVerbTense !== expectedVerbTense) {
      throw new Error(
        `La oración ${index + 1} no usa ${getCombinedVerbTenseLabel(expectedVerbTense)}.`,
      )
    }
    verbTenseCounts[sentenceVerbTense] += 1
    const question = requireText(sentence?.spanish, `sentences[${index}].spanish`)
    const correctAnswer = requireText(sentence?.latin, `sentences[${index}].latin`)
    const explanation = requireText(
      sentence?.explanation,
      `sentences[${index}].explanation`,
    )
    const acceptableAnswers = Array.isArray(sentence?.acceptableAnswers)
      ? sentence.acceptableAnswers.map((answer, answerIndex) =>
          requireText(answer, `sentences[${index}].acceptableAnswers[${answerIndex}]`),
        )
      : []
    if (!Array.isArray(sentence?.targetVocabulary) || !sentence.targetVocabulary.length) {
      throw new Error(`La oración ${index + 1} debe identificar su vocabulario objetivo.`)
    }
    const targetVocabulary = sentence.targetVocabulary.map((target, targetIndex) => {
      const lemma = requireText(
        target?.lemma,
        `sentences[${index}].targetVocabulary[${targetIndex}].lemma`,
      )
      const meaning = requireText(
        target?.meaning,
        `sentences[${index}].targetVocabulary[${targetIndex}].meaning`,
      )
      const form = requireText(
        target?.form,
        `sentences[${index}].targetVocabulary[${targetIndex}].form`,
      )
      if (!normalize(correctAnswer).includes(normalize(form))) {
        throw new Error(
          `La forma ${form} no aparece en la respuesta latina de la oración ${index + 1}.`,
        )
      }
      return { lemma, meaning, form }
    })
    const signature = normalize(question)
    if (signatures.has(signature)) {
      throw new Error('La práctica combinada contiene oraciones repetidas.')
    }
    signatures.add(signature)

    return {
      id: `combined-${index + 1}`,
      exerciseType: 'translation_es_la',
      prompt: 'Traduce la oración completa al latín.',
      verbTense: sentenceVerbTense,
      question,
      options: [],
      correctAnswer,
      acceptableAnswers,
      targetVocabulary,
      explanation,
      source: 'manual_chatgpt',
    }
  })

  if (
    expectedVerbTense === 'mixed' &&
    individualVerbTenses.some((tenseId) => verbTenseCounts[tenseId] < 2)
  ) {
    throw new Error(
      'La práctica mixta debe incluir al menos dos oraciones de cada tiempo verbal.',
    )
  }

  return {
    chapterFrom,
    chapterTo,
    combinedVerbTense: expectedVerbTense,
    exercises,
  }
}
