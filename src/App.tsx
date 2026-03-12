import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  Download, 
  LayoutDashboard, 
  Users, 
  Search,
  Plus,
  ChevronRight,
  Menu,
  X,
  Eye,
  Check,
  XCircle,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PieChart, 
  Pie, 
  Cell,
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import * as XLSX from 'xlsx';
import { Persona, Risk, Department, ISOCause } from './types';

// --- Components ---

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    draft: 'bg-stone-200 text-stone-700',
    submitted: 'bg-emerald-100 text-emerald-700',
    revision: 'bg-amber-100 text-amber-700',
    conformity: 'bg-blue-100 text-blue-700',
    'non-conformity': 'bg-rose-100 text-rose-700',
    recommendation: 'bg-indigo-100 text-indigo-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${styles[status] || 'bg-gray-100'}`}>
      {status.replace('-', ' ')}
    </span>
  );
};

const Card = ({ children, className = "", ...props }: { children: React.ReactNode, className?: string, [key: string]: any }) => (
  <div className={`bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden ${className}`} {...props}>
    {children}
  </div>
);

// --- Views ---

const UserView = ({ departments, clauses }: { departments: Department[], clauses: ISOCause[] }) => {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<any>(null);

  const fetchRisks = async () => {
    const res = await fetch('/api/risks');
    const data = await res.json();
    setRisks(data);
  };

  useEffect(() => { fetchRisks(); }, []);

  const handleUpload = async (planId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('evidence_plan_id', planId.toString());
    await fetch('/api/evidence/upload', { method: 'POST', body: formData });
    if (selectedRisk) {
      const res = await fetch(`/api/risks/${selectedRisk.id}/details`);
      setSelectedRisk(await res.json());
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-serif italic text-stone-900">현업 부서 리스크 관리</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-lg hover:bg-stone-800 transition-colors"
        >
          <Plus size={18} /> 리스크 등록
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {risks.map(risk => (
          <Card key={risk.id} className="p-5 hover:border-stone-400 transition-all cursor-pointer" >
            <div onClick={async () => {
              const res = await fetch(`/api/risks/${risk.id}/details`);
              setSelectedRisk(await res.json());
            }}>
              <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400">ISO {risk.standard}</span>
                <StatusBadge status={risk.status} />
              </div>
              <h3 className="font-medium text-stone-900 mb-1">{risk.title}</h3>
              <p className="text-sm text-stone-500 line-clamp-2 mb-4">{risk.description}</p>
              <div className="flex items-center justify-between text-xs text-stone-400 border-t border-stone-100 pt-3">
                <span>{risk.department_name}</span>
                <span>{new Date(risk.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Risk Detail Modal */}
      <AnimatePresence>
        {selectedRisk && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-stone-50 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-stone-200"
            >
              <div className="sticky top-0 bg-stone-50 border-b border-stone-200 p-6 flex justify-between items-center z-10">
                <div>
                  <h3 className="text-xl font-serif italic">{selectedRisk.title}</h3>
                  <p className="text-sm text-stone-500">ISO {selectedRisk.standard} - {selectedRisk.clause_number} {selectedRisk.clause_title}</p>
                </div>
                <button onClick={() => setSelectedRisk(null)} className="p-2 hover:bg-stone-200 rounded-full"><X size={20}/></button>
              </div>
              
              <div className="p-6 space-y-8">
                <section>
                  <h4 className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-4">통제 활동 및 증빙 제출</h4>
                  <div className="space-y-4">
                    {selectedRisk.controls.map((ctrl: any) => (
                      <div key={ctrl.id} className="bg-white p-4 rounded-xl border border-stone-200">
                        <p className="font-medium text-stone-800 mb-3">{ctrl.activity}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {ctrl.plans.map((plan: any) => (
                            <div key={plan.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-dashed border-stone-300">
                              <div className="flex items-center gap-2">
                                <FileText size={16} className="text-stone-400" />
                                <span className="text-sm text-stone-600">{plan.document_name}</span>
                              </div>
                              {plan.file_name ? (
                                <div className="flex items-center gap-2 text-emerald-600">
                                  <CheckCircle2 size={16} />
                                  <span className="text-xs font-medium">제출됨</span>
                                </div>
                              ) : (
                                <label className="cursor-pointer text-stone-400 hover:text-stone-900">
                                  <Upload size={16} />
                                  <input 
                                    type="file" 
                                    className="hidden" 
                                    onChange={(e) => e.target.files?.[0] && handleUpload(plan.id, e.target.files[0])} 
                                  />
                                </label>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {selectedRisk.audit && (
                  <section className="bg-stone-900 text-stone-100 p-6 rounded-xl">
                    <h4 className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-4">심사 의견</h4>
                    <div className="flex items-start gap-4">
                      <StatusBadge status={selectedRisk.audit.status} />
                      <div>
                        <p className="text-sm opacity-90 mb-2">{selectedRisk.audit.comment}</p>
                        <p className="text-[10px] opacity-50 font-mono">심사원: {selectedRisk.audit.auditor_name} | {new Date(selectedRisk.audit.audited_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </section>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Risk Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif italic">신규 리스크 등록</h3>
                <button onClick={() => setIsAdding(false)}><X size={20}/></button>
              </div>
              <form className="space-y-4" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = {
                  department_id: formData.get('department_id'),
                  iso_clause_id: formData.get('iso_clause_id'),
                  title: formData.get('title'),
                  description: formData.get('description'),
                  controls: [
                    {
                      activity: formData.get('control_activity'),
                      plans: [{ document_name: formData.get('evidence_name') }]
                    }
                  ]
                };
                await fetch('/api/risks', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(data)
                });
                setIsAdding(false);
                fetchRisks();
              }}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-stone-400 mb-1">부서</label>
                    <select name="department_id" className="w-full p-2 border border-stone-200 rounded-lg">
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-stone-400 mb-1">ISO 조항</label>
                    <select name="iso_clause_id" className="w-full p-2 border border-stone-200 rounded-lg">
                      {clauses.map(c => <option key={c.id} value={c.id}>ISO {c.standard} - {c.clause_number}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-stone-400 mb-1">리스크 명칭</label>
                  <input name="title" required className="w-full p-2 border border-stone-200 rounded-lg" placeholder="예: 구매 프로세스 내 부패 리스크" />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-stone-400 mb-1">상세 설명</label>
                  <textarea name="description" className="w-full p-2 border border-stone-200 rounded-lg h-24" placeholder="리스크에 대한 구체적인 내용을 입력하세요." />
                </div>
                <div className="border-t border-stone-100 pt-4">
                  <h4 className="text-sm font-medium mb-3">통제 및 증빙 계획 (1차)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <input name="control_activity" required className="p-2 border border-stone-200 rounded-lg text-sm" placeholder="통제 활동 내용" />
                    <input name="evidence_name" required className="p-2 border border-stone-200 rounded-lg text-sm" placeholder="증빙 서류 명칭" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-stone-900 text-white py-3 rounded-xl font-medium hover:bg-stone-800 transition-colors mt-4">
                  등록 완료
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminView = () => {
  const [stats, setStats] = useState<any>(null);
  const [risks, setRisks] = useState<Risk[]>([]);

  useEffect(() => {
    fetch('/api/stats').then(res => res.json()).then(setStats);
    fetch('/api/risks').then(res => res.json()).then(setRisks);
  }, []);

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(risks.map(r => ({
      '부서': r.department_name,
      '표준': `ISO ${r.standard}`,
      '조항': r.clause_number,
      '리스크 명칭': r.title,
      '상태': r.status,
      '심사결과': r.audit_status || '미심사',
      '등록일': new Date(r.created_at).toLocaleDateString()
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "RCM_Master");
    XLSX.writeFile(workbook, "ISO_Integrated_Management_Report.xlsx");
  };

  if (!stats) return null;

  const chartData = [
    { name: '적합', value: stats.conformity, color: '#3b82f6' },
    { name: '부적합', value: stats.nonConformity, color: '#f43f5e' },
    { name: '미심사', value: Math.max(0, stats.total - (stats.conformity + stats.nonConformity)), color: '#e7e5e4' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-serif italic text-stone-900">컴플라이언스 대시보드</h2>
        <button 
          onClick={exportToExcel}
          className="flex items-center gap-2 border border-stone-200 bg-white px-4 py-2 rounded-lg hover:bg-stone-50 transition-colors shadow-sm"
        >
          <Download size={18} /> 엑셀 마스터 시트 추출
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: '전체 리스크', value: stats.total, icon: FileText, color: 'text-stone-400' },
          { label: '제출 완료', value: stats.submitted, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: '적합 판정', value: stats.conformity, icon: Shield, color: 'text-blue-500' },
          { label: '부적합/개선', value: stats.nonConformity, icon: AlertCircle, color: 'text-rose-500' },
        ].map((item, i) => (
          <Card key={i} className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-1">{item.label}</p>
                <p className="text-3xl font-light text-stone-900">{item.value}</p>
              </div>
              <item.icon className={item.color} size={24} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-6 flex items-center gap-2">
            <BarChart3 size={18} className="text-stone-400" /> 심사 결과 분포
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {chartData.map(d => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                <span className="text-xs text-stone-500">{d.name}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-medium mb-6">최근 등록 현황</h3>
          <div className="space-y-4">
            {risks.slice(0, 5).map(risk => (
              <div key={risk.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-[10px] font-bold">
                    {risk.department_name?.substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-stone-800">{risk.title}</p>
                    <p className="text-[10px] text-stone-400">{risk.department_name} • {new Date(risk.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <StatusBadge status={risk.status} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

const AuditorView = () => {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [selectedRisk, setSelectedRisk] = useState<any>(null);
  const [auditForm, setAuditForm] = useState({ status: 'conformity', comment: '' });

  const fetchRisks = async () => {
    const res = await fetch('/api/risks');
    setRisks(await res.json());
  };

  useEffect(() => { fetchRisks(); }, []);

  const submitAudit = async () => {
    await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        risk_id: selectedRisk.id,
        status: auditForm.status,
        comment: auditForm.comment,
        auditor_name: '심사원 A'
      })
    });
    setSelectedRisk(null);
    fetchRisks();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-serif italic text-stone-900">내부 심사원 검증</h2>
      
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="p-4 text-[11px] font-mono uppercase tracking-widest text-stone-400">부서</th>
                <th className="p-4 text-[11px] font-mono uppercase tracking-widest text-stone-400">ISO 표준/조항</th>
                <th className="p-4 text-[11px] font-mono uppercase tracking-widest text-stone-400">리스크 명칭</th>
                <th className="p-4 text-[11px] font-mono uppercase tracking-widest text-stone-400">상태</th>
                <th className="p-4 text-[11px] font-mono uppercase tracking-widest text-stone-400">심사</th>
              </tr>
            </thead>
            <tbody>
              {risks.map(risk => (
                <tr key={risk.id} className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors">
                  <td className="p-4 text-sm text-stone-600">{risk.department_name}</td>
                  <td className="p-4 text-sm text-stone-600">ISO {risk.standard} - {risk.clause_number}</td>
                  <td className="p-4 text-sm font-medium text-stone-900">{risk.title}</td>
                  <td className="p-4"><StatusBadge status={risk.status} /></td>
                  <td className="p-4">
                    <button 
                      onClick={async () => {
                        const res = await fetch(`/api/risks/${risk.id}/details`);
                        setSelectedRisk(await res.json());
                      }}
                      className="flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-900"
                    >
                      <Eye size={14} /> 검토하기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Audit Modal */}
      <AnimatePresence>
        {selectedRisk && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-stone-200 flex justify-between items-center">
                <h3 className="text-xl font-serif italic">리스크-통제-증빙 정합성 검토</h3>
                <button onClick={() => setSelectedRisk(null)}><X size={20}/></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <section>
                    <h4 className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-3">리스크 정보</h4>
                    <div className="bg-stone-50 p-4 rounded-xl">
                      <p className="font-medium mb-1">{selectedRisk.title}</p>
                      <p className="text-sm text-stone-500">{selectedRisk.description}</p>
                    </div>
                  </section>

                  <section>
                    <h4 className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-3">통제 및 증빙 검증</h4>
                    <div className="space-y-4">
                      {selectedRisk.controls.map((ctrl: any) => (
                        <div key={ctrl.id} className="border border-stone-200 rounded-xl overflow-hidden">
                          <div className="bg-stone-50 p-3 border-b border-stone-200">
                            <p className="text-sm font-medium">통제 활동: {ctrl.activity}</p>
                          </div>
                          <div className="p-4 space-y-3">
                            {ctrl.plans.map((plan: any) => (
                              <div key={plan.id} className="flex items-center justify-between p-3 bg-white border border-stone-100 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <FileText size={16} className="text-stone-300" />
                                  <div>
                                    <p className="text-sm font-medium">{plan.document_name}</p>
                                    {plan.file_name && (
                                      <a 
                                        href={`/${plan.file_path}`} 
                                        target="_blank" 
                                        className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1"
                                      >
                                        <Download size={10} /> {plan.file_name}
                                      </a>
                                    )}
                                  </div>
                                </div>
                                {plan.file_name ? (
                                  <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                                    <Check size={14} /> 파일 확인됨
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-rose-500 text-xs font-bold">
                                    <XCircle size={14} /> 증빙 누락
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="bg-stone-50 p-6 rounded-2xl border border-stone-200 h-fit lg:sticky lg:top-0">
                  <h4 className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-4">심사 판정</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">판정 결과</label>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { id: 'conformity', label: '적합', color: 'text-blue-600' },
                          { id: 'non-conformity', label: '부적합', color: 'text-rose-600' },
                          { id: 'recommendation', label: '개선권고', color: 'text-indigo-600' },
                        ].map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => setAuditForm({ ...auditForm, status: opt.id })}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${
                              auditForm.status === opt.id 
                                ? 'border-stone-900 bg-stone-900 text-white' 
                                : 'border-stone-200 bg-white hover:border-stone-300'
                            }`}
                          >
                            <span className="text-sm font-bold">{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">심사 의견</label>
                      <textarea 
                        className="w-full p-3 border border-stone-200 rounded-xl h-32 text-sm"
                        placeholder="심사 의견을 구체적으로 작성하세요."
                        value={auditForm.comment}
                        onChange={(e) => setAuditForm({ ...auditForm, comment: e.target.value })}
                      />
                    </div>
                    <button 
                      onClick={submitAudit}
                      className="w-full bg-stone-900 text-white py-4 rounded-xl font-bold hover:bg-stone-800 transition-colors"
                    >
                      심사 결과 저장
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [persona, setPersona] = useState<Persona>('user');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [clauses, setClauses] = useState<ISOCause[]>([]);

  useEffect(() => {
    fetch('/api/departments').then(res => res.json()).then(setDepartments);
    fetch('/api/iso-clauses').then(res => res.json()).then(setClauses);
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-stone-900 font-sans">
      {/* Sidebar / Nav */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-stone-200 p-6 hidden lg:block">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center text-white">
            <Shield size={24} />
          </div>
          <h1 className="text-lg font-serif italic leading-tight">ISO Integrated<br/>Management</h1>
        </div>

        <nav className="space-y-1">
          {[
            { id: 'user', label: '현업 부서', icon: Users },
            { id: 'admin', label: '컴플라이언스 관리', icon: LayoutDashboard },
            { id: 'auditor', label: '내부 심사', icon: Search },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setPersona(item.id as Persona)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                persona === item.id 
                  ? 'bg-stone-900 text-white shadow-lg shadow-stone-200' 
                  : 'text-stone-500 hover:bg-stone-50'
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="absolute bottom-6 left-6 right-6">
          <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
            <p className="text-[10px] font-mono uppercase tracking-widest text-stone-400 mb-1">Logged in as</p>
            <p className="text-sm font-medium">{persona === 'user' ? '현업 담당자' : persona === 'admin' ? '관리자' : '심사원'}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-8">
        <div className="max-w-7xl mx-auto">
          <header className="mb-12 lg:hidden flex justify-between items-center">
             <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-stone-900 rounded-lg flex items-center justify-center text-white">
                <Shield size={18} />
              </div>
              <h1 className="text-sm font-serif italic">ISO Management</h1>
            </div>
            <select 
              value={persona} 
              onChange={(e) => setPersona(e.target.value as Persona)}
              className="text-sm border-stone-200 rounded-lg"
            >
              <option value="user">현업 부서</option>
              <option value="admin">관리자</option>
              <option value="auditor">심사원</option>
            </select>
          </header>

          <AnimatePresence mode="wait">
            <motion.div
              key={persona}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {persona === 'user' && <UserView departments={departments} clauses={clauses} />}
              {persona === 'admin' && <AdminView />}
              {persona === 'auditor' && <AuditorView />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
