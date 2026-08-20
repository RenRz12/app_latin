export const topics = [
  {
    id: 'verb_tenses',
    label: 'Tiempos verbales',
    description: 'Conjugacion por tiempo, persona, numero y familia verbal',
  },
  { id: 'declinaciones', label: 'Declinaciones', description: 'Casos, genero y numero' },
  {
    id: 'vocabulary',
    label: 'Vocabulario',
    description: 'Palabras de Lingua Latina por alcance de capitulos',
  },
  {
    id: 'combined',
    label: 'Práctica combinada',
    description: 'Traducción de oraciones completas con vocabulario del rango elegido',
  },
]

export const vocabularyChapters = Array.from({ length: 35 }, (_, index) => ({
  id: index + 1,
  label: `Capitulo ${index + 1}`,
}))

export const exerciseTypes = [
  { id: 'multiple_choice', label: 'Opcion multiple' },
  { id: 'fill_blank', label: 'Completar' },
  { id: 'conjugation', label: 'Conjugaciones' },
  { id: 'transformation', label: 'Transformaciones' },
  { id: 'translation_la_es', label: 'Latin a español' },
  { id: 'translation_es_la', label: 'Español a latin' },
]

export const vocabularyExerciseTypes = exerciseTypes.filter((item) =>
  ['multiple_choice', 'translation_la_es', 'translation_es_la'].includes(item.id),
)

export const sampleExercises = {
  multiple_choice: {
    presente: {
      question: 'Puella rosam ____.',
      prompt: 'Elegi la forma correcta del verbo en presente.',
      options: ['amat', 'amavit', 'amabit', 'amabant'],
      correctAnswer: 'amat',
      explanation: 'Puella es singular, por eso corresponde amat: la niña ama.',
      source: 'local_sample',
    },
    perfecto: {
      question: 'Puer librum ____.',
      prompt: 'Elegi la forma que expresa una accion ya terminada.',
      options: ['legit', 'legebat', 'legitne', 'leget'],
      correctAnswer: 'legit',
      explanation: 'Legit puede funcionar como perfecto: el niño leyo el libro.',
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
      explanation: 'Puellae puede indicar de la niña: la rosa de la niña es hermosa.',
      source: 'local_sample',
    },
    vocabulary: {
      question: 'Puella',
      prompt: 'Elegi la traduccion correcta.',
      options: ['niña', 'rosa', 'casa', 'agua'],
      correctAnswer: 'niña',
      explanation: 'Puella significa niña.',
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
      explanation: 'Legit puede expresar que el niño leyo el libro.',
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
      explanation: 'Puellae indica de la niña.',
      source: 'local_sample',
    },
    vocabulary: {
      question: 'Puella significa ____.',
      prompt: 'Completa el significado de la palabra latina.',
      options: [],
      correctAnswer: 'niña',
      explanation: 'Puella significa niña.',
      source: 'local_sample',
    },
  },
  conjugation: {
    presente: {
      question: 'amo -> presente activo, tercera persona singular',
      prompt: 'Conjuga la forma indicada.',
      options: [],
      correctAnswer: 'amat',
      explanation: 'Amat es presente activo, tercera persona singular.',
      source: 'local_sample',
    },
    perfecto: {
      question: 'video -> perfecto activo, segunda persona singular',
      prompt: 'Conjuga la forma indicada.',
      options: [],
      correctAnswer: 'vidisti',
      explanation: 'Vidisti es perfecto activo, segunda persona singular.',
      source: 'local_sample',
    },
    imperfecto: {
      question: 'scribo -> imperfecto activo, tercera persona plural',
      prompt: 'Conjuga la forma indicada.',
      options: [],
      correctAnswer: 'scribebant',
      explanation: 'Scribebant es imperfecto activo, tercera persona plural.',
      source: 'local_sample',
    },
    declinaciones: {
      question: 'laudo -> presente pasivo, tercera persona singular',
      prompt: 'Conjuga la forma indicada.',
      options: [],
      correctAnswer: 'laudatur',
      explanation: 'Laudatur es presente pasivo, tercera persona singular.',
      source: 'local_sample',
    },
  },
  transformation: {
    presente: {
      question: 'Magister discipulos laudat. -> presente pasivo',
      prompt: 'Transforma la oracion segun la indicacion.',
      options: [],
      correctAnswer: 'Discipuli a magistro laudantur.',
      explanation: 'Discipuli pasa a sujeto y a magistro expresa el agente.',
      source: 'local_sample',
    },
    perfecto: {
      question: 'Magister discipulos laudat. -> perfecto activo',
      prompt: 'Transforma la oracion segun la indicacion.',
      options: [],
      correctAnswer: 'Magister discipulos laudavit.',
      explanation: 'Laudavit expresa accion terminada en perfecto activo.',
      source: 'local_sample',
    },
    imperfecto: {
      question: 'Magister discipulos laudat. -> imperfecto activo',
      prompt: 'Transforma la oracion segun la indicacion.',
      options: [],
      correctAnswer: 'Magister discipulos laudabat.',
      explanation: 'Laudabat expresa imperfecto activo.',
      source: 'local_sample',
    },
    declinaciones: {
      question: 'Magister discipulos laudat. -> imperfecto pasivo',
      prompt: 'Transforma la oracion segun la indicacion.',
      options: [],
      correctAnswer: 'Discipuli a magistro laudabantur.',
      explanation: 'Laudabantur es imperfecto pasivo, tercera persona plural.',
      source: 'local_sample',
    },
  },
  translation_la_es: {
    presente: {
      question: 'Puella rosam amat.',
      prompt: 'Traduce la frase al español.',
      options: [],
      correctAnswer: 'La niña ama la rosa.',
      explanation: 'Puella es el sujeto, rosam el objeto directo y amat el verbo.',
      source: 'local_sample',
    },
    perfecto: {
      question: 'Puer librum legit.',
      prompt: 'Traduce la frase al español.',
      options: [],
      correctAnswer: 'El niño leyo el libro.',
      explanation: 'Legit puede funcionar como preterito perfecto.',
      source: 'local_sample',
    },
    imperfecto: {
      question: 'Servus aquam portabat.',
      prompt: 'Traduce la frase al español.',
      options: [],
      correctAnswer: 'El esclavo llevaba agua.',
      explanation: 'Portabat expresa una accion en desarrollo en el pasado.',
      source: 'local_sample',
    },
    declinaciones: {
      question: 'Rosa puellae pulchra est.',
      prompt: 'Traduce la frase al español.',
      options: [],
      correctAnswer: 'La rosa de la niña es hermosa.',
      explanation: 'Puellae puede indicar de la niña.',
      source: 'local_sample',
    },
    vocabulary: {
      question: 'Puella',
      prompt: 'Escribe el significado en español.',
      options: [],
      correctAnswer: 'niña',
      explanation: 'Puella significa niña.',
      source: 'local_sample',
    },
  },
  translation_es_la: {
    presente: {
      question: 'La niña ama la rosa.',
      prompt: 'Traduce la frase al latin.',
      options: [],
      correctAnswer: 'Puella rosam amat.',
      explanation: 'Puella es sujeto, rosam es acusativo singular y amat es el verbo.',
      source: 'local_sample',
    },
    perfecto: {
      question: 'El niño leyo el libro.',
      prompt: 'Traduce la frase al latin.',
      options: [],
      correctAnswer: 'Puer librum legit.',
      explanation: 'Legit puede funcionar como preterito perfecto.',
      source: 'local_sample',
    },
    imperfecto: {
      question: 'El esclavo llevaba agua.',
      prompt: 'Traduce la frase al latin.',
      options: [],
      correctAnswer: 'Servus aquam portabat.',
      explanation: 'Portabat expresa imperfecto activo.',
      source: 'local_sample',
    },
    declinaciones: {
      question: 'La rosa de la niña es hermosa.',
      prompt: 'Traduce la frase al latin.',
      options: [],
      correctAnswer: 'Rosa puellae pulchra est.',
      explanation: 'Puellae puede indicar de la niña.',
      source: 'local_sample',
    },
    vocabulary: {
      question: 'Niña',
      prompt: 'Escribe la palabra en latin.',
      options: [],
      correctAnswer: 'puella',
      explanation: 'La palabra latina para niña es puella.',
      source: 'local_sample',
    },
  },
}

export function getSampleExercise(topicId, exerciseTypeId) {
  return (
    sampleExercises[exerciseTypeId]?.[topicId] ||
    sampleExercises.multiple_choice[topicId] ||
    sampleExercises.multiple_choice.presente
  )
}
