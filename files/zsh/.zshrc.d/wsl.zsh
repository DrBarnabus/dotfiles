# Stop Windows Volta infecting WSL PATH
export PATH=$(echo "$PATH" | tr ':' '\n' | grep -v "/mnt/c/Users/.*/Volta" | grep -v "/mnt/c/Program Files/Volta" | tr '\n' ':' | sed 's/:$//')

# NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Open URLs in the Windows default browser
export BROWSER=wsl-open
