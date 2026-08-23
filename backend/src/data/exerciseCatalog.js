export const topicCatalog = {
  presente: {
    label: 'Presente',
    promptLabel: 'presente',
  },
  perfecto: {
    label: 'Preterito perfecto',
    promptLabel: 'preterito perfecto',
  },
  imperfecto: {
    label: 'Preterito imperfecto',
    promptLabel: 'preterito imperfecto',
  },
  declinaciones: {
    label: 'Declinaciones',
    promptLabel: 'declinaciones',
  },
  vocabulary: {
    label: 'Vocabulario',
    promptLabel: 'vocabulario latino',
  },
}

export const allowedTopics = Object.keys(topicCatalog)
export const allowedVocabularyLevels = [1, 2, 3, 4]
export const allowedVocabularyChapters = Array.from({ length: 35 }, (_, index) => index + 1)
export const allowedExerciseTypes = [
  'multiple_choice',
  'fill_blank',
  'conjugation',
  'transformation',
  'translation_la_es',
  'translation_es_la',
  'translation',
]

export const vocabularyScopesByLevel = {
  1: {
    label: 'Lingua Latina caps. 1-5',
    book: 'Lingua Latina per se Illustrata: Familia Romana',
    fromChapter: 1,
    toChapter: 5,
    description: 'Vocabulario visto desde el capitulo 1 hasta el 5.',
  },
  2: {
    label: 'Lingua Latina caps. 1-10',
    book: 'Lingua Latina per se Illustrata: Familia Romana',
    fromChapter: 1,
    toChapter: 10,
    description: 'Vocabulario visto desde el capitulo 1 hasta el 10.',
  },
  3: {
    label: 'Lingua Latina caps. 1-15',
    book: 'Lingua Latina per se Illustrata: Familia Romana',
    fromChapter: 1,
    toChapter: 15,
    description: 'Vocabulario visto desde el capitulo 1 hasta el 15.',
  },
  4: {
    label: 'Lingua Latina caps. 1-20',
    book: 'Lingua Latina per se Illustrata: Familia Romana',
    fromChapter: 1,
    toChapter: 20,
    description: 'Vocabulario visto desde el capitulo 1 hasta el 20.',
  },
}

export function createVocabularyScope(fromChapter, toChapter) {
  return {
    label: `Lingua Latina caps. ${fromChapter}-${toChapter}`,
    book: 'Lingua Latina per se Illustrata: Familia Romana',
    fromChapter,
    toChapter,
    description: `Vocabulario introducido desde el capitulo ${fromChapter} hasta el ${toChapter}.`,
  }
}

export const mockExercisesByTopic = {
  presente: {
    prompt: 'Elegi la forma correcta del verbo en presente.',
    question: 'Puella rosam ____.',
    options: ['amat', 'amavit', 'amabit', 'amabant'],
    correctAnswer: 'amat',
    explanation: 'Puella es singular, por eso corresponde amat: la nina ama.',
  },
  perfecto: {
    prompt: 'Elegi la forma que expresa una accion terminada en preterito perfecto.',
    question: 'Puer librum ____.',
    options: ['legit', 'legebat', 'legitne', 'leget'],
    correctAnswer: 'legit',
    explanation: 'Legit puede funcionar como preterito perfecto: el nino leyo el libro.',
  },
  imperfecto: {
    prompt: 'Elegi la forma verbal del preterito imperfecto.',
    question: 'Servus aquam ____.',
    options: ['portabat', 'portat', 'portavit', 'portabit'],
    correctAnswer: 'portabat',
    explanation: 'Portabat indica una accion en desarrollo o habitual en el pasado.',
  },
  declinaciones: {
    prompt: 'Completa con el genitivo singular correcto.',
    question: 'Rosa ____ pulchra est.',
    options: ['puellae', 'puellam', 'puella', 'puellas'],
    correctAnswer: 'puellae',
    explanation: 'Puellae puede indicar de la nina: la rosa de la nina es hermosa.',
  },
  vocabulary: {
    prompt: 'Elegi la traduccion correcta.',
    question: 'Puella',
    options: ['nina', 'rosa', 'casa', 'agua'],
    correctAnswer: 'nina',
    explanation: 'Puella significa nina.',
  },
}
