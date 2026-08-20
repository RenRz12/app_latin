function getExampleByExerciseType(exerciseType) {
  const examples = {
    multiple_choice: {
      exercises: [
        {
          prompt: 'Elegi la forma correcta del verbo.',
          question: 'Puella rosam ____.',
          options: ['amat', 'amavit', 'amabit', 'amabant'],
          correctAnswer: 'amat',
          explanation: 'Amat es presente, tercera persona singular.',
        },
      ],
    },
    fill_blank: {
      exercises: [
        {
          prompt: 'Completa la palabra que falta.',
          question: 'Puella ____ amat.',
          options: [],
          correctAnswer: 'rosam',
          explanation: 'Rosam esta en acusativo singular porque recibe la accion de amat.',
        },
      ],
    },
    conjugation: {
      exercises: [
        {
          prompt: 'Conjuga la forma indicada.',
          question: 'scribo -> imperfecto activo, tercera persona plural',
          options: [],
          correctAnswer: 'scribebant',
          explanation:
            'Scribebant es imperfecto activo, tercera persona plural, del verbo scribere.',
        },
      ],
    },
    transformation: {
      exercises: [
        {
          prompt: 'Transforma la oracion segun la indicacion.',
          question: 'Magister discipulos laudat. -> imperfecto pasivo',
          options: [],
          correctAnswer: 'Discipuli a magistro laudabantur.',
          explanation:
            'En pasiva, discipuli pasa a sujeto y el agente se expresa con a magistro.',
        },
      ],
    },
    translation_la_es: {
      exercises: [
        {
          prompt: 'Traduce la frase al español.',
          question: 'Puella rosam amat.',
          options: [],
          correctAnswer: 'La niña ama la rosa.',
          explanation: 'Puella es el sujeto, rosam es el objeto directo y amat es el verbo.',
        },
      ],
    },
    translation_es_la: {
      exercises: [
        {
          prompt: 'Traduce la frase al latin.',
          question: 'La niña ama la rosa.',
          options: [],
          correctAnswer: 'Puella rosam amat.',
          explanation: 'Puella es sujeto, rosam es acusativo singular y amat es el verbo.',
        },
      ],
    },
  }

  return examples[exerciseType] || examples.translation_la_es
}

function getRulesByExerciseType(exerciseType) {
  const rules = {
    multiple_choice: [
      '- Cada ejercicio debe tener exactamente 4 opciones.',
      '- correctAnswer debe aparecer exactamente dentro de options.',
      '- Las opciones incorrectas deben ser plausibles, pero claramente incorrectas.',
    ],
    fill_blank: [
      '- Cada ejercicio debe tener una frase con un espacio en blanco marcado como ____.',
      '- options debe ser un array vacio.',
      '- correctAnswer debe contener solamente la palabra o forma que completa el espacio.',
    ],
    conjugation: [
      '- Cada ejercicio debe pedir conjugar un verbo en una forma especifica.',
      '- La pregunta debe tener este formato: "verbo -> tiempo, voz, persona y numero".',
      '- Incluye tiempos y voces como presente activo, imperfecto activo, perfecto activo, futuro activo, presente pasivo, imperfecto pasivo, perfecto pasivo o futuro pasivo solo si son compatibles con el nivel.',
      '- options debe ser un array vacio.',
      '- correctAnswer debe contener solamente la forma conjugada.',
    ],
    transformation: [
      '- Cada ejercicio debe partir de una oracion base y pedir transformarla.',
      '- La pregunta debe tener este formato: "oracion base -> transformacion solicitada".',
      '- La transformacion solicitada debe usar exclusivamente el tema gramatical pedido arriba.',
      '- No mezcles otros tiempos verbales dentro del mismo set de ejercicios.',
      '- Si el tema pedido es preterito perfecto, todas las transformaciones deben ser de preterito perfecto activo o pasivo.',
      '- Si el tema pedido es preterito imperfecto, todas las transformaciones deben ser de preterito imperfecto activo o pasivo.',
      '- Si el tema pedido es presente, todas las transformaciones deben ser de presente activo o pasivo.',
      '- options debe ser un array vacio.',
      '- correctAnswer debe contener la oracion completa transformada y correctamente escrita.',
      '- explanation debe explicar brevemente que cambio verbal, de voz, de caso o de estructura se realizo.',
    ],
    translation_la_es: [
      '- Cada ejercicio debe pedir traducir una frase breve de latin a español.',
      '- La pregunta debe estar en latin.',
      '- options debe ser un array vacio.',
      '- correctAnswer debe ser una traduccion modelo breve en español.',
    ],
    translation_es_la: [
      '- Cada ejercicio debe pedir traducir una frase breve de español a latin.',
      '- La pregunta debe estar en español.',
      '- options debe ser un array vacio.',
      '- correctAnswer debe ser una traduccion modelo breve en latin.',
    ],
  }

  return rules[exerciseType] || rules.translation_la_es
}

function getRulesByTopic(topic) {
  if (topic !== 'vocabulary') return []

  return [
    '- Cada ejercicio debe evaluar una sola palabra de vocabulario.',
    '- No pidas conjugar, declinar ni transformar oraciones.',
    '- Usa el significado principal y evita traducciones ambiguas.',
    '- Para latin a español, question debe contener solo la palabra latina.',
    '- Para español a latin, question debe contener solo la palabra española.',
  ]
}

export function buildManualExercisePrompt({
  topic,
  topicLabel,
  exerciseType,
  vocabularyScope,
  excludedVocabularyWords = [],
}) {
  const example = topic === 'vocabulary' ? null : getExampleByExerciseType(exerciseType)
  const typeRules = getRulesByExerciseType(exerciseType)

  const importShape = {
    exercises: [
      {
        exerciseType,
        prompt: 'string',
        question: 'string',
        options: ['string'],
        correctAnswer: 'string',
        explanation: 'string',
      },
    ],
  }

  return [
    'Quiero crear ejercicios de latin para una app educativa.',
    '',
    'Genera 20 ejercicios con estas condiciones:',
    `- Tema gramatical: ${topicLabel || topic}`,
    `- Tipo de ejercicio: ${exerciseType}`,
    `- Libro de referencia: ${vocabularyScope.book}`,
    `- Alcance de vocabulario: capitulos ${vocabularyScope.fromChapter} al ${vocabularyScope.toChapter}`,
    '',
    'Reglas:',
    '- Usa solamente vocabulario y estructuras compatibles con ese alcance de capitulos.',
    '- No uses vocabulario que aparezca por primera vez despues del capitulo maximo permitido.',
    '- La explicacion debe estar en español claro.',
    '- Evita ejercicios ambiguos.',
    `- Incluye "exerciseType": "${exerciseType}" en cada ejercicio.`,
    '- La respuesta debe estar separada de la explicacion: correctAnswer contiene solo la respuesta final, explanation contiene la explicacion.',
    ...(topic === 'vocabulary'
      ? [
          `- Cada palabra objetivo debe haber sido introducida entre los capitulos ${vocabularyScope.fromChapter} y ${vocabularyScope.toChapter}; no uses como respuesta palabras basicas de capitulos anteriores.`,
          '- Las 20 palabras latinas deben ser diferentes entre si.',
          '- No repitas una palabra aunque cambie el uso de mayusculas o los signos de cantidad vocalica.',
          ...(excludedVocabularyWords.length > 0
            ? [`- No uses ninguna de estas palabras ya practicadas: ${excludedVocabularyWords.join(', ')}.`]
            : []),
        ]
      : []),
    ...typeRules,
    ...getRulesByTopic(topic),
    '',
    'Devuelve solamente JSON valido, sin Markdown y sin comentarios.',
    'Usa exactamente este formato:',
    JSON.stringify(importShape, null, 2),
    ...(example
      ? ['', 'Ejemplo del tipo de ejercicio solicitado:', JSON.stringify(example, null, 2)]
      : []),
  ].join('\n')
}
