Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
Set-Location $repoRoot

git rev-parse --git-dir *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Output "[checkpoint] not a git repo, skipping"
  exit 0
}

$status = git status --porcelain
if ([string]::IsNullOrWhiteSpace(($status -join ""))) {
  Write-Output "[checkpoint] no changes, skipping"
  exit 0
}

$branch = (git rev-parse --abbrev-ref HEAD 2>$null).Trim()
if ([string]::IsNullOrWhiteSpace($branch) -or $branch -eq "HEAD") {
  $branch = "session-checkpoint"
  Write-Output "[checkpoint] detached HEAD -> switching to $branch"
  git checkout -B $branch *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Output "[checkpoint] failed to switch to $branch, aborting"
    exit 0
  }
}

if ($branch -eq "main" -or $branch -eq "master") {
  Write-Output "[checkpoint] on protected branch '$branch' -> creating/switching to session-checkpoint"
  git checkout -B session-checkpoint *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Output "[checkpoint] failed to switch to session-checkpoint, aborting"
    exit 0
  }
  $branch = "session-checkpoint"
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$message = "chore: auto session checkpoint $timestamp"

git add -A
$commitOutput = git commit -m $message --allow-empty 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Output "[checkpoint] commit failed (perhaps pre-commit hook?). Try manually."
  exit 0
}

$shortSha = (git rev-parse --short HEAD).Trim()
Write-Output "[checkpoint] committed $shortSha on '$branch'"

git remote get-url origin *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Output "[checkpoint] no 'origin' remote, skipping push"
  exit 0
}

git ls-remote --exit-code --heads origin $branch *> $null
if ($LASTEXITCODE -eq 0) {
  git push origin $branch *> $null
} else {
  git push -u origin $branch *> $null
}

if ($LASTEXITCODE -eq 0) {
  Write-Output "[checkpoint] pushed to origin/$branch"
} else {
  Write-Output "[checkpoint] push failed (offline / auth?). Commit saved locally; try 'git push' later."
}

exit 0
