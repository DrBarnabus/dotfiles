export MSYS=winsymlinks:nativestrict
export XDG_CONFIG_HOME=~/.config

# Launch zsh for interactive sessions
if [[ $- == *i* ]] && command -v zsh &>/dev/null; then
  exec zsh
else
  export PATH="$HOME/.local/bin:$PATH"
  [ -s "$HOME/.local/bin/env" ] && . "$HOME/.local/bin/env"

  command -v fnm &>/dev/null && eval "$(fnm env --use-on-cd --shell bash)"
  [ -s "$HOME/.deno/env" ] && . "$HOME/.deno/env"
fi
