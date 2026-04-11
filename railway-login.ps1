$env:Path = 'C:\Program Files\nodejs;C:\Users\ooxxx\AppData\Roaming\npm;' + $env:Path
Write-Host "=== Railway 重新登入 ===" -ForegroundColor Cyan
Write-Host "請在瀏覽器中完成授權..." -ForegroundColor Yellow
railway login
Write-Host ""
Write-Host "=== 查看最新部署日誌 ===" -ForegroundColor Cyan
Set-Location 'C:\Users\ooxxx\OneDrive\Desktop\nini-payment-tracker'
railway logs --tail 80
