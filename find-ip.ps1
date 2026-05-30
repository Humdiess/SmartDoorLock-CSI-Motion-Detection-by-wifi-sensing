# Script untuk menemukan IP Address komputer
# Jalankan dengan: powershell -ExecutionPolicy Bypass -File find-ip.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SMART DOOR LOCK - IP Finder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Dapatkan semua network adapters yang aktif
$adapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notlike "127.*" -and 
    $_.IPAddress -notlike "169.254.*" -and
    $_.PrefixOrigin -eq "Dhcp" -or $_.PrefixOrigin -eq "Manual"
}

if ($adapters.Count -eq 0) {
    Write-Host "❌ Tidak ada network adapter aktif ditemukan!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Pastikan komputer terhubung ke WiFi atau Ethernet." -ForegroundColor Yellow
    exit
}

Write-Host "✅ IP Address ditemukan:" -ForegroundColor Green
Write-Host ""

foreach ($adapter in $adapters) {
    $interface = Get-NetAdapter -InterfaceIndex $adapter.InterfaceIndex
    Write-Host "  Interface: $($interface.Name)" -ForegroundColor White
    Write-Host "  IP Address: $($adapter.IPAddress)" -ForegroundColor Yellow
    Write-Host "  Status: $($interface.Status)" -ForegroundColor Green
    Write-Host ""
}

# Ambil IP yang paling mungkin (WiFi atau Ethernet yang aktif)
$primaryIP = $adapters | Where-Object { 
    $interface = Get-NetAdapter -InterfaceIndex $_.InterfaceIndex
    $interface.Status -eq "Up" -and ($interface.Name -like "*Wi-Fi*" -or $interface.Name -like "*Ethernet*")
} | Select-Object -First 1

if ($primaryIP) {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "📋 GUNAKAN IP INI UNTUK ESP32:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  http://$($primaryIP.IPAddress):3000/api/motion" -ForegroundColor Green
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📝 Langkah selanjutnya:" -ForegroundColor Yellow
    Write-Host "  1. Buka file: firmware/SmartDoorLock.ino" -ForegroundColor White
    Write-Host "  2. Cari baris: const char* SERVER_URL = ..." -ForegroundColor White
    Write-Host "  3. Ganti dengan: const char* SERVER_URL = `"http://$($primaryIP.IPAddress):3000/api/motion`";" -ForegroundColor White
    Write-Host "  4. Upload ke ESP32" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "⚠️  Gunakan salah satu IP di atas untuk ESP32" -ForegroundColor Yellow
}

Write-Host "Tekan Enter untuk keluar..."
Read-Host
