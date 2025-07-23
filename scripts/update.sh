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
NC='\033[0m'

DRY_RUN=false

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

log_dry_run() {
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY-RUN]${NC} Would: $1"
    fi
}

show_help() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Update dotfiles by pulling latest changes and verifying configurations.

OPTIONS:
    -h, --help       Show this help message
    -d, --dry-run    Show what would be done without making changes
    -f, --force      Force update even if there are local changes
    -s, --skip-pull  Skip git pull and only verify/sync configurations

EXAMPLES:
    $(basename "$0")              # Normal update
    $(basename "$0") --dry-run    # See what would be updated
    $(basename "$0") --force      # Force update with local changes
    $(basename "$0") --skip-pull  # Only sync configurations without pulling

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

parse_json() {
    local json_file="$1"
    local query="$2"
    jq -r "$query" "$json_file"
}

expand_path() {
    local path="$1"
    path="${path/#\~/$HOME}"
    echo "$path"
}

check_git_status() {
    cd "$REPO_DIR"
    
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        log_error "Not a git repository: $REPO_DIR"
        return 1
    fi
    
    local status
    status=$(git status --porcelain)
    if [[ -n "$status" ]]; then
        log_warn "Repository has uncommitted changes:"
        while IFS= read -r line; do
            echo "  $line"
        done <<< "$status"
        return 1
    fi
    
    return 0
}

pull_latest() {
    cd "$REPO_DIR"
    
    log_info "Fetching latest changes..."
    if [[ "$DRY_RUN" == "true" ]]; then
        log_dry_run "git pull origin $(git rev-parse --abbrev-ref HEAD)"
        return 0
    fi
    
    local current_branch
    current_branch=$(git rev-parse --abbrev-ref HEAD)
    local before_pull
    before_pull=$(git rev-parse HEAD)
    
    if ! git pull origin "$current_branch"; then
        log_error "Failed to pull latest changes"
        return 1
    fi
    
    local after_pull
    after_pull=$(git rev-parse HEAD)
    
    if [[ "$before_pull" == "$after_pull" ]]; then
        log_info "Already up to date"
    else
        log_success "Updated from $before_pull to $after_pull"
        git log --oneline "$before_pull..$after_pull" | sed 's/^/  /'
    fi
    
    return 0
}

verify_symlink() {
    local source="$1"
    local expected_target="$2"
    local config_name="$3"
    
    if [[ ! -e "$source" ]] && [[ ! -L "$source" ]]; then
        log_warn "Missing: $source (expected -> $expected_target)"
        return 1
    fi
    
    if [[ -L "$source" ]]; then
        local actual_target
        actual_target=$(readlink "$source")
        if [[ "$actual_target" != "$expected_target" ]]; then
            log_warn "Incorrect symlink: $source -> $actual_target (expected -> $expected_target)"
            return 1
        fi
        log_success "Verified: $source -> $expected_target"
        return 0
    else
        log_warn "Not a symlink: $source (should point to $expected_target)"
        return 1
    fi
}

sync_extracted_field() {
    local source_path="$1"
    local field="$2"
    local repo_file="$3"
    
    if [[ ! -f "$source_path" ]]; then
        log_warn "Source file not found for extraction: $source_path"
        return 1
    fi
    
    if [[ ! -f "$repo_file" ]]; then
        log_warn "Repository file not found: $repo_file"
        return 1
    fi
    
    log_info "Re-syncing field '$field' from $repo_file to $source_path"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_dry_run "Merge $repo_file content into $source_path field '$field'"
        return 0
    fi
    
    local temp_file
    temp_file=$(mktemp)
    if jq --slurpfile extracted "$repo_file" ".$field = \$extracted[0]" "$source_path" > "$temp_file" 2>/dev/null; then
        mv "$temp_file" "$source_path"
        log_success "Synced field '$field' to $source_path"
        return 0
    else
        log_error "Failed to sync field '$field' to $source_path"
        rm -f "$temp_file"
        return 1
    fi
}

check_platform_match() {
    local platforms="$1"
    local current_platform
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if grep -qi microsoft /proc/version 2>/dev/null; then
            current_platform="wsl"
        else
            current_platform="linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        current_platform="darwin"
    else
        current_platform="unknown"
    fi
    
    if [[ -z "$platforms" ]] || [[ "$platforms" == "null" ]]; then
        return 0
    fi
    
    echo "$platforms" | grep -q "\"$current_platform\"" && return 0
    return 1
}

verify_configuration() {
    local config_name="$1"
    local sources="$2"
    local issues=0
    
    log_info "Verifying configuration: $config_name"
    
    while IFS= read -r source; do
        if [[ -z "$source" ]] || [[ "$source" == "null" ]]; then
            continue
        fi
        
        local path
        path=$(echo "$source" | jq -r ".path")
        local type
        type=$(echo "$source" | jq -r ".type")
        local platforms
        platforms=$(echo "$source" | jq -r ".platforms // empty")
        local extract
        extract=$(echo "$source" | jq -r ".extract // empty")
        local symlink_mode
        symlink_mode=$(echo "$source" | jq -r ".symlink_mode // empty")
        
        if ! check_platform_match "$platforms"; then
            continue
        fi
        
        path=$(expand_path "$path")
        
        if [[ -n "$extract" ]] && [[ "$extract" != "null" ]]; then
            local field
            field=$(echo "$extract" | jq -r ".field")
            local target
            target=$(echo "$extract" | jq -r ".target")
            local repo_file="$REPO_DIR/files/$config_name/$target"
            
            if [[ -f "$repo_file" ]]; then
                sync_extracted_field "$path" "$field" "$repo_file" || issues=$((issues + 1))
            else
                log_warn "Missing extracted file: $repo_file"
                issues=$((issues + 1))
            fi
        elif [[ "$type" == "file" ]]; then
            local filename
            filename=$(basename "$path")
            local repo_file="$REPO_DIR/files/$config_name/$filename"
            verify_symlink "$path" "$repo_file" "$config_name" || issues=$((issues + 1))
        elif [[ "$type" == "directory" ]]; then
            local repo_dir
            if [[ "$symlink_mode" == "directory" ]]; then
                # For directory symlinks, target is directly in the config dir
                repo_dir="$REPO_DIR/files/$config_name"
            else
                # For regular directories, target includes the basename
                local dirname
                dirname=$(basename "$path")
                repo_dir="$REPO_DIR/files/$config_name/$dirname"
            fi
            verify_symlink "$path" "$repo_dir" "$config_name" || issues=$((issues + 1))
        fi
    done < <(echo "$sources" | jq -c '.[]')
    
    if [[ $issues -eq 0 ]]; then
        log_success "Configuration '$config_name' is up to date"
        return 0
    else
        log_warn "Configuration '$config_name' has $issues issue(s)"
        return 1
    fi
}

cleanup_old_backups() {
    if [[ "$DRY_RUN" == "true" ]]; then
        if [[ -d "$BACKUP_DIR" ]]; then
            local backup_count
            backup_count=$(find "$BACKUP_DIR" -maxdepth 1 -type d | tail -n +2 | wc -l)
            if [[ $backup_count -gt 5 ]]; then
                log_dry_run "Clean up old backups (keeping last 5)"
            fi
        fi
        return 0
    fi
    
    if [[ -d "$BACKUP_DIR" ]]; then
        local backup_count
        backup_count=$(find "$BACKUP_DIR" -maxdepth 1 -type d | tail -n +2 | wc -l)
        if [[ $backup_count -gt 5 ]]; then
            log_info "Cleaning up old backups (keeping last 5)"
            find "$BACKUP_DIR" -maxdepth 1 -type d | tail -n +2 | sort | head -n -5 | xargs rm -rf
            log_success "Removed $((backup_count - 5)) old backup(s)"
        fi
    fi
}

main() {
    local force_update=false
    local skip_pull=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -f|--force)
                force_update=true
                shift
                ;;
            -s|--skip-pull)
                skip_pull=true
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    log_info "Starting dotfiles update"
    log_info "Repository: $REPO_DIR"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Running in dry-run mode (no changes will be made)"
    fi
    
    check_dependencies
    
    if [[ ! -f "$MANIFEST_FILE" ]]; then
        log_error "Manifest file not found: $MANIFEST_FILE"
        exit 1
    fi
    
    if [[ "$skip_pull" == "false" ]]; then
        if [[ "$force_update" == "false" ]]; then
            if ! check_git_status; then
                log_error "Repository has uncommitted changes. Use --force to update anyway."
                exit 1
            fi
        fi
        
        if ! pull_latest; then
            log_error "Failed to pull latest changes"
            exit 1
        fi
    else
        log_info "Skipping git pull (--skip-pull specified)"
    fi
    
    local total_configs=0
    local successful_configs=0
    local config_count
    config_count=$(parse_json "$MANIFEST_FILE" ".groups | length")
    
    for i in $(seq 0 $((config_count - 1))); do
        local config
        config=$(parse_json "$MANIFEST_FILE" ".groups[$i]")
        local name
        name=$(echo "$config" | jq -r ".name")
        local sources
        sources=$(echo "$config" | jq -c ".sources")
        
        if [[ -n "$name" ]] && [[ "$name" != "null" ]]; then
            total_configs=$((total_configs + 1))
            if verify_configuration "$name" "$sources"; then
                successful_configs=$((successful_configs + 1))
            fi
        fi
    done
    
    cleanup_old_backups
    
    echo
    if [[ $successful_configs -eq $total_configs ]]; then
        log_success "All configurations are up to date ($successful_configs/$total_configs)"
    else
        log_warn "Some configurations need attention ($successful_configs/$total_configs successful)"
        log_info "Run './scripts/install.sh' to fix any issues"
    fi
}

main "$@"