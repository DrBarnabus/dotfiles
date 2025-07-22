#!/usr/bin/env bash

set -euo pipefail

# Read JSON input from stdin
input=$(cat)

# Extract file path using jq
file_path=$(echo "$input" | jq -r '.tool_input.file_path // ""')

# Exit early if no file path or file doesn't exist
[[ -z "$file_path" ]] && exit 0
[[ ! -f "$file_path" ]] && exit 0

# Run Prettier on all supported file types
if command -v npx &> /dev/null && npx prettier --version &> /dev/null 2>&1; then
    # Check if Prettier supports this file
    if npx prettier --file-info "$file_path" 2>/dev/null | jq -e '.ignored == false' &> /dev/null; then
        echo >&2 "Running Prettier on $file_path..."
        if npx prettier --write "$file_path" &> /dev/null; then
            echo >&2 "✓ Formatted $file_path with Prettier"
        fi
    fi
fi

# Get file extension
ext="${file_path##*.}"

case "$ext" in
    js|jsx|ts|tsx|mjs|cjs|mts|cts)
        # Check if ESLint is available
        if command -v npx &> /dev/null && npx eslint --version &> /dev/null 2>&1; then
            echo >&2 "Running ESLint on $file_path..."
            
            # Run ESLint and capture output
            if output=$(npx eslint "$file_path" --format json 2>/dev/null); then
                # No errors
                :  # Continue to TypeScript check
            else
                # Parse errors from JSON output
                if errors=$(echo "$output" | jq -r '.[0].messages[] | select(.severity == 2) | "  Line \(.line): \(.message)"' 2>/dev/null); then
                    if [[ -n "$errors" ]]; then
                        error_count=$(echo "$output" | jq '[.[0].messages[] | select(.severity == 2)] | length' 2>/dev/null || echo "0")
                        echo >&2 "ESLint found $error_count error(s) in $file_path:"
                        echo >&2 "$errors" | head -n 6  # Show first 3 errors (2 lines each)
                        exit 2  # Block the operation
                    fi
                fi
            fi
        fi
        
        # TypeScript type checking for .ts/.tsx files
        if [[ "$ext" =~ ^(ts|tsx|mts|cts)$ ]]; then
            if command -v npx &> /dev/null && npx tsc --version &> /dev/null 2>&1; then
                # Find nearest tsconfig.json
                dir=$(dirname "$file_path")
                tsconfig=""
                while [[ "$dir" != "/" ]]; do
                    if [[ -f "$dir/tsconfig.json" ]]; then
                        tsconfig="$dir/tsconfig.json"
                        break
                    fi
                    dir=$(dirname "$dir")
                done
                
                if [[ -n "$tsconfig" ]]; then
                    echo >&2 "Running TypeScript check on $file_path..."
                    project_dir=$(dirname "$tsconfig")
                    
                    # Run tsc from project directory with incremental compilation
                    if output=$(cd "$project_dir" && npx tsc --noEmit --incremental --pretty false 2>&1); then
                        # No errors
                        exit 0
                    else
                        # Parse errors for current file only
                        file_errors=$(echo "$output" | grep "^$file_path:" | head -n 5)
                        if [[ -n "$file_errors" ]]; then
                            error_count=$(echo "$file_errors" | wc -l)
                            echo >&2 "TypeScript found $error_count error(s) in $file_path:"
                            # Indent each line of errors
                            while IFS= read -r line; do
                                echo >&2 "  $line"
                            done <<< "$file_errors"
                        fi
                        # Don't block on TypeScript errors (exit 0)
                    fi
                fi
            fi
        fi
        ;;
        
    rs)
        # Rust linting and formatting
        if command -v cargo &> /dev/null; then
            # Find nearest Cargo.toml
            dir=$(dirname "$file_path")
            cargo_toml=""
            while [[ "$dir" != "/" ]]; do
                if [[ -f "$dir/Cargo.toml" ]]; then
                    cargo_toml="$dir/Cargo.toml"
                    break
                fi
                dir=$(dirname "$dir")
            done
            
            if [[ -n "$cargo_toml" ]]; then
                project_dir=$(dirname "$cargo_toml")
                
                # Format with rustfmt
                echo >&2 "Running rustfmt on $file_path..."
                if cd "$project_dir" && cargo fmt --check 2>/dev/null; then
                    # Already formatted
                    :
                else
                    # Format the file
                    if cd "$project_dir" && cargo fmt 2>/dev/null; then
                        echo >&2 "✓ Formatted $file_path with rustfmt"
                    fi
                fi
                
                # Lint with clippy
                echo >&2 "Running cargo clippy on $file_path..."
                if output=$(cd "$project_dir" && cargo clippy --message-format json --quiet 2>/dev/null); then
                    # Parse clippy warnings for current file only
                    file_warnings=$(echo "$output" | jq -r --arg file "$file_path" '
                        select(.reason == "compiler-message") |
                        select(.message.spans[0].file_name == $file) |
                        select(.message.level == "warning") |
                        "  Line \(.message.spans[0].line_start): \(.message.message)"' 2>/dev/null | head -n 10)
                    
                    if [[ -n "$file_warnings" ]]; then
                        warning_count=$(echo "$file_warnings" | wc -l)
                        echo >&2 "Clippy found $warning_count warning(s) in $file_path:"
                        echo >&2 "$file_warnings"
                    fi
                fi
                
                # Check compilation
                echo >&2 "Running cargo check on $file_path..."
                if output=$(cd "$project_dir" && cargo check --message-format json --quiet 2>/dev/null); then
                    # Parse compilation errors for current file only
                    file_errors=$(echo "$output" | jq -r --arg file "$file_path" '
                        select(.reason == "compiler-message") |
                        select(.message.spans[0].file_name == $file) |
                        select(.message.level == "error") |
                        "  Line \(.message.spans[0].line_start): \(.message.message)"' 2>/dev/null | head -n 5)
                    
                    if [[ -n "$file_errors" ]]; then
                        error_count=$(echo "$file_errors" | wc -l)
                        echo >&2 "Cargo check found $error_count error(s) in $file_path:"
                        echo >&2 "$file_errors"
                        exit 2  # Block on compilation errors
                    fi
                else
                    # cargo check failed, show generic error
                    echo >&2 "Cargo check failed for $file_path"
                    exit 2
                fi
            fi
        fi
        ;;
        
    sh|bash)
        # Shell script linting with shellcheck
        if command -v shellcheck &> /dev/null; then
            echo >&2 "Running shellcheck on $file_path..."
            if ! shellcheck "$file_path" 2>&1 | head -n 10 >&2; then
                exit 2  # Block on errors
            fi
        fi
        ;;
esac

exit 0  # Success if no linter matched