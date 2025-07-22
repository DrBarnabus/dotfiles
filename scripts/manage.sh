#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
MANIFEST_FILE="$REPO_DIR/dotfiles.json"
BACKUP_DIR="$REPO_DIR/backups"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

show_help() {
    cat << EOF
Usage: $(basename "$0") COMMAND [OPTIONS]

Manage dotfiles configurations.

COMMANDS:
    add <name> <path1> [path2...] [OPTIONS]
        Add a new configuration to dotfiles.json
        
        OPTIONS:
            --extract field:target    Extract JSON field to separate file
            --platform platform       Restrict to specific platform(s)
                                     (linux, darwin, wsl)
        
        EXAMPLES:
            $(basename "$0") add git ~/.gitconfig ~/.gitignore_global
            $(basename "$0") add ssh ~/.ssh/config
            $(basename "$0") add tmux ~/.tmux.conf ~/.tmux/
            $(basename "$0") add claude ~/.claude.json --extract mcpServers:mcp.json
            $(basename "$0") add bash ~/.bashrc --platform linux,wsl

    remove <name>
        Remove a configuration and its symlinks
        
        EXAMPLES:
            $(basename "$0") remove vim

    list [--verbose]
        List all configurations
        
        OPTIONS:
            -v, --verbose    Show detailed status for each configuration
        
        EXAMPLES:
            $(basename "$0") list
            $(basename "$0") list --verbose

    help
        Show this help message

EOF
}

check_dependencies() {
    if ! command -v jq >/dev/null 2>&1; then
        log_error "jq is required but not installed. Please install jq first."
        log_info "On Ubuntu/Debian: sudo apt-get install jq"
        log_info "On macOS: brew install jq"
        exit 1
    fi
}

expand_path() {
    local path="$1"
    path="${path/#\~/$HOME}"
    echo "$path"
}

parse_json() {
    local json_file="$1"
    local query="$2"
    jq -r "$query" "$json_file"
}

validate_config_name() {
    local name="$1"
    
    if [[ -z "$name" ]]; then
        log_error "Configuration name cannot be empty"
        return 1
    fi
    
    if [[ "$name" =~ [^a-zA-Z0-9_-] ]]; then
        log_error "Configuration name can only contain letters, numbers, underscores, and hyphens"
        return 1
    fi
    
    return 0
}

config_exists() {
    local name="$1"
    local exists
    exists=$(parse_json "$MANIFEST_FILE" ".groups[] | select(.name == \"$name\") | .name" 2>/dev/null | head -1)
    [[ -n "$exists" ]]
}

add_configuration() {
    local name="$1"
    shift
    
    local paths=()
    local extract_specs=()
    local platforms=()
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --extract)
                if [[ $# -lt 2 ]]; then
                    log_error "Missing value for --extract"
                    return 1
                fi
                extract_specs+=("$2")
                shift 2
                ;;
            --platform)
                if [[ $# -lt 2 ]]; then
                    log_error "Missing value for --platform"
                    return 1
                fi
                IFS=',' read -ra platform_array <<< "$2"
                platforms+=("${platform_array[@]}")
                shift 2
                ;;
            -*)
                log_error "Unknown option: $1"
                return 1
                ;;
            *)
                paths+=("$1")
                shift
                ;;
        esac
    done
    
    if [[ ${#paths[@]} -eq 0 ]]; then
        log_error "No paths specified"
        return 1
    fi
    
    # Validate configuration name
    if ! validate_config_name "$name"; then
        return 1
    fi
    
    # Check if configuration already exists
    if config_exists "$name"; then
        log_error "Configuration '$name' already exists"
        return 1
    fi
    
    # Build sources array
    local sources_json="["
    local first=true
    
    for i in "${!paths[@]}"; do
        local path="${paths[$i]}"
        local expanded_path
        expanded_path=$(expand_path "$path")
        
        # Validate path exists
        if [[ ! -e "$expanded_path" ]]; then
            log_warn "Path does not exist: $expanded_path"
            read -p "Continue anyway? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                return 1
            fi
        fi
        
        # Determine type
        local type="file"
        if [[ -d "$expanded_path" ]]; then
            type="directory"
        fi
        
        # Start source object
        [[ "$first" == "true" ]] && first=false || sources_json+=","
        sources_json+="{\"path\":\"$path\",\"type\":\"$type\""
        
        # Add platform restrictions if specified
        if [[ ${#platforms[@]} -gt 0 ]]; then
            sources_json+=",\"platforms\":["
            local pfirst=true
            for platform in "${platforms[@]}"; do
                [[ "$pfirst" == "true" ]] && pfirst=false || sources_json+=","
                sources_json+="\"$platform\""
            done
            sources_json+="]"
        fi
        
        # Check if this path has an extract spec
        for spec in "${extract_specs[@]}"; do
            if [[ "$spec" =~ ^([^:]+):(.+)$ ]]; then
                local field="${BASH_REMATCH[1]}"
                local target="${BASH_REMATCH[2]}"
                
                # Only apply extract to the path that ends with the filename being extracted from
                local basename_path
                basename_path=$(basename "$expanded_path")
                if [[ "$basename_path" == "$(basename "$path")" ]]; then
                    sources_json+=",\"extract\":{\"field\":\"$field\",\"target\":\"$target\"}"
                    break
                fi
            fi
        done
        
        sources_json+="}"
    done
    sources_json+="]"
    
    # Create the new configuration object
    local new_config="{\"name\":\"$name\",\"sources\":$sources_json}"
    
    # Update dotfiles.json
    local temp_file
    temp_file=$(mktemp)
    if jq ".groups += [$new_config]" "$MANIFEST_FILE" > "$temp_file"; then
        mv "$temp_file" "$MANIFEST_FILE"
        log_success "Added configuration '$name' to manifest"
    else
        rm -f "$temp_file"
        log_error "Failed to update manifest"
        return 1
    fi
    
    # Create files directory
    mkdir -p "$REPO_DIR/files/$name"
    log_success "Created directory: files/$name"
    
    # Copy initial files if they exist (skip files with extract specs)
    for i in "${!paths[@]}"; do
        local path="${paths[$i]}"
        local expanded_path should_skip=false
        expanded_path=$(expand_path "$path")
        
        # Check if this path has an extract spec
        for spec in "${extract_specs[@]}"; do
            if [[ "$spec" =~ ^([^:]+):(.+)$ ]]; then
                # Extract specs apply to files that match the path
                local basename_path
                basename_path=$(basename "$expanded_path")
                if [[ "$basename_path" == "$(basename "$path")" ]] && [[ -f "$expanded_path" ]]; then
                    should_skip=true
                    log_info "Skipping copy of $expanded_path (will use extraction instead)"
                    break
                fi
            fi
        done
        
        if [[ "$should_skip" == "false" ]] && [[ -e "$expanded_path" ]]; then
            local basename
            basename=$(basename "$expanded_path")
            if [[ -d "$expanded_path" ]]; then
                cp -r "$expanded_path" "$REPO_DIR/files/$name/$basename"
                log_success "Copied directory: $expanded_path -> files/$name/$basename"
            else
                cp "$expanded_path" "$REPO_DIR/files/$name/$basename"
                log_success "Copied file: $expanded_path -> files/$name/$basename"
            fi
        fi
    done
    
    log_info "Configuration '$name' added successfully"
    log_info "Run './scripts/install.sh' to create symlinks"
}

remove_configuration() {
    local name="$1"
    
    if ! config_exists "$name"; then
        log_error "Configuration '$name' does not exist"
        return 1
    fi
    
    # Get all sources for this configuration
    local sources
    sources=$(parse_json "$MANIFEST_FILE" ".groups[] | select(.name == \"$name\") | .sources")
    
    # Remove symlinks
    while read -r path; do
        local expanded_path
        expanded_path=$(expand_path "$path")
        if [[ -L "$expanded_path" ]]; then
            rm "$expanded_path"
            log_success "Removed symlink: $expanded_path"
        elif [[ -e "$expanded_path" ]]; then
            log_warn "Not a symlink, skipping: $expanded_path"
        fi
    done < <(echo "$sources" | jq -r '.[] | .path')
    
    # Archive configuration
    if [[ -d "$REPO_DIR/files/$name" ]]; then
        local archive_dir
        archive_dir="$BACKUP_DIR/removed_$(date +%Y%m%d_%H%M%S)_$name"
        mkdir -p "$archive_dir"
        mv "$REPO_DIR/files/$name" "$archive_dir/"
        log_success "Archived configuration to: $archive_dir"
    fi
    
    # Remove from manifest
    local temp_file
    temp_file=$(mktemp)
    if jq ".groups |= map(select(.name != \"$name\"))" "$MANIFEST_FILE" > "$temp_file"; then
        mv "$temp_file" "$MANIFEST_FILE"
        log_success "Removed configuration '$name' from manifest"
    else
        rm -f "$temp_file"
        log_error "Failed to update manifest"
        return 1
    fi
}

get_platform_display() {
    local platform_json="$1"
    if [[ -z "$platform_json" ]] || [[ "$platform_json" == "null" ]]; then
        echo "all"
    else
        echo "$platform_json" | jq -r '.[]' | tr '\n' ',' | sed 's/,$//'
    fi
}

check_symlink_status() {
    local path="$1"
    local expected_target="$2"
    
    if [[ ! -e "$path" ]] && [[ ! -L "$path" ]]; then
        echo "missing"
    elif [[ -L "$path" ]]; then
        local actual_target
        actual_target=$(readlink "$path")
        if [[ "$actual_target" == "$expected_target" ]]; then
            echo "ok"
        else
            echo "incorrect"
        fi
    else
        echo "not-symlink"
    fi
}

list_configurations() {
    local verbose=false
    
    if [[ "${1:-}" == "--verbose" ]] || [[ "${1:-}" == "-v" ]]; then
        verbose=true
    fi
    
    local config_count
    config_count=$(parse_json "$MANIFEST_FILE" ".groups | length")
    
    if [[ "$config_count" -eq 0 ]]; then
        log_info "No configurations found"
        return 0
    fi
    
    echo -e "${CYAN}Configured dotfiles:${NC}"
    echo
    
    for i in $(seq 0 $((config_count - 1))); do
        local config name sources source_count
        config=$(parse_json "$MANIFEST_FILE" ".groups[$i]")
        name=$(echo "$config" | parse_json /dev/stdin ".name" | head -1)
        sources=$(echo "$config" | parse_json /dev/stdin ".sources")
        source_count=$(echo "$sources" | jq -s 'length')
        
        echo -e "${GREEN}$name${NC} ($source_count source$([ "$source_count" -ne 1 ] && echo "s"))"
        
        if [[ "$verbose" == "true" ]]; then
            while IFS= read -r source; do
                local path type platforms extract expanded_path platform_display
                path=$(echo "$source" | parse_json /dev/stdin ".path")
                type=$(echo "$source" | parse_json /dev/stdin ".type")
                platforms=$(echo "$source" | parse_json /dev/stdin ".platforms")
                extract=$(echo "$source" | parse_json /dev/stdin ".extract")
                
                expanded_path=$(expand_path "$path")
                platform_display=$(get_platform_display "$platforms")
                
                echo -n "  - $path "
                echo -n "($type"
                [[ "$platform_display" != "all" ]] && echo -n ", $platform_display"
                echo -n ")"
                
                # Check status if verbose
                if [[ "$type" == "file" ]]; then
                    local basename expected_target status
                    basename=$(basename "$expanded_path")
                    expected_target="$REPO_DIR/files/$name/$basename"
                    status=$(check_symlink_status "$expanded_path" "$expected_target")
                elif [[ "$type" == "directory" ]]; then
                    local basename expected_target status
                    basename=$(basename "$expanded_path")
                    expected_target="$REPO_DIR/files/$name/$basename"
                    status=$(check_symlink_status "$expanded_path" "$expected_target")
                fi
                
                case "$status" in
                    ok) echo -e " ${GREEN}✓${NC}" ;;
                    missing) echo -e " ${YELLOW}⚠ missing${NC}" ;;
                    incorrect) echo -e " ${RED}✗ incorrect symlink${NC}" ;;
                    not-symlink) echo -e " ${RED}✗ not a symlink${NC}" ;;
                    *) echo ;;
                esac
                
                if [[ -n "$extract" ]] && [[ "$extract" != "null" ]]; then
                    local field target
                    field=$(echo "$extract" | parse_json /dev/stdin ".field")
                    target=$(echo "$extract" | parse_json /dev/stdin ".target")
                    echo "    Extract: $field -> $target"
                fi
            done < <(echo "$sources" | jq -c '.[]')
            echo
        fi
    done
}

main() {
    check_dependencies
    
    if [[ $# -eq 0 ]]; then
        show_help
        exit 1
    fi
    
    local command="$1"
    shift
    
    case "$command" in
        add)
            if [[ $# -lt 2 ]]; then
                log_error "Usage: $(basename "$0") add <name> <path1> [path2...] [OPTIONS]"
                exit 1
            fi
            add_configuration "$@"
            ;;
        remove)
            if [[ $# -ne 1 ]]; then
                log_error "Usage: $(basename "$0") remove <name>"
                exit 1
            fi
            remove_configuration "$1"
            ;;
        list)
            list_configurations "$@"
            ;;
        help)
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

main "$@"