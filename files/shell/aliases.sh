alias grep='grep --color'
alias rgi='rg -i'
alias rgf='rg -l'
alias rga='rg -uu'
alias cat='bat --paging=never'

# Interactive shells only: eza reads a path list from stdin when stdin is not a
# TTY, so it hangs under tool runners (e.g. Claude Code) that leave stdin open.
case $- in
  *i*)
    alias ls='eza --color=auto --icons=auto --group-directories-first'
    alias ll='eza --color=auto --icons=auto --group-directories-first -lh --git'
    alias tree='eza --color=auto --icons=auto --group-directories-first --tree'
    ;;
esac

alias vim='nvim'
