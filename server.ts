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

  CREATE TABLE IF NOT EXISTS compliance_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    department_id INTEGER NOT NULL,
    category TEXT,
    name TEXT NOT NULL,
    goal_description TEXT,
    manager TEXT,
    deadline TEXT,
    monitoring_timing TEXT,
    criteria TEXT,
    method TEXT,
    status TEXT DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES assessment_sessions(id),
    FOREIGN KEY (department_id) REFERENCES departments(id)
  );

  CREATE TABLE IF NOT EXISTS risks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    department_id INTEGER NOT NULL,
    iso_clause_id INTEGER,
    obligation_id INTEGER,
    type TEXT DEFAULT 'compliance', -- 'compliance' or 'ethics'
    area TEXT,
    risk_type TEXT,
    stakeholder TEXT,
    cause TEXT,
    scale TEXT,
    scale_reason TEXT,
    control1 TEXT,
    control2 TEXT,
    evidence_type1 TEXT,
    evidence_type2 TEXT,
    monitoring_target TEXT,
    monitoring_period TEXT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft',
    needs_reassessment BOOLEAN DEFAULT 0,
    previous_content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES assessment_sessions(id),
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (iso_clause_id) REFERENCES iso_clauses(id),
    FOREIGN KEY (obligation_id) REFERENCES compliance_obligations(id)
  );

  CREATE TABLE IF NOT EXISTS evidence_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_type TEXT DEFAULT 'risk', -- 'risk' or 'goal'
    target_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    description TEXT,
    control_field TEXT, -- 'control1', 'control2', etc.
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    risk_id INTEGER,
    goal_id INTEGER,
    status TEXT NOT NULL, -- 'conformity', 'non-conformity'
    comment TEXT,
    auditor_name TEXT,
    audited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (risk_id) REFERENCES risks(id),
    FOREIGN KEY (goal_id) REFERENCES compliance_goals(id)
  );
`);


// --- Migrations ---
function runMigrations() {
  const tables = {
    assessment_sessions: ['status'],
    departments: ['org_code'],
    compliance_obligations: ['session_id'],
    risks: [
      'session_id', 'obligation_id', 'type', 'area', 'risk_type', 
      'stakeholder', 'cause', 'scale', 'scale_reason', 'control1', 
      'control2', 'monitoring_target', 'evidence_type', 'monitoring_period'
    ],
    evidence_files: ['description', 'target_type', 'target_id', 'evidence_plan_id', 'control_field'],
    compliance_goals: ['status'],
    audit_results: ['goal_id']
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
          else if (column === 'description') alterQuery += "TEXT";
          else if (column === 'type') alterQuery += "TEXT DEFAULT 'compliance'";
          else if (column === 'area') alterQuery += "TEXT";
          else if (column === 'risk_type') alterQuery += "TEXT";
          else if (column === 'stakeholder') alterQuery += "TEXT";
          else if (column === 'cause') alterQuery += "TEXT";
          else if (column === 'scale') alterQuery += "TEXT";
          else if (column === 'scale_reason') alterQuery += "TEXT";
          else if (column === 'control1') alterQuery += "TEXT";
          else if (column === 'control2') alterQuery += "TEXT";
          else if (column === 'monitoring_target') alterQuery += "TEXT";
          else if (column === 'evidence_type1') alterQuery += "TEXT";
          else if (column === 'evidence_type2') alterQuery += "TEXT";
          else if (column === 'monitoring_period') alterQuery += "TEXT";
          else if (column === 'target_type') alterQuery += "TEXT DEFAULT 'risk'";
          else if (column === 'target_id') alterQuery += "INTEGER";
          else if (column === 'evidence_plan_id') alterQuery += "INTEGER";
          else if (column === 'goal_id') alterQuery += "INTEGER";
          else if (column === 'control_field') alterQuery += "TEXT";
          
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
  db.prepare("INSERT INTO departments (name) VALUES (?)").run("CP팀");

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
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      cb(null, uniqueSuffix + "-" + originalName);
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
  app.get("/api/departments", (req, res) => {
    const depts = db.prepare("SELECT * FROM departments").all();
    res.json(depts);
  });

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

  app.delete("/api/sessions/:id", (req, res) => {
    const { id } = req.params;
    db.transaction(() => {
      // Delete child records first
      db.prepare("DELETE FROM audit_results WHERE risk_id IN (SELECT id FROM risks WHERE session_id = ?)").run(id);
      db.prepare("DELETE FROM audit_results WHERE goal_id IN (SELECT id FROM compliance_goals WHERE session_id = ?)").run(id);
      db.prepare("DELETE FROM evidence_files WHERE target_type = 'risk' AND target_id IN (SELECT id FROM risks WHERE session_id = ?)").run(id);
      db.prepare("DELETE FROM evidence_files WHERE target_type = 'goal' AND target_id IN (SELECT id FROM compliance_goals WHERE session_id = ?)").run(id);
      
      db.prepare("DELETE FROM risks WHERE session_id = ?").run(id);
      db.prepare("DELETE FROM compliance_goals WHERE session_id = ?").run(id);
      db.prepare("DELETE FROM compliance_obligations WHERE session_id = ?").run(id);
      db.prepare("DELETE FROM assessment_sessions WHERE id = ?").run(id);
    })();
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
        const dept = row['부서'] || row['Department'] || row['부서명'];
        const law = row['법령명'] || row['Law'] || row['관련 법령명'];
        const content = row['의무내용'] || row['Content'] || row['주요 의무 내용'];
        
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
        const dept = row['부서'] || row['Department'] || row['부서명'];
        const clause = row['조항'] || row['Clause'];
        const law = row['법령명'] || row['Law'] || row['관련 법령명'];
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
      params.push(Number(department_id));
    }
    if (session_id) {
      conditions.push("o.session_id = ?");
      params.push(Number(session_id));
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

  app.delete("/api/obligations/:id", (req, res) => {
    const { id } = req.params;
    db.transaction(() => {
      // Nullify references in risks table
      db.prepare("UPDATE risks SET obligation_id = NULL WHERE obligation_id = ?").run(id);
      db.prepare("DELETE FROM compliance_obligations WHERE id = ?").run(id);
    })();
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
      params.push(Number(session_id));
    }
    if (department_id) {
      conditions.push("r.department_id = ?");
      params.push(Number(department_id));
    }
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    const risks = db.prepare(query).all(...params) as any[];

    return res.json(risks);
  });

  app.get("/api/goals", (req, res) => {
    const { session_id, department_id } = req.query;
    let query = "SELECT g.*, d.name as department_name FROM compliance_goals g JOIN departments d ON g.department_id = d.id";
    let params = [];
    const conditions = [];
    if (session_id) {
      conditions.push("g.session_id = ?");
      params.push(Number(session_id));
    }
    if (department_id) {
      conditions.push("g.department_id = ?");
      params.push(Number(department_id));
    }
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    const goals = db.prepare(query).all(...params);
    res.json(goals);
  });

  app.post("/api/goals", (req, res) => {
    const { session_id, department_id, category, name, goal_description, manager, deadline, monitoring_timing, criteria, method } = req.body;
    const result = db.prepare(`
      INSERT INTO compliance_goals (session_id, department_id, category, name, goal_description, manager, deadline, monitoring_timing, criteria, method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(session_id, department_id, category, name, goal_description, manager, deadline, monitoring_timing, criteria, method);
    res.json({ id: result.lastInsertRowid });
  });

  app.put("/api/goals/:id", (req, res) => {
    const { id } = req.params;
    const { name, goal_description, manager, deadline, monitoring_timing, criteria, method, status } = req.body;
    db.prepare(`
      UPDATE compliance_goals 
      SET name = ?, goal_description = ?, manager = ?, deadline = ?, monitoring_timing = ?, criteria = ?, method = ?, status = ?
      WHERE id = ?
    `).run(name, goal_description, manager, deadline, monitoring_timing, criteria, method, status || 'draft', id);
    res.json({ success: true });
  });

  app.delete("/api/goals/:id", (req, res) => {
    db.prepare("DELETE FROM compliance_goals WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/risks", async (req, res) => {
    const { 
      session_id, department_id, iso_clause_id, obligation_id, title, description,
      type, area, risk_type, stakeholder, cause, scale, scale_reason, 
      control1, control2, evidence_type1, evidence_type2, monitoring_target, monitoring_period
    } = req.body;
    
    const insertRisk = db.prepare(`
      INSERT INTO risks (
        session_id, department_id, iso_clause_id, obligation_id, title, description,
        type, area, risk_type, stakeholder, cause, scale, scale_reason, 
        control1, control2, evidence_type1, evidence_type2, monitoring_target, monitoring_period
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = insertRisk.run(
      session_id, department_id, iso_clause_id || null, obligation_id || null, title, description,
      type || 'compliance', area, risk_type, stakeholder, cause, scale, scale_reason,
      control1, control2, evidence_type1, evidence_type2, monitoring_target, monitoring_period
    );
    
    const riskId = result.lastInsertRowid;
    res.json({ id: riskId });
  });

  app.put("/api/risks/:id", async (req, res) => {
    const { id } = req.params;
    const { 
      department_id, iso_clause_id, obligation_id, title, description,
      type, area, risk_type, stakeholder, cause, scale, scale_reason, 
      control1, control2, evidence_type1, evidence_type2, monitoring_target, monitoring_period,
      status
    } = req.body;
    
    db.prepare(`
      UPDATE risks 
      SET department_id = ?, iso_clause_id = ?, obligation_id = ?, title = ?, description = ?,
          type = ?, area = ?, risk_type = ?, stakeholder = ?, cause = ?, scale = ?, scale_reason = ?,
          control1 = ?, control2 = ?, evidence_type1 = ?, evidence_type2 = ?, monitoring_target = ?, monitoring_period = ?,
          status = ?, needs_reassessment = 0 
      WHERE id = ?
    `).run(
      department_id, iso_clause_id || null, obligation_id || null, title, description,
      type, area, risk_type, stakeholder, cause, scale, scale_reason,
      control1, control2, evidence_type1, evidence_type2, monitoring_target, monitoring_period,
      status || 'draft', id
    );
    
    res.json({ success: true });
  });

  app.get("/api/stats", (req, res) => {
    const { session_id, department_id } = req.query;
    let riskQuery = "SELECT status, id FROM risks WHERE session_id = ?";
    let goalQuery = "SELECT status, id FROM compliance_goals WHERE session_id = ?";
    let params: any[] = [Number(session_id)];

    if (department_id) {
      riskQuery += " AND department_id = ?";
      goalQuery += " AND department_id = ?";
      params.push(Number(department_id));
    }

    const risks = db.prepare(riskQuery).all(...params) as any[];
    const goals = db.prepare(goalQuery).all(...params) as any[];
    const all = [...risks, ...goals];

    const stats = {
      total: all.length,
      submitted: all.filter(r => r.status === 'submitted' || r.status === 'conformity' || r.status === 'non-conformity').length,
      conformity: 0,
      nonConformity: 0
    };

    // Count audits
    const riskIds = risks.map(r => r.id);
    const goalIds = goals.map(g => g.id);
    
    if (riskIds.length > 0) {
      const riskAudits = db.prepare(`SELECT status FROM audit_results WHERE risk_id IN (${riskIds.map(() => '?').join(',')})`).all(...riskIds) as any[];
      stats.conformity += riskAudits.filter(a => a.status === 'conformity').length;
      stats.nonConformity += riskAudits.filter(a => a.status === 'non-conformity').length;
    }
    
    // For goals, we might need a separate table or check audit_results if we add goal_id there
    // For now, let's assume audit_results has goal_id or we use a similar logic
    if (goalIds.length > 0) {
       const goalAudits = db.prepare(`SELECT status FROM audit_results WHERE goal_id IN (${goalIds.map(() => '?').join(',')})`).all(...goalIds) as any[];
       stats.conformity += goalAudits.filter(a => a.status === 'conformity').length;
       stats.nonConformity += goalAudits.filter(a => a.status === 'non-conformity').length;
    }

    res.json(stats);
  });

  app.get("/api/risks/:id/details", (req, res) => {
    const risk = db.prepare(`
      SELECT r.*, d.name as department_name, ic.standard, ic.clause_number, ic.title as clause_title,
             o.law_name as obligation_law_name, o.content as obligation_content
      FROM risks r
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN iso_clauses ic ON r.iso_clause_id = ic.id
      LEFT JOIN compliance_obligations o ON r.obligation_id = o.id
      WHERE r.id = ?
    `).get(req.params.id) as any;

    if (!risk) return res.status(404).send("Risk not found");

    const files = db.prepare("SELECT * FROM evidence_files WHERE target_type = 'risk' AND target_id = ?").all(req.params.id);
    const audit = db.prepare("SELECT * FROM audit_results WHERE risk_id = ? OR goal_id = ?").get(req.params.id, req.params.id);

    res.json({ ...risk, files, audit });
  });

  app.post("/api/evidence/upload", upload.single("file"), async (req: any, res) => {
    const { target_type, target_id, description, control_field } = req.body;
    if (!req.file || !target_type || !target_id) return res.status(400).send("Missing file, target_type, or target_id.");

    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const targetDir = path.join(uploadDir, `${target_type}_${target_id}`);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const newPath = path.join(targetDir, req.file.filename);
    fs.renameSync(req.file.path, newPath);

    const insertFile = db.prepare("INSERT INTO evidence_files (target_type, target_id, file_name, file_path, description) VALUES (?, ?, ?, ?, ?)");
    insertFile.run(target_type, target_id, originalName, newPath, description || null);

    if (target_type === 'risk') {
      db.prepare("UPDATE risks SET status = 'submitted' WHERE id = ? AND status = 'draft'").run(target_id);
    } else if (target_type === 'goal') {
      db.prepare("UPDATE compliance_goals SET status = 'submitted' WHERE id = ? AND status = 'draft'").run(target_id);
    }

    res.json({ success: true });
  });

  app.post("/api/audit", (req, res) => {
    const { risk_id, goal_id, status, comment, auditor_name } = req.body;
    const existing = risk_id 
      ? db.prepare("SELECT id FROM audit_results WHERE risk_id = ?").get(risk_id)
      : db.prepare("SELECT id FROM audit_results WHERE goal_id = ?").get(goal_id);
    
    if (existing) {
      if (risk_id) {
        db.prepare("UPDATE audit_results SET status = ?, comment = ?, auditor_name = ?, audited_at = CURRENT_TIMESTAMP WHERE risk_id = ?")
          .run(status, comment, auditor_name, risk_id);
      } else {
        db.prepare("UPDATE audit_results SET status = ?, comment = ?, auditor_name = ?, audited_at = CURRENT_TIMESTAMP WHERE goal_id = ?")
          .run(status, comment, auditor_name, goal_id);
      }
    } else {
      db.prepare("INSERT INTO audit_results (risk_id, goal_id, status, comment, auditor_name) VALUES (?, ?, ?, ?, ?)")
        .run(risk_id || null, goal_id || null, status, comment, auditor_name);
    }

    const riskStatus = status === 'conformity' ? 'conformity' : 'non-conformity';
    if (risk_id) {
      db.prepare("UPDATE risks SET status = ? WHERE id = ?").run(riskStatus, risk_id);
    } else if (goal_id) {
      db.prepare("UPDATE compliance_goals SET status = ? WHERE id = ?").run(riskStatus, goal_id);
    }

    res.json({ success: true });
  });

  app.get("/api/stats", (req, res) => {
    const { session_id, department_id } = req.query;
    
    let riskConds = [];
    let params: any[] = [];
    if (session_id) { riskConds.push("session_id = ?"); params.push(Number(session_id)); }
    if (department_id) { riskConds.push("department_id = ?"); params.push(Number(department_id)); }
    
    let riskWhere = riskConds.length > 0 ? " WHERE " + riskConds.join(" AND ") : "";
    let riskWhereAnd = riskConds.length > 0 ? riskWhere + " AND " : " WHERE ";

    let auditConds = [];
    let auditParams: any[] = [];
    if (session_id) { auditConds.push("r.session_id = ?"); auditParams.push(Number(session_id)); }
    if (department_id) { auditConds.push("r.department_id = ?"); auditParams.push(Number(department_id)); }
    
    let auditWhereAnd = auditConds.length > 0 ? " WHERE " + auditConds.join(" AND ") + " AND " : " WHERE ";

    const totalRisks = db.prepare(`SELECT COUNT(*) as count FROM risks ${riskWhere}`).get(...params) as any;
    const submittedRisks = db.prepare(`SELECT COUNT(*) as count FROM risks ${riskWhereAnd} status = 'submitted'`).get(...params) as any;
    const conformity = db.prepare(`SELECT COUNT(*) as count FROM audit_results ar JOIN risks r ON ar.risk_id = r.id ${auditWhereAnd} ar.status = 'conformity'`).get(...auditParams) as any;
    const nonConformity = db.prepare(`SELECT COUNT(*) as count FROM audit_results ar JOIN risks r ON ar.risk_id = r.id ${auditWhereAnd} ar.status = 'non-conformity'`).get(...auditParams) as any;

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
