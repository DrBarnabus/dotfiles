[ -s "$HOME/.local/bin/env" ] && . "$HOME/.local/bin/env"
export PATH="$HOME/.local/bin:$PATH"

# Platform-specific configuration
if [[ "$OSTYPE" == "darwin"* ]]; then
  [[ -f "$HOME/.zshrc.d/darwin.zsh" ]] && source "$HOME/.zshrc.d/darwin.zsh"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  [[ -f "$HOME/.zshrc.d/linux.zsh" ]] && source "$HOME/.zshrc.d/linux.zsh"
  if grep -qi microsoft /proc/version 2>/dev/null; then
    [[ -f "$HOME/.zshrc.d/wsl.zsh" ]] && source "$HOME/.zshrc.d/wsl.zsh"
  fi
elif [[ "$OSTYPE" == cygwin* || "$OSTYPE" == msys* ]]; then
  [[ -f "$HOME/.zshrc.d/windows.zsh" ]] && source "$HOME/.zshrc.d/windows.zsh"
fi

# Deno
if [[ ":$FPATH:" != *":$HOME/.zsh/completions:"* ]]; then export FPATH="$HOME/.zsh/completions:$FPATH"; fi
[ -s "$HOME/.deno/env" ] && . "$HOME/.deno/env"

# Aliases (available in scripts too)
alias grep='grep --color'
alias cat='bat --paging=never'
alias ls='eza --color=auto --icons=auto --group-directories-first'
alias ll='eza --color=auto --icons=auto --group-directories-first -lh --git'
alias tree='eza --color=auto --icons=auto --group-directories-first --tree'
alias vim='nvim'

# Interactive shell configuration
if [[ $- == *i* ]]; then
  # Zinit plugin manager
  ZINIT_HOME="${HOME}/.local/share/zinit/zinit.git"
  [ ! -d $ZINIT_HOME ] && mkdir -p "$(dirname $ZINIT_HOME)"
  [ ! -d $ZINIT_HOME/.git ] && git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
  source "${ZINIT_HOME}/zinit.zsh"

  # Zinit plugins
  zinit light zsh-users/zsh-syntax-highlighting
  zinit light zsh-users/zsh-completions
  zinit light zsh-users/zsh-autosuggestions
  zinit light Aloxaf/fzf-tab

  # Completions
  autoload -Uz compinit && compinit
  zinit cdreplay -q

  # Keybindings
  bindkey -e
  bindkey '^p' history-search-backward
  bindkey '^n' history-search-forward
  bindkey "^[[3~" delete-char
  bindkey '^[[1;5D' backward-word
  bindkey '^[[1;5C' forward-word

  # History
  HISTSIZE=5000
  SAVEHIST=$HISTSIZE
  HISTFILE=~/.histfile
  HISTDUP=erase
  setopt appendhistory
  setopt sharehistory
  setopt hist_ignore_space
  setopt hist_ignore_all_dups
  setopt hist_save_no_dups
  setopt hist_ignore_dups
  setopt hist_find_no_dups

  # Completion styling
  zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
  zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
  zstyle ':completion:*' menu no
  zstyle ':fzf-tab:complete:cd:*' fzf-preview 'eza --color=always --icons=auto $realpath'
  zstyle ':fzf-tab:complete:__zoxide_z:*' fzf-preview 'eza --color=always --icons=auto $realpath'

  # Shell integrations
  eval "$(fzf --zsh)"
  eval "$(zoxide init --cmd cd zsh)"

  # Oh My Posh prompt
  eval "$(oh-my-posh init zsh --config ~/.theme.omp.toml)"
fi
