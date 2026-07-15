# Daily-cached shell-init evaluation (zsh-only)

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
  command -v "$1" &>/dev/null || return

  if [[ "$_platform" != windows ]]; then
    eval "$("$@" 2>/dev/null)"
    return
  fi

  # Key on the full command so a flag/config change auto-invalidates.
  local key="$name-${${(j.:.)@}//[^A-Za-z0-9]/_}"
  if ! _cache "$key"; then
    local tmp="$_cache_file.tmp.$$"
    if "$@" > "$tmp" 2>/dev/null && [[ -s "$tmp" ]]; then
      mv -f "$tmp" "$_cache_file"
    else
      rm -f "$tmp"
      eval "$("$@" 2>/dev/null)"   # fall back fresh; never freeze a broken cache
      return
    fi
  fi
  source "$_cache_file"
}
