#!/bin/bash
# Shared utility library for dotfiles management scripts
# Source this file near the top of install.sh, update.sh, and manage.sh

# ── Color constants ──────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── Logging ──────────────────────────────────────────────────────────────────

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

# ── Platform detection ───────────────────────────────────────────────────────

detect_platform() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if grep -qi microsoft /proc/version 2>/dev/null; then
            echo "wsl"
        else
            echo "linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "darwin"
    elif [[ "$OSTYPE" == "msys"* || "$OSTYPE" == "cygwin"* ]]; then
        echo "windows"
    else
        echo "unknown"
    fi
}

# Check whether the current platform matches a platforms filter from dotfiles.json.
#
# Supports two modes:
#   Inclusion:  ["linux", "wsl"]     → match only those platforms
#   Exclusion:  ["!windows"]         → match all platforms except windows
#
# An empty or null filter matches every platform.
check_platform_match() {
    local platforms="$1"
    local current_platform
    current_platform=$(detect_platform)

    if [[ -z "$platforms" ]] || [[ "$platforms" == "null" ]]; then
        return 0
    fi

    # Check if any entry starts with !
    if echo "$platforms" | grep -q '"!'; then
        # Negation mode: match if current platform is NOT in the negated set
        local negated
        negated=$(echo "$platforms" | jq -r '.[] | select(startswith("!")) | ltrimstr("!")')
        echo "$negated" | grep -qx "$current_platform" && return 1
        return 0
    fi

    # Inclusion mode: match if current platform IS in the list
    echo "$platforms" | grep -q "\"$current_platform\"" && return 0
    return 1
}

# ── Path utilities ───────────────────────────────────────────────────────────

expand_path() {
    local path="$1"
    path="${path/#\~/$HOME}"
    echo "$path"
}

# Return the effective path for a source entry, respecting path_overrides.
# Usage: resolve_path <source_json>
resolve_path() {
    local source_json="$1"
    local current_platform
    current_platform=$(detect_platform)

    local override
    override=$(echo "$source_json" | jq -r ".path_overrides.$current_platform // empty")

    if [[ -n "$override" ]]; then
        echo "$override"
    else
        echo "$source_json" | jq -r '.path'
    fi
}

# ── Dependency checking ──────────────────────────────────────────────────────

check_dependencies() {
    if ! command -v jq >/dev/null 2>&1; then
        log_error "jq is required but not installed. Please install jq first."
        log_info "On Ubuntu/Debian: sudo apt-get install jq"
        log_info "On macOS: brew install jq"
        if [[ "$(detect_platform)" == "windows" ]]; then
            log_info "On Windows: winget install jqlang.jq  OR  choco install jq  OR  scoop install jq"
        fi
        exit 1
    fi
}

# ── JSON helpers ─────────────────────────────────────────────────────────────

parse_json() {
    local json_file="$1"
    local query="$2"
    if [[ "$json_file" == "/dev/stdin" || "$json_file" == "-" ]]; then
        jq -r "$query"
    else
        jq -r "$query" "$json_file"
    fi
}

# ── Symlink support check (Windows) ─────────────────────────────────────────

# On Git Bash, ln -s deep-copies by default instead of creating real symlinks.
# Two things are needed for real NTFS symlinks:
#   1. Developer Mode enabled — grants SeCreateSymbolicLinkPrivilege without
#      UAC elevation (Settings > For Developers)
#   2. MSYS=winsymlinks:nativestrict — tells the MSYS layer to create native
#      symlinks instead of deep-copies
# This function verifies that real symlinks are working by creating a temp one.
check_symlink_support() {
    local test_dir
    test_dir=$(mktemp -d)
    local test_target="$test_dir/symlink_test_target"
    local test_link="$test_dir/symlink_test_link"

    echo "test" > "$test_target"
    ln -s "$test_target" "$test_link" 2>/dev/null

    local result=1
    if [[ -L "$test_link" ]]; then
        local resolved
        resolved=$(readlink "$test_link")
        if [[ "$resolved" == "$test_target" ]]; then
            result=0
        fi
    fi

    rm -rf "$test_dir"
    return $result
}
