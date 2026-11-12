param([switch]$CompileDesktop, [switch]$SkipReplay, [switch]$UiSmoke)
$ErrorActionPreference = 'Stop'
$workspace = Split-Path $PSScriptRoot -Parent
$project = Join-Path $workspace 'durian scale V2/CanQuocHung'
$output = Join-Path $workspace 'artifacts/durian-fixes'
New-Item -ItemType Directory -Path $output -Force | Out-Null
function Restore-ToolZip([string]$Uri, [string]$Archive, [string]$Destination) {
    Invoke-WebRequest -UseBasicParsing -Uri $Uri -OutFile $Archive
    Expand-Archive -LiteralPath $Archive -DestinationPath $Destination -Force
}
$compiler = Join-Path $output 'compiler/tasks/net472/csc.exe'
if (!(Test-Path -LiteralPath $compiler)) {
    Restore-ToolZip 'https://api.nuget.org/v3-flatcontainer/microsoft.net.compilers.toolset/4.8.0/microsoft.net.compilers.toolset.4.8.0.nupkg' (Join-Path $output 'compiler.zip') (Join-Path $output 'compiler')
}
$json = Join-Path $workspace 'durian scale V2/packages/Newtonsoft.Json.13.0.4/lib/net45/Newtonsoft.Json.dll'
if (!(Test-Path -LiteralPath $json)) {
    Restore-ToolZip 'https://api.nuget.org/v3-flatcontainer/newtonsoft.json/13.0.4/newtonsoft.json.13.0.4.nupkg' (Join-Path $output 'newtonsoft.zip') (Join-Path $workspace 'durian scale V2/packages/Newtonsoft.Json.13.0.4')
}
$dapper = Join-Path $workspace 'durian scale V2/packages/Dapper.2.0.78/lib/net461/Dapper.dll'
$contrib = Join-Path $workspace 'durian scale V2/packages/Dapper.Contrib.2.0.78/lib/net461/Dapper.Contrib.dll'
$sqlite = Join-Path $output 'sqlite-test/lib/net46/System.Data.SQLite.dll'
if (!(Test-Path -LiteralPath $sqlite)) {
    Restore-ToolZip 'https://api.nuget.org/v3-flatcontainer/stub.system.data.sqlite.core.netframework/1.0.119/stub.system.data.sqlite.core.netframework.1.0.119.nupkg' (Join-Path $output 'sqlite-test.zip') (Join-Path $output 'sqlite-test')
}
$core = @('Class/BenchRecovery.cs','Class/BenchReceiptRepository.cs','Class/ScaleCardProtocol.cs','Class/LocalSecrets.cs','Class/configDatabase.cs',
    'weight_type/Bindable.cs','Model/tbweight.cs','Model/tbweight_detail.cs','Model/tbweight_entry.cs','Model/tbusers_group.cs')
$references = @($dapper,$contrib,$sqlite,'System.Security.dll','System.Data.dll','System.ComponentModel.DataAnnotations.dll','System.Windows.Forms.dll','System.Xml.Linq.dll')
$arguments = @('/nologo','/langversion:7.3','/target:exe',('/out:"' + (Join-Path $output 'ReliabilityTests.exe') + '"'))
$arguments += $references | ForEach-Object { '/reference:"' + $_ + '"' }
$arguments += '/reference:qhsjson="' + $json + '"'
$arguments += $core | ForEach-Object { '"' + (Join-Path $project $_) + '"' }
$arguments += '"' + (Join-Path $PSScriptRoot 'durian-tests/ReliabilityTests.cs') + '"'
$arguments += '"' + (Join-Path $PSScriptRoot 'durian-tests/RepositoryTests.cs') + '"'
$response = Join-Path $output 'core-tests.rsp'
$arguments | Set-Content -LiteralPath $response -Encoding UTF8
& $compiler ('@' + $response) 2>&1 | Tee-Object -FilePath (Join-Path $output 'core-tests-compile.log') | Where-Object { $_ -match 'error CS' }
if ($LASTEXITCODE -ne 0) { throw 'Reliability tests did not compile.' }
foreach ($dependency in @($json,$dapper,$contrib,$sqlite)) { Copy-Item -LiteralPath $dependency -Destination $output -Force }
foreach ($architecture in @('x64','x86')) {
    $native = Join-Path $output $architecture
    New-Item -ItemType Directory -Path $native -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $output "sqlite-test/build/net46/$architecture/SQLite.Interop.dll") -Destination $native -Force
}
if (!$SkipReplay) {
    & (Join-Path $output 'ReliabilityTests.exe')
    if ($LASTEXITCODE -ne 0) { throw 'Reliability tests failed.' }
}
if (!$CompileDesktop) { return }

# Compile all declared sources against supplied deployment assemblies, without starting the app.
[xml]$xml = Get-Content -LiteralPath (Join-Path $project 'QHS-Weight.csproj') -Raw
$ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$ns.AddNamespace('m', $xml.DocumentElement.NamespaceURI)
$lib = Join-Path $project 'bin/Release/lib'
$references = @()
foreach ($reference in $xml.SelectNodes('//m:Reference',$ns)) {
    $name = $reference.Include.Split(',')[0] + '.dll'
    $hint = $reference.SelectSingleNode('m:HintPath',$ns)
    if ($name -eq 'Newtonsoft.Json.dll') { continue }
    if ($hint -and (Test-Path -LiteralPath (Join-Path $project $hint.InnerText))) { $references += Join-Path $project $hint.InnerText }
    elseif (Test-Path -LiteralPath (Join-Path $lib $name)) { $references += Join-Path $lib $name }
    elseif (Test-Path -LiteralPath (Join-Path 'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/WPF' $name)) { $references += Join-Path 'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/WPF' $name }
    else { $references += $name }
}
$references += Join-Path $lib 'DetectLP.dll'
$references += Join-Path $lib 'netstandard.dll'
$references += Join-Path $lib 'Emgu.CV.dll'
$references += Join-Path $lib 'Emgu.Util.dll'
$arguments = @('/nologo','/langversion:7.3','/target:winexe','/unsafe+')
$arguments += $references | Select-Object -Unique | ForEach-Object { '/reference:"' + $_ + '"' }
$arguments += '/reference:qhsjson="' + $json + '"'
$arguments += $xml.SelectNodes('//m:Compile',$ns) | ForEach-Object { '"' + (Join-Path $project $_.Include) + '"' }
foreach ($flavour in @('local','APP')) {
    $branch = $arguments + ('/out:"' + (Join-Path $output "QHS-Weight-SourceCheck-$flavour.exe") + '"')
    if ($flavour -eq 'APP') { $branch += '/define:APP;DEBUG;TRACE' }
    $response = Join-Path $output "desktop-source-check-$flavour.rsp"
    $branch | Set-Content -LiteralPath $response -Encoding UTF8
    & $compiler ('@' + $response) 2>&1 | Tee-Object -FilePath (Join-Path $output "desktop-source-check-$flavour.log") | Where-Object { $_ -match 'error CS' }
    if ($LASTEXITCODE -ne 0) { throw "Desktop source check failed: $flavour" }
    Write-Output "PASS: desktop source compile ($flavour). Resources/native runtime packaging not included."
}
if ($UiSmoke) {
    $empty = Join-Path $output 'empty-ui.resources'
    $writer = New-Object System.Resources.ResourceWriter($empty)
    $writer.Generate(); $writer.Close()
    $branch = $arguments + @('/target:exe','/main:UiSmokeTests',('/out:"' + (Join-Path $output 'UiSmokeTests.exe') + '"'),
        ('"' + (Join-Path $PSScriptRoot 'durian-tests/UiSmokeTests.cs') + '"'),
        ('/resource:"' + $empty + '",QHSWeight.GUI.frmCans.resources'))
    $response = Join-Path $output 'ui-smoke.rsp'
    $branch | Set-Content -LiteralPath $response -Encoding UTF8
    & $compiler ('@' + $response) 2>&1 | Tee-Object -FilePath (Join-Path $output 'ui-smoke-compile.log') | Where-Object { $_ -match 'error CS' }
    if ($LASTEXITCODE -ne 0) { throw 'UI smoke test did not compile.' }
    Push-Location $output
    try {
        & (Join-Path $output 'UiSmokeTests.exe') $lib
        if ($LASTEXITCODE -ne 0) { throw 'UI smoke test failed.' }
    } finally { Pop-Location }
}
