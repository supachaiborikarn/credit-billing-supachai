param(
    [Parameter(Mandatory = $true)]
    [string]$AppUrl,

    [Parameter(Mandatory = $true)]
    [string]$PrinterIp,

    [string]$Token,
    [string]$ScheduleTime = '07:00',
    [string]$PrinterDeviceId = 'local_printer',
    [string]$InstallDirectory = "$env:ProgramData\Supachai\TankLoyAutoPrint"
)

$ErrorActionPreference = 'Stop'
$TaskName = 'Supachai Tank Loy Auto Print'
$PackagedTokenPath = Join-Path $PSScriptRoot 'print-agent-token.txt'

function Test-IsAdministrator {
    $Identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $Principal = New-Object Security.Principal.WindowsPrincipal($Identity)
    return $Principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdministrator)) {
    throw 'Run Windows PowerShell as Administrator before installing.'
}

if (-not $Token) {
    if (Test-Path $PackagedTokenPath) {
        $Token = (Get-Content -Raw -Path $PackagedTokenPath).Trim()
    }
    else {
        $SecureToken = Read-Host 'Enter TANK_LOY_PRINT_AGENT_TOKEN from Vercel' -AsSecureString
        $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureToken)
        try {
            $Token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer)
        }
        finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer)
        }
    }
}

if (-not $Token.Trim()) {
    throw 'Print agent token is required.'
}

try {
    $Time = [TimeSpan]::ParseExact($ScheduleTime, 'hh\:mm', [Globalization.CultureInfo]::InvariantCulture)
}
catch {
    throw 'ScheduleTime must use HH:mm, for example 07:00.'
}

$PrinterBaseUrl = if ($PrinterIp -match '^https?://') {
    $PrinterIp.TrimEnd('/')
}
else {
    "http://$($PrinterIp.Trim().TrimEnd('/'))"
}

$SourceScript = Join-Path $PSScriptRoot 'tank-loy-auto-print.ps1'
if (-not (Test-Path $SourceScript)) {
    throw "Missing worker script: $SourceScript"
}

New-Item -ItemType Directory -Path $InstallDirectory -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $InstallDirectory 'logs') -Force | Out-Null

$WorkerPath = Join-Path $InstallDirectory 'tank-loy-auto-print.ps1'
$ConfigPath = Join-Path $InstallDirectory 'config.json'
Copy-Item -Path $SourceScript -Destination $WorkerPath -Force

$Config = @{
    AppUrl = $AppUrl.TrimEnd('/')
    Token = $Token
    PrinterBaseUrl = $PrinterBaseUrl
    PrinterDeviceId = $PrinterDeviceId
    RetryMinutes = 10
    MaxWaitMinutes = 180
}
$Config | ConvertTo-Json | Set-Content -Path $ConfigPath -Encoding UTF8

if (Test-Path $PackagedTokenPath) {
    Remove-Item -Path $PackagedTokenPath -Force
}

& icacls.exe $ConfigPath /inheritance:r /grant:r '*S-1-5-18:(R)' '*S-1-5-32-544:(F)' | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'Could not protect the configuration file.'
}

$PowerShellPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$WorkerPath`""
$Action = New-ScheduledTaskAction -Execute $PowerShellPath -Argument $Arguments
$TriggerAt = [DateTime]::Today.Add($Time)
$Trigger = New-ScheduledTaskTrigger -Daily -At $TriggerAt
$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 4) `
    -MultipleInstances IgnoreNew
$Principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description 'Print yesterday Tank Loy daily report to Epson TM-m30III at 07:00.' `
    -Force | Out-Null

Write-Output "Installed scheduled task: $TaskName"
Write-Output "Schedule: daily at $ScheduleTime"
Write-Output "Files: $InstallDirectory"

if ([TimeZoneInfo]::Local.Id -ne 'SE Asia Standard Time') {
    Write-Warning "Windows time zone is '$([TimeZoneInfo]::Local.Id)'. Set it to Bangkok (UTC+07:00) so the task runs at 07:00 Thailand time."
}

& $PowerShellPath -NoProfile -ExecutionPolicy Bypass -File $WorkerPath -CheckOnly
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Installation finished, but the connection check failed with exit code $LASTEXITCODE. Check the log file before the first scheduled print."
}
