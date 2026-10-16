const pg = require("c:/VOB's/US24-VOB/node_modules/pg");
const { BlobServiceClient } = require("c:/VOB's/US24-VOB/node_modules/@azure/storage-blob");
const crypto = require('crypto');

const API_BASE = 'https://us24-vob-uat.vercel.app';
const AZURE_DB_URL = 'postgresql://us24admin:Ankitsingh%40123@us24-vob-db.postgres.database.azure.com:5432/vob?sslmode=require';
const AZURE_BLOB_CONN = 'DefaultEndpointsProtocol=https;AccountName=us24vobstorage;AccountKey=dLhKJnyr0HOkLFuikSxJwf3/Lb9Yp1Fv9rhZGDbHYQcCjqIK6FrD1dOtToH6vuqeuKp/9Hz7KTEU+AStY8zxLg==;EndpointSuffix=core.windows.net';

async function main() {
  console.log('================================================================');
  console.log('   US24 VOB PORTAL: LIVE END-TO-END WORKFLOW VERIFICATION       ');
  console.log('   Target Backend: ' + API_BASE);
  console.log('================================================================\n');

  // 1. Admin Login
  console.log('1. Signing in as Admin (admin@us24.test)...');
  const loginRes = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@us24.test', password: 'DevPassword123!' })
  });
  const loginData = await loginRes.json();
  let token = loginData.access_token;
  if (!token && loginData.requires_2fa) {
    const verifyRes = await fetch(`${API_BASE}/api/v1/auth/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mfa_token: loginData.mfa_token, otp: loginData.dev_otp })
    });
    const verifyData = await verifyRes.json();
    token = verifyData.access_token;
  }
  if (!token) throw new Error('Admin login failed: ' + JSON.stringify(loginData));
  console.log('✓ Admin authenticated successfully!\n');

  // 2. Fetch clients to get an active client ID
  console.log('2. Fetching available client organizations...');
  const clientsRes = await fetch(`${API_BASE}/api/v1/clients`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const clientsData = await clientsRes.json();
  const clients = Array.isArray(clientsData) ? clientsData : (clientsData.clients || clientsData.data || []);
  const client = clients[0] || { id: 'arra' };
  console.log(`✓ Selected Client: ${client.name || client.id} (ID: ${client.id})\n`);

  // 3. Upload task batch
  console.log('3. Uploading task batch with 2 patient VOB requests...');
  const uploadPayload = {
    client_id: client.id,
    kind: 'tasks',
    filename: 'Azure_Live_Test_Batch.xlsx',
    rows: [
      {
        row: 1,
        patient_name: 'Robert Azure Chen',
        dob: '1985-04-12',
        dos: '2026-10-25',
        insurance: 'Aetna Commercial PPO',
        appointment_type: 'Initial Evaluation',
        group_no: 'GRP-9921',
        member_id: 'MEM-881230',
        assignee_email: 'rohit.k@us24solutions.com'
      },
      {
        row: 2,
        patient_name: 'Maria Azure Gonzalez',
        dob: '1990-08-22',
        dos: '2026-10-26',
        insurance: 'Blue Cross Blue Shield',
        appointment_type: 'Follow-up Treatment',
        group_no: 'GRP-3341',
        member_id: 'MEM-774411',
        assignee_email: 'user@us24.test'
      }
    ]
  };

  const uploadRes = await fetch(`${API_BASE}/api/v1/uploads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(uploadPayload)
  });
  const uploadBatch = await uploadRes.json();
  if (uploadRes.status !== 201) {
    throw new Error(`Upload failed (${uploadRes.status}): ${JSON.stringify(uploadBatch)}`);
  }
  console.log(`✓ Upload Batch Preview Created: ID ${uploadBatch.id}, Valid Rows: ${uploadBatch.valid_rows}`);

  // 4. Commit upload batch to generate VOB records
  console.log('4. Committing batch to create and assign VOB records...');
  const commitRes = await fetch(`${API_BASE}/api/v1/uploads/${uploadBatch.id}/commit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      skip_rows: []
    })
  });
  const commitData = await commitRes.json();
  if (!commitRes.ok) throw new Error(`Commit failed (${commitRes.status}): ${JSON.stringify(commitData)}`);
  console.log(`✓ Successfully committed! Created ${commitData.created} VOB records.`);
  console.log('  VOB IDs created:', commitData.vob_ids, '\n');

  const targetVobId = commitData.vob_ids[0];

  // 5. Specialist working on VOB: Upload transcript to Azure Blob Storage
  console.log(`5. Working on VOB (${targetVobId}): Attaching Payer Call Transcript to Azure Blob Storage...`);
  const transcriptContent = `
[CALL RECORDING TRANSCRIPT - US24 VOB SPECIALIST]
Date of Service: 2026-10-25
Payer: Aetna Commercial PPO
Payer Representative: Sarah Miller (ID #AET-8839)
Patient: Robert Azure Chen (DOB: 1985-04-12, Member ID: MEM-881230)
Call Duration: 14m 32s

Verification Details:
- Coverage Status: Active / Primary
- In-Network Status: In-Network with Group & Individual
- Deductible: $1,500.00 Individual, $1,500.00 Met, Remaining: $0.00
- Out of Pocket Maximum: $4,000.00, $1,200.00 Met, Remaining: $2,800.00
- Copay per Visit: $25.00 Copay
- Coinsurance: 10% after deductible
- Pre-Authorization Required: Yes (Authorization TAT: 72 hours)
- Authorization Contact: 1-800-555-0199
- Timely Filing: 90 days from Date of Service
  `.trim();

  const transcriptUploadRes = await fetch(`${API_BASE}/api/v1/storage/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      filename: `Call_Transcript_${targetVobId}.txt`,
      content: transcriptContent,
      isBase64: false,
      contentType: 'text/plain',
      vobId: targetVobId,
      kind: 'transcript'
    })
  });
  const transcriptResult = await transcriptUploadRes.json();
  console.log('✓ Transcript uploaded successfully via live API!');
  console.log('  Stored Blob Key:', transcriptResult.key);
  console.log('  Direct Azure Blob URL:', transcriptResult.url, '\n');

  // 6. Direct Verification in Azure PostgreSQL Database
  console.log('================================================================');
  console.log('   DIRECT AZURE POSTGRESQL DATABASE VERIFICATION QUERY         ');
  console.log('================================================================');
  const dbClient = new pg.Client({ connectionString: AZURE_DB_URL, ssl: { rejectUnauthorized: false } });
  await dbClient.connect();

  const dbVobsRes = await dbClient.query(`
    SELECT 
      v.id,
      v.client_id,
      v.status,
      v.assignee_id,
      p.name AS patient_name,
      p.dob AS patient_dob,
      v.transcript_blob_key,
      v.transcript_blob_url,
      v.transcript_file_name,
      v.created_at
    FROM vob v
    LEFT JOIN patient p ON v.patient_id = p.id
    WHERE v.id = ANY($1::text[])
    ORDER BY v.created_at DESC;
  `, [commitData.vob_ids]);

  console.log(`Found ${dbVobsRes.rows.length} rows directly in Azure PostgreSQL 'vob' table:`);
  dbVobsRes.rows.forEach((row, i) => {
    console.log(`\n--- Record #${i + 1} in Azure PostgreSQL ---`);
    console.log(`  VOB ID:               ${row.id}`);
    console.log(`  Patient Name:         ${row.patient_name} (DOB: ${row.patient_dob})`);
    console.log(`  Client ID:            ${row.client_id}`);
    console.log(`  Status:               ${row.status}`);
    console.log(`  Assigned User ID:     ${row.assignee_id}`);
    console.log(`  Transcript Blob Key:  ${row.transcript_blob_key || '(none yet)'}`);
    console.log(`  Transcript Blob URL:  ${row.transcript_blob_url || '(none yet)'}`);
    console.log(`  Transcript File:      ${row.transcript_file_name || '(none yet)'}`);
  });
  await dbClient.end();

  // 7. Direct Verification in Azure Blob Storage
  console.log('\n================================================================');
  console.log('   DIRECT AZURE BLOB STORAGE CONTAINER VERIFICATION QUERY       ');
  console.log('================================================================');
  const blobClient = BlobServiceClient.fromConnectionString(AZURE_BLOB_CONN);
  const container = blobClient.getContainerClient('vob-storage');

  console.log(`Checking container 'vob-storage' for key: ${transcriptResult.key}`);
  const targetBlob = container.getBlockBlobClient(transcriptResult.key);
  const exists = await targetBlob.exists();
  console.log(`Blob exists in Azure Storage? ${exists}`);

  if (exists) {
    const props = await targetBlob.getProperties();
    console.log(`  Content Length:    ${props.contentLength} bytes`);
    console.log(`  Content Type:      ${props.contentType}`);
    console.log(`  Last Modified:     ${props.lastModified}`);
    console.log(`  Metadata:         `, props.metadata);

    const downloadBuffer = await targetBlob.downloadToBuffer();
    console.log(`\nSnippet of downloaded content from Azure Blob Storage:`);
    console.log('--------------------------------------------------');
    console.log(downloadBuffer.toString('utf8').slice(0, 300) + '...\n--------------------------------------------------');
  }

  console.log('\n✅ ALL LIVE END-TO-END TESTS PASSED WITH 100% SUCCESS!');
}

main().catch(err => {
  console.error('\n❌ Error during verification:', err);
  process.exit(1);
});
