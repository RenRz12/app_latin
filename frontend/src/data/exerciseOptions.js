export const topics = [
  { id: 'presente', label: 'Presente', description: 'Verbos regulares en acciones actuales' },
  { id: 'perfecto', label: 'Preterito perfecto', description: 'Acciones terminadas en el pasado' },
  { id: 'imperfecto', label: 'Imperfecto', description: 'Acciones habituales o en desarrollo' },
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
    prompt: 'Elegi la forma verbal imperfecta.',
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
}
