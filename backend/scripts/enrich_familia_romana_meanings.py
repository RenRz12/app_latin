#!/usr/bin/env python3
"""Enrich the Familia Romana seed with concise Spanish meanings.

The source is the Latin-Spanish vocabulary published for Familia Romana.  The
script deliberately uses exact, diacritic-insensitive lemma matches only.  It
skips homographs and conflicting glossary entries instead of guessing which
meaning belongs to an OCR-derived seed entry.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pdfplumber


SOURCE_NAME = "Vocabulario latín-español I — Familia Romana (Cultura Clásica, 2008)"
SOURCE_URL = "https://www.culturaclasica.com/lingualatina/vocabulario-familia-romana.pdf"
PAGE_INDEXES = range(2, 26)
COLUMNS = (
    ((35, 35, 229, 625), 46),
    ((235, 35, 456, 625), 244),
)


def normalize_lemma(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value)
    without_marks = "".join(
        character for character in decomposed if not unicodedata.combining(character)
    )
    return re.sub(r"[^a-z]", "", without_marks.lower().replace("j", "i"))


def concise_meaning(value: str) -> str:
    compact = re.sub(r"\s+", " ", value).strip()
    return re.split(r"[;,]", compact, maxsplit=1)[0].strip()


def leading_bold_text(line: dict[str, Any]) -> str:
    characters: list[str] = []
    for character in line["chars"]:
        if "Bold" not in character["fontname"]:
            break
        characters.append(character["text"])
    return "".join(characters)


def extract_glossary_entries(source_pdf: Path) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    with pdfplumber.open(source_pdf) as document:
        if len(document.pages) < max(PAGE_INDEXES) + 1:
            raise ValueError("El PDF de vocabulario no contiene todas las páginas esperadas.")

        for page_index in PAGE_INDEXES:
            page = document.pages[page_index]
            for bounding_box, entry_start_limit in COLUMNS:
                lines = page.crop(bounding_box).extract_text_lines(
                    strip=False,
                    return_chars=True,
                )
                current: dict[str, str] | None = None
                skipping_subentry = False
                for line in lines:
                    if line["x0"] <= entry_start_limit:
                        if current:
                            entries.append(current)
                        current = {
                            "headword": leading_bold_text(line),
                            "text": line["text"],
                        }
                        skipping_subentry = False
                    elif current and "⇒" in line["text"] and "⇒" in current["text"]:
                        # Indented constructions (for example, "aut... aut")
                        # are separate glossary items, not extra meanings of
                        # the preceding headword.
                        skipping_subentry = True
                    elif current and not skipping_subentry:
                        current["text"] += f" {line['text']}"
                if current:
                    entries.append(current)
    return entries


def build_meaning_index(entries: list[dict[str, str]]) -> dict[str, str]:
    candidates: defaultdict[str, list[str]] = defaultdict(list)
    for entry in entries:
        if "⇒" not in entry["text"] or not entry["headword"]:
            continue
        meaning = concise_meaning(entry["text"].split("⇒", maxsplit=1)[1])
        if not meaning:
            continue
        for variant in entry["headword"].split("/"):
            # Forms such as adversus/-um contain a suffix, not another lemma.
            if variant.startswith("-"):
                continue
            normalized = normalize_lemma(variant)
            if len(normalized) > 1:
                candidates[normalized].append(meaning)

    return {
        lemma: meanings[0]
        for lemma, values in candidates.items()
        if len(meanings := sorted(set(values))) == 1
    }


def enrich_seed(seed: dict[str, Any], meaning_index: dict[str, str]) -> dict[str, Any]:
    entries = seed["entries"]
    seed_lemma_counts = Counter(entry["normalizedLemma"] for entry in entries)
    enriched_count = 0
    refreshed_count = 0

    for entry in entries:
        morphology = entry.get("morphologyData") or {}
        generated_by_script = morphology.get("meaningSource") == SOURCE_NAME
        if entry.get("meaningEs") and not generated_by_script:
            continue
        normalized = entry["normalizedLemma"]
        if seed_lemma_counts[normalized] != 1 or normalized not in meaning_index:
            continue
        entry["meaningEs"] = meaning_index[normalized]
        entry["sourceReference"] = SOURCE_NAME
        entry["morphologyData"] = {
            **morphology,
            "meaningSource": SOURCE_NAME,
            "meaningSourceUrl": SOURCE_URL,
        }
        if generated_by_script:
            refreshed_count += 1
        else:
            enriched_count += 1

    seed["generatedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    seed["source"] = "Familia Romana — Index Vocabulorum; " + SOURCE_NAME
    return {
        "enriched": enriched_count,
        "refreshed": refreshed_count,
        "practiceReady": sum(bool(entry.get("meaningEs")) for entry in entries),
        "total": len(entries),
        "byChapter": {
            str(chapter): sum(
                bool(entry.get("meaningEs"))
                and entry["firstAppearanceChapter"] == chapter
                for entry in entries
            )
            for chapter in range(1, 36)
        },
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-pdf", required=True, type=Path)
    parser.add_argument(
        "--seed",
        type=Path,
        default=Path(__file__).resolve().parents[1]
        / "seed"
        / "familia-romana-vocabulary.json",
    )
    parser.add_argument("--write", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    seed = json.loads(args.seed.read_text(encoding="utf-8"))
    glossary_entries = extract_glossary_entries(args.source_pdf)
    meaning_index = build_meaning_index(glossary_entries)
    summary = enrich_seed(seed, meaning_index)
    summary["glossaryEntries"] = len(glossary_entries)
    summary["unambiguousMeanings"] = len(meaning_index)

    if args.write:
        args.seed.write_text(
            json.dumps(seed, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
