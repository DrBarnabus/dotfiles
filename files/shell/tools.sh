# fnm/deno/local-bin bootstrap
[ -s "$HOME/.local/bin/env" ] && . "$HOME/.local/bin/env"

if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env --use-on-cd --shell "$_shell")"
fi

[ -s "$HOME/.deno/env" ] && . "$HOME/.deno/env"
