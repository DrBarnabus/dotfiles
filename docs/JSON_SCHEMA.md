# JSON Schema Documentation

This document provides detailed information about the `dotfiles.json` manifest file structure and all available options.

## Schema Overview

The `dotfiles.json` file uses JSON Schema for validation. The schema file is located at `dotfiles.schema.json`.

## Basic Structure

```json
{
  "$schema": "./dotfiles.schema.json",
  "groups": [
    {
      "name": "configuration-name",
      "sources": [
        {
          "path": "~/path/to/file",
          "type": "file"
        }
      ]
    }
  ]
}
```

## Root Object

| Property  | Type   | Required | Description                                      |
| --------- | ------ | -------- | ------------------------------------------------ |
| `$schema` | string | No       | Reference to the JSON schema file for validation |
| `groups`  | array  | Yes      | Array of file group objects                      |

## File Group Object

Each file group in the `groups` array has the following properties:

| Property  | Type   | Required | Description                                                                 |
| --------- | ------ | -------- | --------------------------------------------------------------------------- |
| `name`    | string | Yes      | Unique identifier for the file group. Used as directory name under `files/` |
| `sources` | array  | Yes      | Array of source objects defining files/directories to manage                |

### Naming Conventions

- Use lowercase letters, numbers, and hyphens
- Avoid spaces and special characters
- Examples: `vim`, `git-config`, `shell-aliases`

## Source Object

Each source in the `sources` array defines a file or directory to manage:

| Property    | Type   | Required | Description                                         |
| ----------- | ------ | -------- | --------------------------------------------------- |
| `path`      | string | Yes      | Path to the file/directory (supports `~` expansion) |
| `type`      | string | Yes      | Either `"file"` or `"directory"`                    |
| `platforms` | array  | No       | List of platforms where this source applies         |
| `extract`   | object | No       | JSON extraction configuration (file type only)      |

### Path Property

- Supports tilde (`~`) expansion for home directory
- Must be absolute paths or start with `~`
- Examples:
  - `"~/.vimrc"`
  - `"~/.config/nvim/"`
  - `"/etc/hosts"` (requires appropriate permissions)

### Type Property

- `"file"`: Single file symlink
- `"directory"`: Directory symlink (not recursive - entire directory is symlinked)

### Platforms Array

Available platform values:

- `"linux"`: Standard Linux distributions
- `"darwin"`: macOS
- `"wsl"`: Windows Subsystem for Linux

If not specified, the source applies to all platforms.

## Extract Object

For JSON files where you only want to track specific fields:

| Property | Type   | Required | Description                         |
| -------- | ------ | -------- | ----------------------------------- |
| `field`  | string | Yes      | JSONPath to the field to extract    |
| `target` | string | Yes      | Filename to store extracted content |

### Extract Behavior

1. **First Install**: Extracts specified field FROM home TO repository
2. **Updates**: Syncs FROM repository TO home file
3. **Missing Field**: Creates empty object `{}`

## Complete Example

```json
{
  "$schema": "./dotfiles.schema.json",
  "groups": [
    {
      "name": "shell",
      "sources": [
        {
          "path": "~/.bashrc",
          "type": "file",
          "platforms": ["linux", "wsl"]
        },
        {
          "path": "~/.zshrc",
          "type": "file",
          "platforms": ["darwin"]
        },
        {
          "path": "~/.config/shell/",
          "type": "directory"
        }
      ]
    },
    {
      "name": "git",
      "sources": [
        {
          "path": "~/.gitconfig",
          "type": "file"
        },
        {
          "path": "~/.gitignore_global",
          "type": "file"
        }
      ]
    },
    {
      "name": "claude",
      "sources": [
        {
          "path": "~/.claude.json",
          "type": "file",
          "extract": {
            "field": "mcpServers",
            "target": "mcp-servers.json"
          }
        },
        {
          "path": "~/.claude/settings.json",
          "type": "file"
        }
      ]
    }
  ]
}
```

## Validation

The schema validates:

- Required properties are present
- Property types are correct
- `type` is either "file" or "directory"
- `platforms` contains valid platform identifiers
- `name` is unique across file groups

To validate manually:

```bash
# Using a JSON schema validator tool
jsonschema -i dotfiles.json dotfiles.schema.json
```

## Best Practices

1. **Group Related Files**: Keep related files together (e.g., all vim files in one group)
2. **Use Platform Restrictions**: Only sync platform-specific files where they're needed
3. **Extract Sensitive Data**: Use the extract feature to keep private data out of the repository
4. **Consistent Naming**: Use descriptive, consistent names for file groups
5. **Document Complex Configs**: Add comments in your CLAUDE.md or README about complex setups

## Migration Guide

### From Individual Symlinks

1. List your existing symlinks: `find ~ -type l -ls`
2. Group related files into file groups
3. Add each group to `dotfiles.json`
4. Run `./scripts/install.sh` to create managed symlinks
5. Remove old unmanaged symlinks

### From Other Systems

1. Export/list your current managed files
2. Create appropriate entries in `dotfiles.json`
3. Copy files to `files/` directories
4. Run installation script
5. Verify symlinks are correct

## Troubleshooting Schema Issues

### Common Errors

**"Additional properties are not allowed"**

- You've included a property not defined in the schema
- Check for typos in property names

**"Required property missing"**

- Ensure all required fields are present
- Common: missing `type` in source objects

**"Invalid type"**

- Property has wrong type (e.g., string instead of array)
- Check platforms is an array, not a string

**"Pattern does not match"**

- Usually means invalid platform name
- Valid: linux, darwin, wsl
