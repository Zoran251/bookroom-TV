$ErrorActionPreference = 'Stop'

$blueStacksPlayer = Join-Path $env:ProgramFiles 'BlueStacks_nxt\HD-Player.exe'
if (-not (Test-Path -LiteralPath $blueStacksPlayer -PathType Leaf)) {
    throw "BlueStacks player was not found at '$blueStacksPlayer'. Install BlueStacks or update this path."
}

$protocolKey = 'HKCU:\Software\Classes\bookroom-power-tv'
$openCommandKey = Join-Path $protocolKey 'shell\open\command'
$openCommand = '"{0}" --instance Pie64 --cmd launchApp --package "power.bestapps.uk" --source desktop_shortcut' -f $blueStacksPlayer

New-Item -Path $protocolKey -Force | Out-Null
Set-Item -LiteralPath $protocolKey -Value 'URL:Launch POWER TV in BlueStacks'
New-ItemProperty -LiteralPath $protocolKey -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
New-Item -Path $openCommandKey -Force | Out-Null
Set-Item -LiteralPath $openCommandKey -Value $openCommand

Write-Host 'POWER TV browser launch registered for this Windows user.'
Write-Host "BlueStacks player: $blueStacksPlayer"
Write-Host 'Close and reopen the browser, then click the TV tile in the Hotel TV console.'
