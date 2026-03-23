# Report cwd to Windows Terminal for pane splitting
autoload -Uz add-zsh-hook
_wt_osc9_9() { printf '\e]9;9;%s\e\\' "$(cygpath -w "$PWD")" }
add-zsh-hook precmd _wt_osc9_9
