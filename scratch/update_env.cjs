const fs = require('fs');
const envPath = "c:/VOB's/US24-VOB/.env";
let env = fs.readFileSync(envPath, 'utf8');

const newDbUrl = 'DATABASE_URL="postgresql://us24admin:Ankitsingh%40123@us24-vob-db.postgres.database.azure.com:5432/vob?sslmode=require"';
const newDirectUrl = 'DIRECT_URL="postgresql://us24admin:Ankitsingh%40123@us24-vob-db.postgres.database.azure.com:5432/vob?sslmode=require"';
const azureConn = 'AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=us24vobstorage;AccountKey=dLhKJnyr0HOkLFuikSxJwf3/Lb9Yp1Fv9rhZGDbHYQcCjqIK6FrD1dOtToH6vuqeuKp/9Hz7KTEU+AStY8zxLg==;EndpointSuffix=core.windows.net"';
const azureContainer = 'AZURE_STORAGE_CONTAINER_NAME="vob-storage"';

env = env.replace(/^DATABASE_URL=.*$/m, newDbUrl);
env = env.replace(/^DIRECT_URL=.*$/m, newDirectUrl);
env = env.replace(/^SUPABASE_URL=.*$/m, '# SUPABASE_URL=""');
env = env.replace(/^SUPABASE_PUBLISHABLE_KEY=.*$/m, '# SUPABASE_PUBLISHABLE_KEY=""');

if (!env.includes('AZURE_STORAGE_CONNECTION_STRING=')) {
  env += `\n# Azure Blob Storage\n${azureConn}\n${azureContainer}\n`;
} else {
  env = env.replace(/^AZURE_STORAGE_CONNECTION_STRING=.*$/m, azureConn);
  env = env.replace(/^AZURE_STORAGE_CONTAINER_NAME=.*$/m, azureContainer);
}

fs.writeFileSync(envPath, env, 'utf8');
console.log('✓ Successfully updated backend .env with Azure credentials!');
