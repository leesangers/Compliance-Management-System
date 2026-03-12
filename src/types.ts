export interface AssessmentSession {
  id: number;
  year: number;
  name: string;
  status: 'active' | 'finalized';
  created_at: string;
}

export interface Department {
  id: number;
  org_code?: string;
  name: string;
}

export interface ISOCause {
  id: number;
  standard: string;
  clause_number: string;
  title: string;
}

export interface ComplianceObligation {
  id: number;
  session_id: number;
  department_id: number;
  department_name?: string;
  law_name: string;
  content: string;
  is_changed: boolean;
  is_new: boolean;
  created_at: string;
}

export interface Risk {
  id: number;
  session_id: number;
  department_id: number;
  department_name?: string;
  iso_clause_id: number;
  obligation_id?: number;
  obligation_law_name?: string;
  obligation_content?: string;
  standard?: string;
  clause_number?: string;
  clause_title?: string;
  title: string;
  description: string;
  status: 'draft' | 'submitted' | 'revision';
  needs_reassessment: boolean;
  previous_content?: string;
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
