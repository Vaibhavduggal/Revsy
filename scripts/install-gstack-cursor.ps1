# Install gstack for Cursor (run once per machine). Requires Git Bash or WSL for ./setup.
$ErrorActionPreference = "Stop"
$dest = Join-Path $env:USERPROFILE ".claude\skills\gstack"
if (-not (Test-Path $dest)) {
  git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git $dest
}
Write-Host "gstack cloned to $dest"
Write-Host "Next: open Git Bash and run:"
Write-Host "  cd '$dest' && ./setup --host cursor"
Write-Host "Optional team bootstrap from Revsy repo:"
Write-Host "  bash '$dest/bin/gstack-team-init' optional"
