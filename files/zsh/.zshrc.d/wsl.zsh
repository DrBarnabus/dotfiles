# Stop Windows Volta infecting WSL PATH
export PATH=$(echo "$PATH" | tr ':' '\n' | grep -v "/mnt/c/Users/.*/Volta" | grep -v "/mnt/c/Program Files/Volta" | tr '\n' ':' | sed 's/:$//')

# NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# pnpm
export PNPM_HOME="$HOME/.local/share/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

# .NET
export DOTNET_ROOT="$HOME/.dotnet"
export PATH=$PATH:$DOTNET_ROOT:$DOTNET_ROOT/tools

# Open URLs in the Windows default browser
export BROWSER=wsl-open
