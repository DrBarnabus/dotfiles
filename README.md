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

### Windows Prerequisites

1. **Git for Windows** (provides Git Bash)
2. **jq**: `winget install jqlang.jq`
3. **Developer Mode**: Settings > For Developers > Developer Mode (grants symlink permission)
4. **Native symlinks** — add to `~/.bashrc`:
   ```bash
   export MSYS=winsymlinks:nativestrict
   ```

For tools that use different paths on Windows, prefer setting `XDG_CONFIG_HOME=~/.config` for XDG-aware tools. Use `path_overrides` in `dotfiles.json` for tools that ignore XDG.
