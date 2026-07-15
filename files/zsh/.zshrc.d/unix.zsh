# pnpm
export PNPM_HOME="$HOME/.local/share/pnpm"
_prepend_path "$PNPM_HOME"

# .NET
export DOTNET_ROOT="$HOME/.dotnet"
_append_path "$DOTNET_ROOT"
_append_path "$DOTNET_ROOT/tools"
