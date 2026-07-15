# Shared POSIX shell config (bash + zsh)
source "$HOME/.config/shell/platform.sh"
source "$HOME/.config/shell/path.sh"
source "$HOME/.config/shell/aliases.sh"

# Cache helpers
source "$HOME/.zshrc.d/cache.zsh"

# Machine-local secrets
[[ -f "$HOME/.zshrc.d/env.zsh" ]] && source "$HOME/.zshrc.d/env.zsh"

# Platform-specific configuration
case "$_platform" in
  darwin) source "$HOME/.zshrc.d/unix.zsh"; source "$HOME/.zshrc.d/darwin.zsh" ;;
  linux*) source "$HOME/.zshrc.d/unix.zsh"; source "$HOME/.zshrc.d/linux.zsh"; [[ "$_platform" == linux-wsl ]] && source "$HOME/.zshrc.d/wsl.zsh" ;;
  windows) source "$HOME/.zshrc.d/windows.zsh" ;;
esac

# Tool bootstrap
source "$HOME/.config/shell/tools.sh"

# Interactive shell configuration
[[ $- == *i* ]] && source "$HOME/.zshrc.d/interactive.zsh"
