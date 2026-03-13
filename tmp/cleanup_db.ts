import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const db = new Database("iso_management.db");

// Delete in reverse order of dependencies
const tables = [
    "audit_results",
    "evidence_files",
    "evidence_plans",
    "controls",
    "risks",
    "compliance_obligations",
    "departments"
];

console.log("Cleaning up database...");
tables.forEach(table => {
    try {
        db.prepare(`DELETE FROM ${table}`).run();
        // Reset autoincrement
        db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(table);
        console.log(`- Cleared table: ${table}`);
    } catch (err) {
        console.error(`- Error clearing table ${table}:`, err);
    }
});

const uploadDir = path.join(process.cwd(), "uploads");
if (fs.existsSync(uploadDir)) {
    console.log("Cleaning up uploads folder...");
    const files = fs.readdirSync(uploadDir);
    for (const file of files) {
        const filePath = path.join(uploadDir, file);
        if (fs.lstatSync(filePath).isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(filePath);
        }
    }
    console.log("- Cleared uploads folder.");
}

console.log("Cleanup complete.");
db.close();
