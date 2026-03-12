export interface Department {
  id: number;
  name: string;
}

export interface ISOCause {
  id: number;
  standard: string;
  clause_number: string;
  title: string;
}

export interface Risk {
  id: number;
  department_id: number;
  department_name?: string;
  iso_clause_id: number;
  standard?: string;
  clause_number?: string;
  clause_title?: string;
  title: string;
  description: string;
  status: 'draft' | 'submitted' | 'revision';
  created_at: string;
  audit_status?: string;
  audit_comment?: string;
}

export interface Control {
  id: number;
  risk_id: number;
  activity: string;
  plans?: EvidencePlan[];
}

export interface EvidencePlan {
  id: number;
  control_id: number;
  document_name: string;
  file_name?: string;
  file_path?: string;
}

export interface AuditResult {
  id: number;
  risk_id: number;
  status: 'conformity' | 'non-conformity' | 'recommendation';
  comment: string;
  auditor_name: string;
  audited_at: string;
}

export type Persona = 'user' | 'admin' | 'auditor';
