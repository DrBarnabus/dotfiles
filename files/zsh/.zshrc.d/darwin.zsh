# Homebrew
if [[ -f /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [[ -f /usr/local/bin/brew ]]; then
  eval "$(/usr/local/bin/brew shellenv)"
fi

# .NET
export DOTNET_ROOT="$HOME/.dotnet"
export PATH=$PATH:$DOTNET_ROOT:$DOTNET_ROOT/tools
