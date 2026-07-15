export MSYS=winsymlinks:nativestrict
export XDG_CONFIG_HOME=~/.config

# Launch zsh for interactive sessions
if [[ $- == *i* ]] && command -v zsh &>/dev/null; then
  exec zsh
fi

# Non-interactive bash
source "$HOME/.config/shell/platform.sh"
source "$HOME/.config/shell/path.sh"
source "$HOME/.config/shell/aliases.sh"
source "$HOME/.config/shell/tools.sh"
