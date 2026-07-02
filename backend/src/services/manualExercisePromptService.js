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
    translation: {
      exercises: [
        {
          prompt: 'Traduce la frase al espanol.',
          question: 'Puella rosam amat.',
          options: [],
          correctAnswer: 'La nina ama la rosa.',
          explanation: 'Puella es el sujeto, rosam es el objeto directo y amat es el verbo.',
        },
      ],
    },
  }

  return examples[exerciseType] || examples.multiple_choice
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
    translation: [
      '- Cada ejercicio debe pedir traducir una frase breve.',
      '- Alterna entre traduccion latin-espanol y espanol-latin cuando sea razonable.',
      '- options debe ser un array vacio.',
      '- correctAnswer debe ser una traduccion modelo breve.',
    ],
  }

  return rules[exerciseType] || rules.multiple_choice
}

export function buildManualExercisePrompt({
  topic,
  topicLabel,
  vocabularyLevel,
  exerciseType,
  vocabularyScope,
}) {
  const example = getExampleByExerciseType(exerciseType)
  const typeRules = getRulesByExerciseType(exerciseType)

  const importShape = {
    exercises: [
      {
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
    `- Nivel interno de la app: ${vocabularyLevel}`,
    '',
    'Reglas:',
    '- Usa solamente vocabulario y estructuras compatibles con ese alcance de capitulos.',
    '- No uses vocabulario que aparezca por primera vez despues del capitulo maximo permitido.',
    '- La explicacion debe estar en espanol claro.',
    '- Evita ejercicios ambiguos.',
    ...typeRules,
    '',
    'Devuelve solamente JSON valido, sin Markdown y sin comentarios.',
    'Usa exactamente este formato:',
    JSON.stringify(importShape, null, 2),
    '',
    'Ejemplo del tipo de ejercicio solicitado:',
    JSON.stringify(example, null, 2),
  ].join('\n')
}
