# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is Daniel's personal dotfiles repository that synchronizes configuration files across machines using Git and symlinks. It provides a structured way to version control configurations while supporting partial file extraction for sensitive data management.

## Core Architecture

### Configuration Flow

1. **dotfiles.json** - Central manifest defining all managed configurations
2. **files/** - Repository storage for actual configuration files
3. **Home directory** - Symlinks point from original locations to repo files

### Key Concepts

**Extract Feature**: For large config files where only part needs version control (e.g., extracting `mcpServers` from `~/.claude.json`):

- On first install: Extracts specified field FROM home TO repo
- On subsequent runs: Syncs FROM repo TO home
- Allows tracking partial files without exposing entire files

**Symlink Management**: Regular files/directories are symlinked directly, allowing bidirectional sync.

**Directory Symlink Modes**: Directories can be handled in two ways:

- `contents` (default): Copies directory contents to repo and symlinks the directory
- `directory`: Symlinks the entire directory as-is, storing it directly in the config folder

## Common Commands

### Adding Configurations

```bash
# Add simple files/directories
./scripts/manage.sh add vim ~/.vimrc ~/.vim/

# Add with JSON field extraction
./scripts/manage.sh add claude ~/.claude.json --extract mcpServers:mcp-servers.json

# Add with platform restrictions
./scripts/manage.sh add shell ~/.bashrc --platform linux,wsl

# Add directory with whole-folder symlink (new feature)
./scripts/manage.sh add nvim ~/.config/nvim --symlink-mode directory
```

### Installation and Updates

```bash
# Initial setup or re-sync (creates symlinks, imports files)
./scripts/install.sh

# Pull changes and verify all configurations
./scripts/update.sh

# Update without git pull (useful for testing)
./scripts/update.sh --skip-pull

# Preview changes without applying
./scripts/update.sh --dry-run
```

### Managing Configurations

```bash
# List all configurations
./scripts/manage.sh list

# Show detailed status with symlink verification
./scripts/manage.sh list --verbose

# Remove configuration (archives to backups/)
./scripts/manage.sh remove vim
```

## Script Behavior Notes

1. **Arithmetic Operations**: Scripts use `var=$((var + 1))` instead of `((var++))` due to `set -e` compatibility

2. **JSON Parsing**: All scripts require `jq` - no Python fallback

3. **Extract Workflow**:
   - manage.sh: Skips copying files with extract specs
   - install.sh: Checks if repo file exists to determine sync direction
   - update.sh: Always syncs extracted content FROM repo TO home

4. **Backup Strategy**:
   - Automatic backups before modifications
   - Keeps last 5 backups, auto-cleanup of older ones
   - Removed file groups archived with timestamp

## Testing Workflow

1. Create test configuration: `./scripts/manage.sh add test ~/test-config`
2. Verify symlinks: `./scripts/manage.sh list --verbose`
3. Test extraction: Edit extracted JSON in repo, run `./scripts/update.sh --skip-pull`
4. Clean up: `./scripts/manage.sh remove test`

## Important Implementation Details

- Platform detection supports: linux, darwin, wsl
- Symlinks are never overwritten if pointing elsewhere (safety)
- Empty JSON objects created for missing extract fields
- Sources array parsing uses `jq -c '.[]'` with process substitution to avoid subshell issues
