# Neovim
export PATH="$PATH:/opt/nvim-linux-x86_64/bin"

# Homebrew
if [[ -f /home/linuxbrew/.linuxbrew/bin/brew ]]; then
  eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv)"
fi

# ls colour support
export LS_COLOR_FLAG='--color'
alias ls='ls --color'
