# CLAUDE.md

Personal dotfiles repository — syncs configuration files across machines using Git and symlinks, with support for partial file extraction.

## Key Concepts

**Extract Feature**: For config files where only part needs version control (e.g., extracting `mcpServers` from `~/.claude.json`):

- On first install: Extracts specified field FROM home TO repo
- On subsequent runs: Syncs FROM repo TO home

**Directory Symlink Modes**:

- `contents` (default): Copies directory contents to repo and symlinks the directory
- `directory`: Symlinks the entire directory as-is, storing it directly in the config folder

**Path Overrides**: For tools that use different config paths on certain platforms, use `path_overrides` in source entries:

```json
{
  "path": "~/.config/sometool",
  "type": "directory",
  "path_overrides": {
    "windows": "~/AppData/Local/sometool"
  }
}
```

Prefer setting `XDG_CONFIG_HOME=~/.config` for XDG-aware tools; use `path_overrides` only when a tool ignores XDG on a specific platform.

## Common Commands

```bash
./scripts/install.sh                # Initial setup or re-sync
./scripts/update.sh                 # Pull changes and verify configs
./scripts/update.sh --skip-pull     # Update without git pull
./scripts/update.sh --dry-run       # Preview changes without applying
./scripts/manage.sh list --verbose  # Show status with symlink verification
./scripts/manage.sh remove vim      # Remove config (archives to backups/)

# Adding configurations
./scripts/manage.sh add vim ~/.vimrc ~/.vim/
./scripts/manage.sh add claude ~/.claude.json --extract mcpServers:mcp-servers.json
./scripts/manage.sh add shell ~/.bashrc --platform linux,wsl
./scripts/manage.sh add zsh ~/.zshrc
./scripts/manage.sh add nvim ~/.config/nvim --symlink-mode directory
```

## Implementation Notes

- All scripts require `jq` — no fallback
- Scripts use `var=$((var + 1))` instead of `((var++))` due to `set -e` compatibility
- Extract sync direction varies per script: manage.sh skips extract files, install.sh checks repo file existence to pick direction, update.sh always syncs FROM repo TO home
- Sources array parsing uses `jq -c '.[]'` with process substitution to avoid subshell issues
- Platform detection supports: linux, darwin, wsl, windows (Git Bash/MSYS2)
- Platform filters support `!` negation (e.g. `["!windows"]` matches all except Windows)
- On Windows, real NTFS symlinks require Developer Mode + `MSYS=winsymlinks:nativestrict`
- Symlinks are never overwritten if pointing elsewhere (safety)
