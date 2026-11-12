$ErrorActionPreference = 'Stop'
$sourcePath = Join-Path $PSScriptRoot 'AppJs.html'
$bundlePath = Join-Path $PSScriptRoot 'AppBundle.html'
$source = [IO.File]::ReadAllText($sourcePath) -replace '^\s*<script>\s*','' -replace '\s*</script>\s*$',''
$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($source))
[IO.File]::WriteAllText($bundlePath, $encoded, [Text.UTF8Encoding]::new($false))
Write-Output 'Client bundle updated.'
