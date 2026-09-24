import * as XLSX from 'xlsx';
import fs from 'fs';

// 1. Test XLSX parsing of ARRA_Daily_Requests.xlsx
const arraBuffer = fs.readFileSync('ARRA_Daily_Requests.xlsx');
const wb1 = XLSX.read(arraBuffer, { type: 'buffer', cellDates: true });
console.log('✓ Read ARRA_Daily_Requests.xlsx:', wb1.SheetNames);
const rawRows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { defval: '' });
console.log(`✓ Parsed ${rawRows1.length} raw rows from ARRA workbook`);

// 2. Test XLSX parsing of VOB_Requests_Intake_Batch.xlsx
const intakeBuffer = fs.readFileSync('VOB_Requests_Intake_Batch.xlsx');
const wb2 = XLSX.read(intakeBuffer, { type: 'buffer', cellDates: true });
console.log('✓ Read VOB_Requests_Intake_Batch.xlsx:', wb2.SheetNames);
const rawRows2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { defval: '' });
console.log(`✓ Parsed ${rawRows2.length} raw rows from Intake workbook`);
console.log('Sample parsed patient:', rawRows2[0]['Patient Name'], 'DOB:', rawRows2[0]['DOB']);

console.log('✓ All file reading and row extraction tests passed!');
