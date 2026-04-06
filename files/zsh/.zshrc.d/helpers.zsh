# Shared helpers sourced early in .zshrc.

_cache_today=$(date +%Y%m%d)

# Check whether a daily cache file exists for the given name.
# Sets _cache_file to the resolved path. Returns 1 if stale/missing.
# rm -rf ~/.cache/zsh to force regeneration.
_cache() {
  local name=$1
  local cache_dir="${XDG_CACHE_HOME:-$HOME/.cache}/zsh"
  _cache_file="$cache_dir/$name-$_cache_today"

  if [[ -f "$_cache_file" ]]; then
    return 0
  fi

  mkdir -p "$cache_dir"
  setopt local_options null_glob
  rm -f "$cache_dir/"$name-*
  return 1
}

# Run a command, cache its output, and source it. Rebuilds daily.
_cache_eval() {
  local name=$1; shift
  if ! _cache "$name"; then
    "$@" > "$_cache_file" 2>/dev/null
  fi
  source "$_cache_file"
}
