const longVowelMap = {
  ā: 'a*',
  á: 'a*',
  à: 'a*',
  â: 'a*',
  ä: 'a*',
  ã: 'a*',
  ē: 'e*',
  é: 'e*',
  è: 'e*',
  ê: 'e*',
  ë: 'e*',
  ī: 'i*',
  í: 'i*',
  ì: 'i*',
  î: 'i*',
  ï: 'i*',
  ō: 'o*',
  ó: 'o*',
  ò: 'o*',
  ô: 'o*',
  ö: 'o*',
  õ: 'o*',
  ū: 'u*',
  ú: 'u*',
  ù: 'u*',
  û: 'u*',
  ü: 'u*',
  ȳ: 'y*',
  ý: 'y*',
  ÿ: 'y*',
}

function normalizeSpacing(value) {
  return String(value || '')
    .normalize('NFC')
    .toLocaleLowerCase('es-AR')
    .trim()
    .replace(/[.,;:!?¿¡"']/g, '')
    .replace(/\s+/g, ' ')
}

function normalizeLongVowels(value) {
  return [...normalizeSpacing(value)]
    .map((letter) => longVowelMap[letter] || letter)
    .join('')
}

function normalizeWithoutMarks(value) {
  return normalizeSpacing(value)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function evaluateAnswer(userAnswer, correctAnswer) {
  const normalizedUserAnswer = normalizeSpacing(userAnswer)
  const normalizedCorrectAnswer = normalizeSpacing(correctAnswer)

  if (!normalizedUserAnswer) {
    return {
      status: 'empty',
      label: 'Sin respuesta',
    }
  }

  if (
    normalizedUserAnswer === normalizedCorrectAnswer ||
    normalizeLongVowels(userAnswer) === normalizeLongVowels(correctAnswer)
  ) {
    return {
      status: 'correct',
      label: 'Respuesta correcta',
    }
  }

  if (normalizeWithoutMarks(userAnswer) === normalizeWithoutMarks(correctAnswer)) {
    return {
      status: 'almost',
      label: 'Respuesta incompleta: revisa las vocales largas',
    }
  }

  return {
    status: 'incorrect',
    label: 'Todavia no',
  }
}
