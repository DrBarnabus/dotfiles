# Sets _platform to darwin | linux | linux-wsl | windows.
# WSL is a linux variant; match it agnostically with `case $_platform in linux*)`.
case "$OSTYPE" in
  darwin*) _platform=darwin ;;
  linux-gnu*) grep -qi microsoft /proc/version 2>/dev/null && _platform=linux-wsl || _platform=linux ;;
  cygwin*|msys*) _platform=windows ;;
esac

# Sets _shell to zsh | bash.
if [ -n "$ZSH_VERSION" ]; then
  _shell=zsh
elif [ -n "$BASH_VERSION" ]; then
  _shell=bash
fi
