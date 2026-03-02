export MSYS=winsymlinks:nativestrict
export XDG_CONFIG_HOME=~/.config

# Launch zsh for interactive sessions
if [[ $- == *i* ]] && command -v zsh &>/dev/null; then
  exec zsh
fi
