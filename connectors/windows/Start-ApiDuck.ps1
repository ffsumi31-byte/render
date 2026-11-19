param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ClaudeArgs
)
$ErrorActionPreference = 'Stop'
$baseUrl = 'https://apiduh.netlify.app'

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Error 'Claude Code CLI was not found. Install it from Anthropic first, then run this launcher.'
    exit 1
}

$secureKey = Read-Host 'Customer API key (sk-gw-...) — input hidden' -AsSecureString
$customerKey = [Net.NetworkCredential]::new('', $secureKey).Password
if ($customerKey -notmatch '^sk-gw-[a-f0-9]{64}$') {
    $customerKey = $null
    Write-Error 'Invalid customer key format. Use the key issued by the ApiDuck administrator.'
    exit 1
}

$oldBaseUrl = $env:ANTHROPIC_BASE_URL
$oldAuthToken = $env:ANTHROPIC_AUTH_TOKEN
try {
    $env:ANTHROPIC_BASE_URL = $baseUrl
    $env:ANTHROPIC_AUTH_TOKEN = $customerKey
    Write-Host "Launching Claude Code through $baseUrl. The customer key is not saved by this script."
    & claude @ClaudeArgs
    exit $LASTEXITCODE
} finally {
    $customerKey = $null
    if ($null -eq $oldBaseUrl) { Remove-Item Env:ANTHROPIC_BASE_URL -ErrorAction SilentlyContinue }
    else { $env:ANTHROPIC_BASE_URL = $oldBaseUrl }
    if ($null -eq $oldAuthToken) { Remove-Item Env:ANTHROPIC_AUTH_TOKEN -ErrorAction SilentlyContinue }
    else { $env:ANTHROPIC_AUTH_TOKEN = $oldAuthToken }
}
