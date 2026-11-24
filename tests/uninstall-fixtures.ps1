# Uninstaller link-detection fixtures (issue #7).
# The shipped uninstaller (src/uninstall.js, generated cmd) refuses to continue
# when the app folder or any install-manifest folder is a link, and leaves
# linked folders in the data tree untouched. The Windows cmd reads the 'l'
# attribute; PowerShell exposes the same fact as the ReparsePoint flag. These
# fixtures pin that detection semantics on any OS with pwsh. Running the
# generated cmd itself is Windows-only and is covered by manual verification.
$ErrorActionPreference = 'Stop'
$root = Join-Path ([IO.Path]::GetTempPath()) ('apnp-linkfix-' + [guid]::NewGuid().ToString('n'))
New-Item -ItemType Directory -Path $root | Out-Null

function Is-Link([string]$p) {
  if (-not (Test-Path -LiteralPath $p)) { return $false }
  return [bool]((Get-Item -LiteralPath $p -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)
}
function Has-LinkAncestor([string]$base, [string]$p) {
  $cur = $p
  while ($cur -and $cur.Length -gt $base.Length) {
    if (Is-Link $cur) { return $true }
    $cur = Split-Path -Parent $cur
  }
  return $false
}
$results = [ordered]@{}
try {
  # clean tree: nothing detected
  New-Item -ItemType Directory -Path (Join-Path $root 'app/resources/app') -Force | Out-Null
  $results.clean_dir_ok = -not (Is-Link (Join-Path $root 'app'))
  $results.clean_nested_ok = -not (Has-LinkAncestor (Join-Path $root 'app') (Join-Path $root 'app/resources/app'))

  # linked folder (junction/symlink analog): detected
  $target = Join-Path $root 'real-target'
  New-Item -ItemType Directory -Path $target | Out-Null
  $link = Join-Path $root 'linked-dir'
  New-Item -ItemType SymbolicLink -Path $link -Target $target | Out-Null
  $results.link_dir_detected = Is-Link $link

  # linked parent of a manifest folder: ancestor walk detects it
  $parentTarget = Join-Path $root 'parent-target'
  New-Item -ItemType Directory -Path (Join-Path $parentTarget 'child') -Force | Out-Null
  $parentLink = Join-Path $root 'parent-link'
  New-Item -ItemType SymbolicLink -Path $parentLink -Target $parentTarget | Out-Null
  $results.link_ancestor_detected = Has-LinkAncestor $root (Join-Path $parentLink 'child')

  # linked folder inside the data tree: detected (uninstaller leaves it untouched)
  $data = Join-Path $root 'data'
  New-Item -ItemType Directory -Path $data | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $root 'elsewhere') | Out-Null
  $dataLink = Join-Path $data 'Cache'
  New-Item -ItemType SymbolicLink -Path $dataLink -Target (Join-Path $root 'elsewhere') | Out-Null
  $results.data_link_detected = Is-Link $dataLink

  $results | ConvertTo-Json | Write-Output
  $failed = @($results.Keys | Where-Object { -not $results[$_] })
  if ($failed.Count) { Write-Error "FAILED: $($failed -join ', ')"; exit 1 }
  Write-Output "uninstall-fixtures.ps1: $($results.Count) checks passed"
  exit 0
} finally {
  Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}
