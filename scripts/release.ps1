Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$releaseDir = Join-Path $HOME "Downloads/release"

$chromeDistDir = Join-Path $repoRoot "dist_chrome"
$firefoxDistDir = Join-Path $repoRoot "dist_firefox"

$chromeZipPath = Join-Path $releaseDir "chrome.zip"
$firefoxZipPath = Join-Path $releaseDir "firefox.zip"
$sourceZipPath = Join-Path $releaseDir "source.zip"
$changelogTempPath = Join-Path $repoRoot "changelogs.txt"
$changelogPath = Join-Path $releaseDir "changelogs.txt"

function New-ZipFromDirectoryContent {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourceDir,
    [Parameter(Mandatory = $true)]
    [string]$ZipPath,
    [string[]]$ExcludeDirNames = @()
  )

  if (-not (Test-Path -LiteralPath $SourceDir -PathType Container)) {
    throw "Directory not found: $SourceDir"
  }

  if (Test-Path -LiteralPath $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
  }

  Add-Type -AssemblyName "System.IO.Compression"
  Add-Type -AssemblyName "System.IO.Compression.FileSystem"

  $sourceRoot = [System.IO.Path]::GetFullPath($SourceDir)
  $excludeSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($name in $ExcludeDirNames) {
    if ([string]::IsNullOrWhiteSpace($name)) { continue }
    [void]$excludeSet.Add($name.Trim())
  }

  $archive = [System.IO.Compression.ZipFile]::Open($ZipPath, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    $files = Get-ChildItem -LiteralPath $sourceRoot -Recurse -File
    foreach ($file in $files) {
      $relativePath = [System.IO.Path]::GetRelativePath($sourceRoot, $file.FullName)
      $segments = $relativePath -split "[/\\]"
      $isExcluded = $false
      foreach ($segment in $segments) {
        if ($excludeSet.Contains($segment)) {
          $isExcluded = $true
          break
        }
      }
      if ($isExcluded) { continue }

      $entryPath = ($relativePath -replace "\\", "/")
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $archive,
        $file.FullName,
        $entryPath,
        [System.IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
    }
  }
  finally {
    $archive.Dispose()
  }
}

function New-SourceZip {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,
    [Parameter(Mandatory = $true)]
    [string]$ZipPath
  )

  Push-Location $RepoRoot
  try {
    $latestCommit = (git rev-parse --verify HEAD).Trim()
    if ([string]::IsNullOrWhiteSpace($latestCommit)) {
      throw "Unable to resolve latest commit (HEAD)."
    }

    if (Test-Path -LiteralPath $ZipPath) {
      Remove-Item -LiteralPath $ZipPath -Force
    }

    & git archive --format=zip "--output=$ZipPath" $latestCommit
    if ($LASTEXITCODE -ne 0) {
      throw "git archive failed with exit code $LASTEXITCODE"
    }
  }
  finally {
    Pop-Location
  }
}

function New-ChangelogFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$OutputPath
  )

  $tags = @(git for-each-ref --sort=-creatordate --format="%(refname:strip=2)" refs/tags)
  if (-not $tags -or $tags.Count -lt 2) {
    throw "At least two tags are required to generate changelog."
  }

  $latestTag = $tags[0].Trim()
  $previousTag = $tags[1].Trim()
  $shortLog = git log "$previousTag..$latestTag" --pretty=format:"%s"

  $content = @(
    "$previousTag..$latestTag"
    ""
    $shortLog
  )
  Set-Content -LiteralPath $OutputPath -Value $content -Encoding UTF8
}

Push-Location $repoRoot
try {
  New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null

  pnpm build:firefox
  pnpm build:chrome

  New-ZipFromDirectoryContent -SourceDir $chromeDistDir -ZipPath $chromeZipPath -ExcludeDirNames @(".vite")
  New-ZipFromDirectoryContent -SourceDir $firefoxDistDir -ZipPath $firefoxZipPath -ExcludeDirNames @(".vite")

  New-SourceZip -RepoRoot $repoRoot -ZipPath $sourceZipPath
  New-ChangelogFile -OutputPath $changelogTempPath
  Move-Item -LiteralPath $changelogTempPath -Destination $changelogPath -Force

  Write-Host "Release packages created:"
  Write-Host "  $chromeZipPath"
  Write-Host "  $firefoxZipPath"
  Write-Host "  $sourceZipPath"
  Write-Host "  $changelogPath"
}
finally {
  Pop-Location
}
