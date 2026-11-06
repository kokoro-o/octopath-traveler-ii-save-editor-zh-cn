#!/usr/bin/env python3
"""Extract only editor names from locally extracted official GameText assets.

Usage: python3 scripts/octopath-ii-text.py TEXT_DIRECTORY TEMPLATE_JSON
TEXT_DIRECTORY must contain GameTextEN.uexp and GameTextZH_CN.uexp.
The original game assets and personal saves are never included in this project.
"""
import collections
import hashlib
import json
import pathlib
import re
import struct
import sys


def fstring(data, offset):
    size = struct.unpack_from("<i", data, offset)[0]
    offset += 4
    if not size or abs(size) > 1_000_000:
        raise ValueError("Invalid FString length")
    end = offset + (size if size > 0 else -size * 2)
    raw = data[offset:end]
    if len(raw) != end - offset:
        raise ValueError("Truncated FString")
    terminator = 1 if size > 0 else 2
    if raw[-terminator:] != bytes(terminator):
        raise ValueError("Unterminated FString")
    return raw[:-terminator].decode("utf-8" if size > 0 else "utf-16le"), end


def extract(path, namespace):
    data = path.read_bytes()
    texts = {}
    needle = namespace.encode() + b"\0"
    for match in re.finditer(re.escape(needle), data):
        # FText namespace, stable text key, then localized FString.
        if struct.unpack_from("<i", data, match.start() - 4)[0] != len(needle):
            continue
        key, offset = fstring(data, match.end())
        value, _ = fstring(data, offset)
        if key in texts and texts[key] != value:
            raise ValueError(f"Conflicting text key: {key}")
        texts[key] = value
    return texts


def display_strings(template):
    result = set()

    def resources(node):
        if isinstance(node, dict):
            for value in node.values():
                resources(value)
        elif isinstance(node, str):
            result.add(node)

    def walk(node):
        if isinstance(node, list):
            for value in node:
                walk(value)
        elif isinstance(node, dict):
            for key, value in node.items():
                if key in ("resources", "resourcesLabels"):
                    resources(value)
                elif key in ("name", "label", "hint", "text", "error") and isinstance(value, str):
                    result.add(value)
                else:
                    walk(value)

    walk(template)
    # The location flags combine region and town names into HTML labels.
    for name in list(result):
        location = re.fullmatch(r"<b>(.*?):</b> (.*)", name)
        if location:
            result.update(location.groups())
    return result


def main():
    text_dir, template_path = map(pathlib.Path, sys.argv[1:])
    english = extract(text_dir / "GameTextEN.uexp", "GameTextEN")
    chinese = extract(text_dir / "GameTextZH_CN.uexp", "GameTextZH_CN")
    candidates = collections.defaultdict(list)
    for key, value in english.items():
        if key in chinese:
            candidates[value].append((key, chinese[key]))

    # Resolve identical English strings by their actual editor context.
    preferred = {
        "Hikari": "CHARA_NAME_PC_0001_Text",
        "Headgear": "eSHOP_CATEGORY_HELMET_Text",
        "Body Armor": "eSHOP_CATEGORY_ARMOR_Text",
        "Accessories": "eSHOP_CATEGORY_ACCESSORY_Text",
        "Formation": "eMAINMENU_INPUT_GUIDE_FORMATION_Text",
        "Skills": "eMAINMENU_CONTENT_10_Text",
        "Equipment": "eMAINMENU_CONTENT_02_Text",
        "Support Skills": "eMAINMENU_JOB_SUPPORTABILITYNAME_Text",
        "Latent Power": "eSTATUSMENU_POTENTIALITY_ACTION_Text",
        "Rest": "ABN_MER_040_Text",
        "Revive": "ABN_CLE_070_Text",
        "The Show Goes On": "ABN_DAN_SAP_001_Text",
    }
    # Upstream abbreviates these map labels; use the full official location.
    aliases = {
        "Crackridge Harbor": "Fld_Wld_1_2_Text",
        "New Delsta Harbor": "Fld_Cty_1_1_Text",
        "Beasting Bay": "Fld_Isd_1_3_Text",
    }

    def priority(pair):
        key = pair[0]
        prefixes = ("TX_NA_", "eCLASS_NAME_", "CHARA_NAME_PC_", "ABN_", "eSHOP_", "eMAINMENU_", "e", "Twn_")
        return next((i for i, prefix in enumerate(prefixes) if key.startswith(prefix)), len(prefixes)), key

    translations, sources = {}, {}
    for name in sorted(display_strings(json.loads(template_path.read_text()))):
        if name in aliases:
            key = aliases[name]
            translations[name], sources[name] = chinese[key], key
            continue
        options = candidates.get(name, [])
        if not options or name == "General":
            continue
        selected = next((p for p in options if p[0] == preferred.get(name)), min(options, key=priority))
        translations[name] = selected[1]
        sources[name] = selected[0]

    out = pathlib.Path("src/lib/templates/octopath-traveler-ii/saveEditor/utils")
    (out / "zh-CN.game.json").write_text(json.dumps(translations, ensure_ascii=False, indent=2) + "\n")
    manifest = {
        "language": "ZH_CN (game Simplified Chinese, not ZH_TW)",
        "source": "Local Majesty-Switch.pak / Majesty/Content/GameText/Database",
        "sha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in text_dir.glob("*.uexp")},
        "textKeys": sources,
    }
    (out / "zh-CN.sources.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"Extracted {len(translations)} editor strings with original game text keys.")


if __name__ == "__main__":
    main()
