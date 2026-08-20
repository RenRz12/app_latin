#!/usr/bin/env python3
"""Extract lemma-oriented vocabulary from Familia Romana's Index Vocabulorum.

The PDF text layer is imperfect. This extractor deliberately preserves uncertain
readings, labels them for review, and never invents Spanish meanings or silently
reconstructs macrons that are not represented reliably by the source layer.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import pdfplumber


COLUMN_STARTS = (42.5, 165.5, 286.5)
CHAPTER_PATTERN = re.compile(r"([0-9IilOS]{1,2})\s*\.\s*(\d{1,3})")
LETTER_PATTERN = re.compile(r"^[A-Za-zÀ-ž-]+")


def normalize_ocr_number(value: str) -> int | None:
    translated = value.replace(" ", "").translate(
        str.maketrans({"I": "1", "i": "1", "l": "1", "O": "0", "S": "5"})
    )
    if not translated.isdigit():
        return None
    number = int(translated)
    return number if 1 <= number <= 35 else None


def normalize_lemma(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value)
    without_marks = "".join(character for character in decomposed if not unicodedata.combining(character))
    return re.sub(r"[^a-z]", "", without_marks.lower().replace("j", "i"))


def join_words(words: list[dict[str, Any]]) -> str:
    ordered = sorted(words, key=lambda word: word["x0"])
    output: list[str] = []
    previous_x1: float | None = None
    for word in ordered:
        text = word["text"].strip()
        if not text:
            continue
        gap = word["x0"] - previous_x1 if previous_x1 is not None else 10
        separator = " " if gap > 0.7 else ""
        output.append(f"{separator}{text}" if output else text)
        previous_x1 = word["x1"]
    return "".join(output)


def group_column_lines(page: Any, column_index: int) -> list[dict[str, Any]]:
    words = page.extract_words(use_text_flow=False, keep_blank_chars=False)
    lower = (150, 280, page.width + 1)[column_index]
    upper = (0, 150, 280)[column_index]
    selected = [
        word
        for word in words
        if upper <= word["x0"] < lower and 92 <= word["top"] <= page.height - 25
    ]
    rows: list[list[dict[str, Any]]] = []
    for word in sorted(selected, key=lambda item: (item["top"], item["x0"])):
        matching_row = next(
            (row for row in reversed(rows[-3:]) if abs(row[0]["top"] - word["top"]) <= 2.0),
            None,
        )
        if matching_row is None:
            rows.append([word])
        else:
            matching_row.append(word)

    return [
        {
            "text": join_words(row),
            "x0": min(word["x0"] for word in row),
            "top": min(word["top"] for word in row),
        }
        for row in rows
    ]


def collect_raw_entries(pdf: Any, start_page: int, end_page: int) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for page_number in range(start_page, end_page):
        page = pdf.pages[page_number]
        for column_index, _column_start in enumerate(COLUMN_STARTS):
            lines = group_column_lines(page, column_index)
            column_start = Counter(round(line["x0"]) for line in lines).most_common(1)[0][0]
            current: dict[str, Any] | None = None
            for line in lines:
                is_left_aligned = abs(line["x0"] - column_start) <= 2.5
                begins_with_letters = bool(LETTER_PATTERN.match(line["text"]))
                is_heading = bool(re.fullmatch(r"[A-Z]\s*[·.]?", line["text"]))

                if is_left_aligned and begins_with_letters and not is_heading:
                    if current:
                        entries.append(current)
                    current = {
                        "raw": line["text"],
                        "pdfPage": page_number + 1,
                        "column": column_index + 1,
                    }
                elif current:
                    current["raw"] = f"{current['raw']} {line['text']}"
            if current:
                entries.append(current)
    return entries


def extract_occurrences(raw: str) -> list[dict[str, int]]:
    occurrences: list[dict[str, int]] = []
    seen: set[tuple[int, int]] = set()
    for match in CHAPTER_PATTERN.finditer(raw):
        chapter = normalize_ocr_number(match.group(1))
        line = int(match.group(2))
        if chapter is None or line < 1 or line > 400:
            continue
        key = (chapter, line)
        if key not in seen:
            seen.add(key)
            occurrences.append({"chapter": chapter, "line": line})
        continuation = re.match(r"((?:\s*,\s*\d{1,3})+)", raw[match.end() :])
        if continuation:
            for extra_line in re.findall(r"\d{1,3}", continuation.group(1)):
                extra_key = (chapter, int(extra_line))
                if 1 <= extra_key[1] <= 400 and extra_key not in seen:
                    seen.add(extra_key)
                    occurrences.append({"chapter": chapter, "line": extra_key[1]})
    return occurrences


def text_before_first_occurrence(raw: str) -> str:
    match = CHAPTER_PATTERN.search(raw)
    return raw[: match.start()].strip(" /;,.") if match else raw.strip()


def infer_part_of_speech(header: str, lemma: str) -> str:
    lowered = header.lower()
    tokens = re.split(r"\s+", lowered)

    if re.search(r"(?:^|\s)(m|f|n)(?:\s|$)", lowered):
        return "NOUN"
    if re.search(r"-a\s+-?um|-a-um|-is\s+-?e", lowered):
        return "ADJECTIVE"
    if re.search(r"-(?:ae|i|is|us|ei)(?:\s|/|$)", lowered):
        return "NOUN"
    if lemma.endswith(("are", "ere", "ire")) or any(
        marker in lowered for marker in ("-isse", "-fuisse", "-fecisse")
    ):
        return "VERB"
    if "adv" in tokens:
        return "ADVERB"
    if "conj" in tokens:
        return "CONJUNCTION"
    if "prep" in tokens or "+acc" in lowered or "+abl" in lowered:
        return "PREPOSITION"
    if "pron" in tokens:
        return "PRONOUN"
    if "num" in tokens:
        return "NUMERAL"
    return "UNKNOWN"


def morphology_for(header: str, lemma: str, part_of_speech: str) -> dict[str, Any]:
    morphology: dict[str, Any] = {"indexEntry": header}
    if part_of_speech == "NOUN":
        gender_match = re.search(r"(?:^|\s)(m|f|n)(?:\s|$)", header.lower())
        ending_match = re.search(r"\s(-[^\s/;,]+)", header)
        morphology.update(
            {
                "nominative": lemma,
                "genitive": ending_match.group(1) if ending_match else None,
                "gender": gender_match.group(1) if gender_match else None,
            }
        )
    elif part_of_speech == "VERB":
        morphology["principalParts"] = re.findall(r"(?:^|\s)([A-Za-zÀ-ž-]+)", header)
    elif part_of_speech == "ADJECTIVE":
        morphology["adjectiveForms"] = re.findall(r"(?:^|\s)(-?[A-Za-zÀ-ž]+)", header)
    return morphology


def parse_raw_entry(item: dict[str, Any]) -> dict[str, Any] | None:
    raw = re.sub(r"\s+", " ", item["raw"]).strip()
    occurrences = extract_occurrences(raw)
    header = text_before_first_occurrence(raw)
    headword_match = LETTER_PATTERN.match(header)
    if not headword_match or not occurrences:
        return None

    printed_lemma = headword_match.group(0).strip("-")
    normalized = normalize_lemma(printed_lemma.replace("-", ""))
    if len(normalized) < 2:
        return None

    lemma = printed_lemma.lower().replace("-", "")
    part_of_speech = infer_part_of_speech(header, normalized)
    morphology = morphology_for(header, lemma, part_of_speech)
    reasons: list[str] = []

    if "�" in raw:
        reasons.append("Carácter ilegible en la capa de texto del PDF")
    if any(character.isupper() for character in printed_lemma[1:]):
        reasons.append("Mayúscula interna posiblemente producida por OCR o por una vocal larga")
    if part_of_speech == "UNKNOWN":
        reasons.append("Categoría gramatical no inferible de forma segura")
    if re.search(r"[+7]", header):
        reasons.append("Notación morfológica dañada o ambigua en la extracción")

    chapter_lines: dict[int, int] = {}
    for occurrence in occurrences:
        chapter_lines[occurrence["chapter"]] = min(
            chapter_lines.get(occurrence["chapter"], occurrence["line"]), occurrence["line"]
        )
    chapters = [
        {"chapter": chapter, "firstOccurrenceLine": line}
        for chapter, line in sorted(chapter_lines.items())
    ]

    return {
        "lemma": lemma,
        "normalizedLemma": normalized,
        "meaningEs": None,
        "partOfSpeech": part_of_speech,
        "homographKey": "",
        "firstAppearanceChapter": chapters[0]["chapter"],
        "nominative": morphology.get("nominative"),
        "genitive": morphology.get("genitive"),
        "gender": morphology.get("gender"),
        "declension": None,
        "principalParts": morphology.get("principalParts"),
        "conjugation": None,
        "adjectiveForms": morphology.get("adjectiveForms"),
        "morphologyData": {"indexEntry": header, "rawOccurrences": len(occurrences)},
        "importStatus": "NEEDS_REVIEW" if reasons else "VERIFIED",
        "sourceReference": "Familia Romana — Index Vocabulorum",
        "chapters": chapters,
        "occurrences": occurrences,
        "reviewReasons": reasons,
        "sourceLocation": {
            "pdfPage": item["pdfPage"],
            "column": item["column"],
            "rawEntry": raw,
        },
    }


def assign_homograph_keys(entries: list[dict[str, Any]]) -> None:
    groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for entry in entries:
        groups[(entry["normalizedLemma"], entry["partOfSpeech"])].append(entry)

    for group in groups.values():
        if len(group) <= 1:
            continue
        signatures: dict[str, int] = defaultdict(int)
        for entry in group:
            base = normalize_lemma(entry["morphologyData"]["indexEntry"].replace(entry["lemma"], "", 1))
            base = base[:36] or "homograph"
            signatures[base] += 1
            suffix = f"-{signatures[base]}" if signatures[base] > 1 else ""
            entry["homographKey"] = f"{base}{suffix}"
            entry["reviewReasons"].append("Homógrafo separado por su entrada morfológica")
            entry["importStatus"] = "NEEDS_REVIEW"


def merge_exact_entries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[tuple[str, str, str], dict[str, Any]] = {}
    for entry in entries:
        signature = (
            entry["normalizedLemma"],
            entry["partOfSpeech"],
            entry["morphologyData"]["indexEntry"].lower(),
        )
        if signature not in merged:
            merged[signature] = entry
            continue

        target = merged[signature]
        occurrence_keys = {(item["chapter"], item["line"]) for item in target["occurrences"]}
        target["occurrences"].extend(
            occurrence
            for occurrence in entry["occurrences"]
            if (occurrence["chapter"], occurrence["line"]) not in occurrence_keys
        )
        by_chapter = {item["chapter"]: item for item in target["chapters"]}
        for chapter in entry["chapters"]:
            current = by_chapter.get(chapter["chapter"])
            if current:
                current["firstOccurrenceLine"] = min(
                    current["firstOccurrenceLine"], chapter["firstOccurrenceLine"]
                )
            else:
                target["chapters"].append(chapter)
        target["chapters"].sort(key=lambda item: item["chapter"])
        target["firstAppearanceChapter"] = target["chapters"][0]["chapter"]
    return list(merged.values())


def find_index_pages(pdf: Any) -> tuple[int, int]:
    start_page = None
    end_page = None
    for page_number, page in enumerate(pdf.pages):
        if page_number < 280:
            continue
        text = (page.extract_text() or "").upper()
        if start_page is None and "INDEX VOCAB" in text:
            start_page = page_number
        elif start_page is not None and "INDEX GRAMMATIC" in text:
            end_page = page_number
            break
    if start_page is None or end_page is None:
        raise RuntimeError("No se pudieron delimitar INDEX VOCABVLORVM e INDEX GRAMMATICVS.")
    return start_page, end_page


def build_report(entries: list[dict[str, Any]], raw_count: int, pages: tuple[int, int]) -> dict[str, Any]:
    chapter_stats = {
        str(chapter): {"uniqueLemmas": 0, "detectedOccurrences": 0} for chapter in range(1, 36)
    }
    for entry in entries:
        for chapter in entry["chapters"]:
            chapter_stats[str(chapter["chapter"])]["uniqueLemmas"] += 1
        for occurrence in entry["occurrences"]:
            chapter_stats[str(occurrence["chapter"])]["detectedOccurrences"] += 1

    ambiguous = [
        {
            "lemma": entry["lemma"],
            "normalizedLemma": entry["normalizedLemma"],
            "reasons": entry["reviewReasons"],
            "sourceLocation": entry["sourceLocation"],
        }
        for entry in entries
        if entry["importStatus"] == "NEEDS_REVIEW"
    ]
    missing_chapters = [
        int(chapter) for chapter, stats in chapter_stats.items() if stats["uniqueLemmas"] == 0
    ]
    possible_duplicates = [
        item for item in ambiguous if "Homógrafo separado" in " ".join(item["reasons"])
    ]
    unidentified_lemmas = [
        item for item in ambiguous if "Categoría gramatical no inferible" in " ".join(item["reasons"])
    ]

    return {
        "source": "Lingua Latina: Pars I — Familia Romana",
        "strategy": "Index Vocabulorum; one canonical index entry per lemma and M:N chapter links",
        "indexPdfPages": {"from": pages[0] + 1, "to": pages[1]},
        "rawEntriesDetected": raw_count,
        "uniqueVocabularyEntries": len(entries),
        "duplicatesAvoided": max(0, raw_count - len(entries)),
        "detectedOccurrences": sum(len(entry["occurrences"]) for entry in entries),
        "verifiedEntries": sum(entry["importStatus"] == "VERIFIED" for entry in entries),
        "needsReviewEntries": len(ambiguous),
        "missingSpanishMeanings": sum(not entry["meaningEs"] for entry in entries),
        "missingChapters": missing_chapters,
        "problematicChapters": missing_chapters,
        "macronPolicy": (
            "La capa de texto no representa las vocales largas con fiabilidad; no se reconstruyen "
            "silenciosamente y los casos sospechosos se marcan para revisión."
        ),
        "chapters": chapter_stats,
        "ambiguities": ambiguous,
        "unidentifiedLemmas": unidentified_lemmas,
        "possibleDuplicates": possible_duplicates,
        "fatalErrors": missing_chapters,
    }


def extract(pdf_path: Path) -> dict[str, Any]:
    with pdfplumber.open(pdf_path) as pdf:
        pages = find_index_pages(pdf)
        raw_entries = collect_raw_entries(pdf, *pages)

    parsed = [entry for item in raw_entries if (entry := parse_raw_entry(item))]
    entries = merge_exact_entries(parsed)
    assign_homograph_keys(entries)
    entries.sort(key=lambda entry: (entry["normalizedLemma"], entry["partOfSpeech"], entry["homographKey"]))
    report = build_report(entries, len(raw_entries), pages)
    return {"entries": entries, "report": report}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf_path", type=Path)
    arguments = parser.parse_args()
    if not arguments.pdf_path.is_file():
        print(json.dumps({"error": f"No existe el PDF: {arguments.pdf_path}"}, ensure_ascii=False))
        return 2

    try:
        result = extract(arguments.pdf_path)
    except Exception as error:  # The JSON error is consumed by the Node importer.
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
        return 1

    json.dump(result, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
