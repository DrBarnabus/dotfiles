if [[ -z "$HERDR_ENV" && ( "$_platform" != linux-wsl || -n "$WT_SESSION" ) ]] \
  && command -v herdr &>/dev/null && [[ -t 1 ]]; then
  exec herdr
fi

# Zinit plugin manager
ZINIT_HOME="${HOME}/.local/share/zinit/zinit.git"
[ ! -d $ZINIT_HOME ] && mkdir -p "$(dirname $ZINIT_HOME)"
[ ! -d $ZINIT_HOME/.git ] && git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
source "${ZINIT_HOME}/zinit.zsh"

# Zinit plugins
zinit light zsh-users/zsh-completions
zinit ice wait lucid; zinit light zsh-users/zsh-syntax-highlighting
zinit ice wait lucid atload'_zsh_autosuggest_start'; zinit light zsh-users/zsh-autosuggestions
zinit light Aloxaf/fzf-tab

# Completions (rebuild daily, skip security check otherwise)
if [[ ":$FPATH:" != *":$HOME/.zsh/completions:"* ]]; then export FPATH="$HOME/.zsh/completions:$FPATH"; fi
autoload -Uz compinit
if ! _cache zcompdump; then
  compinit -d "$_cache_file"
else
  compinit -C -d "$_cache_file"
fi
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
_cache_eval fzf fzf --zsh
_cache_eval zoxide zoxide init --cmd cd zsh

# Oh My Posh prompt
_cache_eval omp oh-my-posh init zsh --config ~/.theme.omp.toml

# Reload
alias reload='rm -rf "$_cache_dir" && source ~/.zshrc'
