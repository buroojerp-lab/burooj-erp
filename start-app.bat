@echo off
cd /d "E:\BuroojERP_Windows\burooj-erp"
powershell -WindowStyle Hidden -Command "Get-NetTCPConnection -LocalPort 5001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
start "" cmd /c "npm run electron:dev > "%TEMP%\burooj-erp.log" 2>&1"
