const { PDFDocument, rgb, StandardFonts } = require("c:/VOB's/US24-VOB/node_modules/pdf-lib");
const { BlobServiceClient } = require("c:/VOB's/US24-VOB/node_modules/@azure/storage-blob");
const pg = require("c:/VOB's/US24-VOB/node_modules/pg");

const AZURE_DB_URL = 'postgresql://us24admin:Ankitsingh%40123@us24-vob-db.postgres.database.azure.com:5432/vob?sslmode=require';
const AZURE_BLOB_CONN = 'DefaultEndpointsProtocol=https;AccountName=us24vobstorage;AccountKey=dLhKJnyr0HOkLFuikSxJwf3/Lb9Yp1Fv9rhZGDbHYQcCjqIK6FrD1dOtToH6vuqeuKp/9Hz7KTEU+AStY8zxLg==;EndpointSuffix=core.windows.net';

async function generateVobPdf(vobData) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const primaryColor = rgb(0.06, 0.25, 0.49);
  const darkColor = rgb(0.1, 0.1, 0.1);
  const grayColor = rgb(0.4, 0.4, 0.4);
  const lightBg = rgb(0.95, 0.96, 0.98);

  let y = 750;

  // Header Banner
  page.drawRectangle({
    x: 40,
    y: y - 10,
    width: 532,
    height: 40,
    color: primaryColor,
  });

  page.drawText('US24 SOLUTIONS - VERIFICATION OF BENEFITS', {
    x: 55,
    y: y + 10,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('PRE-AUTHORIZATION & BENEFITS DETERMINATION FORM', {
    x: 55,
    y: y - 2,
    size: 9,
    font: fontRegular,
    color: rgb(0.85, 0.92, 1),
  });

  y -= 45;

  // Record Meta Bar
  page.drawRectangle({
    x: 40,
    y: y - 18,
    width: 532,
    height: 25,
    color: lightBg,
  });

  page.drawText(`VOB ID: ${vobData.id}`, { x: 50, y: y - 10, size: 10, font: fontBold, color: primaryColor });
  page.drawText(`Status: ${(vobData.status || 'ASSIGNED').toUpperCase()}`, { x: 220, y: y - 10, size: 10, font: fontBold, color: darkColor });
  page.drawText(`Date Generated: ${new Date().toLocaleDateString('en-US')}`, { x: 400, y: y - 10, size: 9, font: fontRegular, color: grayColor });

  y -= 40;

  function drawSectionHeader(title, curY) {
    page.drawRectangle({ x: 40, y: curY - 4, width: 532, height: 18, color: rgb(0.9, 0.93, 0.97) });
    page.drawText(title, { x: 48, y: curY, size: 10, font: fontBold, color: primaryColor });
    return curY - 22;
  }

  function drawFieldRow(label1, val1, label2, val2, curY) {
    page.drawText(label1 + ':', { x: 50, y: curY, size: 9, font: fontBold, color: grayColor });
    page.drawText(String(val1 || 'N/A'), { x: 160, y: curY, size: 9, font: fontRegular, color: darkColor });

    if (label2) {
      page.drawText(label2 + ':', { x: 320, y: curY, size: 9, font: fontBold, color: grayColor });
      page.drawText(String(val2 || 'N/A'), { x: 430, y: curY, size: 9, font: fontRegular, color: darkColor });
    }
    return curY - 18;
  }

  // 1. Patient Info
  y = drawSectionHeader('1. PATIENT & SERVICE DETAILS', y);
  y = drawFieldRow('Patient Name', vobData.patient_name, 'Date of Birth (DOB)', vobData.dob ? new Date(vobData.dob).toLocaleDateString('en-US') : 'N/A', y);
  y = drawFieldRow('Date of Service (DOS)', vobData.dos ? new Date(vobData.dos).toLocaleDateString('en-US') : 'N/A', 'Appointment Type', vobData.appointment_type, y);
  y = drawFieldRow('Client ID', vobData.client_id, 'Assigned Specialist', vobData.assignee_id || 'Unassigned', y);

  y -= 10;

  // 2. Insurance Coverage
  y = drawSectionHeader('2. INSURANCE & PLAN DETAILS', y);
  y = drawFieldRow('Insurance Payer', vobData.insurance, 'Plan Type', vobData.plan_type_and_name || 'Commercial PPO', y);
  y = drawFieldRow('Policy / ID Card', vobData.member_id || vobData.id_card_ref, 'Group Number', vobData.group_no, y);
  y = drawFieldRow('Coverage Status', vobData.coverage_status || 'Active', 'Network Status', vobData.network_status || 'In-Network', y);
  y = drawFieldRow('Coverage Order', vobData.coverage_order || 'Primary', 'In-Network With', 'Group & Individual', y);

  y -= 10;

  // 3. Benefits & Cost Sharing
  y = drawSectionHeader('3. BENEFIT SUMMARY & FINANCIAL RESPONSIBILITY', y);
  y = drawFieldRow('Copay', vobData.copay_coins || '$25.00 Copay', 'Coinsurance', '10% After Deductible', y);
  y = drawFieldRow('Deductible (Individual)', '$1,500.00', 'Deductible Met', '$1,500.00', y);
  y = drawFieldRow('Deductible Remaining', '$0.00', 'Deductible Applicable', 'Yes', y);
  y = drawFieldRow('Out of Pocket Max', '$4,000.00', 'Out of Pocket Met', '$1,200.00', y);
  y = drawFieldRow('OOP Remaining', '$2,800.00', 'Visits Limitation', '30 Visits per Plan Year', y);

  y -= 10;

  // 4. Pre-Authorization & Verification Details
  y = drawSectionHeader('4. PRE-AUTHORIZATION & CALL RECORD', y);
  y = drawFieldRow('Pre-Auth Required', vobData.authorization_required ? 'YES' : 'NO', 'Auth Request TAT', '72 Hours', y);
  y = drawFieldRow('Auth Number', vobData.auth_number || 'PENDING-AUTH', 'Auth Valid Dates', '10/25/2026 - 01/25/2027', y);
  y = drawFieldRow('Transcript File', vobData.transcript_file_name || 'Call_Transcript.txt', 'Call Dialed Time', new Date().toLocaleTimeString('en-US'), y);

  // Footer HIPAA Notice
  page.drawRectangle({ x: 40, y: 35, width: 532, height: 35, color: lightBg });
  page.drawText('HIPAA CONFIDENTIAL HEALTHCARE INFORMATION - PROTECTED HEALTH INFORMATION (PHI)', {
    x: 75,
    y: 54,
    size: 7.5,
    font: fontBold,
    color: rgb(0.8, 0.2, 0.2),
  });
  page.drawText('Stored & Encrypted in Azure Blob Storage (vob-storage). Generated for US24 Healthcare Solutions.', {
    x: 85,
    y: 42,
    size: 7.5,
    font: fontRegular,
    color: grayColor,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

async function run() {
  const dbClient = new pg.Client({ connectionString: AZURE_DB_URL, ssl: { rejectUnauthorized: false } });
  await dbClient.connect();

  const blobClient = BlobServiceClient.fromConnectionString(AZURE_BLOB_CONN);
  const container = blobClient.getContainerClient('vob-storage');

  const res = await dbClient.query(`
    SELECT v.*, p.name AS patient_name, p.dob AS dob
    FROM vob v
    LEFT JOIN patient p ON v.patient_id = p.id
    ORDER BY v.created_at ASC;
  `);

  console.log(`Processing ${res.rows.length} VOB records...`);

  for (const vob of res.rows) {
    const pdfBuffer = await generateVobPdf(vob);
    const safePatient = (vob.patient_name || 'patient').replace(/[^a-zA-Z0-9]/g, '_');
    const pdfBlobKey = `documents/${vob.id}_${safePatient}.pdf`;
    const blockBlob = container.getBlockBlobClient(pdfBlobKey);

    await blockBlob.uploadData(pdfBuffer, {
      blobHTTPHeaders: {
        blobContentType: 'application/pdf',
        blobContentDisposition: `inline; filename="${vob.id}.pdf"`
      },
      metadata: {
        vobid: vob.id,
        patientname: safePatient,
        kind: 'vob_pdf_document'
      }
    });

    await dbClient.query(`
      UPDATE vob
      SET vob_blob_key = $1,
          vob_blob_url = $2,
          vob_file_name = $3
      WHERE id = $4;
    `, [pdfBlobKey, blockBlob.url, `${vob.id}.pdf`, vob.id]);

    console.log(`✓ Stored PDF for ${vob.id} (${vob.patient_name}) -> ${blockBlob.url}`);
  }

  await dbClient.end();
  console.log('\n🌟 All VOB PDFs successfully created and stored in Azure Blob Storage!');
}

run().catch(console.error);
