import React, { useState, useEffect, useRef } from 'react';
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
  RefreshCw,
  ChevronRight,
  Menu,
  X,
  Eye,
  Check,
  XCircle,
  BarChart3,
  Scale,
  BookOpen
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
import { Persona, Risk, Department, ISOCause, ComplianceObligation, AssessmentSession } from './types';

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

const UserView = ({ departments, clauses, sessionId, isFinalized }: { 
  departments: Department[], 
  clauses: ISOCause[], 
  sessionId: number | null,
  isFinalized?: boolean
}) => {
  const [activeTab, setActiveTab] = useState<'obligations' | 'risks' | 'matrix'>('obligations');
  const [obligations, setObligations] = useState<ComplianceObligation[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [isAddingObligation, setIsAddingObligation] = useState(false);
  const [editingObligation, setEditingObligation] = useState<ComplianceObligation | null>(null);
  const [isAddingRisk, setIsAddingRisk] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<any>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const deptSelectRef = useRef<HTMLSelectElement>(null);

  const fetchObligations = async () => {
    if (!sessionId) return;
    const url = `/api/obligations?session_id=${sessionId}${selectedDeptId ? `&department_id=${selectedDeptId}` : ''}`;
    const res = await fetch(url);
    setObligations(await res.json());
  };

  const fetchRisks = async () => {
    if (!sessionId) return;
    const url = `/api/risks?session_id=${sessionId}${selectedDeptId ? `&department_id=${selectedDeptId}` : ''}`;
    const res = await fetch(url);
    setRisks(await res.json());
  };

  useEffect(() => { 
    fetchObligations();
    fetchRisks(); 
  }, [selectedDeptId, sessionId]);

  const exportToExcel = (data: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, fileName);
  };

  const handleExport = () => {
    if (activeTab === 'obligations') {
      exportToExcel(obligations, `의무등록부_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else if (activeTab === 'risks') {
      exportToExcel(risks, `리스크목록_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else {
      const matrixData = obligations.map(o => {
        const relatedRisks = risks.filter(r => r.obligation_id === o.id);
        return {
          부서: o.department_name,
          법령명: o.law_name,
          의무내용: o.content,
          리스크: relatedRisks.map(r => r.title).join(', '),
          통제활동: relatedRisks.map(r => r.controls?.[0]?.activity || '').join(', ')
        };
      });
      exportToExcel(matrixData, `통합매트릭스_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
  };

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-serif italic text-stone-900">의무등록부 & 리스크 식별</h2>
            {isFinalized && (
              <span className="bg-stone-200 text-stone-600 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                최종 확정됨
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-mono text-stone-400 uppercase tracking-widest">부서 필터 (CA 전용):</span>
            <select 
              value={selectedDeptId} 
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="text-xs border-stone-200 rounded-lg bg-white p-1"
            >
              <option value="">전체 부서</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('obligations')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'obligations' ? 'bg-stone-900 text-white' : 'bg-white text-stone-500 border border-stone-200'}`}
          >
            의무등록부
          </button>
          <button 
            onClick={() => setActiveTab('risks')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'risks' ? 'bg-stone-900 text-white' : 'bg-white text-stone-500 border border-stone-200'}`}
          >
            리스크 식별
          </button>
          <button 
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'matrix' ? 'bg-stone-900 text-white' : 'bg-white text-stone-500 border border-stone-200'}`}
          >
            준거성 매트릭스
          </button>
          <button 
            onClick={() => { fetchObligations(); fetchRisks(); }}
            className="p-2 text-stone-400 hover:text-stone-900 transition-colors"
            title="새로고침"
          >
            <RefreshCw size={16} />
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-stone-200 rounded-lg text-sm bg-white hover:bg-stone-50"
          >
            <Download size={16} /> 엑셀 추출
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'obligations' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-stone-700">부서별 의무등록부 (ISO 37301)</h3>
                {!isFinalized && (
                  <button 
                    onClick={() => setIsAddingObligation(true)}
                    className="flex items-center gap-2 text-sm bg-stone-900 text-white px-4 py-2 rounded-lg hover:bg-stone-800 transition-colors"
                  >
                    <Plus size={16} /> 의무 항목 추가
                  </button>
                )}
              </div>
              
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200">
                        <th className="p-4 text-[11px] font-mono uppercase tracking-widest text-stone-400 w-24">부서</th>
                        <th className="p-4 text-[11px] font-mono uppercase tracking-widest text-stone-400 w-48">법령/규정 명칭</th>
                        <th className="p-4 text-[11px] font-mono uppercase tracking-widest text-stone-400">의무 내용</th>
                        {!isFinalized && <th className="p-4 text-[11px] font-mono uppercase tracking-widest text-stone-400 w-20 text-center">관리</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {obligations.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-12 text-center text-stone-400 italic">등록된 의무 사항이 없습니다.</td>
                        </tr>
                      ) : (
                        obligations.map(ob => (
                          <tr key={ob.id} className={`border-b border-stone-100 hover:bg-stone-50/50 transition-colors group ${ob.is_changed ? 'bg-amber-50/30' : ''} ${ob.is_new ? 'bg-emerald-50/30' : ''}`}>
                            <td className="p-4">
                              <span className="text-xs font-medium px-2 py-1 bg-stone-100 rounded text-stone-600">{ob.department_name}</span>
                              <div className="mt-1">
                                {ob.is_changed && <span className="text-[10px] bg-amber-100 text-amber-700 px-1 rounded">변경됨</span>}
                                {ob.is_new && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1 rounded ml-1">신규</span>}
                              </div>
                            </td>
                            <td className="p-4 text-sm font-bold text-stone-900">{ob.law_name}</td>
                            <td className="p-4 text-sm text-stone-600 leading-relaxed">{ob.content}</td>
                            {!isFinalized && (
                              <td className="p-4 text-center">
                                <button 
                                  onClick={() => setEditingObligation(ob)}
                                  className="text-stone-400 hover:text-stone-900 transition-colors p-2"
                                >
                                  <FileText size={16} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'risks' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-stone-700">리스크 식별 및 통제 계획</h3>
                {!isFinalized && (
                  <button 
                    onClick={() => setIsAddingRisk(true)}
                    className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-lg hover:bg-stone-800 transition-colors"
                  >
                    <Plus size={18} /> 리스크 등록
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {risks.map(risk => (
                  <Card key={risk.id} className="p-5 hover:border-stone-400 transition-all cursor-pointer" >
                    <div onClick={async () => {
                      const res = await fetch(`/api/risks/${risk.id}/details`);
                      setSelectedRisk(await res.json());
                    }}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400">ISO {risk.standard}</span>
                          {risk.needs_reassessment && (
                            <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <AlertCircle size={10} /> 재평가 필요
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <StatusBadge status={risk.status} />
                          {risk.audit_status && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              risk.audit_status === 'conformity' ? 'bg-blue-600 text-white' : 
                              risk.audit_status === 'non-conformity' ? 'bg-rose-600 text-white' : 
                              'bg-indigo-600 text-white'
                            }`}>
                              {risk.audit_status === 'conformity' ? '적합' : risk.audit_status === 'non-conformity' ? '부적합' : '개선권고'}
                            </span>
                          )}
                        </div>
                      </div>
                      <h3 className="font-medium text-stone-900 mb-1">{risk.title}</h3>
                      {risk.obligation_law_name && (
                        <div className="flex items-center gap-1 text-[10px] text-blue-700 font-bold mb-2 bg-blue-50 px-2 py-1 rounded border border-blue-100 w-fit">
                          <BookOpen size={10} /> {risk.obligation_law_name}
                        </div>
                      )}
                      <p className="text-sm text-stone-500 line-clamp-2 mb-4">{risk.description}</p>
                      <div className="flex items-center justify-between text-xs text-stone-400 border-t border-stone-100 pt-3">
                        <span>{risk.department_name}</span>
                        <span>{new Date(risk.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'matrix' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-stone-700">통합 준거성 매트릭스 (Compliance Matrix)</h3>
                <p className="text-xs text-stone-400 italic">* 법령별 의무사항과 연결된 리스크 및 통제 현황을 한눈에 확인합니다.</p>
              </div>

              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200">
                        <th className="p-4 text-xs font-mono uppercase text-stone-400 w-32">부서</th>
                        <th className="p-4 text-xs font-mono uppercase text-stone-400 w-48">법령명</th>
                        <th className="p-4 text-xs font-mono uppercase text-stone-400">의무내용</th>
                        <th className="p-4 text-xs font-mono uppercase text-stone-400">연결된 리스크 및 통제활동</th>
                      </tr>
                    </thead>
                    <tbody>
                      {obligations.map(o => {
                        const relatedRisks = risks.filter(r => r.obligation_id === o.id);
                        return (
                          <tr key={o.id} className="border-b border-stone-100 align-top">
                            <td className="p-4 text-sm font-medium">{o.department_name}</td>
                            <td className="p-4">
                              <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                                {o.law_name}
                              </span>
                            </td>
                            <td className="p-4 text-sm text-stone-600">{o.content}</td>
                            <td className="p-4">
                              {relatedRisks.length > 0 ? (
                                <div className="space-y-3">
                                  {relatedRisks.map(r => (
                                    <div key={r.id} className="bg-stone-50 p-3 rounded-lg border border-stone-100">
                                      <p className="text-xs font-bold text-stone-900 mb-1">⚠️ {r.title}</p>
                                      <div className="pl-4 border-l-2 border-stone-200 space-y-1">
                                        {r.controls?.map((c, idx) => (
                                          <div key={idx} className="text-[11px] text-stone-600">
                                            <span className="font-mono text-stone-400 mr-2">Control:</span>
                                            {c.activity}
                                            <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600">
                                              <FileText size={10} />
                                              <span>증빙: {c.plans?.[0]?.document_name || '미지정'}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-50 p-2 rounded-lg">
                                  <AlertCircle size={14} />
                                  <span>식별된 리스크 없음</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Add/Edit Obligation Modal */}
      <AnimatePresence>
        {(isAddingObligation || editingObligation) && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif italic">{editingObligation ? '의무등록부 항목 수정' : '의무등록부 항목 추가'}</h3>
                <button onClick={() => { setIsAddingObligation(false); setEditingObligation(null); }}><X size={20}/></button>
              </div>
              <form className="space-y-4" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = {
                  session_id: sessionId,
                  department_id: formData.get('department_id'),
                  law_name: formData.get('law_name'),
                  content: formData.get('content')
                };

                if (editingObligation) {
                  await fetch(`/api/obligations/${editingObligation.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                  });
                } else {
                  await fetch('/api/obligations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                  });
                }
                
                setIsAddingObligation(false);
                setEditingObligation(null);
                fetchObligations();
              }}>
                <div>
                  <label className="block text-xs font-mono uppercase text-stone-400 mb-1">부서</label>
                  <select name="department_id" defaultValue={editingObligation?.department_id} className="w-full p-2 border border-stone-200 rounded-lg">
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-stone-400 mb-1">법령/규정 명칭</label>
                  <input name="law_name" required defaultValue={editingObligation?.law_name} className="w-full p-2 border border-stone-200 rounded-lg" placeholder="예: 개인정보 보호법" />
                </div>
                {editingObligation && (
                  <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 mb-4">
                    <label className="block text-[10px] font-mono uppercase text-stone-400 mb-1">기존 내용 (수정 전)</label>
                    <p className="text-xs text-stone-500 italic">{editingObligation.content}</p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-mono uppercase text-stone-400 mb-1">의무 내용</label>
                  <textarea name="content" required defaultValue={editingObligation?.content} className="w-full p-2 border border-stone-200 rounded-lg h-32" placeholder="준수해야 할 구체적인 법적 의무 사항을 입력하세요." />
                </div>
                <button type="submit" className="w-full bg-stone-900 text-white py-3 rounded-xl font-medium">
                  {editingObligation ? '수정 완료' : '저장하기'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Risk Modal */}
      <AnimatePresence>
        {isAddingRisk && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-serif italic">신규 리스크 및 통제 등록</h3>
                <button onClick={() => setIsAddingRisk(false)}><X size={20}/></button>
              </div>
              <form className="space-y-4" onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data = {
                  session_id: sessionId,
                  department_id: formData.get('department_id'),
                  iso_clause_id: formData.get('iso_clause_id'),
                  obligation_id: formData.get('obligation_id'),
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
                setIsAddingRisk(false);
                fetchRisks();
              }}>
                <div>
                  <label className="block text-xs font-mono uppercase text-stone-400 mb-1">관련 법령 (의무등록부)</label>
                  <select 
                    name="obligation_id" 
                    required 
                    className="w-full p-2 border border-stone-200 rounded-lg bg-blue-50/50 border-blue-200"
                    onChange={(e) => {
                      const obId = e.target.value;
                      const ob = obligations.find(o => o.id.toString() === obId);
                      if (ob && deptSelectRef.current) {
                        deptSelectRef.current.value = ob.department_id.toString();
                      }
                    }}
                  >
                    <option value="">-- 법령 선택 (필수) --</option>
                    {obligations.map(o => <option key={o.id} value={o.id}>[{o.department_name}] {o.law_name}</option>)}
                  </select>
                  <p className="mt-1 text-[10px] text-stone-400 italic">* 업로드된 의무등록부의 법령을 기준으로 리스크를 식별합니다.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-stone-400 mb-1">부서</label>
                    <select name="department_id" ref={deptSelectRef} className="w-full p-2 border border-stone-200 rounded-lg">
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
                  <input name="title" required className="w-full p-2 border border-stone-200 rounded-lg" placeholder="예: 개인정보 유출 리스크" />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-stone-400 mb-1">상세 설명</label>
                  <textarea name="description" className="w-full p-2 border border-stone-200 rounded-lg h-24" placeholder="리스크에 대한 구체적인 내용을 입력하세요." />
                </div>
                <div className="border-t border-stone-100 pt-4">
                  <h4 className="text-sm font-medium mb-3">통제 및 증빙 계획</h4>
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
                {selectedRisk.obligation_law_name && (
                  <section className="bg-white p-5 rounded-xl border border-blue-100">
                    <h4 className="text-xs font-mono uppercase tracking-widest text-blue-400 mb-2">관련 법령 의무</h4>
                    <p className="font-bold text-stone-900 mb-1">{selectedRisk.obligation_law_name}</p>
                    <p className="text-sm text-stone-600 italic">"{selectedRisk.obligation_content}"</p>
                  </section>
                )}

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
    </div>
  );
};

const AdminView = ({ sessionId, departments, clauses, sessions, onSessionCreated, onOrgUpdated }: { 
  sessionId: number | null, 
  departments: Department[], 
  clauses: ISOCause[],
  sessions: AssessmentSession[],
  onSessionCreated: () => void,
  onOrgUpdated: () => void
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'session' | 'dashboard' | 'identification' | 'audit'>('session');
  const [stats, setStats] = useState<any>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [orgChartFile, setOrgChartFile] = useState<File | null>(null);
  const [obFile, setObFile] = useState<File | null>(null);
  const [riskFile, setRiskFile] = useState<File | null>(null);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [isAddingSession, setIsAddingSession] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    const url = `/api/stats?session_id=${sessionId}${selectedDeptId ? `&department_id=${selectedDeptId}` : ''}`;
    fetch(url).then(res => res.json()).then(setStats);
    fetch(`/api/risks?session_id=${sessionId}${selectedDeptId ? `&department_id=${selectedDeptId}` : ''}`).then(res => res.json()).then(setRisks);
  }, [sessionId, selectedDeptId]);

  const handleOrgChartUpload = async (fileToUpload = orgChartFile) => {
    if (!fileToUpload) return false;
    const formData = new FormData();
    formData.append('file', fileToUpload);
    try {
      const res = await fetch('/api/org-chart/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        if (fileToUpload === orgChartFile) {
          alert('조직도 업로드 및 부서 업데이트 완료');
          setOrgChartFile(null);
        }
        onOrgUpdated();
        return true;
      } else {
        alert('조직도 업로드 실패: ' + await res.text());
        return false;
      }
    } catch (e) {
      alert('조직도 업로드 중 오류 발생: ' + e);
      return false;
    }
  };

  const handleObUpload = async (fileToUpload = obFile) => {
    if (!sessionId) {
      alert('먼저 평가 세션을 생성하거나 선택해주세요.');
      return false;
    }
    if (!fileToUpload) return false;
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('session_id', sessionId.toString());
    try {
      const res = await fetch('/api/obligations/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        if (fileToUpload === obFile) {
          let msg = `${data.count}개의 의무사항이 업로드되었습니다.`;
          if (data.failedRows && data.failedRows.length > 0) {
            msg += `\n\n⚠️ 실패한 항목 (${data.failedRows.length}건):\n` + data.failedRows.join('\n');
          }
          alert(msg);
          setObFile(null);
        }
        return true;
      } else {
        alert('의무등록부 업로드 실패: ' + await res.text());
        return false;
      }
    } catch (e) {
      alert('의무등록부 업로드 중 오류 발생: ' + e);
      return false;
    }
  };

  const handleRiskUpload = async (fileToUpload = riskFile) => {
    if (!sessionId) {
      alert('먼저 평가 세션을 생성하거나 선택해주세요.');
      return false;
    }
    if (!fileToUpload) return false;
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('session_id', sessionId.toString());
    try {
      const res = await fetch('/api/risks/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        if (fileToUpload === riskFile) {
          let msg = `${data.count}개의 리스크가 업로드되었습니다.`;
          if (data.failedRows && data.failedRows.length > 0) {
            msg += `\n\n⚠️ 실패한 항목 (${data.failedRows.length}건):\n` + data.failedRows.join('\n');
          }
          alert(msg);
          setRiskFile(null);
          // Navigate to 3rd tab individually if desired
          setActiveSubTab('identification');
        }
        return true;
      } else {
        alert('리스크 업로드 실패: ' + await res.text());
        return false;
      }
    } catch (e) {
      alert('리스크 업로드 중 오류 발생: ' + e);
      return false;
    }
  };

  const handleExecuteAll = async () => {
    if (!sessionId) {
      alert('먼저 평가 세션을 생성하거나 선택해주세요.');
      return;
    }
    
    // Process in order: OrgChart -> Obligations -> Risks
    let success = true;
    if (orgChartFile) {
      success = await handleOrgChartUpload(orgChartFile);
      if (success) setOrgChartFile(null);
    }
    
    if (success && obFile) {
      success = await handleObUpload(obFile);
      if (success) setObFile(null);
    }
    
    if (success && riskFile) {
      success = await handleRiskUpload(riskFile);
      if (success) setRiskFile(null);
    }
    
    if (success && (orgChartFile || obFile || riskFile)) {
      alert('일괄 업로드 및 실행이 완료되었습니다.');
      // After execution, navigate to the 3rd tab (의무등록부 & 리스크 식별)
      setActiveSubTab('identification');
    }
  };

  const downloadTemplate = (type: 'org' | 'ob' | 'risk') => {
    let data: any[] = [];
    let fileName = '';
    if (type === 'org') {
      data = [{ '부서코드': 'DEPT001', '부서명': '인사팀' }];
      fileName = '조직도_템플릿.xlsx';
    } else if (type === 'ob') {
      data = [{ '부서': '인사팀', '법령명': '근로기준법', '의무내용': '연차 유급 휴가 부여' }];
      fileName = '의무등록부_템플릿.xlsx';
    } else if (type === 'risk') {
      data = [{ '부서': '인사팀', '법령명': '근로기준법', '조항': '4.1', '리스크명': '인력 유출 리스크', '상세설명': '핵심 인력 퇴사로 인한 업무 공백' }];
      fileName = '리스크_템플릿.xlsx';
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, fileName);
  };

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

  const subTabs = [
    { id: 'session', label: '1. 평가 생성', icon: Plus },
    { id: 'dashboard', label: '2. 컴플라이언스 대시보드', icon: LayoutDashboard },
    { id: 'identification', label: '3. 의무등록부 & 리스크 식별', icon: Users },
    { id: 'audit', label: '4. 내부 심사', icon: Search },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-stone-200 pb-4 overflow-x-auto">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeSubTab === tab.id 
                ? 'bg-stone-900 text-white shadow-md' 
                : 'text-stone-500 hover:bg-stone-100'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeSubTab === 'session' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-serif italic">평가 세션 관리</h3>
                <div className="flex gap-2">
                  {sessionId && sessions.find(s => s.id === sessionId)?.status === 'active' && (
                    <button 
                      onClick={async () => {
                        if (confirm('평가를 최종 확정하시겠습니까? 확정 후에는 데이터 수정이 제한될 수 있습니다.')) {
                          await fetch(`/api/sessions/${sessionId}/finalize`, { method: 'POST' });
                          onSessionCreated();
                        }
                      }}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-emerald-700 transition-colors"
                    >
                      <CheckCircle2 size={16} /> 평가 최종 확정
                    </button>
                  )}
                  <button 
                    onClick={async () => {
                      if (!sessionId) return;
                      const res = await fetch(`/api/export-all?session_id=${sessionId}`);
                      const { depts, obligations, risks } = await res.json();
                      
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(depts), "Departments");
                      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(obligations), "Obligations");
                      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(risks), "Risks");
                      XLSX.writeFile(wb, `ISO_Assessment_Export_${sessionId}.xlsx`);
                    }}
                    className="bg-stone-100 text-stone-600 px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-stone-200 transition-colors"
                  >
                    <Download size={16} /> 전체 데이터 추출
                  </button>
                  <button 
                    onClick={() => setIsAddingSession(true)}
                    className="bg-stone-900 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                  >
                    <Plus size={16} /> 신규 평가 생성
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessions.map(s => (
                  <Card key={s.id} className={`p-6 border-2 transition-all ${sessionId === s.id ? 'border-stone-900 bg-stone-50' : 'border-transparent'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-mono text-stone-400">{s.year}</span>
                        {s.status === 'finalized' && (
                          <span className="text-[10px] bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded mt-1 font-bold">확정됨</span>
                        )}
                      </div>
                      {sessionId === s.id && <CheckCircle2 size={16} className="text-stone-900" />}
                    </div>
                    <h4 className="text-lg font-medium text-stone-900 mb-2">{s.name}</h4>
                    <p className="text-xs text-stone-500 mb-4">생성일: {new Date(s.created_at).toLocaleDateString()}</p>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-6">
                <Card className="p-6 bg-stone-50 border-dashed border-2">
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="text-sm font-medium">1-2. 평가 기준 벌크 업로드 (조직도, 의무등록부, 리스크)</h4>
                    <div className="flex gap-4">
                      <button onClick={() => downloadTemplate('org')} className="text-[10px] text-stone-500 hover:underline flex items-center gap-1">
                        <Download size={12} /> 조직도 템플릿
                      </button>
                      <button onClick={() => downloadTemplate('ob')} className="text-[10px] text-stone-500 hover:underline flex items-center gap-1">
                        <Download size={12} /> 의무 템플릿
                      </button>
                      <button onClick={() => downloadTemplate('risk')} className="text-[10px] text-stone-500 hover:underline flex items-center gap-1">
                        <Download size={12} /> 리스크 템플릿
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="block text-xs font-mono uppercase text-stone-400">1. 조직도</label>
                      <label className="flex items-center gap-2 bg-white border border-stone-200 px-3 py-3 rounded-lg cursor-pointer hover:bg-stone-100 text-sm">
                        <Upload size={16} className="text-stone-400 shrink-0" />
                        <span className="truncate">{orgChartFile ? orgChartFile.name : '조직도(Excel) 선택'}</span>
                        <input type="file" className="hidden" onChange={(e) => setOrgChartFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-xs font-mono uppercase text-stone-400">2. 의무등록부</label>
                      <label className="flex items-center gap-2 bg-white border border-stone-200 px-3 py-3 rounded-lg cursor-pointer hover:bg-stone-100 text-sm">
                        <FileText size={16} className="text-stone-400 shrink-0" />
                        <span className="truncate">{obFile ? obFile.name : '의무등록부(Excel) 선택'}</span>
                        <input type="file" className="hidden" onChange={(e) => setObFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="block text-xs font-mono uppercase text-stone-400">3. 리스크 목록</label>
                      <label className="flex items-center gap-2 bg-white border border-stone-200 px-3 py-3 rounded-lg cursor-pointer hover:bg-stone-100 text-sm">
                        <AlertCircle size={16} className="text-stone-400 shrink-0" />
                        <span className="truncate">{riskFile ? riskFile.name : '리스크(Excel) 선택'}</span>
                        <input type="file" className="hidden" onChange={(e) => setRiskFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                  </div>
                  <div className="mt-8 border-t border-stone-200 border-dashed pt-6">
                    <button 
                      onClick={handleExecuteAll}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!(orgChartFile || obFile || riskFile)}
                    >
                      <CheckCircle2 size={20} /> 설정된 파일 일괄 Execution 및 3.식별 탭으로 이동
                    </button>
                    <p className="mt-3 text-center text-xs text-stone-500">
                      * 파일을 필요한 만큼 선택한 뒤 이 버튼을 누르면 순서대로 업로드한 뒤 식별 탭으로 자동 이동합니다. ISO 37001 등 표준 요구사항에 맞춘 데이터를 벌크로 등록할 수 있습니다.
                    </p>
                  </div>
                </Card>
              </div>

              {isAddingSession && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-md rounded-2xl p-8 shadow-2xl">
                    <h3 className="text-xl font-serif italic mb-6">신규 평가 생성 (1-1)</h3>
                    <form className="space-y-4" onSubmit={async (e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      await fetch('/api/sessions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          year: formData.get('year'),
                          name: formData.get('name')
                        })
                      });
                      setIsAddingSession(false);
                      onSessionCreated();
                    }}>
                      <div>
                        <label className="block text-xs font-mono uppercase text-stone-400 mb-1">연도</label>
                        <input name="year" type="number" defaultValue={new Date().getFullYear()} className="w-full p-2 border border-stone-200 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-xs font-mono uppercase text-stone-400 mb-1">평가 명칭 (예: 2026년 내부심사)</label>
                        <input name="name" required className="w-full p-2 border border-stone-200 rounded-lg" placeholder="예: 2026년 정기 내부심사" />
                      </div>
                      <p className="text-[10px] text-stone-400 italic bg-stone-50 p-2 rounded">
                        * 신규 평가 생성 시 직전 평가의 의무등록부 및 리스크 데이터가 자동으로 복사됩니다.
                      </p>
                      <div className="flex gap-2 pt-4">
                        <button type="button" onClick={() => setIsAddingSession(false)} className="flex-1 py-3 border border-stone-200 rounded-xl">취소</button>
                        <button type="submit" className="flex-1 bg-stone-900 text-white py-3 rounded-xl font-medium">생성하기</button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'identification' && (
            <UserView 
              departments={departments} 
              clauses={clauses} 
              sessionId={sessionId} 
              isFinalized={sessions.find(s => s.id === sessionId)?.status === 'finalized'}
            />
          )}

          {activeSubTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-serif italic text-stone-900">컴플라이언스 대시보드</h2>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs font-mono text-stone-400 uppercase tracking-widest">부서 필터:</span>
                    <select 
                      value={selectedDeptId} 
                      onChange={(e) => setSelectedDeptId(e.target.value)}
                      className="text-xs border-stone-200 rounded-lg bg-white p-1"
                    >
                      <option value="">전체 부서</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
                <button 
                  onClick={exportToExcel}
                  className="flex items-center gap-2 border border-stone-200 bg-white px-4 py-2 rounded-lg hover:bg-stone-50 transition-colors shadow-sm text-sm"
                >
                  <Download size={18} /> 엑셀 리포트 추출
                </button>
              </div>

              {stats && (
                <>
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
                              data={[
                                { name: '적합', value: stats.conformity, color: '#3b82f6' },
                                { name: '부적합', value: stats.nonConformity, color: '#f43f5e' },
                                { name: '미심사', value: Math.max(0, stats.total - (stats.conformity + stats.nonConformity)), color: '#e7e5e4' },
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {[
                                { name: '적합', value: stats.conformity, color: '#3b82f6' },
                                { name: '부적합', value: stats.nonConformity, color: '#f43f5e' },
                                { name: '미심사', value: Math.max(0, stats.total - (stats.conformity + stats.nonConformity)), color: '#e7e5e4' },
                              ].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex justify-center gap-6 mt-4">
                        {[
                          { name: '적합', color: '#3b82f6' },
                          { name: '부적합', color: '#f43f5e' },
                          { name: '미심사', color: '#e7e5e4' },
                        ].map(d => (
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
                </>
              )}
            </div>
          )}

          {activeSubTab === 'audit' && (
            <AuditorView sessionId={sessionId} departmentId={selectedDeptId} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const AuditorView = ({ sessionId, departmentId }: { sessionId?: number | null, departmentId?: string }) => {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [selectedRisk, setSelectedRisk] = useState<any>(null);
  const [auditForm, setAuditForm] = useState({ status: 'conformity', comment: '' });

  const fetchRisks = async () => {
    let url = '/api/risks';
    const params = new URLSearchParams();
    if (sessionId) params.append('session_id', sessionId.toString());
    if (departmentId) params.append('department_id', departmentId);
    if (params.toString()) url += `?${params.toString()}`;
    
    const res = await fetch(url);
    setRisks(await res.json());
  };

  useEffect(() => { fetchRisks(); }, [sessionId, departmentId]);

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
                <th className="p-4 text-[11px] font-mono uppercase tracking-widest text-stone-400">관련 법령</th>
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
                  <td className="p-4 text-sm text-blue-700 font-bold">{risk.obligation_law_name || '-'}</td>
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
                    <div className="bg-stone-50 p-4 rounded-xl space-y-3">
                      <div>
                        <p className="font-medium mb-1">{selectedRisk.title}</p>
                        <p className="text-sm text-stone-500">{selectedRisk.description}</p>
                      </div>
                      {selectedRisk.obligation_law_name && (
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                          <h5 className="text-[10px] font-mono uppercase text-blue-400 mb-1">근거 법령 (의무등록부)</h5>
                          <p className="text-sm font-bold text-blue-900">{selectedRisk.obligation_law_name}</p>
                          <p className="text-xs text-blue-700 italic mt-1">"{selectedRisk.obligation_content}"</p>
                        </div>
                      )}
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
  const [sessions, setSessions] = useState<AssessmentSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [isAddingSession, setIsAddingSession] = useState(false);

  const fetchDepartments = async () => {
    const res = await fetch('/api/departments');
    setDepartments(await res.json());
  };

  const fetchSessions = async () => {
    const res = await fetch('/api/sessions');
    const data = await res.json();
    setSessions(data);
    if (data.length > 0 && !selectedSessionId) {
      setSelectedSessionId(data[0].id);
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetch('/api/iso-clauses').then(res => res.json()).then(setClauses);
    fetchSessions();
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-stone-900 font-sans">
      {/* Top Session Bar */}
      <div className="bg-stone-900 text-white px-6 py-2 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400">Assessment Session</span>
          <select 
            value={selectedSessionId || ''} 
            onChange={(e) => setSelectedSessionId(Number(e.target.value))}
            className="bg-stone-800 border-none text-xs rounded px-2 py-1"
          >
            {sessions.map(s => <option key={s.id} value={s.id}>{s.year} - {s.name}</option>)}
          </select>
          <button onClick={() => setIsAddingSession(true)} className="text-[10px] bg-stone-700 hover:bg-stone-600 px-2 py-1 rounded">
            + New Session
          </button>
        </div>
        <div className="text-[10px] text-stone-400 italic">
          {sessions.find(s => s.id === selectedSessionId)?.name}
        </div>
      </div>

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
            { id: 'admin', label: '평가 관리자', icon: Shield },
            { id: 'user', label: '의무등록부 & 리스크 식별', icon: Users },
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
            <p className="text-sm font-medium">{persona === 'user' ? '현업 담당자 (CA)' : '평가 관리자 (Admin)'}</p>
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
            <option value="admin">평가 관리자</option>
            <option value="user">의무등록부 & 리스크 식별</option>
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
              {persona === 'admin' && (
                <AdminView 
                  sessionId={selectedSessionId} 
                  departments={departments} 
                  clauses={clauses} 
                  sessions={sessions} 
                  onSessionCreated={fetchSessions} 
                  onOrgUpdated={fetchDepartments}
                />
              )}
              {persona === 'user' && <UserView departments={departments} clauses={clauses} sessionId={selectedSessionId} />}
            </motion.div>
          </AnimatePresence>

          {/* New Session Modal */}
          <AnimatePresence>
            {isAddingSession && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-md rounded-2xl p-8 shadow-2xl">
                  <h3 className="text-xl font-serif italic mb-6">Create New Assessment Session</h3>
                  <form className="space-y-4" onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    await fetch('/api/sessions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        year: formData.get('year'),
                        name: formData.get('name')
                      })
                    });
                    setIsAddingSession(false);
                    fetchSessions();
                  }}>
                    <div>
                      <label className="block text-xs font-mono uppercase text-stone-400 mb-1">Year</label>
                      <input name="year" type="number" defaultValue={new Date().getFullYear()} className="w-full p-2 border border-stone-200 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-xs font-mono uppercase text-stone-400 mb-1">Session Name</label>
                      <input name="name" required className="w-full p-2 border border-stone-200 rounded-lg" placeholder="e.g. 2026 Internal Audit" />
                    </div>
                    <p className="text-[10px] text-stone-400 italic bg-stone-50 p-2 rounded">
                      * This will automatically copy all obligations and risks from the most recent session.
                    </p>
                    <div className="flex gap-2 pt-4">
                      <button type="button" onClick={() => setIsAddingSession(false)} className="flex-1 py-3 border border-stone-200 rounded-xl">Cancel</button>
                      <button type="submit" className="flex-1 bg-stone-900 text-white py-3 rounded-xl font-medium">Create</button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
