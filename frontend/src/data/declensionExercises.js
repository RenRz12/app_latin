export const declensionOptions = [
  {
    id: 'first',
    label: '1.a declinacion',
    model: 'puella, puellae',
    description: 'Tema en -a; genitivo en -ae',
  },
  {
    id: 'second',
    label: '2.a declinacion',
    model: 'servus, servī',
    description: 'Tema en -o; genitivo en -ī',
  },
  {
    id: 'third',
    label: '3.a declinacion',
    model: 'rēx, rēgis',
    description: 'Tema consonantico; genitivo en -is',
  },
  {
    id: 'fourth',
    label: '4.a declinacion',
    model: 'manus, manūs',
    description: 'Tema en -u; genitivo en -ūs',
  },
  {
    id: 'fifth',
    label: '5.a declinacion',
    model: 'rēs, reī',
    description: 'Tema en -e; genitivo en -eī',
  },
]

const cases = [
  { id: 'nominative', label: 'Nominativo' },
  { id: 'genitive', label: 'Genitivo' },
  { id: 'dative', label: 'Dativo' },
  { id: 'accusative', label: 'Acusativo' },
  { id: 'ablative', label: 'Ablativo' },
  { id: 'vocative', label: 'Vocativo' },
]

function createTable(singular, plural) {
  return cases.map((item, index) => ({
    ...item,
    singular: singular[index],
    plural: plural[index],
  }))
}

export const declensionExercises = {
  first: {
    word: 'puella, puellae',
    meaning: 'niña',
    gender: 'femenino',
    table: createTable(
      ['puella', 'puellae', 'puellae', 'puellam', 'puellā', 'puella'],
      ['puellae', 'puellārum', 'puellīs', 'puellās', 'puellīs', 'puellae'],
    ),
    sentences: [
      { text: '____ cantat.', hint: 'Nominativo singular', answer: 'puella' },
      { text: 'Liber ____ est.', hint: 'Genitivo singular', answer: 'puellae' },
      { text: 'Magister ____ rosam dat.', hint: 'Dativo singular', answer: 'puellae' },
      { text: 'Marcus ____ videt.', hint: 'Acusativo singular', answer: 'puellam' },
      { text: 'Cum ____ ambulamus.', hint: 'Ablativo singular', answer: 'puellā' },
      { text: 'O ____, veni!', hint: 'Vocativo singular', answer: 'puella' },
      { text: '____ cantant.', hint: 'Nominativo plural', answer: 'puellae' },
      { text: 'Magister ____ libros legit.', hint: 'Genitivo plural', answer: 'puellārum' },
      { text: 'Rosas ____ damus.', hint: 'Dativo plural', answer: 'puellīs' },
      { text: 'Marcus ____ videt.', hint: 'Acusativo plural', answer: 'puellās' },
    ],
  },
  second: {
    word: 'servus, servī',
    meaning: 'esclavo',
    gender: 'masculino',
    table: createTable(
      ['servus', 'servī', 'servō', 'servum', 'servō', 'serve'],
      ['servī', 'servōrum', 'servīs', 'servōs', 'servīs', 'servī'],
    ),
    sentences: [
      { text: '____ laborat.', hint: 'Nominativo singular', answer: 'servus' },
      { text: 'Villa ____ magna est.', hint: 'Genitivo singular', answer: 'servī' },
      { text: 'Dominus ____ aquam dat.', hint: 'Dativo singular', answer: 'servō' },
      { text: 'Marcus ____ vocat.', hint: 'Acusativo singular', answer: 'servum' },
      { text: 'Cum ____ laboro.', hint: 'Ablativo singular', answer: 'servō' },
      { text: 'O ____, veni!', hint: 'Vocativo singular', answer: 'serve' },
      { text: '____ laborant.', hint: 'Nominativo plural', answer: 'servī' },
      { text: 'Dominus ____ severus est.', hint: 'Genitivo plural', answer: 'servōrum' },
      { text: 'Aquam ____ damus.', hint: 'Dativo plural', answer: 'servīs' },
      { text: 'Dominus ____ vocat.', hint: 'Acusativo plural', answer: 'servōs' },
    ],
  },
  third: {
    word: 'rēx, rēgis',
    meaning: 'rey',
    gender: 'masculino',
    table: createTable(
      ['rēx', 'rēgis', 'rēgī', 'rēgem', 'rēge', 'rēx'],
      ['rēgēs', 'rēgum', 'rēgibus', 'rēgēs', 'rēgibus', 'rēgēs'],
    ),
    sentences: [
      { text: '____ venit.', hint: 'Nominativo singular', answer: 'rēx' },
      { text: 'Filia ____ cantat.', hint: 'Genitivo singular', answer: 'rēgis' },
      { text: 'Legatus ____ donum dat.', hint: 'Dativo singular', answer: 'rēgī' },
      { text: 'Populus ____ salutat.', hint: 'Acusativo singular', answer: 'rēgem' },
      { text: 'Cum ____ ambulamus.', hint: 'Ablativo singular', answer: 'rēge' },
      { text: 'O ____, audi!', hint: 'Vocativo singular', answer: 'rēx' },
      { text: '____ veniunt.', hint: 'Nominativo plural', answer: 'rēgēs' },
      { text: 'Castra ____ magna sunt.', hint: 'Genitivo plural', answer: 'rēgum' },
      { text: 'Legati ____ dona dant.', hint: 'Dativo plural', answer: 'rēgibus' },
      { text: 'Populus ____ salutat.', hint: 'Acusativo plural', answer: 'rēgēs' },
    ],
  },
  fourth: {
    word: 'manus, manūs',
    meaning: 'mano',
    gender: 'femenino',
    table: createTable(
      ['manus', 'manūs', 'manuī', 'manum', 'manū', 'manus'],
      ['manūs', 'manuum', 'manibus', 'manūs', 'manibus', 'manūs'],
    ),
    sentences: [
      { text: '____ laesa est.', hint: 'Nominativo singular', answer: 'manus' },
      { text: 'Digiti ____ longi sunt.', hint: 'Genitivo singular', answer: 'manūs' },
      { text: 'Medicus ____ auxilium dat.', hint: 'Dativo singular', answer: 'manuī' },
      { text: 'Puella ____ levat.', hint: 'Acusativo singular', answer: 'manum' },
      { text: 'Miles gladium in ____ tenet.', hint: 'Ablativo singular', answer: 'manū' },
      { text: 'O ____ dextra, fortis es!', hint: 'Vocativo singular', answer: 'manus' },
      { text: '____ laesae sunt.', hint: 'Nominativo plural', answer: 'manūs' },
      { text: 'Digiti ____ longi sunt.', hint: 'Genitivo plural', answer: 'manuum' },
      { text: 'Medicus ____ auxilium dat.', hint: 'Dativo plural', answer: 'manibus' },
      { text: 'Puella ____ lavat.', hint: 'Acusativo plural', answer: 'manūs' },
    ],
  },
  fifth: {
    word: 'rēs, reī',
    meaning: 'cosa / asunto',
    gender: 'femenino',
    table: createTable(
      ['rēs', 'reī', 'reī', 'rem', 'rē', 'rēs'],
      ['rēs', 'rērum', 'rēbus', 'rēs', 'rēbus', 'rēs'],
    ),
    sentences: [
      { text: '____ difficilis est.', hint: 'Nominativo singular', answer: 'rēs' },
      { text: 'Initium ____ notum est.', hint: 'Genitivo singular', answer: 'reī' },
      { text: 'Multum temporis ____ damus.', hint: 'Dativo singular', answer: 'reī' },
      { text: 'Hanc ____ intellego.', hint: 'Acusativo singular', answer: 'rem' },
      { text: 'De ____ loquimur.', hint: 'Ablativo singular', answer: 'rē' },
      { text: 'O ____ pulchra, mane!', hint: 'Vocativo singular', answer: 'rēs' },
      { text: '____ difficiles sunt.', hint: 'Nominativo plural', answer: 'rēs' },
      { text: 'Causae ____ clarae sunt.', hint: 'Genitivo plural', answer: 'rērum' },
      { text: '____ novis studemus.', hint: 'Dativo plural', answer: 'rēbus' },
      { text: 'Multas ____ videmus.', hint: 'Acusativo plural', answer: 'rēs' },
    ],
  },
}

export function getDeclensionExercise(declensionId) {
  return declensionExercises[declensionId] || declensionExercises.first
}
