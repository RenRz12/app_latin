const invisibleClipboardCharacters =
  /[\u061C\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g
const nonJsonSpaces = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g

function cleanClipboardText(value) {
  return String(value ?? '')
    .replace(invisibleClipboardCharacters, '')
    .replace(nonJsonSpaces, ' ')
    .trim()
}

function unwrapMarkdownFence(text) {
  const fencedBlock = text.match(/```\s*(?:json)?\s*([\s\S]*?)\s*```/i)
  return fencedBlock ? fencedBlock[1].trim() : text
}

function extractJsonValue(text) {
  const objectStart = text.indexOf('{')
  const arrayStart = text.indexOf('[')
  const starts = [objectStart, arrayStart].filter((index) => index >= 0)
  if (!starts.length) return text

  const start = Math.min(...starts)
  const expectedClosings = []
  let insideString = false
  let escaped = false

  for (let index = start; index < text.length; index += 1) {
    const character = text[index]

    if (insideString) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === '"') {
        insideString = false
      }
      continue
    }

    if (character === '"') {
      insideString = true
    } else if (character === '{') {
      expectedClosings.push('}')
    } else if (character === '[') {
      expectedClosings.push(']')
    } else if (character === '}' || character === ']') {
      if (expectedClosings.at(-1) !== character) return text
      expectedClosings.pop()
      if (!expectedClosings.length) return text.slice(start, index + 1)
    }
  }

  return text
}

function withTypographicQuotesRecovered(text) {
  return text.replace(/[\u201C\u201D]/g, '"')
}

function uniqueCandidates(text) {
  const unfenced = unwrapMarkdownFence(text)
  const candidates = [unfenced, extractJsonValue(unfenced)]
  const withRecoveredQuotes = withTypographicQuotesRecovered(unfenced)
  candidates.push(withRecoveredQuotes, extractJsonValue(withRecoveredQuotes))
  return [...new Set(candidates.filter(Boolean))]
}

export function parsePastedJson(value) {
  const cleaned = cleanClipboardText(value)

  for (const candidate of uniqueCandidates(cleaned)) {
    try {
      return JSON.parse(candidate)
    } catch {
      // Probamos la siguiente normalización segura del mismo contenido pegado.
    }
  }

  throw new Error('El contenido pegado no es un JSON válido.')
}
