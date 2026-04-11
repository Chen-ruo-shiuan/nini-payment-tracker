$env:Path = 'C:\Program Files\nodejs;C:\Users\ooxxx\AppData\Roaming\npm;' + $env:Path
Set-Location 'C:\Users\ooxxx\OneDrive\Desktop\nini-payment-tracker'
Write-Host "=== Railway Status ===" -ForegroundColor Cyan
& 'C:\Users\ooxxx\AppData\Roaming\npm\railway.ps1' status
Write-Host ""
Write-Host "=== Recent Logs ===" -ForegroundColor Cyan
& 'C:\Users\ooxxx\AppData\Roaming\npm\railway.ps1' logs --tail 60
