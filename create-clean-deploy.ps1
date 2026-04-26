# PowerShell script to create a clean deployment ZIP for Azure App Service (source code only)
# Excludes node_modules, .next, .git, .env files, and previous deployment zips

# 1. Remove any old deployment zips
Remove-Item -Force -ErrorAction SilentlyContinue web-deploy.zip

# 2. Select only the files/folders to include (source code only)
$src = Get-ChildItem -Force | Where-Object { \
    $_.Name -notin @('node_modules','.next','.git','.github','.env','.env.production','.env.uat','web-deploy.zip') \
    -and $_.Name -notlike 'web-deploy*.zip' \
}

# 3. Create the deployment ZIP
Compress-Archive -Path $src.FullName -DestinationPath .\web-deploy.zip -Force

Write-Host "Created clean deployment package: web-deploy.zip"
