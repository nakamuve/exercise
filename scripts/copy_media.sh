#!/usr/bin/env bash
# Regenerates the media assets copied from the exercises-dataset repo.
# Usage: ./scripts/copy_media.sh [path-to-exercises-dataset]
set -euo pipefail

DATASET="${1:-../exercises-dataset}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -d "$DATASET/images" || ! -d "$DATASET/videos" ]]; then
	echo "error: $DATASET does not look like the exercises-dataset repo" >&2
	exit 1
fi

mkdir -p "$ROOT/public"
cp -r "$DATASET/images" "$ROOT/public/images"
cp -r "$DATASET/videos" "$ROOT/public/videos"
cp "$DATASET/LICENSE" "$ROOT/public/DATASET-LICENSE.txt"
cp "$DATASET/NOTICE.md" "$ROOT/public/DATASET-NOTICE.md"

echo "copied media from $DATASET"
echo "  images: $(find "$ROOT/public/images" -type f | wc -l) files"
echo "  videos: $(find "$ROOT/public/videos" -type f | wc -l) files"
