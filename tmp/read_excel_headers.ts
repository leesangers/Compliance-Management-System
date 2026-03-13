import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = 'd:/OneDrive - Doosan/Project/CMS_Portal/Compliance-Management-System/uploads/2025_리스크식별표_CP팀.xlsx';
const fileBuffer = fs.readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

console.log('SHEETS_LIST:' + JSON.stringify(workbook.SheetNames));

const targetSheets = ['1. 의무등록부(관련법규 및 이해관계자)', '2. Compliance 리스크 통제', '3. Ethics 리스크 통제'];

targetSheets.forEach(name => {
    const worksheet = workbook.Sheets[name];
    if (worksheet) {
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        console.log(`SHEET_DATA:${name}:` + JSON.stringify(data.slice(0, 10)));
    } else {
        console.log(`SHEET_MISSING:${name}`);
    }
});
