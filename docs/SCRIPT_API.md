# Script API Documentation

This document provides detailed information about the scripts included in the dotfiles system.

## Overview

The system includes three main scripts:

- `install.sh` - Creates symlinks and imports configurations
- `update.sh` - Updates and verifies existing configurations
- `manage.sh` - Adds, removes, and lists configurations

All scripts use:

- Bash with `set -euo pipefail` for error handling
- Colored output for better readability
- Automatic backup creation
- Platform detection (Linux/macOS/WSL)

## Common Functions

### Logging Functions

All scripts include these logging functions:

- `log_info()` - Blue informational messages
- `log_success()` - Green success messages
- `log_warn()` - Yellow warning messages
- `log_error()` - Red error messages

### Utility Functions

- `expand_path()` - Expands `~` to home directory
- `check_platform_match()` - Validates platform restrictions
- `create_backup()` - Creates timestamped backups
- `cleanup_old_backups()` - Maintains last 5 backups

## install.sh

Creates symlinks from home directory to repository files.

### Usage

```bash
./scripts/install.sh [OPTIONS]
```

### Options

- `-h, --help` - Show help message
- `-v, --version` - Show version information

### Behavior

1. Reads `dotfiles.json` manifest
2. For each configuration:
   - Checks platform compatibility
   - Imports existing files to repository (if not present)
   - Creates symlinks from home to repository
   - Handles JSON field extraction
3. Creates backups before any modifications
4. Reports success/failure summary

### Exit Codes

- `0` - Success
- `1` - One or more configurations failed

### Functions

- `handle_file_source()` - Processes single file
- `handle_directory_source()` - Processes directory
- `handle_extract_source()` - Handles JSON extraction
- `process_config()` - Processes entire configuration
- `create_symlink()` - Creates individual symlink

## update.sh

Verifies and updates existing configurations.

### Usage

```bash
./scripts/update.sh [OPTIONS]
```

### Options

- `-h, --help` - Show help message
- `--skip-pull` - Skip git pull operation
- `--dry-run` - Preview changes without applying

### Behavior

1. Performs git pull (unless --skip-pull)
2. Verifies all symlinks are correct
3. Re-syncs extracted JSON fields
4. Reports any issues found
5. Cleans up old backups

### Exit Codes

- `0` - All configurations up to date
- `1` - Git conflicts or other errors

### Functions

- `verify_symlink()` - Checks symlink validity
- `sync_extracted_field()` - Updates JSON extracts
- `verify_configuration()` - Verifies entire config
- `check_git_status()` - Ensures clean git state

## manage.sh

Manages configuration entries in dotfiles.json.

### Usage

```bash
./scripts/manage.sh <command> [arguments]
```

### Commands

#### add

Add new configuration to dotfiles.json

```bash
./scripts/manage.sh add <name> <path1> [path2...] [OPTIONS]
```

Options:

- `--platform <platforms>` - Comma-separated platform list
- `--extract <field:target>` - JSON extraction spec

Examples:

```bash
# Add single file
./scripts/manage.sh add vim ~/.vimrc

# Add multiple paths
./scripts/manage.sh add shell ~/.bashrc ~/.bash_profile ~/.aliases

# Platform-specific
./scripts/manage.sh add macos ~/Library/Preferences/ --platform darwin

# JSON extraction
./scripts/manage.sh add app ~/.app.json --extract settings:app-settings.json
```

#### remove

Remove configuration and associated symlinks

```bash
./scripts/manage.sh remove <name>
```

Behavior:

- Removes symlinks from home directory
- Archives configuration to `backups/removed_<timestamp>_<name>/`
- Updates dotfiles.json

#### list

List all configurations

```bash
./scripts/manage.sh list [OPTIONS]
```

Options:

- `-v, --verbose` - Show detailed information including:
  - Individual source paths
  - Symlink status (ok/missing/broken/not-symlink)
  - Platform restrictions
  - Extract specifications

### Exit Codes

- `0` - Success
- `1` - Invalid arguments or operation failed

### Functions

- `add_configuration()` - Adds new config entry
- `remove_configuration()` - Removes config and symlinks
- `list_configurations()` - Displays all file groups
- `update_manifest()` - Safely updates dotfiles.json
- `parse_json()` - JSON parsing wrapper
- `check_symlink_status()` - Determines symlink state

## Error Handling

All scripts implement consistent error handling:

1. **set -euo pipefail**: Exit on error, undefined variables, pipe failures
2. **Validation**: Check arguments and file existence
3. **Backups**: Create before any destructive operation
4. **Atomic Operations**: Use temporary files for updates
5. **Cleanup**: Remove temporary files on exit

## Platform Detection

Platform detection logic:

```bash
case "$(uname -s)" in
    Linux*)
        if grep -qi microsoft /proc/version 2>/dev/null; then
            platform="wsl"
        else
            platform="linux"
        fi
        ;;
    Darwin*)
        platform="darwin"
        ;;
    *)
        platform="unknown"
        ;;
esac
```

## JSON Processing

All scripts use `jq` for JSON processing:

- Required dependency
- No Python fallback
- Validates JSON structure
- Handles missing fields gracefully

## Backup Management

Backup directory structure:

```
backups/
├── 2025-07-22_120402/     # Timestamped backups
├── 2025-07-22_121045/
└── removed_20250722_120102_vim/  # Archived file groups
```

Automatic cleanup keeps last 5 timestamped backups.

## Development Guidelines

When modifying scripts:

1. **Maintain Compatibility**: Test on Linux, macOS, WSL
2. **Use Consistent Style**: Match existing code patterns
3. **Add Error Handling**: Validate inputs, check returns
4. **Update Documentation**: Keep this file current
5. **Test Edge Cases**: Empty files, broken symlinks, etc.

## Testing

Test script modifications:

```bash
# Create test configuration
./scripts/manage.sh add test ~/test-file

# Verify installation
./scripts/install.sh

# Check updates
./scripts/update.sh --dry-run

# Clean up
./scripts/manage.sh remove test
```

## Debugging

Enable debug output:

```bash
# Run with bash debugging
bash -x ./scripts/install.sh

# Check specific function
type function_name
```
