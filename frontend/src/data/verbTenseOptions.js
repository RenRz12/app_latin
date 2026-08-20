export const verbTenseOptions = [
  {
    id: 'present',
    label: 'Presente',
    promptLabel: 'presente de indicativo activo',
    description: 'Cuatro familias: una por conjugacion',
  },
  {
    id: 'imperfect',
    label: 'Preterito imperfecto',
    promptLabel: 'preterito imperfecto de indicativo activo',
    description: 'Dos familias: conjugaciones 1.a/2.a y 3.a/4.a',
  },
  {
    id: 'perfect',
    label: 'Preterito perfecto',
    promptLabel: 'preterito perfecto de indicativo activo',
    description: 'Cinco familias: -v-, -u-, -s-, -x- y reduplicacion',
  },
  {
    id: 'future',
    label: 'Futuro',
    promptLabel: 'futuro de indicativo activo',
    description: 'Dos familias: sistema -b- y sistema -am/-es',
  },
]

export const verbFamiliesByTense = {
  present: [
    {
      id: 'present_first',
      label: '1.a conjugacion',
      rule: 'infinitivo en -āre; tema de presente en -ā-',
    },
    {
      id: 'present_second',
      label: '2.a conjugacion',
      rule: 'infinitivo en -ēre; tema de presente en -ē-',
    },
    {
      id: 'present_third',
      label: '3.a conjugacion',
      rule: 'infinitivo en -ere breve; tema consonantico',
    },
    {
      id: 'present_fourth',
      label: '4.a conjugacion',
      rule: 'infinitivo en -īre; tema de presente en -ī-',
    },
  ],
  imperfect: [
    {
      id: 'imperfect_first_second',
      label: 'Familia 1.a/2.a',
      rule: 'verbo de 1.a o 2.a conjugacion: tema vocalico + -bā-',
    },
    {
      id: 'imperfect_third_fourth',
      label: 'Familia 3.a/4.a',
      rule: 'verbo de 3.a o 4.a conjugacion: patron -ēbā- o -iēbā-',
    },
  ],
  perfect: [
    {
      id: 'perfect_v',
      label: 'Perfecto en -v-',
      rule: 'el tema de perfecto agrega -v-, como amāvī',
    },
    {
      id: 'perfect_u',
      label: 'Perfecto en -u-',
      rule: 'el tema de perfecto agrega -u-, como monuī',
    },
    {
      id: 'perfect_s',
      label: 'Perfecto en -s-',
      rule: 'el tema de perfecto agrega o conserva una s reconocible, como mānsī',
    },
    {
      id: 'perfect_x',
      label: 'Perfecto en -x-',
      rule: 'el encuentro de velar + s produce -x-, como rēxī o dīxī',
    },
    {
      id: 'perfect_reduplicated',
      label: 'Perfecto reduplicado',
      rule: 'el tema repite la consonante inicial, como cucurrī o tetigī',
    },
  ],
  future: [
    {
      id: 'future_first_second',
      label: 'Sistema 1.a/2.a',
      rule: 'conjugaciones 1.a y 2.a: futuro con -bō, -bis, -bit, -bimus, -bitis, -bunt',
    },
    {
      id: 'future_third_fourth',
      label: 'Sistema 3.a/4.a',
      rule: 'conjugaciones 3.a y 4.a: futuro con -am, -ēs, -et, -ēmus, -ētis, -ent',
    },
  ],
}

export function getVerbFamiliesForTense(tenseId) {
  return verbFamiliesByTense[tenseId] || verbFamiliesByTense.present
}
