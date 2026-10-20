const fs = require('fs');

const filePath = "c:/VOB's/US24-VOB/src/features/vobs/router.ts";
let content = fs.readFileSync(filePath, 'utf8');
const isCrlf = content.includes('\r\n');
const nl = isCrlf ? '\r\n' : '\n';

// 1. Update listRow schema
const target1 = `    audit_stage: z.string().nullable().optional(),${nl}    /** The caller's own latest audit of the VOB, else the latest anyone made. */`;
const replace1 = `    audit_stage: z.string().nullable().optional(),${nl}    insurance: z.string().nullable().optional(),${nl}    plan_type_and_name: z.string().nullable().optional(),${nl}    id_card: z.string().nullable().optional(),${nl}    /** The caller's own latest audit of the VOB, else the latest anyone made. */`;

if (!content.includes(target1)) {
  console.error('Target 1 not found!');
  process.exit(1);
}
content = content.replace(target1, replace1);

// 2. Update select in findMany
const target2 = `          status: true,${nl}          dos: true,${nl}          updatedAt: true,`;
const replace2 = `          status: true,${nl}          dos: true,${nl}          insurance: true,${nl}          planTypeAndName: true,${nl}          idCardRef: true,${nl}          updatedAt: true,`;

if (!content.includes(target2)) {
  console.error('Target 2 not found!');
  process.exit(1);
}
content = content.replace(target2, replace2);

// 3. Update page.map mapping
const target3 = `            patient_name: v.patient.name,${nl}            dos: v.dos ? isoDate(v.dos) : null,${nl}            client: v.client,`;
const replace3 = `            patient_name: v.patient.name,${nl}            dos: v.dos ? isoDate(v.dos) : null,${nl}            insurance: v.insurance ?? null,${nl}            plan_type_and_name: v.planTypeAndName ?? null,${nl}            id_card: v.idCardRef ?? null,${nl}            client: v.client,`;

if (!content.includes(target3)) {
  console.error('Target 3 not found!');
  process.exit(1);
}
content = content.replace(target3, replace3);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Successfully updated backend router.ts with insurance, plan_type_and_name, and id_card fields!');
