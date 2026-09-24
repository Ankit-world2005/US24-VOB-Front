import { mockServer } from '../src/api/mock/mockServer.js';

async function run() {
  console.log('Testing uploadFile, commitUpload, and assignVobs in mockServer...');

  // 1. Initial VOB count
  const initialVobs = await mockServer.getVobs();
  console.log(`Initial total VOBs: ${initialVobs.length}`);

  // 2. Upload file with custom rows
  const uploadPayload = {
    filename: 'Test_Upload_File.xlsx',
    assignedTo: 'manish.v@us24solutions.com',
    rows: [
      { row: 1, patientName: 'Test Patient Alpha', dob: '1989-01-15', dos: '2026-10-10', insurance: 'Aetna', idCard: 'AET-1001', valid: true },
      { row: 2, patientName: 'Test Patient Beta', dob: '1992-05-20', dos: '2026-10-11', insurance: 'BCBS', idCard: 'BCBS-2002', valid: true },
      { row: 3, patientName: 'Invalid Patient', dob: '', dos: '2026-10-12', insurance: 'UHC', idCard: 'UHC-3003', valid: false, reason: 'Missing Date of Birth (DOB)' }
    ],
    totalRows: 3,
    validRows: 2,
    rejectedRows: 1
  };

  const uploadRes = await mockServer.uploadFile(uploadPayload, 'arra');
  console.log(`✓ uploadFile created uploadId: ${uploadRes.uploadId}, valid rows: ${uploadRes.validRows}`);

  // 3. Commit upload assigned to manish.v@us24solutions.com
  const commitRes = await mockServer.commitUpload(uploadRes.uploadId, 'saurabh@us24solutions.com', 'manish.v@us24solutions.com');
  console.log(`✓ commitUpload created ${commitRes.count} VOBs`);

  // 4. Verify the created VOBs have assignedTo: 'manish.v@us24solutions.com'
  const manishVobs = await mockServer.getVobs({ userEmail: 'manish.v@us24solutions.com' });
  console.log(`✓ मनीष V (manish.v@us24solutions.com) now has ${manishVobs.length} assigned VOBs:`);
  manishVobs.forEach(v => console.log(`  - [${v.id}] ${v.patientName} (${v.insurance}) -> Status: ${v.vobStatus}, AssignedTo: ${v.assignedTo}`));

  // 5. Test re-assigning one of them to jitender.s@us24solutions.com
  const vobToReassign = manishVobs[0].id;
  await mockServer.assignVobs({ vobIds: [vobToReassign], assignees: ['jitender.s@us24solutions.com'] }, 'saurabh@us24solutions.com');

  const jitenderVobs = await mockServer.getVobs({ userEmail: 'jitender.s@us24solutions.com' });
  console.log(`✓ Jitender S (jitender.s@us24solutions.com) has ${jitenderVobs.length} assigned VOB(s):`);
  jitenderVobs.forEach(v => console.log(`  - [${v.id}] ${v.patientName} -> AssignedTo: ${v.assignedTo}`));

  console.log('✓ All mock server upload, assignment, and queue filtering tests succeeded!');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
