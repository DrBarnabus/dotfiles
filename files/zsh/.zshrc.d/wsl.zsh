# .NET
export DOTNET_ROOT="$HOME/.dotnet"
export PATH=$PATH:$DOTNET_ROOT:$DOTNET_ROOT/tools

# Open URLs in the Windows default browser
export BROWSER=wsl-open

# Report cwd to Windows Terminal for pane splitting
autoload -Uz add-zsh-hook
_wt_osc9_9() { printf '\e]9;9;%s\e\\' "$(wslpath -w "$PWD")" }
add-zsh-hook precmd _wt_osc9_9
