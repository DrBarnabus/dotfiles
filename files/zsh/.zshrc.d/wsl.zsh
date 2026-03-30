# .NET
export DOTNET_ROOT="$HOME/.dotnet"
export PATH=$PATH:$DOTNET_ROOT:$DOTNET_ROOT/tools

# Open URLs in the Windows default browser
export BROWSER=wsl-open

# Report cwd to Windows Terminal for pane splitting
_wt_enable_cwd_reporting wslpath
