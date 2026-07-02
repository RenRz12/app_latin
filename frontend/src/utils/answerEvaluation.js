const accentMap = {
  á: 'a',
  à: 'a',
  â: 'a',
  ä: 'a',
  ã: 'a',
  ā: 'a',
  é: 'e',
  è: 'e',
  ê: 'e',
  ë: 'e',
  ē: 'e',
  í: 'i',
  ì: 'i',
  î: 'i',
  ï: 'i',
  ī: 'i',
  ó: 'o',
  ò: 'o',
  ô: 'o',
  ö: 'o',
  õ: 'o',
  ō: 'o',
  ú: 'u',
  ù: 'u',
  û: 'u',
  ü: 'u',
  ū: 'u',
  ý: 'y',
  ÿ: 'y',
  ȳ: 'y',
}

const markedVowelMap = {
  á: 'a*',
  à: 'a*',
  â: 'a*',
  ä: 'a*',
  ã: 'a*',
  ā: 'a*',
  é: 'e*',
  è: 'e*',
  ê: 'e*',
  ë: 'e*',
  ē: 'e*',
  í: 'i*',
  ì: 'i*',
  î: 'i*',
  ï: 'i*',
  ī: 'i*',
  ó: 'o*',
  ò: 'o*',
  ô: 'o*',
  ö: 'o*',
  õ: 'o*',
  ō: 'o*',
  ú: 'u*',
  ù: 'u*',
  û: 'u*',
  ü: 'u*',
  ū: 'u*',
  ý: 'y*',
  ÿ: 'y*',
  ȳ: 'y*',
}

function normalizeSpacing(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[.,;:!?¿¡"']/g, '')
    .replace(/\s+/g, ' ')
}

function normalizeAccents(value) {
  return normalizeSpacing(value)
    .split('')
    .map((letter) => accentMap[letter] || letter)
    .join('')
}

function normalizeMarkedVowels(value) {
  return normalizeSpacing(value)
    .split('')
    .map((letter) => markedVowelMap[letter] || letter)
    .join('')
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

  if (normalizedUserAnswer === normalizedCorrectAnswer) {
    return {
      status: 'correct',
      label: 'Respuesta correcta',
    }
  }

  if (normalizeMarkedVowels(userAnswer) === normalizeMarkedVowels(correctAnswer)) {
    return {
      status: 'correct',
      label: 'Respuesta correcta',
    }
  }

  if (normalizeAccents(userAnswer) === normalizeAccents(correctAnswer)) {
    return {
      status: 'almost',
      label: 'Casi correcta',
    }
  }

  return {
    status: 'incorrect',
    label: 'Todavia no',
  }
}
