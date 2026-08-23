export function isPracticeReadyVocabulary(word) {
  const values = word?.get ? word.get({ plain: true }) : word
  return (
    typeof values?.lemma === 'string' &&
    Boolean(values.lemma.trim()) &&
    typeof values?.normalizedLemma === 'string' &&
    Boolean(values.normalizedLemma.trim()) &&
    typeof values?.meaningEs === 'string' &&
    Boolean(values.meaningEs.trim())
  )
}
