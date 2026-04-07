# Daniel's Dotfiles

Personal dotfiles using Git and symlinks to synchronise configuration files across machines, with support for platform-specific configs and partial JSON file extraction.

## Quick Start

```bash
./scripts/install.sh    # Initial setup (creates symlinks, imports files)
./scripts/update.sh     # Pull changes and re-sync
```

## Managing Configurations

```bash
# Adding configurations
./scripts/manage.sh add vim ~/.vimrc ~/.vim/
./scripts/manage.sh add bash ~/.bashrc --platform linux,wsl
./scripts/manage.sh add zsh ~/.zshrc --platform '!windows'
./scripts/manage.sh add nvim ~/.config/nvim --symlink-mode directory
./scripts/manage.sh add claude ~/.claude.json --extract mcpServers:mcp-servers.json

# Listing and removing
./scripts/manage.sh list --verbose
./scripts/manage.sh remove vim

# Update options
./scripts/update.sh --skip-pull    # Update without git pull
./scripts/update.sh --dry-run      # Preview changes without applying
```

## Configuration Structure

All dotfiles are defined in `dotfiles.json`:

```json
{
  "$schema": "./dotfiles.schema.json",
  "groups": [
    {
      "name": "vim",
      "sources": [
        { "path": "~/.vimrc", "type": "file" },
        { "path": "~/.vim/", "type": "directory", "platforms": ["linux", "darwin"] }
      ]
    }
  ]
}
```

### Source Options

- **path**: Path to the file/directory (supports `~` expansion)
- **type**: `"file"` or `"directory"`
- **platforms** (optional): Array of platforms to include. Prefix with `!` to exclude (e.g. `["!windows"]`)
- **extract** (optional): Extract a specific field from a JSON file (`field` + `target` filename)
- **path_overrides** (optional): Platform-specific path overrides (e.g. `{"windows": "~/AppData/Local/tool"}`)
- **symlink_mode** (optional): `"contents"` (default) copies directory contents; `"directory"` symlinks the whole folder

### Repository Layout

```
~/.dotfiles/
├── dotfiles.json          # Configuration manifest
├── dotfiles.schema.json   # JSON schema for validation
├── files/                 # Managed configuration files
├── scripts/
│   ├── lib.sh             # Shared utility functions
│   ├── install.sh         # Creates symlinks and imports files
│   ├── update.sh          # Updates symlinks and syncs changes
│   └── manage.sh          # Add/remove/list configurations
└── backups/               # Automatic backups (last 5 kept)
```

## Platform Support

Detected automatically: `linux`, `darwin`, `wsl`, `windows` (Git Bash/MSYS2).

### Dependencies

- **git** — Version control
- **jq** — JSON parsing
- **zsh** — Shell
- **neovim** — Editor
- **tmux** — Terminal multiplexer (not used on Windows)
- **bat** — File viewer (replaces cat)
- **eza** — File listing (replaces ls)
- **fzf** — Fuzzy finder
- **zoxide** — Smart directory navigation
- **git-delta** — Git diff viewer
- **oh-my-posh** — Shell prompt theme
- **fnm** — Node.js version manager
- **Node.js** — JavaScript runtime (installed via fnm)
- **make** — Build tool
- **gcc** — C compiler
- **llvm** — Compiler toolchain (needed by tree-sitter-cli)
- **ripgrep** — Fast text search (needed by Neovim Telescope)
- **fd** — Fast file finder (needed by Neovim Telescope)
- **tree-sitter-cli** — Parser generator (needed by Neovim treesitter, installed via cargo)

The following auto-install on first launch and do not need manual setup:

- [Zinit](https://github.com/zdharma-continuum/zinit) — Zsh plugin manager
- [lazy.nvim](https://github.com/folke/lazy.nvim) — Neovim plugin manager
- [Mason](https://github.com/williamboman/mason.nvim) — Neovim LSP/formatter installer
- [TPM](https://github.com/tmux-plugins/tpm) — Tmux plugin manager

### Windows

1. Install [Git for Windows](https://gitforwindows.org) (provides Git Bash)
2. Install zsh into Git for Windows — download the [zsh MSYS2 package](https://packages.msys2.org/packages/zsh), extract with `zstd` and copy into the Git for Windows install directory
3. Enable **Developer Mode**: Settings > For Developers (grants symlink permission)
4. Enable native symlinks for the initial install (the managed `.bashrc` handles this afterwards):
   ```bash
   export MSYS=winsymlinks:nativestrict
   ```
5. Install tools:
   ```bash
   winget install jqlang.jq Neovim.Neovim junegunn.fzf ajeetdsouza.zoxide sharkdp.bat eza-community.eza dandavison.delta JanDeDobbeleer.OhMyPosh Schniz.fnm LLVM.LLVM BurntSushi.ripgrep.MSVC sharkdp.fd
   cargo install --locked tree-sitter-cli
   fnm install --lts
   corepack prepare pnpm@latest --activate
   ```

For tools that use different paths on Windows, prefer setting `XDG_CONFIG_HOME=~/.config` for XDG-aware tools. Use `path_overrides` in `dotfiles.json` for tools that ignore XDG.

### Linux / WSL

```bash
sudo apt install git jq zsh build-essential
```

Install [Homebrew on Linux](https://docs.brew.sh/Homebrew-on-Linux), then:

```bash
brew install neovim tmux fzf zoxide bat eza git-delta oh-my-posh fnm llvm ripgrep fd
cargo install --locked tree-sitter-cli
fnm install --lts
corepack prepare pnpm@latest --activate
pnpm add -g wsl-open
chsh -s $(which zsh)
```

### macOS

```bash
xcode-select --install
```

Install [Homebrew](https://brew.sh), then:

```bash
brew install jq neovim tmux fzf zoxide bat eza git-delta oh-my-posh fnm llvm ripgrep fd
cargo install --locked tree-sitter-cli
fnm install --lts
corepack prepare pnpm@latest --activate
```
