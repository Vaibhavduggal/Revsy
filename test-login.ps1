# Test client login
$body = '{"email":"owner@business.com","password":"demo123"}'
Write-Host "=== Testing client login ==="
$r = Invoke-WebRequest -Uri "http://localhost:4000/api/login" -Method POST -ContentType "application/json" -Body $body -ErrorAction SilentlyContinue
Write-Host "Status: $($r.StatusCode)"
Write-Host "Response: $($r.Content)"
Write-Host ""

# Test demo login
Write-Host "=== Testing demo login ==="
$r2 = Invoke-WebRequest -Uri "http://localhost:4000/api/login/demo" -Method POST -ContentType "application/json" -ErrorAction SilentlyContinue
Write-Host "Status: $($r2.StatusCode)"
Write-Host "Response: $($r2.Content)"