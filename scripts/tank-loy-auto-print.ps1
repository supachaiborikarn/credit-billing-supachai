param(
    [switch]$CheckOnly,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$InstallDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigPath = Join-Path $InstallDirectory 'config.json'
$StatePath = Join-Path $InstallDirectory 'state.json'
$LogDirectory = Join-Path $InstallDirectory 'logs'

function Write-AgentLog {
    param([string]$Message)

    if (-not (Test-Path $LogDirectory)) {
        New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
    }

    $Timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $Line = "[$Timestamp] $Message"
    Add-Content -Path (Join-Path $LogDirectory 'auto-print.log') -Value $Line -Encoding UTF8
    Write-Output $Line
}

function Save-AgentState {
    param([hashtable]$State)

    $TemporaryPath = "$StatePath.tmp"
    $State | ConvertTo-Json -Depth 5 | Set-Content -Path $TemporaryPath -Encoding UTF8
    Move-Item -Path $TemporaryPath -Destination $StatePath -Force
}

function Read-AgentState {
    if (-not (Test-Path $StatePath)) {
        return $null
    }

    try {
        return Get-Content -Raw -Path $StatePath | ConvertFrom-Json
    }
    catch {
        Write-AgentLog "State file could not be read: $($_.Exception.Message)"
        return $null
    }
}

function Test-TcpPort {
    param(
        [string]$HostName,
        [int]$Port,
        [int]$TimeoutMilliseconds = 3000
    )

    $Client = New-Object System.Net.Sockets.TcpClient
    try {
        $AsyncResult = $Client.BeginConnect($HostName, $Port, $null, $null)
        if (-not $AsyncResult.AsyncWaitHandle.WaitOne($TimeoutMilliseconds, $false)) {
            return $false
        }
        $Client.EndConnect($AsyncResult)
        return $true
    }
    catch {
        return $false
    }
    finally {
        $Client.Close()
    }
}

function Get-PrinterConnection {
    param([string]$PrinterBaseUrl)

    $Uri = [Uri]$PrinterBaseUrl
    $Port = $Uri.Port
    if ($Port -le 0) {
        $Port = if ($Uri.Scheme -eq 'https') { 443 } else { 80 }
    }

    return @{
        Host = $Uri.Host
        Port = $Port
    }
}

function Get-DailyReport {
    param([pscustomobject]$Config)

    $AppUrl = $Config.AppUrl.TrimEnd('/')
    $Headers = @{ Authorization = "Bearer $($Config.Token)" }
    return Invoke-RestMethod `
        -Method Get `
        -Uri "$AppUrl/api/automation/tank-loy/daily-report" `
        -Headers $Headers `
        -TimeoutSec 60 `
        -UseBasicParsing
}

function Send-EpsonPrint {
    param(
        [pscustomobject]$Config,
        [string]$PrintXml
    )

    $DeviceId = [Uri]::EscapeDataString([string]$Config.PrinterDeviceId)
    $PrinterUrl = $Config.PrinterBaseUrl.TrimEnd('/')
    $Endpoint = "$PrinterUrl/cgi-bin/epos/service.cgi?devid=$DeviceId&timeout=30000"
    $Soap = '<?xml version="1.0" encoding="utf-8"?>' +
        '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">' +
        '<s:Body>' + $PrintXml + '</s:Body></s:Envelope>'
    $Utf8 = New-Object System.Text.UTF8Encoding($false)
    $Body = $Utf8.GetBytes($Soap)
    $Headers = @{
        'SOAPAction' = '""'
        'If-Modified-Since' = 'Thu, 01 Jan 1970 00:00:00 GMT'
    }

    $Response = Invoke-WebRequest `
        -Method Post `
        -Uri $Endpoint `
        -Headers $Headers `
        -ContentType 'text/xml; charset=utf-8' `
        -Body $Body `
        -TimeoutSec 45 `
        -UseBasicParsing

    [xml]$ResponseXml = $Response.Content
    $ResponseNode = $ResponseXml.SelectSingleNode("//*[local-name()='response']")
    if ($null -eq $ResponseNode) {
        throw 'Printer returned an unreadable response.'
    }

    if ($ResponseNode.GetAttribute('success') -ne 'true') {
        $Code = $ResponseNode.GetAttribute('code')
        throw "Printer rejected the job. Code: $Code"
    }
}

if (-not (Test-Path $ConfigPath)) {
    throw "Missing configuration file: $ConfigPath"
}

$Config = Get-Content -Raw -Path $ConfigPath | ConvertFrom-Json
$Connection = Get-PrinterConnection -PrinterBaseUrl $Config.PrinterBaseUrl

if ($CheckOnly) {
    Write-AgentLog 'Running connection check.'
    $Report = Get-DailyReport -Config $Config
    Write-AgentLog "Report API connected. Date: $($Report.reportDate), ready: $($Report.ready)."

    if (-not (Test-TcpPort -HostName $Connection.Host -Port $Connection.Port)) {
        throw "Printer is not reachable at $($Connection.Host):$($Connection.Port)."
    }

    Write-AgentLog "Printer network connected at $($Connection.Host):$($Connection.Port)."
    exit 0
}

$RetryMinutes = [Math]::Max(1, [int]$Config.RetryMinutes)
$MaxAttempts = [Math]::Max(1, [int]([Math]::Floor([int]$Config.MaxWaitMinutes / $RetryMinutes) + 1))

for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt += 1) {
    try {
        $Report = Get-DailyReport -Config $Config
    }
    catch {
        Write-AgentLog "Report API failed on attempt $Attempt of $MaxAttempts: $($_.Exception.Message)"
        if ($Attempt -lt $MaxAttempts) {
            Start-Sleep -Seconds ($RetryMinutes * 60)
            continue
        }
        exit 1
    }

    $State = Read-AgentState
    if (-not $Force -and $null -ne $State -and $State.reportDate -eq $Report.reportDate) {
        if ($State.status -eq 'printed') {
            Write-AgentLog "Report $($Report.reportDate) was already printed. Skipping duplicate."
            exit 0
        }

        if ($State.status -eq 'printing' -or $State.status -eq 'unknown') {
            Write-AgentLog "Report $($Report.reportDate) has an uncertain previous result. Manual check is required before reprinting."
            exit 2
        }
    }

    if (-not $Report.ready) {
        $ReasonText = ($Report.reasons -join '; ')
        Write-AgentLog "Report $($Report.reportDate) is not ready on attempt $Attempt of $MaxAttempts: $ReasonText"
        if ($Attempt -lt $MaxAttempts) {
            Start-Sleep -Seconds ($RetryMinutes * 60)
            continue
        }
        exit 3
    }

    if (-not (Test-TcpPort -HostName $Connection.Host -Port $Connection.Port)) {
        Write-AgentLog "Printer is not reachable on attempt $Attempt of $MaxAttempts at $($Connection.Host):$($Connection.Port)."
        if ($Attempt -lt $MaxAttempts) {
            Start-Sleep -Seconds ($RetryMinutes * 60)
            continue
        }
        exit 4
    }

    Save-AgentState -State @{
        reportDate = $Report.reportDate
        jobId = $Report.jobId
        status = 'printing'
        startedAt = (Get-Date).ToString('o')
    }

    try {
        Send-EpsonPrint -Config $Config -PrintXml $Report.xml
        Save-AgentState -State @{
            reportDate = $Report.reportDate
            jobId = $Report.jobId
            status = 'printed'
            printedAt = (Get-Date).ToString('o')
        }
        Write-AgentLog "Report $($Report.reportDate) printed successfully."
        exit 0
    }
    catch {
        Save-AgentState -State @{
            reportDate = $Report.reportDate
            jobId = $Report.jobId
            status = 'unknown'
            failedAt = (Get-Date).ToString('o')
            error = $_.Exception.Message
        }
        Write-AgentLog "Printer result is uncertain for report $($Report.reportDate): $($_.Exception.Message)"
        exit 5
    }
}

exit 1
