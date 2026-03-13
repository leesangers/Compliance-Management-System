import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, RefreshCw, Upload, Download, Filter, 
  Trash2, Edit, AlertCircle, CheckCircle2, XCircle, 
  Settings, Layers, Shield, Scale, Target, 
  FileText, BarChart3, ChevronRight, X, Plus, Calendar, BookOpen,
  Minus, Check, Edit3, Trash, LayoutDashboard, Users, Eye, Menu, ClipboardCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

// --- Types ---
interface AssessmentSession {
  id: number;
  year: number;
  name: string;
  status: string;
}

interface Department {
  id: number;
  org_code: string;
  name: string;
}

interface ComplianceObligation {
  id: number;
  department_id: number;
  department_name: string;
  law_name: string;
  content: string;
  is_changed: boolean;
  is_new: boolean;
}

interface Risk {
  id: number;
  type: 'compliance' | 'ethics';
  department_id: number;
  department_name: string;
  title: string;
  description: string;
  area?: string;
  risk_type?: string;
  stakeholder?: string;
  cause?: string;
  scale?: string;
  scale_reason?: string;
  control1?: string;
  control2?: string;
  monitoring_target?: string;
  evidence_type?: string;
  monitoring_period?: string;
  status: string;
  audit_status?: string;
  audit_comment?: string;
  obligation_id?: number;
  obligation_law_name?: string;
}

interface Goal {
  id: number;
  category: string;
  name: string;
  goal_description: string;
  manager: string;
  deadline: string;
  monitoring_timing: string;
  criteria: string;
  method: string;
  status: string;
  department_name: string;
}

interface EvidenceFile {
  id: number;
  file_name: string;
  file_path: string;
  description: string;
  uploaded_at: string;
}

// --- Shared Components ---

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    draft: 'bg-stone-100 text-stone-500',
    submitted: 'bg-blue-100 text-blue-700',
    revision: 'bg-amber-100 text-amber-700',
    conformity: 'bg-emerald-100 text-emerald-700',
    'non-conformity': 'bg-rose-100 text-rose-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status] || 'bg-gray-100'}`}>
      {status}
    </span>
  );
};

const Card = ({ children, className = "", onClick }: { children: React.ReactNode, className?: string, onClick?: () => void, key?: any }) => (
  <div onClick={onClick} className={`bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

const TabButton = ({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-all text-sm font-medium ${
      active 
        ? 'border-stone-900 text-stone-900' 
        : 'border-transparent text-stone-400 hover:text-stone-600'
    }`}
  >
    <Icon size={16} />
    {label}
  </button>
);

// --- Sub-Views ---

const SessionManager = ({ sessions, currentSession, onSessionSelect, onCreateSession, onDeleteSession }: any) => {
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [formData, setFormData] = useState({ year: new Date().getFullYear(), name: '' });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-serif italic text-stone-900">1. 평가의 생성 및 설정</h2>
          <p className="text-sm text-stone-500">연도별 심사 세션을 관리하고 대상 부서를 선택합니다.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-lg hover:bg-stone-800 transition-colors shadow-lg"
        >
          <Plus size={18} /> 새 심사 생성
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.map((s: any) => (
          <Card key={s.id} className={`p-6 cursor-pointer relative transition-all ${currentSession?.id === s.id ? 'ring-2 ring-stone-900 border-transparent bg-stone-50' : 'hover:border-stone-400'}`} >
            <div onClick={() => onSessionSelect(s)}>
              <div className="flex justify-between items-start mb-4">
                <span className="bg-stone-200 text-stone-700 px-2 py-1 rounded text-xs font-mono">{s.year}년</span>
                <StatusBadge status={s.status} />
              </div>
              <h3 className="text-lg font-bold text-stone-900 mb-2">{s.name}</h3>
              <div className="flex items-center gap-2 text-stone-400 text-xs">
                <Calendar size={14} />
                <span>생성일: {new Date(s.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsDeleting(s.id); }}
              className="absolute top-4 right-4 text-stone-300 hover:text-rose-500 transition-colors p-1"
            >
              <X size={16} />
            </button>
          </Card>
        ))}
      </div>

      <AnimatePresence>
        {isDeleting && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-8">
              <div className="text-rose-500 mb-4 flex justify-center">
                <AlertCircle size={48} />
              </div>
              <h3 className="text-xl font-bold text-center mb-2">심사 세션 삭제</h3>
              <p className="text-sm text-stone-500 text-center mb-6">
                이 세션과 관련된 모든 리스크, 목표, 증빙 자료가 삭제됩니다. 정말 삭제하시겠습니까?
                <br/>
                <span className="font-bold text-stone-800">확인을 위해 'OKAY'를 입력해 주세요.</span>
              </p>
              <input 
                type="text" 
                value={deleteConfirm} 
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="OKAY"
                className="w-full p-2 border border-stone-200 rounded-lg mb-6 text-center font-bold"
              />
              <div className="flex gap-2">
                <button onClick={() => { setIsDeleting(null); setDeleteConfirm(''); }} className="flex-1 py-3 border border-stone-200 rounded-xl hover:bg-stone-50">취소</button>
                <button 
                  onClick={() => {
                    if (deleteConfirm === 'OKAY') {
                      onDeleteSession(isDeleting);
                      setIsDeleting(null);
                      setDeleteConfirm('');
                    }
                  }}
                  disabled={deleteConfirm !== 'OKAY'}
                  className="flex-1 bg-rose-500 text-white py-3 rounded-xl font-medium hover:bg-rose-600 shadow-lg disabled:opacity-30"
                >
                  삭제하기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8">
              <h3 className="text-xl font-serif italic mb-6">새로운 심사 세션 생성</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-stone-400 mb-1">연도</label>
                  <input 
                    type="number" 
                    value={formData.year} 
                    onChange={e => setFormData({...formData, year: parseInt(e.target.value)})}
                    className="w-full p-2 border border-stone-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-stone-400 mb-1">심사 명칭</label>
                  <input 
                    type="text" 
                    placeholder="예: 2026년 내부심사" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full p-2 border border-stone-200 rounded-lg"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button onClick={() => setIsCreating(false)} className="flex-1 py-3 border border-stone-200 rounded-xl hover:bg-stone-50">취소</button>
                  <button 
                    onClick={() => { onCreateSession(formData); setIsCreating(false); }}
                    className="flex-1 bg-stone-900 text-white py-3 rounded-xl font-medium hover:bg-stone-800 shadow-lg"
                  >
                    생성하기
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const RiskManager = ({ sessionId, departmentId, obligations, fetchObligations, isoClauses }: any) => {
  const [activeTab, setActiveTab] = useState(2);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [isAddingRisk, setIsAddingRisk] = useState<'compliance' | 'ethics' | null>(null);
  const [isAddingObligation, setIsAddingObligation] = useState<any>(null);

  const fetchRisks = async () => {
    const res = await fetch(`/api/risks?session_id=${sessionId}&department_id=${departmentId}`);
    setRisks(await res.json());
  };

  useEffect(() => { 
    if (sessionId && departmentId) {
      fetchRisks(); 
    }
  }, [sessionId, departmentId]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-serif italic text-stone-900">2. 리스크 식별 및 통제 수립</h2>
          <p className="text-sm text-stone-500">부서별 의무 사항을 검토하고 관련 리스크를 식별하여 통제 방안을 수립합니다.</p>
        </div>
      </div>

      <div className="flex border-b border-stone-200">
        <TabButton active={activeTab === 2} onClick={() => setActiveTab(2)} icon={BookOpen} label="의무등록부" />
        <TabButton active={activeTab === 3} onClick={() => setActiveTab(3)} icon={Shield} label="Compliance 리스크" />
        <TabButton active={activeTab === 4} onClick={() => setActiveTab(4)} icon={Scale} label="Ethics 리스크" />
      </div>

      <div className="mt-6">
        {activeTab === 2 && (
          <div className="space-y-4">
             <div className="flex justify-between items-center">
                <h3 className="font-medium text-stone-700">의무등록부 (Compliance Obligations)</h3>
                <div className="flex gap-2">
                   <button
                     onClick={() => setIsAddingObligation('new')}
                     className="text-xs flex items-center gap-1 bg-stone-900 px-3 py-1.5 rounded-lg text-white hover:bg-stone-800 transition-colors"
                   >
                     <Plus size={14} /> 의무사항 추가
                   </button>
                   <button className="text-xs flex items-center gap-1 bg-stone-100 px-3 py-1.5 rounded-lg hover:bg-stone-200 text-stone-600 transition-colors">
                     <Upload size={14} /> 엑셀 업로드
                   </button>
                </div>
             </div>
             <Card>
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm">
                      <thead className="bg-stone-50 border-b border-stone-200">
                         <tr>
                            <th className="p-4 font-mono uppercase text-[10px] text-stone-400 w-48">법령/규정 명칭</th>
                            <th className="p-4 font-mono uppercase text-[10px] text-stone-400">주요 의무 내용</th>
                            <th className="p-4 font-mono uppercase text-[10px] text-stone-400 w-24 text-right">관리</th>
                         </tr>
                      </thead>
                      <tbody>
                         {obligations.length === 0 ? (
                            <tr><td colSpan={3} className="p-8 text-center text-stone-400 italic">등록된 의무사항이 없습니다.</td></tr>
                         ) : (
                            obligations.map((o: any) => (
                               <tr key={o.id} className="border-b border-stone-100 hover:bg-stone-50/50 group">
                                  <td className="p-4 font-bold text-stone-900">{o.law_name}</td>
                                  <td className="p-4 text-stone-600 leading-relaxed">{o.content}</td>
                                  <td className="p-4 text-right">
                                     <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                          onClick={() => setIsAddingObligation(o)}
                                          className="p-1.5 text-stone-400 hover:text-stone-900 rounded"
                                        >
                                           <Edit size={14} />
                                        </button>
                                        <button
                                          onClick={async () => {
                                             if (confirm('정말 삭제하시겠습니까?')) {
                                                await fetch(`/api/obligations/${o.id}`, { method: 'DELETE' });
                                                fetchObligations();
                                             }
                                          }}
                                          className="p-1.5 text-stone-400 hover:text-rose-500 rounded"
                                        >
                                           <Trash2 size={14} />
                                        </button>
                                     </div>
                                  </td>
                               </tr>
                            ))
                         )}
                      </tbody>
                   </table>
                </div>
             </Card>
          </div>
        )}

        {activeTab === 3 && (
           <div className="space-y-4">
              <div className="flex justify-between items-center">
                 <h3 className="font-medium text-stone-700">Compliance 리스크 정의 및 평가</h3>
                 <button
                  onClick={() => setIsAddingRisk('compliance')}
                  className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-lg text-sm"
                 >
                    <Plus size={16} /> 리스크 추가
                 </button>
              </div>
              <RiskTable
                risks={risks.filter(r => r.type === 'compliance')}
                type="compliance"
                obligations={obligations}
                onRefresh={fetchRisks}
              />
           </div>
        )}

        {activeTab === 4 && (
           <div className="space-y-4">
              <div className="flex justify-between items-center">
                 <h3 className="font-medium text-stone-700">Ethics 리스크 정의 및 평가</h3>
                 <button
                  onClick={() => setIsAddingRisk('ethics')}
                  className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-lg text-sm"
                 >
                    <Plus size={16} /> 리스크 추가
                 </button>
              </div>
              <RiskTable
                risks={risks.filter(r => r.type === 'ethics')}
                type="ethics"
                obligations={obligations}
                onRefresh={fetchRisks}
              />
           </div>
        )}
      </div>

      <RiskModal
        isOpen={!!isAddingRisk}
        onClose={() => setIsAddingRisk(null)}
        type={isAddingRisk}
        sessionId={sessionId}
        departmentId={departmentId}
        obligations={obligations}
        isoClauses={isoClauses}
        onRefresh={fetchRisks}
      />

      <ObligationModal
        isOpen={!!isAddingObligation}
        onClose={() => setIsAddingObligation(null)}
        initialData={isAddingObligation === 'new' ? null : isAddingObligation}
        sessionId={sessionId}
        departmentId={departmentId}
        onRefresh={fetchObligations}
      />
    </div>
  );
};

const ObligationModal = ({ isOpen, onClose, initialData, sessionId, departmentId, onRefresh }: any) => {
  const [formData, setFormData] = useState({ law_name: '', content: '' });

  useEffect(() => {
    if (initialData && typeof initialData === 'object') {
      setFormData({ law_name: initialData.law_name, content: initialData.content });
    } else {
      setFormData({ law_name: '', content: '' });
    }
  }, [initialData]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const url = (initialData && initialData.id) ? `/api/obligations/${initialData.id}` : '/api/obligations';
    const method = (initialData && initialData.id) ? 'PUT' : 'POST';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        session_id: sessionId,
        department_id: departmentId
      })
    });
    onRefresh();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-serif italic">의무사항 {initialData?.id ? '수정' : '등록'}</h3>
          <button onClick={onClose}><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-stone-400 mb-1">법령/규정 명칭</label>
            <input
              type="text"
              value={formData.law_name}
              onChange={e => setFormData({...formData, law_name: e.target.value})}
              className="w-full p-2 border border-stone-200 rounded-lg text-sm"
              placeholder="예: 청탁금지법"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase text-stone-400 mb-1">주요 의무 내용</label>
            <textarea
              value={formData.content}
              onChange={e => setFormData({...formData, content: e.target.value})}
              className="w-full p-2 border border-stone-200 rounded-lg text-sm h-32"
              placeholder="주요 내용을 상세히 입력하세요."
              required
            />
          </div>
          <button type="submit" className="w-full bg-stone-900 text-white py-3 rounded-xl font-medium hover:bg-stone-800 shadow-lg">
            {initialData?.id ? '수정하기' : '등록하기'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const RiskTable = ({ risks, type, obligations, onRefresh }: any) => (
  <Card>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead className="bg-stone-50 border-b border-stone-200">
           <tr>
              {type === 'compliance' && <th className="p-4 font-mono uppercase text-[10px] text-stone-400 w-32">관련 법규</th>}
              <th className="p-4 font-mono uppercase text-[10px] text-stone-400 w-48">리스크 원인 및 상황</th>
              <th className="p-4 font-mono uppercase text-[10px] text-stone-400 w-20 text-center">척도</th>
              <th className="p-4 font-mono uppercase text-[10px] text-stone-400">통제 방안</th>
              <th className="p-4 font-mono uppercase text-[10px] text-stone-400 w-32">증빙 종류</th>
              <th className="p-4 font-mono uppercase text-[10px] text-stone-400 w-16">상태</th>
           </tr>
        </thead>
        <tbody>
           {risks.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-stone-400 italic">등록된 리스크가 없습니다.</td></tr>
           ) : (
              risks.map((r: any) => (
                 <tr key={r.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                    {type === 'compliance' && <td className="p-4 font-medium text-blue-700">{r.obligation_law_name || '-'}</td>}
                    <td className="p-4 text-stone-900 font-medium">{r.title}</td>
                    <td className="p-4 text-center">
                       <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.scale === 'VH' ? 'bg-rose-100 text-rose-700' :
                          r.scale === 'H' ? 'bg-amber-100 text-amber-700' :
                          r.scale === 'MH' ? 'bg-orange-100 text-orange-700' :
                          r.scale === 'M' ? 'bg-stone-100 text-stone-700' : 'bg-emerald-100 text-emerald-700'
                       }`}>{r.scale}</span>
                    </td>
                     <td className="p-4 text-stone-600">
                        <div className="line-clamp-2">1: {r.control1}{r.control2 ? ` / 2: ${r.control2}` : ''}</div>
                     </td>
                     <td className="p-4 text-stone-500 font-medium italic">
                        1: {r.evidence_type1}{r.evidence_type2 ? ` / 2: ${r.evidence_type2}` : ''}
                     </td>
                     <td className="p-4"><StatusBadge status={r.status} /></td>
                 </tr>
              ))
           )}
        </tbody>
      </table>
    </div>
  </Card>
);

const RiskModal = ({ isOpen, onClose, type, sessionId, departmentId, obligations, isoClauses, onRefresh }: any) => {
  const [formData, setFormData] = useState({
    obligation_id: '',
    title: '',
    description: '',
    area: '민간',
    risk_type: '',
    stakeholder: '',
    cause: '',
    scale: 'M',
    scale_reason: '',
    control1: '',
    control2: '',
    evidence_type1: '',
    evidence_type2: '',
    monitoring_target: '',
    monitoring_period: '반기'
  });

  const isControl2Disabled = formData.scale === 'M' || formData.scale === 'L';

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    await fetch('/api/risks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        type,
        session_id: sessionId,
        department_id: departmentId
      })
    });
    onRefresh();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl p-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-serif italic">{type === 'compliance' ? 'Compliance' : 'Ethics'} 리스크 등록</h3>
          <button onClick={onClose}><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          {type === 'compliance' && (
             <div>
                <label className="block text-xs font-mono uppercase text-stone-400 mb-1">연관 법규 (의무등록부)</label>
                <select
                  value={formData.obligation_id}
                  onChange={e => setFormData({...formData, obligation_id: e.target.value})}
                  className="w-full p-2 border border-stone-200 rounded-lg text-sm"
                  required
                >
                   <option value="">법규 선택...</option>
                   {obligations.map((o: any) => <option key={o.id} value={o.id}>{o.law_name}</option>)}
                </select>
             </div>
          )}

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-mono uppercase text-stone-400 mb-1">리스크 원인 및 상황</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full p-2 border border-stone-200 rounded-lg text-sm"
                  placeholder="예: 정부기관 접대 시 부정청탁 발생 상황"
                  required
                />
             </div>
             <div>
                <label className="block text-xs font-mono uppercase text-stone-400 mb-1">리스크 유형</label>
                <input
                  type="text"
                  value={formData.risk_type}
                  onChange={e => setFormData({...formData, risk_type: e.target.value})}
                  className="w-full p-2 border border-stone-200 rounded-lg text-sm"
                  placeholder="예: 증뢰, 수뢰, 담합 등"
                />
             </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
             <div>
                <label className="block text-xs font-mono uppercase text-stone-400 mb-1">척도 평가 (Scale)</label>
                <select
                  value={formData.scale}
                  onChange={e => setFormData({...formData, scale: e.target.value})}
                  className="w-full p-2 border border-stone-200 rounded-lg text-sm"
                >
                   <option value="VH">VH (Very High)</option>
                   <option value="H">H (High)</option>
                   <option value="MH">MH (Medium High)</option>
                   <option value="M">M (Medium)</option>
                   <option value="L">L (Low)</option>
                </select>
             </div>
             <div className="col-span-2">
                <label className="block text-xs font-mono uppercase text-stone-400 mb-1">설정 이유</label>
                <input
                  type="text"
                  value={formData.scale_reason}
                  onChange={e => setFormData({...formData, scale_reason: e.target.value})}
                  className="w-full p-2 border border-stone-200 rounded-lg text-sm"
                  placeholder="예: 매년 등급심사 수검으로 접촉 빈도 높음"
                />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-mono uppercase text-stone-400 mb-1">통제 방안 (1)</label>
                <textarea 
                  value={formData.control1} 
                  onChange={e => setFormData({...formData, control1: e.target.value})}
                  className="w-full p-2 border border-stone-200 rounded-lg text-sm h-20"
                />
             </div>
             <div>
                <label className="block text-xs font-mono uppercase text-stone-400 mb-1">증빙자료 종류 (1)</label>
                <input 
                  type="text" 
                  value={formData.evidence_type1} 
                  onChange={e => setFormData({...formData, evidence_type1: e.target.value})}
                  className="w-full p-2 border border-stone-200 rounded-lg text-sm h-20"
                  placeholder="예: 법인카드 내역, 승인 기안문"
                />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className={isControl2Disabled ? 'opacity-40 grayscale' : ''}>
                <label className="block text-xs font-mono uppercase text-stone-400 mb-1">통제 방안 (2)</label>
                <textarea 
                  value={formData.control2} 
                  onChange={e => setFormData({...formData, control2: e.target.value})}
                  className="w-full p-2 border border-stone-200 rounded-lg text-sm h-20"
                  disabled={isControl2Disabled}
                  placeholder={isControl2Disabled ? 'Scale M/L 단계는 비활성화' : ''}
                />
             </div>
             <div className={isControl2Disabled ? 'opacity-40 grayscale' : ''}>
                <label className="block text-xs font-mono uppercase text-stone-400 mb-1">증빙자료 종류 (2)</label>
                <input 
                  type="text" 
                  value={formData.evidence_type2} 
                  onChange={e => setFormData({...formData, evidence_type2: e.target.value})}
                  className="w-full p-2 border border-stone-200 rounded-lg text-sm h-20"
                  disabled={isControl2Disabled}
                  placeholder={isControl2Disabled ? 'Scale M/L 단계는 비활성화' : ''}
                />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-mono uppercase text-stone-400 mb-1">측정 시기</label>
                <select 
                  value={formData.monitoring_period} 
                  onChange={e => setFormData({...formData, monitoring_period: e.target.value})}
                  className="w-full p-2 border border-stone-200 rounded-lg text-sm"
                >
                   <option value="실시간">실시간</option>
                   <option value="매월">매월</option>
                   <option value="분기">분기</option>
                   <option value="반기">반기</option>
                   <option value="매년">매년</option>
                </select>
             </div>
          </div>

          <button type="submit" className="w-full bg-stone-900 text-white py-3 rounded-xl font-medium shadow-lg">리스크 저장</button>
        </form>
      </motion.div>
    </div>
  );
};

const GoalSettingManager = ({ sessionId, departmentId }: any) => {
  const [goals, setGoals] = useState<any[]>([]);

  const fetchGoals = async () => {
    const res = await fetch(`/api/goals?session_id=${sessionId}&department_id=${departmentId}`);
    setGoals(await res.json());
  };

  useEffect(() => { if(sessionId && departmentId) fetchGoals(); }, [sessionId, departmentId]);

  const handleAddLine = () => {
    setGoals([...goals, { id: 'new-' + Date.now(), category: 'Compliance', name: '', goal_description: '', manager: '', deadline: '', monitoring_timing: '', criteria: '', method: '', status: 'draft', isNew: true }]);
  };

  const handleRemoveLine = async (id: any) => {
    if (typeof id === 'number') {
      await fetch(`/api/goals/${id}`, { method: 'DELETE' });
    }
    setGoals(goals.filter(g => g.id !== id));
  };

  const handleSave = async (goal: any) => {
    const method = goal.isNew ? 'POST' : 'PUT';
    const url = goal.isNew ? '/api/goals' : `/api/goals/${goal.id}`;

    await fetch(url, {
       method,
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ ...goal, session_id: sessionId, department_id: departmentId })
    });
    fetchGoals();
  };

  return (
    <div className="space-y-6">
       <div>
          <h2 className="text-2xl font-serif italic text-stone-900">3. 자율준수 목표의 수립</h2>
          <p className="text-sm text-stone-500">Ethics & Compliance 활동 목표를 설정하고 관리 방안을 정의합니다.</p>
       </div>

       <Card className="p-4">
          <table className="w-full text-left text-xs border-collapse">
             <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                   <th className="p-2 font-mono uppercase text-[10px] text-stone-400 w-24">구분</th>
                   <th className="p-2 font-mono uppercase text-[10px] text-stone-400">목표: 추진활동</th>
                   <th className="p-2 font-mono uppercase text-[10px] text-stone-400 w-20">책임자</th>
                   <th className="p-2 font-mono uppercase text-[10px] text-stone-400 w-20">달성시기</th>
                   <th className="p-2 font-mono uppercase text-[10px] text-stone-400 w-48">측정 기준 / 방법</th>
                   <th className="p-2 font-mono uppercase text-[10px] text-stone-400 w-16 text-center">동작</th>
                </tr>
             </thead>
             <tbody>
                {goals.map((g, index) => (
                   <tr key={g.id} className="border-b border-stone-100 last:border-0">
                      <td className="p-2">
                         <select
                            value={g.category}
                            onChange={e => {
                               const updated = [...goals];
                               updated[index].category = e.target.value;
                               setGoals(updated);
                            }}
                            className="w-full p-1 border rounded"
                         >
                            <option value="Compliance">Compliance</option>
                            <option value="Ethics">Ethics</option>
                         </select>
                      </td>
                      <td className="p-2">
                         <input
                            value={g.name}
                            onChange={e => {
                               const updated = [...goals];
                               updated[index].name = e.target.value;
                               setGoals(updated);
                            }}
                            className="w-full p-1 border rounded"
                            placeholder="추진활동 목표"
                         />
                      </td>
                      <td className="p-2">
                         <input
                            value={g.manager}
                            onChange={e => {
                               const updated = [...goals];
                               updated[index].manager = e.target.value;
                               setGoals(updated);
                            }}
                            className="w-full p-1 border rounded"
                         />
                      </td>
                      <td className="p-2">
                         <input
                            value={g.deadline}
                            onChange={e => {
                               const updated = [...goals];
                               updated[index].deadline = e.target.value;
                               setGoals(updated);
                            }}
                            className="w-full p-1 border rounded"
                         />
                      </td>
                      <td className="p-2">
                         <input
                            value={g.criteria}
                            onChange={e => {
                               const updated = [...goals];
                               updated[index].criteria = e.target.value;
                               setGoals(updated);
                            }}
                            className="w-full p-1 border rounded text-[10px]"
                            placeholder="측정 기준 (예: 인증 통과 여부)"
                         />
                      </td>
                      <td className="p-2 flex gap-1 justify-center">
                         <button onClick={() => handleSave(g)} className="text-emerald-600 p-1 hover:bg-emerald-50 rounded"><Check size={14} /></button>
                         <button onClick={() => handleRemoveLine(g.id)} className="text-rose-400 p-1 hover:bg-rose-50 rounded"><Minus size={14} /></button>
                      </td>
                   </tr>
                ))}
                <tr>
                   <td colSpan={6} className="p-2">
                      <button
                        onClick={handleAddLine}
                        className="w-full py-2 border-2 border-dashed border-stone-200 text-stone-400 hover:border-stone-400 hover:text-stone-600 rounded-lg flex items-center justify-center gap-2 transition-all"
                      >
                         <Plus size={14} /> 목표 라인 추가
                      </button>
                   </td>
                </tr>
             </tbody>
          </table>
       </Card>
    </div>
  );
};

const EvidenceManager = ({ sessionId, departmentId }: any) => {
  const [activeTab, setActiveTab] = useState(1);
  const [items, setItems] = useState<any[]>([]);
  const [uploadTarget, setUploadTarget] = useState<any>(null);
  const [description, setDescription] = useState('');

  const fetchData = async () => {
    const [riskRes, goalRes] = await Promise.all([
      fetch(`/api/risks?session_id=${sessionId}&department_id=${departmentId}`),
      fetch(`/api/goals?session_id=${sessionId}&department_id=${departmentId}`)
    ]);
    const rs = await riskRes.json();
    const gs = await goalRes.json();
    setItems([...rs.map((r: any) => ({...r, targetType: 'risk'})), ...gs.map((g: any) => ({...g, targetType: 'goal', title: g.name}))]);
  };

  useEffect(() => { if(sessionId && departmentId) fetchData(); }, [sessionId, departmentId]);

  const handleUpload = async (file: File, description: string) => {
     const formData = new FormData();
     formData.append('file', file);
     formData.append('target_type', uploadTarget.target_type);
     formData.append('target_id', uploadTarget.target_id);
     formData.append('description', description);
     if (uploadTarget.control_field) formData.append('control_field', uploadTarget.control_field);

     const res = await fetch('/api/evidence/upload', { method: 'POST', body: formData });
     if (res.ok) {
        setUploadTarget(null);
        fetchData();
     }
  };

  return (
     <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-serif italic text-stone-900">4. 증빙의 제출</h2>
          <p className="text-sm text-stone-500">각 리스크 및 목표 항목별로 이행 증빙 자료를 업로드합니다.</p>
        </div>

        <div className="flex border-b border-stone-200">
           <TabButton active={activeTab === 1} onClick={() => setActiveTab(1)} icon={Shield} label="Compliance 리스크" />
           <TabButton active={activeTab === 2} onClick={() => setActiveTab(2)} icon={Scale} label="Ethics 리스크" />
           <TabButton active={activeTab === 3} onClick={() => setActiveTab(3)} icon={Target} label="자율준수 목표" />
        </div>

        <div className="space-y-4">
           {activeTab === 1 && items.filter(r => r.targetType === 'risk' && r.type === 'compliance').map(r => (
              <div key={r.id} className="space-y-2">
                 <div className="bg-stone-100/50 p-2 px-4 rounded-lg text-[10px] font-bold text-stone-500 uppercase tracking-widest">{r.title}</div>
                 {r.control1 && <EvidenceRow title={`통제1: ${r.control1}`} requirement={r.evidence_type1} onUpload={() => setUploadTarget({target_type: 'risk', target_id: r.id, control_field: 'control1', title: `통제1`})} status={r.status} />}
                 {r.control2 && (r.scale !== 'M' && r.scale !== 'L') && <EvidenceRow title={`통제2: ${r.control2}`} requirement={r.evidence_type2} onUpload={() => setUploadTarget({target_type: 'risk', target_id: r.id, control_field: 'control2', title: `통제2`})} status={r.status} />}
              </div>
           ))}
           {activeTab === 2 && items.filter(r => r.targetType === 'risk' && r.type === 'ethics').map(r => (
              <div key={r.id} className="space-y-2">
                 <div className="bg-stone-100/50 p-2 px-4 rounded-lg text-[10px] font-bold text-stone-500 uppercase tracking-widest">{r.title}</div>
                 {r.control1 && <EvidenceRow title={`통제1: ${r.control1}`} requirement={r.evidence_type1} onUpload={() => setUploadTarget({target_type: 'risk', target_id: r.id, control_field: 'control1', title: `통제1`})} status={r.status} />}
                 {r.control2 && (r.scale !== 'M' && r.scale !== 'L') && <EvidenceRow title={`통제2: ${r.control2}`} requirement={r.evidence_type2} onUpload={() => setUploadTarget({target_type: 'risk', target_id: r.id, control_field: 'control2', title: `통제2`})} status={r.status} />}
              </div>
           ))}
           {activeTab === 3 && items.filter(g => g.targetType === 'goal').map(g => (
              <EvidenceRow key={g.id} title={g.name} requirement={g.criteria || '지정 없음'} onUpload={() => setUploadTarget({target_type: 'goal', target_id: g.id, title: g.name})} status={g.status} />
           ))}
        </div>

        {uploadTarget && (
           <UploadModal
              isOpen={!!uploadTarget}
              onClose={() => setUploadTarget(null)}
              onConfirm={handleUpload}
              title={uploadTarget.title}
           />
        )}
     </div>
  );
};

const EvidenceRow = ({ title, requirement, onUpload, status }: any) => (
   <Card className="p-4 flex justify-between items-center group">
      <div>
         <h4 className="font-medium text-stone-900 mb-1">{title}</h4>
         <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 font-mono italic">요구증빙: {requirement}</span>
            <StatusBadge status={status} />
         </div>
      </div>
      <button
        onClick={onUpload}
        className="flex items-center gap-2 bg-stone-50 text-stone-600 px-4 py-2 rounded-lg border border-stone-200 hover:bg-stone-900 hover:text-white transition-all text-sm font-medium"
      >
         <Upload size={16} /> 증빙 업로드
      </button>
   </Card>
);

const UploadModal = ({ isOpen, onClose, onConfirm, title }: any) => {
   const [file, setFile] = useState<File | null>(null);
   const [desc, setDesc] = useState('');
   return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
         <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold mb-4">{title} - 증빙 제출</h3>
            <div className="space-y-4">
               <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm" />
               <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full p-2 border rounded h-24 text-sm" placeholder="증빙에 대한 상세 설명을 입력하세요." />
               <div className="flex gap-2">
                  <button onClick={onClose} className="flex-1 py-2 border rounded">취소</button>
                  <button onClick={() => onConfirm(file, desc)} disabled={!file} className="flex-1 py-2 bg-stone-900 text-white rounded disabled:opacity-50">업로드</button>
               </div>
            </div>
         </motion.div>
      </div>
   );
};

const EvaluationManager = ({ sessionId, departmentId }: any) => {
   const [items, setItems] = useState<any[]>([]);
   const [selectedItem, setSelectedItem] = useState<any>(null);
   const [auditData, setAuditData] = useState({ status: 'conformity', comment: '' });

   const fetchData = async () => {
      const [riskRes, goalRes] = await Promise.all([
         fetch(`/api/risks?session_id=${sessionId}&department_id=${departmentId}`),
         fetch(`/api/goals?session_id=${sessionId}&department_id=${departmentId}`)
      ]);
      const rs = await riskRes.json();
      const gs = await goalRes.json();
      setItems([...rs.map((r: any) => ({...r, targetType: 'risk'})), ...gs.map((g: any) => ({...g, targetType: 'goal', title: g.name}))]);
   };

   useEffect(() => { if(sessionId && departmentId) fetchData(); }, [sessionId, departmentId]);

   const handleAudit = async () => {
      await fetch('/api/audit', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            risk_id: selectedItem.targetType === 'risk' ? selectedItem.id : null,
            goal_id: selectedItem.targetType === 'goal' ? selectedItem.id : null,
            ...auditData,
            auditor_name: '관리자'
         })
      });
      setSelectedItem(null);
      fetchData();
   };

   return (
      <div className="space-y-6">
         <div>
            <h2 className="text-2xl font-serif italic text-stone-900">5. 평가 및 심사</h2>
            <p className="text-sm text-stone-500">작성된 모든 리스크 및 목표 항목을 검토하고 평가 결과를 남깁니다.</p>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(item => (
               <Card key={`${item.targetType}-${item.id}`} className="p-4 hover:border-stone-400 cursor-pointer transition-all" >
                  <div onClick={async () => {
                     const res = await fetch(`/api/risks/${item.id}/details`);
                     const details = await res.json();
                     setSelectedItem({...item, ...details});
                  }}>
                     <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.targetType === 'risk' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                           {item.targetType === 'risk' ? 'RISK' : 'GOAL'}
                        </span>
                        <StatusBadge status={item.status} />
                     </div>
                     <h4 className="font-medium text-stone-900 mb-1">{item.title}</h4>
                     <p className="text-xs text-stone-500 line-clamp-1 italic">{item.description || item.goal_description}</p>
                  </div>
               </Card>
            ))}
         </div>

         {selectedItem && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-8 overflow-y-auto max-h-[90vh]">
                  <div className="flex justify-between items-center mb-6">
                     <h3 className="text-xl font-bold">{selectedItem.title}</h3>
                     <button onClick={() => setSelectedItem(null)}><X size={20}/></button>
                  </div>
                  <div className="space-y-6">
                     <section className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                        <h4 className="text-[10px] font-mono uppercase text-stone-400 mb-2">상세 정보</h4>
                        <div className="grid grid-cols-2 gap-y-2 text-sm text-stone-700">
                           <span>유형: {selectedItem.targetType?.toUpperCase()}</span>
                           <span>부서: {selectedItem.department_name}</span>
                        </div>
                     </section>

                     <section>
                         <h4 className="text-[10px] font-mono uppercase text-stone-400 mb-3">제출된 증빙</h4>
                         <div className="space-y-4">
                            {['control1', 'control2', null].map(field => {
                               const fieldFiles = selectedItem.files?.filter((f: any) => f.control_field === field);
                               if (!fieldFiles || fieldFiles.length === 0) return null;
                               return (
                                  <div key={field || 'goal'}>
                                     {field && <div className="text-[10px] font-bold text-stone-400 mb-2">{field.toUpperCase()} 증빙</div>}
                                     <div className="space-y-2">
                                        {fieldFiles.map((f: any) => (
                                           <div key={f.id} className="flex items-center justify-between p-3 bg-white border border-stone-200 rounded-lg">
                                              <span className="text-sm font-medium">{f.file_name}</span>
                                              <div className="flex gap-2">
                                                 <a href={`/uploads/${f.file_path.split('uploads')[1]}`} target="_blank" className="text-stone-400 hover:text-stone-900"><Download size={14}/></a>
                                              </div>
                                           </div>
                                        ))}
                                     </div>
                                  </div>
                               );
                            })}
                            {(!selectedItem.files || selectedItem.files.length === 0) && <p className="text-xs text-stone-400 italic">제출된 증빙이 없습니다.</p>}
                         </div>
                      </section>

                     <section className="border-t border-stone-100 pt-6">
                        <h4 className="text-sm font-bold mb-4">평가 및 심사 의견</h4>
                        <div className="space-y-4">
                           <div className="flex gap-4">
                              {['conformity', 'non-conformity'].map(s => (
                                 <button
                                    key={s}
                                    onClick={() => setAuditData({...auditData, status: s})}
                                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                                       auditData.status === s ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-200'
                                    }`}
                                 >
                                    {s === 'conformity' ? '적합' : '부적합/개선'}
                                 </button>
                              ))}
                           </div>
                           <textarea
                              value={auditData.comment}
                              onChange={e => setAuditData({...auditData, comment: e.target.value})}
                              className="w-full p-3 border border-stone-200 rounded-xl text-sm h-32"
                              placeholder="심사 의견을 남겨주세요."
                           />
                           <button onClick={handleAudit} className="w-full bg-stone-900 text-white py-3 rounded-xl font-medium shadow-lg">평가 완료</button>
                        </div>
                     </section>
                  </div>
               </motion.div>
            </div>
         )}
      </div>
   );
};

const Dashboard = ({ sessionId, departmentId }: any) => {
   const [stats, setStats] = useState({ total: 0, submitted: 0, conformity: 0, nonConformity: 0 });

   useEffect(() => {
      const fetchStats = async () => {
         const res = await fetch(`/api/stats?session_id=${sessionId}${departmentId ? `&department_id=${departmentId}` : ''}`);
         setStats(await res.json());
      };
      if (sessionId) fetchStats();
   }, [sessionId, departmentId]);

   const chartData = [
      { name: '적합', value: stats.conformity, color: '#10b981' },
      { name: '부적합/미비', value: stats.total - stats.conformity, color: '#f43f5e' },
   ];

   return (
      <div className="space-y-8">
         <div>
            <h2 className="text-2xl font-serif italic text-stone-900">6. 대시보드 및 통계</h2>
            <p className="text-sm text-stone-500">전체 부서의 컴플라이언스 이행 현황을 모니터링합니다.</p>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="p-6 bg-stone-900 text-white flex flex-col items-center justify-center text-center">
               <span className="text-[10px] font-mono uppercase tracking-widest opacity-50 mb-2">Total Risks</span>
               <div className="text-5xl font-serif italic">{stats.total}</div>
            </Card>
            <Card className="p-6 flex flex-col items-center justify-center text-center">
               <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 mb-2">Submitted</span>
               <div className="text-5xl font-serif italic text-blue-600">{stats.submitted}</div>
            </Card>
            <Card className="p-6 flex flex-col items-center justify-center text-center border-l-4 border-emerald-500">
               <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 mb-2">Conformity</span>
               <div className="text-5xl font-serif italic text-emerald-600">{stats.conformity}</div>
            </Card>
            <Card className="p-6 flex flex-col items-center justify-center text-center border-l-4 border-rose-500">
               <span className="text-[10px] font-mono uppercase tracking-widest text-stone-400 mb-2">Non-Conformity</span>
               <div className="text-5xl font-serif italic text-rose-600">{stats.nonConformity}</div>
            </Card>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-8">
               <h3 className="text-lg font-medium mb-6">심사 적합성 비율</h3>
               <div className="h-[300px] w-full">
                  <ResponsiveContainer>
                     <PieChart>
                        <Pie data={chartData} innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value" stroke="none">
                           {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip />
                     </PieChart>
                  </ResponsiveContainer>
               </div>
               <div className="flex justify-center gap-8 mt-4">
                  {chartData.map(c => (
                     <div key={c.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{backgroundColor: c.color}} />
                        <span className="text-xs text-stone-500">{c.name} ({c.value})</span>
                     </div>
                  ))}
               </div>
            </Card>

            <Card className="p-8">
               <h3 className="text-lg font-medium mb-6">부서별 이행 현황</h3>
               <div className="h-[300px] w-full">
                  <ResponsiveContainer>
                     <BarChart data={[{name: 'CP팀', total: stats.total, sub: stats.submitted, conf: stats.conformity}]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" fontSize={12} stroke="#94a3b8" axisLine={false} tickLine={false} />
                        <YAxis fontSize={12} stroke="#94a3b8" axisLine={false} tickLine={false} />
                        <Tooltip cursor={{fill: '#f8fafc'}} />
                        <Bar dataKey="total" fill="#f1f5f9" radius={[4,4,0,0]} />
                        <Bar dataKey="sub" fill="#3b82f6" radius={[4,4,0,0]} />
                        <Bar dataKey="conf" fill="#10b981" radius={[4,4,0,0]} />
                     </BarChart>
                  </ResponsiveContainer>
               </div>
               <div className="flex justify-center gap-4 mt-6">
                  <div className="flex items-center gap-1.5 text-[10px] text-stone-400 font-medium">
                     <div className="w-2.5 h-2.5 rounded-sm bg-stone-200" /> 전체 리스크
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-stone-400 font-medium">
                     <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> 증빙 제출
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-stone-400 font-medium">
                     <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> 최종 적합
                  </div>
               </div>
            </Card>
         </div>
      </div>
   );
};

// --- Main App ---

export default function App() {
  const [activeMenu, setActiveMenu] = useState(1);
  const [sessions, setSessions] = useState<AssessmentSession[]>([]);
  const [currentSession, setCurrentSession] = useState<AssessmentSession | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [isoClauses, setIsoClauses] = useState([]);
  const [obligations, setObligations] = useState<ComplianceObligation[]>([]);

  const fetchBaseData = async () => {
    const [sessRes, deptRes, clauseRes] = await Promise.all([
      fetch('/api/sessions'),
      fetch('/api/departments'),
      fetch('/api/iso-clauses')
    ]);
    const sessAll = await sessRes.json();
    setSessions(sessAll);
    if (sessAll.length > 0) setCurrentSession(sessAll[0]);

    const depts = await deptRes.json();
    setDepartments(depts);
    if (depts.length > 0) setSelectedDeptId(depts[0].id.toString());
    setIsoClauses(await clauseRes.json());
  };

  const fetchObligations = async () => {
    if (!currentSession || !selectedDeptId) return;
    const res = await fetch(`/api/obligations?session_id=${currentSession.id}&department_id=${selectedDeptId}`);
    setObligations(await res.json());
  };

  useEffect(() => { fetchBaseData(); }, []);
  useEffect(() => { fetchObligations(); }, [currentSession, selectedDeptId]);

  const handleCreateSession = async (data: any) => {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const { id } = await res.json();
    fetchBaseData();
    setActiveMenu(1); // Stay or move to next
  };

  const handleDeleteSession = async (id: number) => {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (currentSession?.id === id) setCurrentSession(null);
    fetchBaseData();
  };

  const menuItems = [
    { id: 1, label: '평가의 생성', icon: Settings },
    { id: 2, label: '리스크 식별 및 통제', icon: Layers },
    { id: 3, label: '자율준수 목표 수립', icon: Target },
    { id: 4, label: '증빙 자료 제출', icon: Upload },
    { id: 5, label: '평가 및 심사', icon: ClipboardCheck },
    { id: 6, label: '대시보드', icon: LayoutDashboard },
  ];

  return (
    <div className="flex h-screen bg-stone-50 font-sans text-stone-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-stone-200 flex flex-col shadow-sm z-20">
        <div className="p-8 pb-4">
           <div className="flex items-center gap-3 mb-10">
              <div className="bg-stone-900 text-white p-2 rounded-xl shadow-lg">
                 <Shield size={24} />
              </div>
              <h1 className="text-xl font-serif italic font-bold tracking-tight">Compliance<br/>Portal</h1>
           </div>
           
           <nav className="space-y-1">
              {menuItems.map(item => (
                 <button
                   key={item.id}
                   onClick={() => setActiveMenu(item.id)}
                   className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all group ${
                     activeMenu === item.id 
                       ? 'bg-stone-900 text-white shadow-lg' 
                       : 'text-stone-400 hover:text-stone-700 hover:bg-stone-50'
                   }`}
                 >
                   <item.icon size={18} className={activeMenu === item.id ? 'text-white' : 'text-stone-300 group-hover:text-stone-500'} />
                   {item.label}
                 </button>
              ))}
           </nav>
        </div>
        
        <div className="mt-auto p-8 border-t border-stone-100 bg-stone-50/50">
           {currentSession ? (
              <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
                 <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold border border-blue-100">
                    {currentSession.year.toString().slice(-2)}
                 </div>
                 <div>
                    <h4 className="text-[10px] font-mono text-stone-400 uppercase tracking-widest leading-none mb-1">Active Session</h4>
                    <p className="text-sm font-bold text-stone-900 truncate max-w-[120px]">{currentSession.name}</p>
                 </div>
              </div>
           ) : (
              <div className="text-xs text-stone-400 italic">No session active</div>
           )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white border-b border-stone-200 flex items-center justify-between px-10 z-10">
           <div className="flex items-center gap-10">
              <div className="flex flex-col">
                 <label className="text-[10px] uppercase font-mono tracking-widest text-stone-400 mb-0.5">평가 부서</label>
                 <div className="text-sm font-bold bg-transparent outline-none border-none p-0">
                    {departments.find(d => d.id.toString() === selectedDeptId)?.name || 'CP팀'}
                 </div>
              </div>
           </div>

           <div className="flex items-center gap-4">
              <button className="p-2 text-stone-400 hover:text-stone-900 transition-colors"><Search size={20}/></button>
              <button className="p-2 text-stone-400 hover:text-stone-900 transition-colors"><RefreshCw size={20}/></button>
              <div className="h-8 w-px bg-stone-200 mx-2" />
              <div className="flex items-center gap-2">
                 <div className="text-right">
                    <p className="text-xs font-bold leading-none">Admin User</p>
                    <p className="text-[10px] text-stone-400">Compliance Officer</p>
                 </div>
                 <div className="w-8 h-8 rounded-full bg-stone-900 flex items-center justify-center text-white text-xs">A</div>
              </div>
           </div>
        </header>

        {/* Viewport */}
        <div className="flex-1 overflow-y-auto p-12 bg-stone-50/50">
           <AnimatePresence mode="wait">
              <motion.div
                key={activeMenu + (currentSession?.id || 0)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                 {!currentSession && activeMenu !== 1 ? (
                    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                       <AlertCircle size={48} className="text-stone-200 mb-4" />
                       <h3 className="text-xl font-serif italic text-stone-900">활동 중인 심사 세션이 없습니다.</h3>
                       <p className="text-stone-400 text-sm mt-2 mb-8">먼저 '평가의 생성' 메뉴에서 새로운 심사를 시작해 주세요.</p>
                       <button 
                         onClick={() => setActiveMenu(1)}
                         className="bg-stone-900 text-white px-8 py-3 rounded-xl font-medium shadow-xl hover:bg-stone-800 transition-all"
                       >
                          새 심사 생성하러 가기
                       </button>
                    </div>
                 ) : (
                    <>
                       {activeMenu === 1 && (
                          <SessionManager 
                            sessions={sessions} 
                            currentSession={currentSession} 
                            onSessionSelect={setCurrentSession}
                            onCreateSession={handleCreateSession}
                            onDeleteSession={handleDeleteSession}
                          />
                       )}
                       {activeMenu === 2 && (
                          <RiskManager 
                            sessionId={currentSession?.id} 
                            departmentId={selectedDeptId} 
                            obligations={obligations}
                            fetchObligations={fetchObligations}
                            isoClauses={isoClauses}
                          />
                       )}
                       {activeMenu === 3 && (
                          <GoalSettingManager 
                            sessionId={currentSession?.id} 
                            departmentId={selectedDeptId} 
                          />
                       )}
                       {activeMenu === 4 && (
                          <EvidenceManager 
                            sessionId={currentSession?.id} 
                            departmentId={selectedDeptId} 
                          />
                       )}
                       {activeMenu === 5 && (
                          <EvaluationManager 
                            sessionId={currentSession?.id} 
                            departmentId={selectedDeptId} 
                          />
                       )}
                       {activeMenu === 6 && (
                          <Dashboard 
                            sessionId={currentSession?.id} 
                            departmentId={selectedDeptId} 
                          />
                       )}
                    </>
                 )}
              </motion.div>
           </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
