import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import multer from "multer";
import fs from "fs";
import * as XLSX from 'xlsx';
import { Client } from "@microsoft/microsoft-graph-client";
import { ConfidentialClientApplication } from "@azure/msal-node";
import "isomorphic-fetch";

const db = new Database("iso_management.db");

// --- Microsoft Graph API Helpers ---
async function getGraphClient() {
  const msalConfig = {
    auth: {
      clientId: process.env.AZURE_CLIENT_ID || "",
      authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
      clientSecret: process.env.AZURE_CLIENT_SECRET || "",
    },
  };

  const cca = new ConfidentialClientApplication(msalConfig);
  const tokenResponse = await cca.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });

  return Client.init({
    authProvider: (done) => {
      done(null, tokenResponse?.accessToken || "");
    },
  });
}

async function appendToExcel(tableName: string, values: any[]) {
  if (!process.env.AZURE_CLIENT_ID) return; // Skip if not configured

  try {
    const client = await getGraphClient();
    const driveId = process.env.TEAMS_EXCEL_DRIVE_ID;
    const itemId = process.env.TEAMS_EXCEL_ITEM_ID;

    await client
      .api(`/drives/${driveId}/items/${itemId}/workbook/tables/${tableName}/rows`)
      .post({ values: [values] });
    console.log(`Successfully appended row to Teams Excel: ${tableName}`);
  } catch (error) {
    console.error(`Failed to append to Teams Excel (${tableName}):`, error);
  }
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS assessment_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active', -- 'active' or 'finalized'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_code TEXT UNIQUE, -- Unique ID from Org Chart
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS iso_clauses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    standard TEXT NOT NULL, -- '37301' or '37001'
    clause_number TEXT NOT NULL,
    title TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS compliance_obligations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    department_id INTEGER NOT NULL,
    law_name TEXT NOT NULL,
    content TEXT NOT NULL,
    is_changed BOOLEAN DEFAULT 0,
    is_new BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES assessment_sessions(id),
    FOREIGN KEY (department_id) REFERENCES departments(id)
  );

  CREATE TABLE IF NOT EXISTS risks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    department_id INTEGER NOT NULL,
    iso_clause_id INTEGER NOT NULL,
    obligation_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft',
    needs_reassessment BOOLEAN DEFAULT 0,
    previous_content TEXT, -- Store previous obligation content if changed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES assessment_sessions(id),
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (iso_clause_id) REFERENCES iso_clauses(id),
    FOREIGN KEY (obligation_id) REFERENCES compliance_obligations(id)
  );

  CREATE TABLE IF NOT EXISTS controls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    risk_id INTEGER NOT NULL,
    activity TEXT NOT NULL,
    FOREIGN KEY (risk_id) REFERENCES risks(id)
  );

  CREATE TABLE IF NOT EXISTS evidence_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    control_id INTEGER NOT NULL,
    document_name TEXT NOT NULL,
    FOREIGN KEY (control_id) REFERENCES controls(id)
  );

  CREATE TABLE IF NOT EXISTS evidence_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    evidence_plan_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (evidence_plan_id) REFERENCES evidence_plans(id)
  );

  CREATE TABLE IF NOT EXISTS audit_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    risk_id INTEGER NOT NULL,
    status TEXT NOT NULL, -- 'conformity', 'non-conformity', 'recommendation'
    comment TEXT,
    auditor_name TEXT,
    audited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (risk_id) REFERENCES risks(id)
  );
`);

// --- Migrations ---
function runMigrations() {
  const tables = {
    assessment_sessions: ['status'],
    departments: ['org_code'],
    compliance_obligations: ['session_id'],
    risks: ['session_id', 'obligation_id']
  };

  for (const [table, columns] of Object.entries(tables)) {
    const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
    const existingColumns = tableInfo.map(col => col.name);

    for (const column of columns) {
      if (!existingColumns.includes(column)) {
        try {
          let alterQuery = `ALTER TABLE ${table} ADD COLUMN ${column} `;
          if (column === 'status') alterQuery += "TEXT DEFAULT 'active'";
          else if (column === 'org_code') alterQuery += "TEXT UNIQUE";
          else if (column === 'session_id') alterQuery += "INTEGER"; // Allow null initially for migration
          else if (column === 'obligation_id') alterQuery += "INTEGER REFERENCES compliance_obligations(id)";
          
          db.exec(alterQuery);
          console.log(`Migration: Added column ${column} to ${table}`);
        } catch (err) {
          console.error(`Migration failed for ${table}.${column}:`, err);
        }
      }
    }
  }
}

runMigrations();

// Seed initial data if empty
const deptCount = db.prepare("SELECT COUNT(*) as count FROM departments").get() as { count: number };
if (deptCount.count === 0) {
  const insertDept = db.prepare("INSERT INTO departments (name) VALUES (?)");
  ["인사팀", "재무팀", "구매팀", "IT지원팀", "영업팀", "법무팀"].forEach(name => insertDept.run(name));

  const insertClause = db.prepare("INSERT INTO iso_clauses (standard, clause_number, title) VALUES (?, ?, ?)");
  insertClause.run("37301", "4.1", "조직과 그 상황의 이해");
  insertClause.run("37301", "6.1", "리스크와 기회를 다루는 조치");
  insertClause.run("37001", "7.2", "역량 및 교육");
  insertClause.run("37001", "8.2", "부패 리스크 평가");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // File upload setup
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Note: req.body might be empty if fields are sent after the file.
      // We'll handle directory move after upload if needed, or ensure client sends ID first.
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + "-" + file.originalname);
    },
  });
  const upload = multer({ storage });

  async function uploadFileToTeams(controlName: string, fileName: string, localPath: string) {
    if (!process.env.AZURE_CLIENT_ID) return;
    try {
      const client = await getGraphClient();
      const driveId = process.env.TEAMS_EXCEL_DRIVE_ID;
      // Sanitize folder name
      const safeFolderName = controlName.replace(/[/\\?%*:|"<>]/g, '-');
      const folderPath = `/Evidence/${safeFolderName}`;
      
      const fileContent = fs.readFileSync(localPath);
      await client
        .api(`/drives/${driveId}/root:${folderPath}/${fileName}:/content`)
        .put(fileContent);
      console.log(`Successfully synced file to Teams folder: ${folderPath}`);
    } catch (error) {
      console.error("Failed to sync file to Teams:", error);
    }
  }

  // --- Assessment Sessions ---
  app.get("/api/sessions", (req, res) => {
    const sessions = db.prepare("SELECT * FROM assessment_sessions ORDER BY year DESC, created_at DESC").all();
    res.json(sessions);
  });

  app.post("/api/sessions", (req, res) => {
    const { year, name } = req.body;
    
    // Start transaction
    const transaction = db.transaction(() => {
      // 1. Create new session
      const sessionResult = db.prepare("INSERT INTO assessment_sessions (year, name) VALUES (?, ?)")
        .run(year, name);
      const newSessionId = sessionResult.lastInsertRowid;

      // 2. Get latest session to copy from
      const latestSession = db.prepare("SELECT id FROM assessment_sessions WHERE id != ? ORDER BY created_at DESC LIMIT 1")
        .get(newSessionId) as any;

      if (latestSession) {
        // Copy obligations
        const obligations = db.prepare("SELECT * FROM compliance_obligations WHERE session_id = ?").all(latestSession.id) as any[];
        const insertObligation = db.prepare("INSERT INTO compliance_obligations (session_id, department_id, law_name, content) VALUES (?, ?, ?, ?)");
        
        // Copy risks
        const risks = db.prepare("SELECT * FROM risks WHERE session_id = ?").all(latestSession.id) as any[];
        const insertRisk = db.prepare("INSERT INTO risks (session_id, department_id, iso_clause_id, obligation_id, title, description, status) VALUES (?, ?, ?, ?, ?, ?, ?)");

        obligations.forEach(ob => {
          const obResult = insertObligation.run(newSessionId, ob.department_id, ob.law_name, ob.content);
          const newObId = obResult.lastInsertRowid;

          // Find risks associated with this obligation
          const associatedRisks = risks.filter(r => r.obligation_id === ob.id);
          associatedRisks.forEach(r => {
            insertRisk.run(newSessionId, r.department_id, r.iso_clause_id, newObId, r.title, r.description, 'draft');
          });
        });

        // Copy risks without obligations
        const risksWithoutOb = risks.filter(r => !r.obligation_id);
        risksWithoutOb.forEach(r => {
          insertRisk.run(newSessionId, r.department_id, r.iso_clause_id, null, r.title, r.description, 'draft');
        });
      }

      return newSessionId;
    });

    const sessionId = transaction();
    res.json({ id: sessionId });
  });

  app.post("/api/sessions/:id/finalize", (req, res) => {
    const { id } = req.params;
    db.prepare("UPDATE assessment_sessions SET status = 'finalized' WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.get("/api/export-all", (req, res) => {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).send("Missing session_id");

    const depts = db.prepare("SELECT * FROM departments").all();
    const obligations = db.prepare("SELECT o.*, d.name as department_name FROM compliance_obligations o JOIN departments d ON o.department_id = d.id WHERE o.session_id = ?").all(session_id);
    const risks = db.prepare(`
      SELECT r.*, d.name as department_name, ic.standard, ic.clause_number, ic.title as clause_title,
             o.law_name as obligation_law_name
      FROM risks r
      JOIN departments d ON r.department_id = d.id
      JOIN iso_clauses ic ON r.iso_clause_id = ic.id
      LEFT JOIN compliance_obligations o ON r.obligation_id = o.id
      WHERE r.session_id = ?
    `).all(session_id);

    res.json({ depts, obligations, risks });
  });

  // --- Org Chart Upload ---
  app.post("/api/org-chart/upload", upload.single("file"), (req: any, res) => {
    if (!req.file) return res.status(400).send("No file uploaded.");
    
    try {
      const workbook = XLSX.read(fs.readFileSync(req.file.path), { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];

      const upsertDept = db.prepare(`
        INSERT INTO departments (org_code, name) 
        VALUES (?, ?) 
        ON CONFLICT(org_code) DO UPDATE SET name=excluded.name
      `);

      data.forEach(row => {
        const orgCode = row['부서코드'] || row['Code'];
        const deptName = row['부서명'] || row['Department'];
        if (orgCode && deptName) {
          upsertDept.run(orgCode.toString(), deptName.toString());
        }
      });

      res.json({ success: true, count: data.length });
    } catch (error) {
      console.error("Org chart upload failed:", error);
      res.status(500).send("Failed to parse org chart.");
    }
  });

  // --- Bulk Upload Obligations ---
  app.post("/api/obligations/upload", upload.single("file"), (req: any, res) => {
    const { session_id } = req.body;
    if (!req.file || !session_id) return res.status(400).send("Missing file or session_id.");

    try {
      const workbook = XLSX.read(fs.readFileSync(req.file.path), { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];

      const getDeptId = db.prepare("SELECT id FROM departments WHERE name = ? OR org_code = ? LIMIT 1");
      const insertOb = db.prepare(`
        INSERT INTO compliance_obligations (session_id, department_id, law_name, content, is_new) 
        VALUES (?, ?, ?, ?, 1)
      `);

      let count = 0;
      let failedRows: string[] = [];
      data.forEach((row, index) => {
        const dept = row['부서'] || row['Department'];
        const law = row['법령명'] || row['Law'];
        const content = row['의무내용'] || row['Content'];
        
        if (dept && law && content) {
          const deptRow = getDeptId.get(dept.toString(), dept.toString()) as any;
          if (deptRow) {
            insertOb.run(session_id, deptRow.id, law.toString(), content.toString());
            count++;
          } else {
            failedRows.push(`Row ${index + 2}: Department "${dept}" not found in Org Chart.`);
          }
        }
      });

      res.json({ success: true, count, failedRows });
    } catch (error) {
      console.error("Obligations upload failed:", error);
      res.status(500).send("Failed to parse obligations.");
    }
  });

  // --- Bulk Upload Risks ---
  app.post("/api/risks/upload", upload.single("file"), (req: any, res) => {
    const { session_id } = req.body;
    if (!req.file || !session_id) return res.status(400).send("Missing file or session_id.");

    try {
      const workbook = XLSX.read(fs.readFileSync(req.file.path), { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];

      const getDeptId = db.prepare("SELECT id FROM departments WHERE name = ? OR org_code = ? LIMIT 1");
      const getClauseId = db.prepare("SELECT id FROM iso_clauses WHERE clause_number = ? OR title = ? LIMIT 1");
      const getObId = db.prepare("SELECT id FROM compliance_obligations WHERE law_name = ? AND session_id = ? LIMIT 1");

      const insertRisk = db.prepare(`
        INSERT INTO risks (session_id, department_id, iso_clause_id, obligation_id, title, description, status) 
        VALUES (?, ?, ?, ?, ?, ?, 'draft')
      `);

      let count = 0;
      let failedRows: string[] = [];
      data.forEach((row, index) => {
        const dept = row['부서'] || row['Department'];
        const clause = row['조항'] || row['Clause'];
        const law = row['법령명'] || row['Law'];
        const title = row['리스크명'] || row['Title'];
        const desc = row['상세설명'] || row['Description'];
        
        if (dept && clause && title && desc) {
          const deptRow = getDeptId.get(dept.toString(), dept.toString()) as any;
          const clauseRow = getClauseId.get(clause.toString(), clause.toString()) as any;
          const obRow = law ? getObId.get(law.toString(), session_id) as any : null;

          if (deptRow && clauseRow) {
            insertRisk.run(session_id, deptRow.id, clauseRow.id, obRow?.id || null, title.toString(), desc.toString());
            count++;
          } else {
            let reason = [];
            if (!deptRow) reason.push(`Department "${dept}" not found`);
            if (!clauseRow) reason.push(`ISO Clause "${clause}" not found`);
            failedRows.push(`Row ${index + 2}: ${reason.join(', ')}.`);
          }
        }
      });

      res.json({ success: true, count, failedRows });
    } catch (error) {
      console.error("Risks upload failed:", error);
      res.status(500).send("Failed to parse risks.");
    }
  });

  // --- Obligations with Reassessment Logic ---
  app.get("/api/obligations", (req, res) => {
    const { department_id, session_id } = req.query;
    let query = "SELECT o.*, d.name as department_name FROM compliance_obligations o JOIN departments d ON o.department_id = d.id";
    let params = [];
    
    const conditions = [];
    if (department_id) {
      conditions.push("o.department_id = ?");
      params.push(department_id);
    }
    if (session_id) {
      conditions.push("o.session_id = ?");
      params.push(session_id);
    }
    
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    
    const obligations = db.prepare(query).all(...params);
    res.json(obligations);
  });

  app.post("/api/obligations", async (req, res) => {
    const { session_id, department_id, law_name, content } = req.body;
    const result = db.prepare("INSERT INTO compliance_obligations (session_id, department_id, law_name, content, is_new) VALUES (?, ?, ?, ?, 1)")
      .run(session_id, department_id, law_name, content);
    
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/obligations/:id", async (req, res) => {
    const { id } = req.params;
    const { department_id, law_name, content } = req.body;
    
    const oldOb = db.prepare("SELECT content FROM compliance_obligations WHERE id = ?").get(id) as any;
    const isChanged = oldOb.content !== content;

    db.prepare("UPDATE compliance_obligations SET department_id = ?, law_name = ?, content = ?, is_changed = ? WHERE id = ?")
      .run(department_id, law_name, content, isChanged ? 1 : 0, id);

    if (isChanged) {
      // Flag associated risks for reassessment
      db.prepare("UPDATE risks SET needs_reassessment = 1, previous_content = ? WHERE obligation_id = ?")
        .run(oldOb.content, id);
    }

    res.json({ success: true });
  });

  app.get("/api/iso-clauses", (req, res) => {
    const clauses = db.prepare("SELECT * FROM iso_clauses").all();
    res.json(clauses);
  });

  app.get("/api/risks", (req, res) => {
    const { session_id, department_id } = req.query;
    let query = `
      SELECT r.*, d.name as department_name, c.standard, c.clause_number, c.title as clause_title,
             o.law_name as obligation_law_name,
             ar.status as audit_status, ar.comment as audit_comment
      FROM risks r
      JOIN departments d ON r.department_id = d.id
      LEFT JOIN iso_clauses c ON r.iso_clause_id = c.id
      LEFT JOIN compliance_obligations o ON r.obligation_id = o.id
      LEFT JOIN audit_results ar ON r.id = ar.risk_id
    `;
    let params = [];
    const conditions = [];
    if (session_id) {
      conditions.push("r.session_id = ?");
      params.push(session_id);
    }
    if (department_id) {
      conditions.push("r.department_id = ?");
      params.push(department_id);
    }
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    const risks = db.prepare(query).all(...params);
    res.json(risks);
  });

  app.post("/api/risks", async (req, res) => {
    const { session_id, department_id, iso_clause_id, obligation_id, title, description, controls } = req.body;
    const insertRisk = db.prepare("INSERT INTO risks (session_id, department_id, iso_clause_id, obligation_id, title, description) VALUES (?, ?, ?, ?, ?, ?)");
    const result = insertRisk.run(session_id, department_id, iso_clause_id, obligation_id || null, title, description);
    const riskId = result.lastInsertRowid;

    const dept = db.prepare("SELECT name FROM departments WHERE id = ?").get(department_id) as any;
    const clause = db.prepare("SELECT standard, clause_number FROM iso_clauses WHERE id = ?").get(iso_clause_id) as any;

    // Sync to Teams Excel
    await appendToExcel(process.env.TEAMS_EXCEL_RISKS_TABLE || "RisksTable", [
      new Date().toISOString(),
      dept?.name || "Unknown",
      `ISO ${clause?.standard} - ${clause?.clause_number}`,
      title,
      description,
      'draft'
    ]);

    if (controls && Array.isArray(controls)) {
      const insertControl = db.prepare("INSERT INTO controls (risk_id, activity) VALUES (?, ?)");
      const insertPlan = db.prepare("INSERT INTO evidence_plans (control_id, document_name) VALUES (?, ?)");
      
      controls.forEach((c: any) => {
        const ctrlResult = insertControl.run(riskId, c.activity);
        const ctrlId = ctrlResult.lastInsertRowid;
        if (c.plans && Array.isArray(c.plans)) {
          c.plans.forEach((p: any) => {
            insertPlan.run(ctrlId, p.document_name);
          });
        }
      });
    }
    res.json({ id: riskId });
  });

  app.put("/api/risks/:id", async (req, res) => {
    const { id } = req.params;
    const { department_id, iso_clause_id, obligation_id, title, description } = req.body;
    
    db.prepare(`
      UPDATE risks 
      SET department_id = ?, iso_clause_id = ?, obligation_id = ?, title = ?, description = ?, needs_reassessment = 0 
      WHERE id = ?
    `).run(department_id, iso_clause_id, obligation_id || null, title, description, id);
    
    res.json({ success: true });
  });

  app.get("/api/risks/:id/details", (req, res) => {
    const risk = db.prepare(`
      SELECT r.*, d.name as department_name, ic.standard, ic.clause_number, ic.title as clause_title,
             o.law_name as obligation_law_name, o.content as obligation_content
      FROM risks r
      JOIN departments d ON r.department_id = d.id
      JOIN iso_clauses ic ON r.iso_clause_id = ic.id
      LEFT JOIN compliance_obligations o ON r.obligation_id = o.id
      WHERE r.id = ?
    `).get(req.params.id);

    const controls = db.prepare("SELECT * FROM controls WHERE risk_id = ?").all(req.params.id);
    
    const fullControls = controls.map((c: any) => {
      const plans = db.prepare(`
        SELECT ep.*, ef.file_name, ef.file_path
        FROM evidence_plans ep
        LEFT JOIN evidence_files ef ON ep.id = ef.evidence_plan_id
        WHERE ep.control_id = ?
      `).all(c.id);
      return { ...c, plans };
    });

    const audit = db.prepare("SELECT * FROM audit_results WHERE risk_id = ?").get(req.params.id);

    res.json({ ...risk, controls: fullControls, audit });
  });

  app.post("/api/evidence/upload", upload.single("file"), async (req: any, res) => {
    const { evidence_plan_id } = req.body;
    if (!req.file) return res.status(400).send("No file uploaded.");

    // Fix Korean filename encoding (latin1 -> utf8)
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    // 1. Get control info to create folder
    const plan = db.prepare(`
      SELECT ep.*, c.activity as control_name 
      FROM evidence_plans ep 
      JOIN controls c ON ep.control_id = c.id 
      WHERE ep.id = ?
    `).get(evidence_plan_id) as any;

    const controlName = plan?.control_name || "Unknown_Control";
    const controlDir = path.join(uploadDir, `Control_${plan?.control_id || "unknown"}`);
    
    if (!fs.existsSync(controlDir)) {
      fs.mkdirSync(controlDir, { recursive: true });
    }

    // 2. Move file to control-specific folder
    const newPath = path.join(controlDir, req.file.filename);
    fs.renameSync(req.file.path, newPath);

    // 3. Save to DB with fixed original name
    const insertFile = db.prepare("INSERT INTO evidence_files (evidence_plan_id, file_name, file_path) VALUES (?, ?, ?)");
    insertFile.run(evidence_plan_id, originalName, newPath);

    // 4. Sync to Teams/OneDrive Folder
    await uploadFileToTeams(controlName, originalName, newPath);

    res.json({ success: true });
  });

  app.post("/api/audit", (req, res) => {
    const { risk_id, status, comment, auditor_name } = req.body;
    const existing = db.prepare("SELECT id FROM audit_results WHERE risk_id = ?").get(risk_id);
    
    if (existing) {
      db.prepare("UPDATE audit_results SET status = ?, comment = ?, auditor_name = ?, audited_at = CURRENT_TIMESTAMP WHERE risk_id = ?")
        .run(status, comment, auditor_name, risk_id);
    } else {
      db.prepare("INSERT INTO audit_results (risk_id, status, comment, auditor_name) VALUES (?, ?, ?, ?)")
        .run(risk_id, status, comment, auditor_name);
    }

    // Update risk status based on audit
    const riskStatus = status === 'conformity' ? 'submitted' : 'revision';
    db.prepare("UPDATE risks SET status = ? WHERE id = ?").run(riskStatus, risk_id);

    res.json({ success: true });
  });

  app.get("/api/stats", (req, res) => {
    const totalRisks = db.prepare("SELECT COUNT(*) as count FROM risks").get() as any;
    const submittedRisks = db.prepare("SELECT COUNT(*) as count FROM risks WHERE status = 'submitted'").get() as any;
    const conformity = db.prepare("SELECT COUNT(*) as count FROM audit_results WHERE status = 'conformity'").get() as any;
    const nonConformity = db.prepare("SELECT COUNT(*) as count FROM audit_results WHERE status = 'non-conformity'").get() as any;

    res.json({
      total: totalRisks.count,
      submitted: submittedRisks.count,
      conformity: conformity.count,
      nonConformity: nonConformity.count
    });
  });

  // Serve uploaded files
  app.use("/uploads", express.static(uploadDir));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
