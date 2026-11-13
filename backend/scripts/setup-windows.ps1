# One-time setup of the API on a Windows PC with PostgreSQL installed.
#  1. Installs the Node.js packages
#  2. Creates a "maritime" database account and the maritime_heritage database
#  3. Writes backend\.env with fresh random secrets (never committed to git)
#  4. Builds the API, creates the tables and loads the sample content
# Safe to run again: it keeps an existing .env and database. Log: backend\logs\setup.log

$ErrorActionPreference = 'Stop'
$backend = Split-Path -Parent $PSScriptRoot
$project = Split-Path -Parent $backend
Set-Location $backend
New-Item -ItemType Directory -Force (Join-Path $backend 'logs') | Out-Null
$log = Join-Path $backend 'logs\setup.log'
"=== setup $(Get-Date -Format s) ===" | Out-File $log -Encoding utf8
function Log($m) { $m | Out-File $log -Append -Encoding utf8 }
function Step($m) { Write-Host ''; Write-Host $m -ForegroundColor Cyan; Log $m }
function Fail($m) { Write-Host $m -ForegroundColor Red; Log "FAILED: $m"; Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue; Read-Host 'Press Enter to close'; exit 1 }
function RandomText([int]$n) { $c = [char[]](48..57 + 65..90 + 97..122); -join (1..$n | ForEach-Object { $c | Get-Random }) }

try {
  Write-Host 'Maritime Safety Heritage Archive - API setup' -ForegroundColor Cyan

  Step '1/4  Checking Node.js and installing packages'
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail 'Node.js is not installed. Install the LTS version from https://nodejs.org and run this again.' }
  Write-Host "Node.js $(node -v)"
  & npm install --no-audit --no-fund 2>&1 | Tee-Object -FilePath $log -Append | Select-Object -Last 3
  if ($LASTEXITCODE -ne 0) { Fail 'npm install failed. Check your internet connection and the log.' }

  $envPath = Join-Path $backend '.env'
  if (Test-Path $envPath) {
    Step '2/4  Database: .env already exists, keeping it'
  } else {
    Step '2/4  Creating the database account and database'
    $psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
    if (-not $psql) { Fail 'PostgreSQL was not found in C:\Program Files\PostgreSQL. Install PostgreSQL and run this again.' }
    Log "psql: $($psql.FullName)"

    # Use the postgres password from LOCAL-DEV-CREDENTIALS.txt if it is there, otherwise ask
    $pgPw = $null
    $cred = Join-Path $project 'LOCAL-DEV-CREDENTIALS.txt'
    if (Test-Path $cred) {
      $line = Get-Content $cred | Where-Object { $_ -match '^\s*password:\s*(.+)$' } | Select-Object -First 1
      if ($line -match '^\s*password:\s*(.+)$') { $pgPw = $Matches[1].Trim() }
    }
    if (-not $pgPw) {
      Write-Host 'Type the password of the "postgres" user (chosen when PostgreSQL was installed). Nothing shows while you type.'
      $s = Read-Host -AsSecureString 'postgres password'
      $pgPw = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
    }
    $env:PGPASSWORD = $pgPw
    $env:PGCLIENTENCODING = 'UTF8'
    function Psql([string]$db, [string]$sql) {
      $out = & $psql.FullName -h localhost -U postgres -d $db -w -v ON_ERROR_STOP=1 -tAc $sql 2>&1
      $code = $LASTEXITCODE
      Log "psql($db) exit $code :: $(($out | Out-String).Trim() -replace "PASSWORD '[^']*'", "PASSWORD '***'")"
      return @{ ok = ($code -eq 0); out = ($out | Out-String).Trim() }
    }
    $t = Psql 'postgres' 'select 1'
    if (-not $t.ok) { Fail "Could not sign in to PostgreSQL as postgres: $($t.out)" }

    $appPw = RandomText 32
    $exists = (Psql 'postgres' "select 1 from pg_roles where rolname = 'maritime'").out -match '^1'
    $verb = if ($exists) { 'ALTER' } else { 'CREATE' }
    $r = Psql 'postgres' "$verb ROLE maritime WITH LOGIN PASSWORD '$appPw'"
    if (-not $r.ok) { Fail "Could not create the maritime account: $($r.out)" }
    if (-not ((Psql 'postgres' "select 1 from pg_database where datname = 'maritime_heritage'").out -match '^1')) {
      $r = Psql 'postgres' "CREATE DATABASE maritime_heritage OWNER maritime ENCODING 'UTF8' TEMPLATE template0"
      if (-not $r.ok) { Fail "Could not create the database: $($r.out)" }
    }
    $r = Psql 'maritime_heritage' 'ALTER SCHEMA public OWNER TO maritime; CREATE EXTENSION IF NOT EXISTS pgcrypto'
    if (-not $r.ok) { Fail "Could not prepare the database: $($r.out)" }
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    Write-Host 'Database maritime_heritage ready.' -ForegroundColor Green

    Step '3/4  Writing .env with new random secrets'
    $text = Get-Content (Join-Path $backend '.env.example') -Raw
    $set = @{
      'DB_USER' = 'maritime'; 'DB_PASSWORD' = $appPw; 'DB_NAME' = 'maritime_heritage'
      'JWT_ACCESS_SECRET' = (RandomText 48); 'JWT_REFRESH_SECRET' = (RandomText 48); 'MEDIA_SIGNING_SECRET' = (RandomText 48)
      'SEED_ADMIN_EMAIL' = 'admin@demo.ke'; 'SEED_ADMIN_PASSWORD' = 'admin1234'
      'CORS_ORIGINS' = 'http://localhost:5173,http://localhost:8080,http://127.0.0.1:5500'
    }
    foreach ($k in $set.Keys) { $text = [regex]::Replace($text, "(?m)^$k=.*$", "$k=$($set[$k])") }
    [IO.File]::WriteAllText($envPath, $text)
    Write-Host '.env written (it stays on this PC and is never committed).' -ForegroundColor Green
  }

  Step '4/4  Building the API, creating tables and loading sample content'
  & npm run build 2>&1 | Tee-Object -FilePath $log -Append | Select-Object -Last 2
  if ($LASTEXITCODE -ne 0) { Fail 'The build failed. See the log.' }
  & npm run setup-db 2>&1 | Tee-Object -FilePath $log -Append
  if ($LASTEXITCODE -ne 0) { Fail 'Creating the tables failed. See the log.' }

  Log 'RESULT: success'
  Write-Host ''
  Write-Host 'Setup complete. Double-click 2-START-API.bat to run the API.' -ForegroundColor Green
  Write-Host 'Demo accounts: researcher@demo.ke / demo1234 and admin@demo.ke / admin1234 (local only).'
  Read-Host 'Press Enter to close'
} catch {
  Fail "Unexpected error: $($_.Exception.Message)"
}
