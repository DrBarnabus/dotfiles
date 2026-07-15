# Shared helpers sourced early in .zshrc.

# Sets _platform to darwin | linux | linux-wsl | windows.
# WSL is a linux variant; match it agnostically with [[ $_platform == linux* ]].
case "$OSTYPE" in
  darwin*) _platform=darwin ;;
  linux-gnu*) grep -qi microsoft /proc/version 2>/dev/null && _platform=linux-wsl || _platform=linux ;;
  cygwin*|msys*) _platform=windows ;;
esac

_cache_today=$(date +%Y%m%d)
_cache_dir="${XDG_CACHE_HOME:-$HOME/.cache}/zsh"

# Check whether a daily cache file exists for the given name.
# Sets _cache_file to the resolved path. Returns 1 if stale/missing.
# rm -rf $_cache_dir to force regeneration.
_cache() {
  local name=$1
  _cache_file="$_cache_dir/$name-$_cache_today"

  if [[ -f "$_cache_file" ]]; then
    return 0
  fi

  mkdir -p "$_cache_dir"
  setopt local_options null_glob
  rm -f "$_cache_dir/"$name-*
  return 1
}

# Run a command, cache its output, and source it. Rebuilds daily.
# Caching only pays off on Windows, where process spawns are slow; elsewhere
# evaluate fresh to avoid serving stale init output.
_cache_eval() {
  local name=$1; shift
  if [[ "$_platform" != windows ]]; then
    eval "$("$@" 2>/dev/null)"
    return
  fi

  if ! _cache "$name"; then
    "$@" > "$_cache_file" 2>/dev/null
  fi
  source "$_cache_file"
}
