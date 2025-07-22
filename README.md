# Daniel's Dotfiles

Personal dotfiles using Git and symlinks to synchronize configuration files across machines.

## Features

- **Centralized Configuration**: All dotfiles defined in a single `dotfiles.json` manifest
- **Selective Syncing**: Choose which configurations to manage
- **Platform Support**: Conditional configurations based on OS (Linux, macOS, WSL)
- **Partial File Extraction**: Extract and sync specific fields from JSON files
- **Automatic Backups**: Creates timestamped backups before any modifications
- **Symlink Management**: Bidirectional sync between repository and home directory

## Usage

Run the install script to set up all configurations:
```bash
./scripts/install.sh
```

Your configurations are now symlinked! Any changes to files in your home directory will be reflected in the repository and vice versa.

### Adding a New Configuration

Add a simple file:
```bash
./scripts/manage.sh add vim ~/.vimrc
```

Add a directory:
```bash
./scripts/manage.sh add tmux ~/.tmux.conf ~/.tmux/
```

Add with platform restrictions:
```bash
./scripts/manage.sh add bash ~/.bashrc --platform linux,wsl
```

Add with JSON field extraction:
```bash
./scripts/manage.sh add claude ~/.claude.json --extract mcpServers:mcp-servers.json
```

### Installing/Updating Configurations

Initial installation or re-sync:
```bash
./scripts/install.sh
```

Update configurations after pulling changes:
```bash
./scripts/update.sh
```

Update without git pull:
```bash
./scripts/update.sh --skip-pull
```

Preview changes without applying:
```bash
./scripts/update.sh --dry-run
```

### Managing Configurations

List all configurations:
```bash
./scripts/manage.sh list
```

Show detailed status:
```bash
./scripts/manage.sh list --verbose
```

Remove a configuration:
```bash
./scripts/manage.sh remove vim
```

## Configuration Structure

### The `dotfiles.json` Manifest

The central configuration file that defines all managed dotfiles:

```json
{
  "$schema": "./dotfiles.schema.json",
  "groups": [
    {
      "name": "vim",
      "sources": [
        {
          "path": "~/.vimrc",
          "type": "file"
        },
        {
          "path": "~/.vim/",
          "type": "directory",
          "platforms": ["linux", "darwin"]
        }
      ]
    }
  ]
}
```

### Configuration Options

- **name**: Unique identifier for the configuration
- **sources**: Array of files/directories to manage
  - **path**: Path to the file/directory (supports `~` expansion)
  - **type**: Either `"file"` or `"directory"`
  - **platforms** (optional): Array of platforms where this source applies
  - **extract** (optional): For extracting specific fields from JSON files
    - **field**: JSONPath to the field to extract
    - **target**: Filename to store the extracted content

### Repository Structure

```
~/.dotfiles/
├── dotfiles.json          # Main configuration manifest
├── dotfiles.schema.json   # JSON schema for validation
├── files/                 # Managed configuration files
│   ├── vim/
│   │   ├── .vimrc
│   │   └── .vim/
│   └── claude/
│       ├── CLAUDE.md
│       ├── settings.json
│       └── mcp-servers.json
├── scripts/
│   ├── install.sh         # Creates symlinks and imports files
│   ├── update.sh          # Updates symlinks and syncs changes
│   └── manage.sh          # Add/remove/list configurations
└── backups/               # Automatic backups (last 5 kept)
```

## Platform Support

The system automatically detects your platform:
- `linux`: Standard Linux distributions
- `darwin`: macOS
- `wsl`: Windows Subsystem for Linux

You can specify platform-specific configurations that will only be installed on matching systems.

## JSON Field Extraction

For large configuration files where you only want to track specific fields:

```bash
# Extract only the 'mcpServers' field from ~/.claude.json
./scripts/manage.sh add claude ~/.claude.json --extract mcpServers:mcp-servers.json
```

This feature:
- Extracts the specified field on first install
- Syncs changes bidirectionally on updates
- Keeps sensitive data out of version control

## Backup System

- Automatic backups created before any file modifications
- Stored in `backups/` with timestamps
- Last 5 backups kept, older ones auto-deleted
- Removed configurations archived with timestamp

## Troubleshooting

### Symlink Not Created
- Check if the source file exists
- Verify no existing file/directory at the destination
- Ensure proper permissions

### Changes Not Syncing
- Run `./scripts/update.sh` to re-sync
- Check symlink status with `./scripts/manage.sh list --verbose`
- Verify files are properly symlinked

## Advanced Usage

### Dry Run Mode
Test changes without applying them:
```bash
./scripts/update.sh --dry-run
```

### Force Reinstall
Remove all symlinks and recreate:
```bash
./scripts/manage.sh remove <config>
./scripts/install.sh
```

### Manual Symlink Verification
```bash
ls -la ~/.vimrc
# Should show: .vimrc -> /home/user/.dotfiles/files/vim/.vimrc
```
