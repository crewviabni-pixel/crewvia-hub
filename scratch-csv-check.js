import fs from 'fs';

const csvContent = fs.readFileSync('d:/Documents/BNI/contacts_2026-10-09T17-35-01-606Z.csv', 'utf-8');
const lines = csvContent.split('\n').filter(l => l.trim() !== '');

const normalizePhone = (p) => {
  if (!p) return "";
  const digits = p.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

const phoneGroups = {};
const headers = lines[0].split(',').map(h => h.trim());

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"|"$/g, '').trim());
  const row = {};
  headers.forEach((h, idx) => {
    row[h] = values[idx] || "";
  });

  const rawPhone = row.UserNumber || row.Phone || row.phone || row.phoneNumber || row["User Number"] || "";
  const name = row.Name || row.name || "Unknown";
  
  if (!rawPhone) continue;
  
  const p = normalizePhone(rawPhone);
  if (!phoneGroups[p]) phoneGroups[p] = [];
  phoneGroups[p].push({ name, rawPhone, line: i + 1 });
}

let duplicateGroups = 0;
for (const [phone, group] of Object.entries(phoneGroups)) {
  if (group.length > 1) {
    duplicateGroups++;
    console.log(`Duplicate Group (${phone}):`);
    group.forEach(g => console.log(`  - Row ${g.line}: Name: ${g.name}, Raw Phone: ${g.rawPhone}`));
  }
}

console.log(`Found ${duplicateGroups} duplicate groups in the CSV.`);
