$ErrorActionPreference = "Stop"

$resourceGroup = $env:CLICKASSIST_AZURE_RESOURCE_GROUP
if (!$resourceGroup) {
  $resourceGroup = "clickassist-prod-rg"
}

$location = $env:CLICKASSIST_AZURE_LOCATION
if (!$location) {
  $location = "eastus2"
}

$tableName = $env:CLICKASSIST_AZURE_TABLE_NAME
if (!$tableName) {
  $tableName = "ClickAssistLicenses"
}

$suffix = Get-Random -Minimum 10000 -Maximum 99999
$storageAccount = $env:CLICKASSIST_AZURE_STORAGE_ACCOUNT
if (!$storageAccount) {
  $storageAccount = "clickassistlic$suffix"
}

Write-Host "Creating resource group $resourceGroup in $location"
az group create --name $resourceGroup --location $location -o none

Write-Host "Creating storage account $storageAccount"
az storage account create `
  --name $storageAccount `
  --resource-group $resourceGroup `
  --location $location `
  --sku Standard_LRS `
  --kind StorageV2 `
  --min-tls-version TLS1_2 `
  --allow-blob-public-access false `
  -o none

$accountKey = az storage account keys list `
  --resource-group $resourceGroup `
  --account-name $storageAccount `
  --query "[0].value" `
  -o tsv

if (!$accountKey) {
  throw "Could not read storage account key."
}

Write-Host "Creating table $tableName"
az storage table create `
  --name $tableName `
  --account-name $storageAccount `
  --account-key $accountKey `
  -o none

Write-Host "Setting Vercel production env vars"
$storageAccount | npx vercel env add AZURE_STORAGE_ACCOUNT_NAME production --force --yes
$accountKey | npx vercel env add AZURE_STORAGE_ACCOUNT_KEY production --force --yes
$tableName | npx vercel env add AZURE_TABLE_NAME production --force --yes
"0" | npx vercel env add ALLOW_ENV_LICENSE_FALLBACK production --force --yes

[pscustomobject]@{
  resourceGroup = $resourceGroup
  location = $location
  storageAccount = $storageAccount
  tableName = $tableName
} | ConvertTo-Json
