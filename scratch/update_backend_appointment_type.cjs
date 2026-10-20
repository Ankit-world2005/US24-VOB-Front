const fs = require('fs');

const filePath = "c:/VOB's/US24-VOB/src/features/vobs/router.ts";
let content = fs.readFileSync(filePath, 'utf8');
const isCrlf = content.includes('\r\n');
const nl = isCrlf ? '\r\n' : '\n';

// 1. Update listRow schema
const target1 = `    id_card: z.string().nullable().optional(),`;
const replace1 = `    id_card: z.string().nullable().optional(),${nl}    appointment_type: z.string().nullable().optional(),`;

if (!content.includes(target1)) {
  console.error('Target 1 not found!');
  process.exit(1);
}
content = content.replace(target1, replace1);

// 2. Update select in findMany
const target2 = `          idCardRef: true,`;
const replace2 = `          idCardRef: true,${nl}          appointmentType: true,`;

if (!content.includes(target2)) {
  console.error('Target 2 not found!');
  process.exit(1);
}
content = content.replace(target2, replace2);

// 3. Update page.map mapping
const target3 = `            id_card: v.idCardRef ?? null,`;
const replace3 = `            id_card: v.idCardRef ?? null,${nl}            appointment_type: v.appointmentType ?? null,`;

if (!content.includes(target3)) {
  console.error('Target 3 not found!');
  process.exit(1);
}
content = content.replace(target3, replace3);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Successfully updated backend router.ts with appointment_type!');
