param([string]$ProjectDir=(Get-Location).Path,[string]$ArchivePath)
$ErrorActionPreference='Stop'
# Windows equivalent of the Sites package-site.sh helper. Preserve staging for audit.
$projectRoot=(Resolve-Path -LiteralPath $ProjectDir).Path
if(-not (Test-Path -LiteralPath (Join-Path $projectRoot 'dist/server/index.js'))){throw 'Build output missing'}
if(-not $ArchivePath){$ArchivePath=Join-Path $projectRoot 'site-build.tar.gz'}
$outputRoot=Join-Path $projectRoot 'outputs'
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$stagePath=Join-Path $outputRoot ('package-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stagePath | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot 'dist') -Destination $stagePath -Recurse
$metadataPath=Join-Path $stagePath 'dist/.openai'
New-Item -ItemType Directory -Path $metadataPath -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $projectRoot '.openai/hosting.json') -Destination $metadataPath -Force
if(-not (Test-Path -LiteralPath (Join-Path $metadataPath 'drizzle'))){Copy-Item -LiteralPath (Join-Path $projectRoot 'drizzle') -Destination $metadataPath -Recurse}
& tar.exe -C $stagePath -czf $ArchivePath dist
if($LASTEXITCODE -ne 0){throw 'Archive failed'}
$entries=& tar.exe -tzf $ArchivePath
if($entries -notcontains 'dist/server/index.js' -or $entries -notcontains 'dist/.openai/hosting.json'){throw 'Archive contract failed'}
Write-Output $ArchivePath
