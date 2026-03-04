#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"
release_dir="$HOME/Downloads/release"

chrome_dist_dir="$repo_root/dist_chrome"
firefox_dist_dir="$repo_root/dist_firefox"

chrome_zip_path="$release_dir/chrome.zip"
firefox_zip_path="$release_dir/firefox.zip"
source_zip_path="$release_dir/source.zip"
changelog_temp_path="$repo_root/changelogs.txt"
changelog_path="$release_dir/changelogs.txt"

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Required command not found: $cmd" >&2
    exit 1
  fi
}

zip_directory_content() {
  local source_dir="$1"
  local zip_path="$2"

  if [[ ! -d "$source_dir" ]]; then
    echo "Directory not found: $source_dir" >&2
    exit 1
  fi

  rm -f "$zip_path"
  (
    cd "$source_dir"
    zip -r -q "$zip_path" . -x "*/.vite/*" ".vite/*"
  )
}

create_source_zip() {
  local latest_commit
  latest_commit="$(git -C "$repo_root" rev-parse --verify HEAD)"
  if [[ -z "$latest_commit" ]]; then
    echo "Unable to resolve latest commit (HEAD)." >&2
    exit 1
  fi

  rm -f "$source_zip_path"
  git -C "$repo_root" archive --format=zip --output="$source_zip_path" "$latest_commit"
}

create_changelog_file() {
  mapfile -t tags < <(git -C "$repo_root" for-each-ref --sort=-creatordate --format="%(refname:strip=2)" refs/tags)
  if (( ${#tags[@]} < 2 )); then
    echo "At least two tags are required to generate changelog." >&2
    exit 1
  fi

  local latest_tag="${tags[0]}"
  local previous_tag="${tags[1]}"

  {
    echo "$previous_tag..$latest_tag"
    echo
    git -C "$repo_root" log "$previous_tag..$latest_tag" --pretty=format:"%s"
  } > "$changelog_temp_path"
}

main() {
  require_command git
  require_command pnpm
  require_command zip

  mkdir -p "$release_dir"

  (
    cd "$repo_root"
    pnpm build:firefox
    pnpm build:chrome
  )

  zip_directory_content "$chrome_dist_dir" "$chrome_zip_path"
  zip_directory_content "$firefox_dist_dir" "$firefox_zip_path"

  create_source_zip
  create_changelog_file
  mv -f "$changelog_temp_path" "$changelog_path"

  echo "Release packages created:"
  echo "  $chrome_zip_path"
  echo "  $firefox_zip_path"
  echo "  $source_zip_path"
  echo "  $changelog_path"
}

main "$@"
