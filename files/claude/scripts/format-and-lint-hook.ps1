#!/usr/bin/env pwsh

$ErrorActionPreference = "Stop"

# Tool availability detection (cached for this run)
$script:tools = @{
    npx        = $null -ne (Get-Command npx -ErrorAction SilentlyContinue)
    cargo      = $null -ne (Get-Command cargo -ErrorAction SilentlyContinue)
    shellcheck = $null -ne (Get-Command shellcheck -ErrorAction SilentlyContinue)
}

# Read JSON input from stdin
try {
    $inputJson = [Console]::In.ReadToEnd()
    $hookInput = $inputJson | ConvertFrom-Json
} catch {
    # Invalid JSON or no input
    exit 0
}

# Extract file path
$filePath = $hookInput.tool_input.file_path
if (-not $filePath) { exit 0 }

# Exit early if file doesn't exist
if (-not (Test-Path -LiteralPath $filePath)) { exit 0 }

# Get file extension
$ext = [System.IO.Path]::GetExtension($filePath).TrimStart('.')

# Run Prettier on all supported file types
if ($script:tools.npx) {
    # Check if Prettier is available via npx
    $prettierAvailable = $false
    try {
        npx prettier --version 2>&1 | Out-Null
        $prettierAvailable = $LASTEXITCODE -eq 0
    } catch {
        $prettierAvailable = $false
    }

    if ($prettierAvailable) {
        # Check if Prettier supports this file
        try {
            $fileInfo = npx prettier --file-info $filePath 2>$null | ConvertFrom-Json
            if ($fileInfo.ignored -eq $false) {
                Write-Host "Running Prettier on $filePath..." -ForegroundColor Cyan
                npx prettier --write $filePath 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "✓ Formatted $filePath with Prettier" -ForegroundColor Green
                }
            }
        } catch {
            # Prettier doesn't support this file or failed, continue
        }
    }
}

# File type specific checks
switch ($ext) {
    {$_ -in 'js','jsx','ts','tsx','mjs','cjs','mts','cts'} {
        # Skip if npx not available
        if (-not $script:tools.npx) { break }

        # Check if ESLint is available
        $eslintAvailable = $false
        try {
            npx eslint --version 2>&1 | Out-Null
            $eslintAvailable = $LASTEXITCODE -eq 0
        } catch {
            $eslintAvailable = $false
        }

        if ($eslintAvailable) {
            Write-Host "Running ESLint on $filePath..." -ForegroundColor Cyan

            # Run ESLint and capture output
            try {
                $eslintOutput = npx eslint $filePath --format json 2>$null
                if ($LASTEXITCODE -eq 0) {
                    # No errors, continue
                } else {
                    # Parse errors from JSON output
                    try {
                        $eslintResult = $eslintOutput | ConvertFrom-Json
                        $errors = $eslintResult[0].messages | Where-Object { $_.severity -eq 2 }

                        if ($errors.Count -gt 0) {
                            Write-Host "ESLint found $($errors.Count) error(s) in ${filePath}:" -ForegroundColor Red
                            $errors | Select-Object -First 3 | ForEach-Object {
                                Write-Host "  Line $($_.line): $($_.message)" -ForegroundColor Red
                            }
                            exit 2  # Block the operation
                        }
                    } catch {
                        # Failed to parse ESLint output, continue
                    }
                }
            } catch {
                # ESLint execution failed, continue
            }
        }

        # TypeScript type checking for .ts/.tsx/.mts/.cts files
        if ($ext -in 'ts','tsx','mts','cts') {
            $tscAvailable = $false
            try {
                npx tsc --version 2>&1 | Out-Null
                $tscAvailable = $LASTEXITCODE -eq 0
            } catch {
                $tscAvailable = $false
            }

            if ($tscAvailable) {
                # Find nearest tsconfig.json
                $dir = [System.IO.Path]::GetDirectoryName($filePath)
                $tsconfig = $null

                while ($dir -and $dir -ne [System.IO.Path]::GetPathRoot($dir)) {
                    $candidateTsconfig = Join-Path $dir "tsconfig.json"
                    if (Test-Path $candidateTsconfig) {
                        $tsconfig = $candidateTsconfig
                        break
                    }
                    $dir = [System.IO.Path]::GetDirectoryName($dir)
                }

                if ($tsconfig) {
                    Write-Host "Running TypeScript check on $filePath..." -ForegroundColor Cyan
                    $projectDir = [System.IO.Path]::GetDirectoryName($tsconfig)

                    # Run tsc from project directory with incremental compilation
                    Push-Location $projectDir
                    try {
                        $tscOutput = npx tsc --noEmit --incremental --pretty false 2>&1
                        if ($LASTEXITCODE -eq 0) {
                            # No errors
                        } else {
                            # Parse errors for current file only
                            $fileErrors = $tscOutput | Where-Object { $_ -match "^$([regex]::Escape($filePath)):" } | Select-Object -First 5

                            if ($fileErrors.Count -gt 0) {
                                Write-Host "TypeScript found $($fileErrors.Count) error(s) in ${filePath}:" -ForegroundColor Yellow
                                $fileErrors | ForEach-Object {
                                    Write-Host "  $_" -ForegroundColor Yellow
                                }
                            }
                            # Don't block on TypeScript errors
                        }
                    } finally {
                        Pop-Location
                    }
                }
            }
        }
    }

    'rs' {
        # Skip if cargo not available
        if (-not $script:tools.cargo) { break }

        # Find nearest Cargo.toml
        $dir = [System.IO.Path]::GetDirectoryName($filePath)
        $cargoToml = $null

        while ($dir -and $dir -ne [System.IO.Path]::GetPathRoot($dir)) {
            $candidateCargoToml = Join-Path $dir "Cargo.toml"
            if (Test-Path $candidateCargoToml) {
                $cargoToml = $candidateCargoToml
                break
            }
            $dir = [System.IO.Path]::GetDirectoryName($dir)
        }

        if ($cargoToml) {
            $projectDir = [System.IO.Path]::GetDirectoryName($cargoToml)
            Push-Location $projectDir

            try {
                # Format with rustfmt
                Write-Host "Running rustfmt on $filePath..." -ForegroundColor Cyan
                cargo fmt --check 2>$null | Out-Null
                if ($LASTEXITCODE -ne 0) {
                    # Format the file
                    cargo fmt 2>$null | Out-Null
                    if ($LASTEXITCODE -eq 0) {
                        Write-Host "✓ Formatted $filePath with rustfmt" -ForegroundColor Green
                    }
                }

                # Lint with clippy
                Write-Host "Running cargo clippy on $filePath..." -ForegroundColor Cyan
                $clippyOutput = cargo clippy --message-format json --quiet 2>$null

                if ($clippyOutput) {
                    try {
                        $warnings = $clippyOutput -split "`n" | ForEach-Object {
                            try {
                                $_ | ConvertFrom-Json
                            } catch {
                                $null
                            }
                        } | Where-Object {
                            $_.reason -eq "compiler-message" -and
                            $_.message.spans[0].file_name -eq $filePath -and
                            $_.message.level -eq "warning"
                        } | Select-Object -First 10

                        if ($warnings.Count -gt 0) {
                            Write-Host "Clippy found $($warnings.Count) warning(s) in ${filePath}:" -ForegroundColor Yellow
                            $warnings | ForEach-Object {
                                Write-Host "  Line $($_.message.spans[0].line_start): $($_.message.message)" -ForegroundColor Yellow
                            }
                        }
                    } catch {
                        # Failed to parse clippy output
                    }
                }

                # Check compilation
                Write-Host "Running cargo check on $filePath..." -ForegroundColor Cyan
                $checkOutput = cargo check --message-format json --quiet 2>$null

                if ($checkOutput) {
                    try {
                        $errors = $checkOutput -split "`n" | ForEach-Object {
                            try {
                                $_ | ConvertFrom-Json
                            } catch {
                                $null
                            }
                        } | Where-Object {
                            $_.reason -eq "compiler-message" -and
                            $_.message.spans[0].file_name -eq $filePath -and
                            $_.message.level -eq "error"
                        } | Select-Object -First 5

                        if ($errors.Count -gt 0) {
                            Write-Host "Cargo check found $($errors.Count) error(s) in ${filePath}:" -ForegroundColor Red
                            $errors | ForEach-Object {
                                Write-Host "  Line $($_.message.spans[0].line_start): $($_.message.message)" -ForegroundColor Red
                            }
                            Pop-Location
                            exit 2  # Block on compilation errors
                        }
                    } catch {
                        # Failed to parse cargo check output
                        Write-Host "Cargo check failed for $filePath" -ForegroundColor Red
                        Pop-Location
                        exit 2
                    }
                }
            } finally {
                Pop-Location
            }
        }
    }

    {$_ -in 'sh','bash'} {
        # Skip if shellcheck not available
        if (-not $script:tools.shellcheck) { break }

        Write-Host "Running shellcheck on $filePath..." -ForegroundColor Cyan
        $shellcheckOutput = shellcheck $filePath 2>&1

        if ($LASTEXITCODE -ne 0) {
            # Show first 10 lines of output
            $shellcheckOutput | Select-Object -First 10 | ForEach-Object {
                Write-Host $_ -ForegroundColor Red
            }
            exit 2  # Block on errors
        }
    }
}

# Success if no linter matched or all checks passed
exit 0
