#!/usr/bin/env python3
"""
Classify each exercise in the exercises-dataset by how it is performed:

  unilateral  - "each side"   : the movement is done one side at a time
                                (lunges, split squats, one-arm rows, alternating work…)
  bilateral   - "both sides"  : the movement is done with both sides together
                                (barbell compounds, machines, push-ups, squats, jumps…)
  either      - "either way"  : the same movement can be performed both sides
                                together OR one side at a time
                                (most dumbbell / kettlebell / band / cable work…)

Why it matters (shown in the UI):
  * unilateral  -> lighter per-side load, more time under tension and a better
                   eccentric (negative) overload; both sides must be trained in
                   balance or asymmetries develop.
  * bilateral   -> the biggest total load, most efficient for maximal strength;
                   can mask side-to-side imbalance.

Rule pipeline (first match wins):
  1. manual overrides        (by normalized name)
  2. unilateral keywords     (strong name patterns)
  3. bilateral keywords      (strong name patterns)
  4. equipment fallback      (machine/cardio -> bilateral, free-weight -> either)

Output: src/data/exercises.json  (English-only, trimmed, side field added)
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC_JSON = ROOT / "data" / "exercises.json"  # expected to exist (copied from dataset)
OUT_JSON = ROOT / "public" / "data" / "exercises.json"

if not SRC_JSON.exists():
    raise SystemExit(
        f"{SRC_JSON} not found. Copy the dataset first:\n"
        "  mkdir -p data && cp ../exercises-dataset/data/exercises.json data/\n"
        "  (or adjust SRC_JSON at the top of scripts/classify.py)"
    )

# --------------------------------------------------------------------------
# 1. Manual overrides — normalized (lowercased, stripped) exact-name -> side
# --------------------------------------------------------------------------
MANUAL: dict[str, str] = {
    # name patterns the keywords cannot safely infer
    "ab roller": "bilateral",  # roller + both arms
    "ab wheel": "bilateral",
    "assisted chest dip (kneeling)": "bilateral",
    "assisted prone hamstring": "either",  # stretch
    "assisted standing triceps extension (with towel)": "either",  # stretch
    "barbell guillotine bench press": "bilateral",
    "barbell hip thrust": "bilateral",
    "barbell shrug": "bilateral",
    "dumbbell fly": "either",
    "dumbbell bench press": "either",
    "dumbbell incline bench press": "either",
    "dumbbell decline bench press": "either",
    "dumbbell flat bench press": "either",
    "dumbbell pullover": "either",
    "dumbbell pull-over": "either",
    "farmer's walk": "bilateral",
    "farmer walk": "bilateral",
    "farmer carry": "bilateral",
    "fireman carry": "bilateral",
    "flutter kicks": "bilateral",
    "flutter kick": "bilateral",
    "hanging knee raise": "bilateral",
    "hanging leg raise": "bilateral",
    "inchworm": "bilateral",
    "kettlebell swing": "bilateral",  # hips drive both sides together
    "lever seated row": "either",
    "l-sit": "bilateral",
    "l sit": "bilateral",
    "lunge": "unilateral",  # plain "lunge" / "side lunge" etc.
    "scissor kick": "bilateral",
    "scissor kicks": "bilateral",
    "seated row": "either",
    "single leg squat (pistol) male": "unilateral",
    "stiff leg deadlift": "bilateral",
    "sumo squat": "bilateral",
    "superman": "bilateral",
    "superman hold": "bilateral",
    "triceps pushdown": "either",
    "triceps pressdown": "either",
    "triceps rope pushdown": "either",
    "upright row": "either",
    "wood chop": "either",
    "woodchopper": "either",
    "zottman curl": "either",
    "wheel rollout": "bilateral",
    "wheel roll-out": "bilateral",
}

# --------------------------------------------------------------------------
# 2. Unilateral keywords (strong name patterns)
# --------------------------------------------------------------------------
UNILATERAL_RE = re.compile(
    r"("
    r"one arm|one leg|one legged|one hand"
    r"|single arm|single leg|single legged|single hand|single-leg|single-arm"
    r"|alternat"  # alternating / alternate
    r"|unilateral"
    r"|pistol"
    r"|split squat"
    r"|bulgarian"
    r"|lunge"
    r"|step[- ]up"
    r"|skater"
    r"|cossack"
    r"|march|marching"
    r"|heel touch"
    r"|donkey kick|fire hydrant|mule kick"
    r"|bird dog"
    r"|bear crawl|crab walk|crab reach"
    r"|mountain climber"
    r"|dead bug"
    r"|side plank"
    r"|suitcase"
    r"|staggered"
    r"|curtsy"
    r"|rear foot elevated"
    r"|high knee"
    r"|ghost ride"
    r"|battle rope|battling"  # battle/battling ropes — alternating waves
    r"|sledge"  # sledgehammer swings alternate sides
    r"|stork"  # stork stance = single-leg support
    r"|seesaw"  # alternating presses
    r"|archer"  # archer pull-up / push-up load one side
    r"|elbow[- ]to[- ]knee"  # alternating ab work
    r"|punch|hook|boxing"  # boxing / shadowboxing alternates sides
    r"|crossover crunch|bicycle crunch|bicycle sit-up|bicycle"
    r"|high knees"
    r"|back and forth"  # stepping drills alternate legs
    r")",
    re.IGNORECASE,
)

# --------------------------------------------------------------------------
# 2b. Either-way keywords — patterns where the same movement can be done one
#     side at a time OR both sides together (checked after unilateral, before
#     bilateral so that e.g. "barbell twist" does not fall through to the
#     bilateral equipment fallback).
# --------------------------------------------------------------------------
EITHER_RE = re.compile(
    r"("
    r"stretch|stretching|mobility|floss"  # mobility work — no load concept
    r"|circle"  # ankle / shoulder / wrist circles
    r"|side bend|side crunch"
    r"|twist|rotat"  # twists & rotations — alternate sides
    r"|russian twist"
    r"|pallof"
    r"|balance board"
    r"|concentration"  # concentration curls — typically one arm at a time
    r"|side bent|side bend|side crunch|circular|side lying"
    r")",
    re.IGNORECASE,
)

# --------------------------------------------------------------------------
# 3. Bilateral keywords
# --------------------------------------------------------------------------
BILATERAL_RE = re.compile(
    r"("
    r"both arm|both leg|both feet|both sides"
    r"|two arm|two leg|two feet"
    r"|push[- ]?up"  # push-up / pushup
    r"|press[- ]?up"  # press-up
    r"|pull[- ]?up"
    r"|chin[- ]?up"
    r"|muscle[- ]?up"
    r"|\bdip"  # dips
    r"|\bsquat"  # squat family
    r"|deadlift"
    r"|snatch|clean|jerk"
    r"|thruster"
    r"|hip thrust"
    r"|glute bridge|hip raise|hip lift"
    r"|sit[- ]?up"
    r"|\bcrunch"
    r"|curl[- ]?up"
    r"|jackknife"
    r"|\bv[- ]?up"
    r"|plank"
    r"|superman"
    r"|back extension|hyperextension|good morning"
    r"|jumping jack|jump rope"
    r"|burpee"
    r"|\bjump"  # box jump, squat jump, star jump…
    r"|sprint|treadmill|stair"
    r"|handstand"
    r"|tire flip"
    r"|leg raise|knee raise|flutter|scissor"
    r"|calf raise"
    r"|donkey calf"
    r"|neck (flexion|extension|rotation)"
    r"|ab roller|ab wheel|wheel roll"
    r"|sled (push|drag|pull)"
    r"|rope climb"
    r"|farmer"
    r"|shrug"
    r")",
    re.IGNORECASE,
)

# --------------------------------------------------------------------------
# 4. Equipment fallback
# --------------------------------------------------------------------------
BILATERAL_EQUIP = {
    "barbell",
    "olympic barbell",
    "ez barbell",
    "trap bar",
    "smith machine",
    "leverage machine",
    "sled machine",
    "stationary bike",
    "elliptical machine",
    "skierg machine",
    "stepmill machine",
    "upper body ergometer",
    "assisted",
    "tire",
    "wheel roller",
    "body weight",
}
EITHER_EQUIP = {
    "dumbbell",
    "kettlebell",
    "band",
    "resistance band",
    "cable",
    "medicine ball",
    "bosu ball",
    "stability ball",
    "roller",
    "rope",
    "hammer",
    "weighted",
}


def normalize(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


def classify(e: dict) -> str:
    name = normalize(e["name"])
    if name in MANUAL:
        return MANUAL[name]

    # strong name patterns — "one arm row" beats "row", "single leg squat" beats "squat"
    if UNILATERAL_RE.search(name):
        return "unilateral"
    if EITHER_RE.search(name):
        return "either"
    if BILATERAL_RE.search(name):
        return "bilateral"

    equip = normalize(e.get("equipment", ""))
    if equip in BILATERAL_EQUIP:
        return "bilateral"
    if equip in EITHER_EQUIP:
        return "either"
    # unknown equipment — conservative default
    return "either"


def main() -> int:
    try:
        with open(SRC_JSON, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"failed to read {SRC_JSON}: {exc}", file=sys.stderr)
        return 1

    counts: dict[str, int] = {"unilateral": 0, "bilateral": 0, "either": 0}
    per_cat: dict[str, dict[str, int]] = {}
    leftovers: dict[str, list[str]] = {"unilateral": [], "bilateral": [], "either": []}

    out = []
    for e in data:
        side = classify(e)
        counts[side] += 1
        cat = e.get("category", "?")
        per_cat.setdefault(cat, {"unilateral": 0, "bilateral": 0, "either": 0})
        per_cat[cat][side] += 1

        trimmed = {
            "id": e["id"],
            "name": e["name"],
            "category": e.get("category", ""),
            "body_part": e.get("body_part", ""),
            "equipment": e.get("equipment", ""),
            "target": e.get("target", ""),
            "muscle_group": e.get("muscle_group", ""),
            "secondary_muscles": e.get("secondary_muscles", []),
            "image": e["image"],
            "gif_url": e["gif_url"],
            "instructions": e.get("instructions", {}).get("en", ""),
            "steps": e.get("instruction_steps", {}).get("en", []),
            "side": side,
        }
        out.append(trimmed)

        # remember equipment-fallback outcomes for spot-checking
        name = normalize(e["name"])
        if name not in MANUAL and not UNILATERAL_RE.search(name) and not BILATERAL_RE.search(name):
            leftovers[side].append(e["name"])

    out.sort(key=lambda x: x["name"].lower())

    print("=== side-type counts ===")
    for k, v in counts.items():
        print(f"  {k:11s} {v:5d}  ({v / len(data) * 100:.1f}%)")

    print("\n=== per category ===")
    for cat, d in sorted(per_cat.items()):
        total = sum(d.values())
        print(f"  {cat:12s} total {total:4d} | " + "  ".join(f"{k}={v}" for k, v in d.items()))

    print("\n=== equipment-fallback outcomes (spot check) ===")
    for side, names in leftovers.items():
        print(f"\n  [{side}] {len(names)}")
        for n in names[:40]:
            print(f"    - {n}")

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(OUT_JSON, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    except OSError as exc:
        print(f"failed to write {OUT_JSON}: {exc}", file=sys.stderr)
        return 1
    print(f"\nwrote {OUT_JSON} ({len(out)} exercises, "
          f"{OUT_JSON.stat().st_size / 1024 / 1024:.2f} MB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
