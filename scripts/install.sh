#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
MANIFEST_FILE="$REPO_DIR/dotfiles.json"
BACKUP_DIR="$REPO_DIR/backups"

source "$SCRIPT_DIR/lib.sh"

show_help() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Install dotfiles by creating symlinks from home directory to repository.

OPTIONS:
    -h, --help      Show this help message

DESCRIPTION:
    This script reads the dotfiles.json manifest and:
    - Creates symlinks for all configured files and directories
    - Imports existing configurations if not already in the repository
    - Extracts JSON fields as specified in the manifest
    - Creates backups before making any changes
    - Keeps only the last 5 backups

EXAMPLES:
    $(basename "$0")           # Install all configurations

NOTES:
    - Requires jq to be installed
    - Will not overwrite existing symlinks that point elsewhere
    - Automatically imports existing files/directories on first run
    - Platform-specific configurations are respected
    - On Windows (Git Bash), requires Developer Mode and
      MSYS=winsymlinks:nativestrict for real NTFS symlinks

EOF
}

create_backup() {
    local source="$1"
    local config_name="$2"
    local timestamp
    timestamp=$(date +"%Y-%m-%d_%H%M%S")
    local backup_path="$BACKUP_DIR/$timestamp/$config_name"

    if [[ -e "$source" ]]; then
        mkdir -p "$backup_path"
        log_info "Creating backup of $source"
        cp -rL "$source" "$backup_path/" || {
            log_error "Failed to backup $source"
            return 1
        }
    fi
    return 0
}

cleanup_old_backups() {
    if [[ -d "$BACKUP_DIR" ]]; then
        local backup_count
        backup_count=$(find "$BACKUP_DIR" -maxdepth 1 -type d | tail -n +2 | wc -l)
        if [[ $backup_count -gt 5 ]]; then
            log_info "Cleaning up old backups (keeping last 5)"
            find "$BACKUP_DIR" -maxdepth 1 -type d | tail -n +2 | sort | head -n -5 | xargs rm -rf
        fi
    fi
}

create_symlink() {
    local source="$1"
    local target="$2"
    local config_name="$3"

    local source_dir
    source_dir=$(dirname "$source")
    if [[ ! -d "$source_dir" ]]; then
        mkdir -p "$source_dir"
        log_info "Created directory: $source_dir"
    fi

    if [[ -L "$source" ]]; then
        local current_target
        current_target=$(readlink "$source")
        if [[ "$current_target" == "$target" ]]; then
            log_info "Symlink already exists and is correct: $source -> $target"
            return 0
        else
            log_warn "Symlink exists but points elsewhere: $source -> $current_target"
            log_warn "Skipping to avoid overwriting existing symlink"
            return 1
        fi
    fi

    if [[ -e "$source" ]]; then
        create_backup "$source" "$config_name" || return 1
        rm -rf "$source"
    fi

    ln -s "$target" "$source"
    log_success "Created symlink: $source -> $target"
    return 0
}

handle_file_source() {
    local source_path="$1"
    local config_name="$2"

    local filename
    filename=$(basename "$source_path")
    local repo_file="$REPO_DIR/files/$config_name/$filename"

    # Import existing file to repository if:
    # 1. The file exists in the home directory
    # 2. The file doesn't exist in the repository yet
    # This allows capturing existing configs on first install
    if [[ -f "$source_path" ]] && [[ ! -f "$repo_file" ]]; then
        mkdir -p "$(dirname "$repo_file")"
        cp "$source_path" "$repo_file"
        log_info "Imported existing file: $source_path -> $repo_file"
    fi

    if [[ -f "$repo_file" ]]; then
        create_symlink "$source_path" "$repo_file" "$config_name"
    else
        log_warn "Repository file not found: $repo_file"
        return 1
    fi
}

handle_directory_source() {
    local source_path="$1"
    local config_name="$2"

    local dirname
    dirname=$(basename "$source_path")
    local repo_dir="$REPO_DIR/files/$config_name/$dirname"

    # Import existing directory to repository if:
    # 1. The directory exists in the home directory
    # 2. The directory doesn't exist in the repository yet
    # This allows capturing existing configs on first install
    if [[ -d "$source_path" ]] && [[ ! -d "$repo_dir" ]]; then
        mkdir -p "$REPO_DIR/files/$config_name"
        cp -r "$source_path" "$repo_dir"
        log_info "Imported existing directory: $source_path -> $repo_dir"
    fi

    if [[ -d "$repo_dir" ]]; then
        create_symlink "$source_path" "$repo_dir" "$config_name"
    else
        log_warn "Repository directory not found: $repo_dir"
        return 1
    fi
}

handle_directory_symlink_source() {
    local source_path="$1"
    local config_name="$2"

    local dirname
    dirname=$(basename "$source_path")
    local repo_dir="$REPO_DIR/files/$config_name"

    # For directory symlinks, we store the directory directly in the config dir
    # Import existing directory to repository if:
    # 1. The directory exists in the home directory
    # 2. The directory doesn't exist in the repository yet
    # This allows capturing existing configs on first install
    if [[ -d "$source_path" ]] && [[ ! -d "$repo_dir" ]]; then
        mkdir -p "$(dirname "$repo_dir")"
        cp -r "$source_path" "$repo_dir"
        log_info "Imported existing directory for whole-folder symlink: $source_path -> $repo_dir"
    fi

    if [[ -d "$repo_dir" ]]; then
        create_symlink "$source_path" "$repo_dir" "$config_name"
    else
        log_warn "Repository directory not found: $repo_dir"
        return 1
    fi
}

handle_extract_source() {
    local source_path="$1"
    local field="$2"
    local target_file="$3"
    local config_name="$4"

    local repo_file="$REPO_DIR/files/$config_name/$target_file"
    mkdir -p "$(dirname "$repo_file")"

    # If repo file already exists, merge FROM repo TO home (not extract)
    if [[ -f "$repo_file" ]]; then
        log_info "Repository file exists, syncing from repo to home"

        # Ensure source file exists
        if [[ ! -f "$source_path" ]]; then
            echo "{}" > "$source_path"
            log_info "Created empty source file: $source_path"
        else
            create_backup "$source_path" "$config_name"
        fi

        # Merge repo content into source file
        local temp_file
        temp_file=$(mktemp)
        jq --slurpfile extracted "$repo_file" ".$field = \$extracted[0]" "$source_path" > "$temp_file" 2>/dev/null || {
            log_error "Failed to merge extracted content back to $source_path"
            rm -f "$temp_file"
            return 1
        }
        mv "$temp_file" "$source_path"
        log_success "Merged extracted content from $repo_file to $source_path"
    else
        # First time: extract FROM home TO repo
        if [[ -f "$source_path" ]]; then
            local extracted_content
            extracted_content=$(parse_json "$source_path" ".$field")
            if [[ -n "$extracted_content" ]]; then
                echo "$extracted_content" | jq . > "$repo_file" 2>/dev/null || echo "$extracted_content" > "$repo_file"
                log_success "Extracted field '$field' from $source_path to $repo_file"
            else
                log_warn "Field '$field' not found in $source_path"
                echo "{}" > "$repo_file"
            fi
        else
            log_info "Source file not found: $source_path, creating empty extraction"
            echo "{}" > "$repo_file"
            echo "{}" > "$source_path"
        fi
    fi
}

process_config() {
    local config_name="$1"
    local sources="$2"
    local success_count=0
    local failure_count=0

    log_info "Processing configuration: $config_name"

    while IFS= read -r source; do
        if [[ -z "$source" ]] || [[ "$source" == "null" ]]; then
            continue
        fi

        local path type platforms extract symlink_mode
        path=$(resolve_path "$source")
        type=$(echo "$source" | jq -r ".type")
        platforms=$(echo "$source" | jq -r ".platforms // empty")
        extract=$(echo "$source" | jq -r ".extract // empty")
        symlink_mode=$(echo "$source" | jq -r ".symlink_mode // empty")

        if ! check_platform_match "$platforms"; then
            log_info "Skipping $path (not for this platform)"
            continue
        fi

        path=$(expand_path "$path")

        if [[ -n "$extract" ]] && [[ "$extract" != "null" ]]; then
            local field target
            field=$(echo "$extract" | jq -r ".field")
            target=$(echo "$extract" | jq -r ".target")
            handle_extract_source "$path" "$field" "$target" "$config_name" && success_count=$((success_count + 1)) || failure_count=$((failure_count + 1))
        elif [[ "$type" == "file" ]]; then
            handle_file_source "$path" "$config_name" && success_count=$((success_count + 1)) || failure_count=$((failure_count + 1))
        elif [[ "$type" == "directory" ]]; then
            if [[ "$symlink_mode" == "directory" ]]; then
                handle_directory_symlink_source "$path" "$config_name" && success_count=$((success_count + 1)) || failure_count=$((failure_count + 1))
            else
                handle_directory_source "$path" "$config_name" && success_count=$((success_count + 1)) || failure_count=$((failure_count + 1))
            fi
        else
            log_error "Unknown source type: $type"
            failure_count=$((failure_count + 1))
        fi
    done < <(echo "$sources" | jq -c '.[]')

    if [[ $failure_count -eq 0 ]]; then
        log_success "Configuration '$config_name' installed successfully ($success_count items)"
        return 0
    else
        log_warn "Configuration '$config_name' partially installed ($success_count succeeded, $failure_count failed)"
        return 1
    fi
}

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    local current_platform
    current_platform=$(detect_platform)

    log_info "Starting dotfiles installation"
    log_info "Repository: $REPO_DIR"
    log_info "Platform: $current_platform"

    # Check dependencies
    check_dependencies

    # On Windows, verify real symlinks are working before proceeding
    if [[ "$current_platform" == "windows" ]]; then
        if ! check_symlink_support; then
            log_error "Real symlinks are not working in this Git Bash session."
            log_error "Dotfiles management requires real NTFS symlinks, not copies."
            echo
            log_info "Two things are needed for native symlinks on Windows:"
            log_info ""
            log_info "  1. Enable Developer Mode (grants symlink permission without UAC elevation):"
            log_info "     Settings > For Developers > Developer Mode"
            log_info ""
            log_info "  2. Tell Git Bash to use native symlinks instead of deep-copies."
            log_info "     Add to your shell profile (~/.bashrc or ~/.bash_profile):"
            log_info "       export MSYS=winsymlinks:nativestrict"
            log_info ""
            log_info "  3. Restart your terminal and run install.sh again"
            exit 1
        fi
        log_success "Real symlink support verified"

        if [[ -z "${XDG_CONFIG_HOME:-}" ]]; then
            log_info "Tip: Set XDG_CONFIG_HOME=~/.config for cross-platform config paths"
            log_info "Many tools (nvim, alacritty) respect XDG_CONFIG_HOME on all platforms"
        fi
    fi

    if [[ ! -f "$MANIFEST_FILE" ]]; then
        log_error "Manifest file not found: $MANIFEST_FILE"
        exit 1
    fi

    mkdir -p "$BACKUP_DIR"
    mkdir -p "$REPO_DIR/files"

    local total_success=0
    local total_failure=0

    local config_count
    config_count=$(parse_json "$MANIFEST_FILE" ".groups | length")

    for i in $(seq 0 $((config_count - 1))); do
        local config name sources
        config=$(parse_json "$MANIFEST_FILE" ".groups[$i]")
        name=$(echo "$config" | parse_json /dev/stdin ".name" | head -1)
        sources=$(echo "$config" | parse_json /dev/stdin ".sources")

        if [[ -n "$name" ]] && [[ "$name" != "null" ]]; then
            mkdir -p "$REPO_DIR/files/$name"
            process_config "$name" "$sources" && total_success=$((total_success + 1)) || total_failure=$((total_failure + 1))
        fi
    done

    cleanup_old_backups

    echo
    log_info "Installation complete!"
    log_success "Successful configurations: $total_success"
    if [[ $total_failure -gt 0 ]]; then
        log_warn "Failed configurations: $total_failure"
        exit 1
    fi

    exit 0
}

main "$@"
