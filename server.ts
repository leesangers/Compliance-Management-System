import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import multer from "multer";
import fs from "fs";

const db = new Database("iso_management.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS iso_clauses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    standard TEXT NOT NULL, -- '37301' or '37001'
    clause_number TEXT NOT NULL,
    title TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS risks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_id INTEGER NOT NULL,
    iso_clause_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft', -- 'draft', 'submitted', 'revision'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (iso_clause_id) REFERENCES iso_clauses(id)
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
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + "-" + file.originalname);
    },
  });
  const upload = multer({ storage });

  // API Routes
  app.get("/api/departments", (req, res) => {
    const depts = db.prepare("SELECT * FROM departments").all();
    res.json(depts);
  });

  app.get("/api/iso-clauses", (req, res) => {
    const clauses = db.prepare("SELECT * FROM iso_clauses").all();
    res.json(clauses);
  });

  app.get("/api/risks", (req, res) => {
    const risks = db.prepare(`
      SELECT r.*, d.name as department_name, c.standard, c.clause_number, c.title as clause_title,
             ar.status as audit_status, ar.comment as audit_comment
      FROM risks r
      JOIN departments d ON r.department_id = d.id
      JOIN iso_clauses c ON r.iso_clause_id = c.id
      LEFT JOIN audit_results ar ON r.id = ar.risk_id
    `).all();
    res.json(risks);
  });

  app.post("/api/risks", (req, res) => {
    const { department_id, iso_clause_id, title, description, controls } = req.body;
    const insertRisk = db.prepare("INSERT INTO risks (department_id, iso_clause_id, title, description) VALUES (?, ?, ?, ?)");
    const result = insertRisk.run(department_id, iso_clause_id, title, description);
    const riskId = result.lastInsertRowid;

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

  app.get("/api/risks/:id/details", (req, res) => {
    const risk = db.prepare(`
      SELECT r.*, d.name as department_name, ic.standard, ic.clause_number, ic.title as clause_title
      FROM risks r
      JOIN departments d ON r.department_id = d.id
      JOIN iso_clauses ic ON r.iso_clause_id = ic.id
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

  app.post("/api/evidence/upload", upload.single("file"), (req: any, res) => {
    const { evidence_plan_id } = req.body;
    if (!req.file) return res.status(400).send("No file uploaded.");

    const insertFile = db.prepare("INSERT INTO evidence_files (evidence_plan_id, file_name, file_path) VALUES (?, ?, ?)");
    insertFile.run(evidence_plan_id, req.file.originalname, req.file.path);
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
