const fs = require('fs');
const pg = require("c:/VOB's/US24-VOB/node_modules/pg");
const { BlobServiceClient } = require("c:/VOB's/US24-VOB/node_modules/@azure/storage-blob");

const envText = fs.readFileSync("c:/VOB's/US24-VOB/.env", 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    const k = trimmed.slice(0, idx).trim();
    let v = trimmed.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
});

async function main() {
  console.log('=== Step 1: Cleaning Azure Blob Storage Container ===');
  if (env.AZURE_STORAGE_CONNECTION_STRING) {
    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(env.AZURE_STORAGE_CONNECTION_STRING);
      const containerName = env.AZURE_STORAGE_CONTAINER_NAME || 'vob-storage';
      const containerClient = blobServiceClient.getContainerClient(containerName);

      let deletedBlobCount = 0;
      for await (const blob of containerClient.listBlobsFlat()) {
        await containerClient.deleteBlob(blob.name);
        console.log(`Deleted blob: ${blob.name}`);
        deletedBlobCount++;
      }
      console.log(`✓ Deleted ${deletedBlobCount} blobs from Azure container "${containerName}".`);
    } catch (err) {
      console.warn('Azure Blob cleanup warning:', err.message);
    }
  } else {
    console.log('No AZURE_STORAGE_CONNECTION_STRING found; skipping Azure Blob cleanup.');
  }

  console.log('\n=== Step 2: Purging Stored & Uploaded Data from Database ===');
  const directUrl = env.DIRECT_URL || env.DATABASE_URL;
  const client = new pg.Client({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query('BEGIN');

    console.log('Deleting auth_queue_item records...');
    const dAuth = await client.query('DELETE FROM auth_queue_item;');
    console.log(`✓ Deleted ${dAuth.rowCount} from auth_queue_item`);

    console.log('Deleting task_reassignment_log records...');
    const dReassign = await client.query('DELETE FROM task_reassignment_log;');
    console.log(`✓ Deleted ${dReassign.rowCount} from task_reassignment_log`);

    console.log('Deleting task records...');
    const dTasks = await client.query('DELETE FROM task;');
    console.log(`✓ Deleted ${dTasks.rowCount} from task`);

    console.log('Deleting vob_field_source records...');
    const dSources = await client.query('DELETE FROM vob_field_source;');
    console.log(`✓ Deleted ${dSources.rowCount} from vob_field_source`);

    console.log('Deleting vob records...');
    const dVobs = await client.query('DELETE FROM vob;');
    console.log(`✓ Deleted ${dVobs.rowCount} from vob`);

    console.log('Deleting upload_batch records...');
    const dUploads = await client.query('DELETE FROM upload_batch;');
    console.log(`✓ Deleted ${dUploads.rowCount} from upload_batch`);

    console.log('Deleting patient records...');
    const dPatients = await client.query('DELETE FROM patient;');
    console.log(`✓ Deleted ${dPatients.rowCount} from patient`);

    console.log('Deleting storage_blobs records...');
    const dBlobs = await client.query('DELETE FROM storage_blobs;');
    console.log(`✓ Deleted ${dBlobs.rowCount} from storage_blobs`);

    console.log('Deleting audit_event records...');
    const dAudit = await client.query('DELETE FROM audit_event;');
    console.log(`✓ Deleted ${dAudit.rowCount} from audit_event`);

    // Reset sequence so new uploads start cleanly from VOB-0001
    try {
      await client.query('ALTER SEQUENCE vob_code_seq RESTART WITH 1;');
      console.log('✓ Reset vob_code_seq sequence to 1.');
    } catch (seqErr) {
      console.log('Sequence reset note:', seqErr.message);
    }

    await client.query('COMMIT');
    console.log('✓ Database transaction COMMITTED successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transaction failed and rolled back:', err);
    throw err;
  }

  console.log('\n=== Step 3: Verification of Remaining Database Records ===');
  const checkTables = [
    'vob',
    'task',
    'auth_queue_item',
    'upload_batch',
    'patient',
    'storage_blobs',
    'task_reassignment_log',
    'vob_field_source',
    'audit_event',
    'app_user',
    'client',
    'client_format'
  ];

  for (const t of checkTables) {
    const res = await client.query(`SELECT count(*) FROM "${t}";`);
    console.log(`${t}: ${res.rows[0].count} rows remaining`);
  }

  await client.end();
}

main().catch(console.error);
