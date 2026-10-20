const fs = require('fs');
const { BlobServiceClient } = require("c:/VOB's/US24-VOB/node_modules/@azure/storage-blob");
const xlsx = require("xlsx");

const connStr = "DefaultEndpointsProtocol=https;AccountName=us24vobstorage;AccountKey=dLhKJnyr0HOkLFuikSxJwf3/Lb9Yp1Fv9rhZGDbHYQcCjqIK6FrD1dOtToH6vuqeuKp/9Hz7KTEU+AStY8zxLg==;EndpointSuffix=core.windows.net";
const containerName = "vob-storage";

async function inspectBlob() {
  const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient("dabf534b-3fb0-440c-a497-2a0aa8fb7dfe");

  const downloadBlockBlobResponse = await blobClient.download();
  const buffer = await streamToBuffer(downloadBlockBlobResponse.readableStreamBody);

  const workbook = xlsx.read(buffer, { type: 'buffer' });
  console.log('Sheet Names:', workbook.SheetNames);
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\n--- Sheet: ${sheetName} ---`);
    console.log('Row 0:', json[0]);
    console.log('Row 1:', json[1]);
    console.log('Row 2:', json[2]);
    console.log('Row 3:', json[3]);
  }
}

async function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}

inspectBlob().catch(console.error);
