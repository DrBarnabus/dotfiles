source "$HOME/.zshrc.d/helpers.zsh"

# Environment configuration
[[ -f "$HOME/.zshrc.d/env.zsh" ]] && source "$HOME/.zshrc.d/env.zsh"

# Platform-specific configuration
case "$_platform" in
  darwin) source "$HOME/.zshrc.d/darwin.zsh" ;;
  linux*) source "$HOME/.zshrc.d/linux.zsh"; [[ "$_platform" == linux-wsl ]] && source "$HOME/.zshrc.d/wsl.zsh" ;;
  windows) source "$HOME/.zshrc.d/windows.zsh" ;;
esac

export PATH="$HOME/.local/bin:$PATH"
[ -s "$HOME/.local/bin/env" ] && . "$HOME/.local/bin/env"

# fnm
eval "$(fnm env --use-on-cd --shell zsh)"

# Deno
[ -s "$HOME/.deno/env" ] && . "$HOME/.deno/env"

# Interactive shell configuration
[[ $- == *i* ]] && source "$HOME/.zshrc.d/interactive.zsh"
