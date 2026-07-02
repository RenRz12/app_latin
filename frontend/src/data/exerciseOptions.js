export const topics = [
  { id: 'presente', label: 'Presente', description: 'Verbos regulares en acciones actuales' },
  { id: 'perfecto', label: 'Preterito perfecto', description: 'Acciones terminadas en el pasado' },
  {
    id: 'imperfecto',
    label: 'Preterito imperfecto',
    description: 'Acciones habituales o en desarrollo en el pasado',
  },
  { id: 'declinaciones', label: 'Declinaciones', description: 'Casos, genero y numero' },
]

export const vocabularyLevels = [
  {
    id: 1,
    label: 'Caps. 1-5',
    scope: 'Lingua Latina: vocabulario visto hasta el capitulo 5',
  },
  {
    id: 2,
    label: 'Caps. 1-10',
    scope: 'Lingua Latina: vocabulario visto hasta el capitulo 10',
  },
  {
    id: 3,
    label: 'Caps. 1-15',
    scope: 'Lingua Latina: vocabulario visto hasta el capitulo 15',
  },
  {
    id: 4,
    label: 'Caps. 1-20',
    scope: 'Lingua Latina: vocabulario visto hasta el capitulo 20',
  },
]

export const exerciseTypes = [
  { id: 'multiple_choice', label: 'Opcion multiple' },
  { id: 'fill_blank', label: 'Completar' },
  { id: 'translation', label: 'Traduccion' },
]

export const sampleExercises = {
  multiple_choice: {
    presente: {
      question: 'Puella rosam ____.',
      prompt: 'Elegi la forma correcta del verbo en presente.',
      options: ['amat', 'amavit', 'amabit', 'amabant'],
      correctAnswer: 'amat',
      explanation: 'Puella es singular, por eso corresponde amat: la nina ama.',
      source: 'local_sample',
    },
    perfecto: {
      question: 'Puer librum ____.',
      prompt: 'Elegi la forma que expresa una accion ya terminada.',
      options: ['legit', 'legebat', 'legitne', 'leget'],
      correctAnswer: 'legit',
      explanation: 'Legit puede funcionar como perfecto: el nino leyo el libro.',
      source: 'local_sample',
    },
    imperfecto: {
      question: 'Servus aquam ____.',
      prompt: 'Elegi la forma verbal del preterito imperfecto.',
      options: ['portabat', 'portat', 'portavit', 'portabit'],
      correctAnswer: 'portabat',
      explanation: 'Portabat indica una accion en desarrollo o habitual en el pasado.',
      source: 'local_sample',
    },
    declinaciones: {
      question: 'Rosa ____ pulchra est.',
      prompt: 'Completa con el genitivo singular correcto.',
      options: ['puellae', 'puellam', 'puella', 'puellas'],
      correctAnswer: 'puellae',
      explanation: 'Puellae puede indicar de la nina: la rosa de la nina es hermosa.',
      source: 'local_sample',
    },
  },
  fill_blank: {
    presente: {
      question: 'Puella ____ amat.',
      prompt: 'Completa la palabra que falta.',
      options: [],
      correctAnswer: 'rosam',
      explanation: 'Rosam esta en acusativo singular porque recibe la accion de amat.',
      source: 'local_sample',
    },
    perfecto: {
      question: 'Puer librum ____.',
      prompt: 'Completa con una forma de preterito perfecto.',
      options: [],
      correctAnswer: 'legit',
      explanation: 'Legit puede expresar que el nino leyo el libro.',
      source: 'local_sample',
    },
    imperfecto: {
      question: 'Servus aquam ____.',
      prompt: 'Completa con una forma de preterito imperfecto.',
      options: [],
      correctAnswer: 'portabat',
      explanation: 'Portabat indica una accion habitual o en desarrollo en el pasado.',
      source: 'local_sample',
    },
    declinaciones: {
      question: 'Rosa ____ pulchra est.',
      prompt: 'Completa con el genitivo singular.',
      options: [],
      correctAnswer: 'puellae',
      explanation: 'Puellae indica de la nina.',
      source: 'local_sample',
    },
  },
  translation: {
    presente: {
      question: 'Puella rosam amat.',
      prompt: 'Traduce la frase al espanol.',
      options: [],
      correctAnswer: 'La nina ama la rosa.',
      explanation: 'Puella es el sujeto, rosam el objeto directo y amat el verbo.',
      source: 'local_sample',
    },
    perfecto: {
      question: 'Puer librum legit.',
      prompt: 'Traduce la frase al espanol.',
      options: [],
      correctAnswer: 'El nino leyo el libro.',
      explanation: 'Legit puede funcionar como preterito perfecto.',
      source: 'local_sample',
    },
    imperfecto: {
      question: 'Servus aquam portabat.',
      prompt: 'Traduce la frase al espanol.',
      options: [],
      correctAnswer: 'El esclavo llevaba agua.',
      explanation: 'Portabat expresa una accion en desarrollo en el pasado.',
      source: 'local_sample',
    },
    declinaciones: {
      question: 'Rosa puellae pulchra est.',
      prompt: 'Traduce la frase al espanol.',
      options: [],
      correctAnswer: 'La rosa de la nina es hermosa.',
      explanation: 'Puellae puede indicar de la nina.',
      source: 'local_sample',
    },
  },
}

export function getSampleExercise(topicId, exerciseTypeId) {
  return sampleExercises[exerciseTypeId]?.[topicId] || sampleExercises.multiple_choice[topicId]
}
