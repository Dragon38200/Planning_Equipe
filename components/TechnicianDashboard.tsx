
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Mission, WeekSelection, MissionType, MissionStatus, FormTemplate, FormResponse, FormField } from '../types';
import { getWeekDates, formatFrenchDate, isSunday } from '../utils';
import { CheckSquare, Square, X, FileText, Plus, CheckCircle2, PenTool, Loader2, AlertCircle, MapPin, ShieldCheck, ShieldX, Clock, Map, List, Navigation, Camera, Trash2 } from 'lucide-react';
import { format, isSameDay } from 'date-fns';

interface Props {
  user: User;
  missions: Mission[];
  week: WeekSelection;
  onWeekChange: (w: WeekSelection) => void;
  onUpdateMissions: (m: Mission[]) => void;
  templates: FormTemplate[];
  responses: FormResponse[];
  onSaveResponse: (r: FormResponse) => void;
  onlyPlanningView?: boolean;
  onlyFormsView?: boolean;
}

const TechnicianDashboard: React.FC<Props> = ({ user, missions, week, onUpdateMissions, templates, responses, onSaveResponse, onlyPlanningView, onlyFormsView }) => {
  const dates = getWeekDates(week.year, week.weekNumber);
  const [localMissions, setLocalMissions] = useState<Mission[]>([]);
  const [activeFormMission, setActiveFormMission] = useState<Mission | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // State pour basculer entre la vue Liste et la vue Carte
  const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>('LIST');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeSignatureFieldId, setActiveSignatureFieldId] = useState<string | null>(null);

  useEffect(() => {
    const weekMissions = missions.filter(m => 
      m.technicianId === user.id && 
      dates.some(d => isSameDay(new Date(m.date), d))
    );
    const synced: Mission[] = [];
    dates.forEach(date => {
      const existing = weekMissions.filter(m => isSameDay(new Date(m.date), date));
      [1, 2].forEach((_, i) => {
        synced.push(existing[i] || {
          id: `m-${user.id}-${date.toISOString()}-${i+1}`,
          date: date.toISOString(),
          jobNumber: '', workHours: 0, travelHours: 0, overtimeHours: 0, type: MissionType.WORK, status: MissionStatus.PENDING, technicianId: user.id, managerInitials: '', igd: false, description: '', address: ''
        });
      });
    });
    setLocalMissions(synced);
  }, [week, missions, user.id]);

  const dailyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    localMissions.forEach(m => {
        const day = m.date.split('T')[0];
        if (!totals[day]) totals[day] = 0;
        totals[day] += (m.workHours || 0) + (m.travelHours || 0) + (m.overtimeHours || 0);
    });
    return totals;
  }, [localMissions]);

  const weeklyTotals = useMemo(() => {
    return localMissions.reduce((acc, m) => {
        acc.work += m.workHours || 0;
        acc.travel += m.travelHours || 0;
        acc.overtime += m.overtimeHours || 0;
        return acc;
    }, { work: 0, travel: 0, overtime: 0 });
  }, [localMissions]);

  const handleMissionChange = (missionId: string, field: keyof Mission, value: any) => {
    let missionToSave: Mission | null = null;
    const newLocalMissions = localMissions.map(m => {
        if (m.id === missionId) {
            const updated = { ...m, [field]: value };
            if ((field === 'jobNumber' || field === 'workHours') && updated.status === MissionStatus.PENDING) {
                if (updated.jobNumber && updated.workHours > 0) {
                    updated.status = MissionStatus.SUBMITTED;
                }
            }
            missionToSave = updated;
            return updated;
        }
        return m;
    });

    setLocalMissions(newLocalMissions);
    
    if (missionToSave && (missionToSave.jobNumber || missionToSave.workHours > 0 || missionToSave.travelHours > 0 || missionToSave.overtimeHours > 0)) {
        onUpdateMissions([missionToSave]);
    }
  };

  // --- LOGIQUE DE SIGNATURE ---
  const startDrawing = (e: any) => { 
    setIsDrawing(true); 
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: any) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.lineWidth = 3; 
    ctx.lineCap = 'round'; 
    ctx.strokeStyle = '#000';
    ctx.lineTo(x, y); 
    ctx.stroke();
  };

  const endDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current && activeSignatureFieldId) {
      const signatureData = canvasRef.current.toDataURL('image/png');
      setFormData(prev => ({ ...prev, [activeSignatureFieldId]: signatureData }));
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      if (activeSignatureFieldId) {
        setFormData(prev => {
          const next = { ...prev };
          delete next[activeSignatureFieldId];
          return next;
        });
      }
    }
  };

  const handleOpenForm = (mission?: Mission, template?: FormTemplate) => {
    const t = template || templates.find(temp => temp.id === 'tpl-pv-rec-mounier') || templates[0];
    setSelectedTemplate(t);
    setValidationErrors([]);
    
    if (mission) {
      setActiveFormMission(mission);
      const existing = responses.find(r => r.missionId === mission.id);
      if (existing) {
        setFormData(existing.data);
      } else {
        // Pré-remplissage intelligent
        const lastJobResponse = [...responses].reverse().find(r => r.data.job_number === mission.jobNumber);
        setFormData({
          job_number: mission.jobNumber,
          address: mission.address || '',
          job_label: mission.description || lastJobResponse?.data.job_label || '',
          client_name: lastJobResponse?.data.client_name || '',
          cmd_number: lastJobResponse?.data.cmd_number || '',
          rep_mounier: user.name,
          date_effet: format(new Date(), 'yyyy-MM-dd'),
          acceptance_type: true
        });
      }
    } else {
      setActiveFormMission(null);
      setFormData({
        rep_mounier: user.name,
        date_effet: format(new Date(), 'yyyy-MM-dd'),
        acceptance_type: true
      });
    }
  };

  const handleSaveForm = () => {
    if (!selectedTemplate || isSubmitting) return;

    // Validation robuste
    const errors: string[] = [];
    selectedTemplate.fields.forEach(f => {
      if (f.required) {
        const val = formData[f.id];
        if (f.type === 'checkbox') {
          if (val === undefined || val === null) errors.push(f.label);
        } else if (f.type === 'photo_gallery') {
           // Photos are usually optional but check if required logic is needed
        } else {
          if (!val || String(val).trim() === '') errors.push(f.label);
        }
      }
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      const modalContent = document.getElementById('form-modal-content');
      if (modalContent) modalContent.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    setValidationErrors([]);

    try {
      const response: FormResponse = {
        id: `res-${Date.now()}`,
        missionId: activeFormMission?.id,
        templateId: selectedTemplate.id,
        technicianId: user.id,
        submittedAt: new Date().toISOString(),
        data: { ...formData }
      };

      onSaveResponse(response);
      setActiveFormMission(null);
      setSelectedTemplate(null);
      setFormData({});
    } catch (e) {
      console.error(e);
      setValidationErrors(["Erreur technique lors de l'envoi."]);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const getStatusIcon = (status: MissionStatus) => {
    switch(status) {
      case MissionStatus.VALIDATED: return <ShieldCheck className="text-emerald-500" size={16} />;
      case MissionStatus.REJECTED: return <ShieldX className="text-red-500" size={16} />;
      case MissionStatus.SUBMITTED: return <Clock className="text-blue-500" size={16} />;
      default: return null;
    }
  };

  const getStatusBgColor = (status: MissionStatus) => {
    switch (status) {
      case MissionStatus.VALIDATED: return 'bg-emerald-50/50';
      case MissionStatus.REJECTED: return 'bg-red-50/50';
      case MissionStatus.SUBMITTED: return 'bg-blue-50/50';
      default: return 'hover:bg-slate-50/30';
    }
  };
  
  const weeklyGrandTotal = weeklyTotals.work + weeklyTotals.travel + weeklyTotals.overtime;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Overlay de Signature */}
      {activeSignatureFieldId && (
        <div className="fixed inset-0 z-[250] bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
              <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
                 <h3 className="text-sm font-black uppercase tracking-widest">Signer le document</h3>
                 <button onClick={() => setActiveSignatureFieldId(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X /></button>
              </div>
              <div className="p-8 space-y-6">
                <div className="relative border-2 border-slate-200 rounded-2xl bg-slate-50 overflow-hidden h-64 touch-none">
                   <canvas 
                    ref={canvasRef} 
                    width={500} 
                    height={300} 
                    onMouseDown={startDrawing} 
                    onMouseMove={draw} 
                    onMouseUp={endDrawing} 
                    onMouseOut={endDrawing} 
                    onTouchStart={startDrawing} 
                    onTouchMove={draw} 
                    onTouchEnd={endDrawing} 
                    className="w-full h-full cursor-crosshair" 
                   />
                </div>
                <div className="flex gap-4">
                   <button onClick={clearSignature} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest">Effacer</button>
                   <button onClick={() => setActiveSignatureFieldId(null)} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">Valider</button>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* MODALE FORMULAIRE */}
      {(activeFormMission || selectedTemplate) && (
        <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 print:hidden">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="p-6 bg-indigo-600 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-white/20 rounded-xl"><FileText size={20}/></div>
                 <h2 className="text-lg font-black uppercase tracking-tight truncate">{selectedTemplate?.name}</h2>
              </div>
              <button disabled={isSubmitting} onClick={() => {setActiveFormMission(null); setSelectedTemplate(null);}} className="p-2 hover:bg-white/10 rounded-full transition-colors disabled:opacity-30"><X /></button>
            </div>
            
            <div id="form-modal-content" className="p-8 md:p-10 overflow-y-auto flex-1 space-y-8 scrollbar-thin bg-white">
              {validationErrors.length > 0 && (
                <div className="bg-red-50 border-2 border-red-200 p-6 rounded-2xl flex items-start gap-4 animate-in shake duration-300">
                  <AlertCircle className="text-red-600 shrink-0" size={24} />
                  <div>
                    <p className="text-sm font-black text-red-800 uppercase mb-1">Attention, champs obligatoires :</p>
                    <ul className="list-disc list-inside text-xs font-bold text-red-600 space-y-0.5">
                      {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                    </ul>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {selectedTemplate?.fields.map(field => (
                  <div key={field.id} className={`${field.type === 'textarea' || field.type === 'signature' || field.type === 'photo' || field.type === 'photo_gallery' ? 'md:col-span-2' : ''} space-y-2`}>
                    <label className={`text-[10px] font-black uppercase tracking-widest px-1 transition-colors ${validationErrors.includes(field.label) ? 'text-red-500' : 'text-slate-400'}`}>
                      {field.label} {field.required && <span className="text-red-500 font-bold">*</span>}
                    </label>
                    
                    {field.type === 'signature' ? (
                      <div onClick={() => !isSubmitting && setActiveSignatureFieldId(field.id)} className={`relative h-32 border-2 border-dashed rounded-2xl bg-slate-50 flex items-center justify-center cursor-pointer transition-all ${formData[field.id] ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 hover:bg-indigo-50/50'} ${validationErrors.includes(field.label) ? 'border-red-300 bg-red-50/30' : ''}`}>
                         {formData[field.id] ? <img src={formData[field.id]} alt="Signed" className="h-full object-contain grayscale" /> : <div className="text-slate-400 flex flex-col items-center gap-1 font-black text-[9px] uppercase tracking-tighter"><PenTool size={20}/><p>Cliquer pour signer</p></div>}
                      </div>
                    ) : field.type === 'photo' ? (
                      <div className="space-y-2">
                          <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer bg-slate-50 hover:bg-indigo-50/50 transition-all ${formData[field.id] ? 'border-emerald-500' : 'border-slate-200'}`}>
                              {formData[field.id] ? (
                                  <div className="relative w-full h-full p-2"><img src={formData[field.id]} className="w-full h-full object-contain rounded-xl" alt="Preview"/><button type="button" onClick={(e) => {e.preventDefault(); setFormData(p => ({...p, [field.id]: null}))}} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"><X size={12}/></button></div>
                              ) : (
                                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                      <Camera className="w-8 h-8 mb-2 text-slate-400" />
                                      <p className="mb-2 text-xs text-slate-500"><span className="font-bold">Cliquez pour prendre une photo</span></p>
                                  </div>
                              )}
                              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                      const reader = new FileReader();
                                      reader.onloadend = () => setFormData(p => ({...p, [field.id]: reader.result}));
                                      reader.readAsDataURL(file);
                                  }
                              }} />
                          </label>
                      </div>
                    ) : field.type === 'photo_gallery' ? (
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-3">
                                {Array.isArray(formData[field.id]) && formData[field.id].map((photo: string, idx: number) => (
                                    <div key={idx} className="relative w-24 h-24 border rounded-xl overflow-hidden group">
                                        <img src={photo} alt={`Photo ${idx+1}`} className="w-full h-full object-cover" />
                                        <button type="button" onClick={() => {
                                            const newPhotos = [...formData[field.id]];
                                            newPhotos.splice(idx, 1);
                                            setFormData(p => ({...p, [field.id]: newPhotos}));
                                        }} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                                {(!formData[field.id] || formData[field.id].length < 10) && (
                                    <label className="w-24 h-24 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 text-slate-400 hover:text-indigo-500 transition-all">
                                        <Plus size={24}/>
                                        <span className="text-[9px] font-black uppercase mt-1">Ajouter</span>
                                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    const current = Array.isArray(formData[field.id]) ? formData[field.id] : [];
                                                    if(current.length < 10) setFormData(p => ({...p, [field.id]: [...current, reader.result]}));
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }} />
                                    </label>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold italic">{Array.isArray(formData[field.id]) ? formData[field.id].length : 0} / 10 photos</p>
                        </div>
                    ) : field.type === 'checkbox' ? (
                      <button 
                        type="button"
                        disabled={isSubmitting || field.readOnly}
                        onClick={() => setFormData(p => ({...p, [field.id]: !p[field.id]}))} 
                        className={`w-full p-5 rounded-2xl border-2 font-black flex items-center justify-between transition-all ${formData[field.id] ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                      >
                        {field.id === 'acceptance_type' ? (formData[field.id] ? 'SANS RÉSERVE' : 'AVEC RÉSERVE(S)') : (formData[field.id] ? 'OUI' : 'NON')}
                        {formData[field.id] ? <CheckSquare size={20} /> : <Square size={20} />}
                      </button>
                    ) : field.type === 'select' ? (
                       <select 
                         disabled={isSubmitting || field.readOnly}
                         value={formData[field.id] || ''}
                         onChange={e => setFormData(p => ({...p, [field.id]: e.target.value}))}
                         className={`w-full p-5 bg-slate-50 border-2 rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-800 transition-colors ${validationErrors.includes(field.label) ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}
                       >
                          <option value="">Sélectionner...</option>
                          {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                       </select>
                    ) : field.type === 'textarea' ? (
                      <textarea 
                        disabled={isSubmitting || field.readOnly}
                        value={formData[field.id] || ''} 
                        onChange={e => setFormData(p => ({...p, [field.id]: e.target.value}))} 
                        className={`w-full p-5 bg-slate-50 border-2 rounded-2xl min-h-[140px] outline-none focus:border-indigo-500 font-bold text-slate-800 transition-colors ${validationErrors.includes(field.label) ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`} 
                      />
                    ) : (
                      <input 
                        disabled={isSubmitting || field.readOnly}
                        type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'} 
                        step={field.type === 'number' ? "0.5" : undefined}
                        value={formData[field.id] || ''} 
                        onChange={e => setFormData(p => ({...p, [field.id]: e.target.value}))} 
                        className={`w-full p-5 bg-slate-50 border-2 rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-800 transition-colors ${validationErrors.includes(field.label) ? 'border-red-200 bg-red-50/30' : 'border-slate-200'} ${field.readOnly ? 'bg-slate-100 text-slate-500' : ''}`} 
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-8">
                 <button 
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSaveForm} 
                  className={`w-full py-6 rounded-3xl font-black uppercase tracking-widest text-sm shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] ${isSubmitting ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-emerald-600 shadow-emerald-200'}`}
                 >
                    {isSubmitting ? (
                      <><Loader2 className="animate-spin" size={24} /> ENVOI EN COURS...</>
                    ) : (
                      <><CheckCircle2 size={24}/> ENVOYER LE RAPPORT</>
                    )}
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PLANNING / CARTE */}
      {onlyPlanningView && (
        <div className="space-y-4">
            {/* Toggle Vue */}
            <div className="flex justify-end gap-2 print:hidden">
                <button 
                    onClick={() => setViewMode('LIST')} 
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${viewMode === 'LIST' ? 'bg-slate-800 text-white shadow-lg' : 'bg-white text-slate-400 hover:bg-slate-100'}`}
                >
                    <List size={16} /> Liste
                </button>
                <button 
                    onClick={() => setViewMode('MAP')} 
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${viewMode === 'MAP' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 hover:bg-slate-100'}`}
                >
                    <Map size={16} /> Carte / Itinéraire
                </button>
            </div>

            {viewMode === 'LIST' ? (
                /* VUE LISTE (TABLEAU) */
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-x-auto print:hidden">
                    <table className="w-full text-left min-w-[1000px]">
                        <thead className="bg-slate-50 border-b">
                            <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                <th className="px-4 py-5 w-48">Jour</th>
                                <th className="px-4 py-5">Affaire</th>
                                <th className="px-2 py-5 text-center w-24">H. Travail</th>
                                <th className="px-2 py-5 text-center w-24">H. Trajet</th>
                                <th className="px-2 py-5 text-center w-24">H. Sup</th>
                                <th className="px-2 py-5 text-center w-24">H. Total</th>
                                <th className="px-2 py-5 text-center w-20">IGD</th>
                                <th className="px-4 py-5 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {localMissions.map((m, idx) => {
                                const sun = isSunday(new Date(m.date));
                                const hasResponse = responses.some(r => r.missionId === m.id);
                                const isLocked = m.status === MissionStatus.VALIDATED || m.status === MissionStatus.REJECTED;
                                const missionTotal = (m.workHours || 0) + (m.travelHours || 0) + (m.overtimeHours || 0);
                                const dayKey = m.date.split('T')[0];
                                const dayTotal = dailyTotals[dayKey] || 0;
                                
                                return (
                                <tr key={m.id} className={`${sun ? 'bg-slate-50/50' : getStatusBgColor(m.status)}`}>
                                    <td className="px-4 py-4 relative align-top">
                                    {idx % 2 === 0 && <span className="text-sm font-black text-slate-800 capitalize">{formatFrenchDate(new Date(m.date))}</span>}
                                    {m.status === MissionStatus.REJECTED && m.rejectionComment && <div className="absolute top-2 left-4 text-[10px] text-red-600 font-bold italic truncate max-w-xs" title={m.rejectionComment}>Rejet: {m.rejectionComment}</div>}
                                    </td>
                                    <td className="px-4 py-2 align-top">
                                    <div className="flex items-center gap-3">
                                        {m.status !== MissionStatus.PENDING && getStatusIcon(m.status)}
                                        {!sun && <input type="text" placeholder="N° AFFAIRE" value={m.jobNumber} disabled={isLocked} onChange={e => handleMissionChange(m.id, 'jobNumber', e.target.value.toUpperCase())} className="w-full max-w-[140px] p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-200/50 disabled:cursor-not-allowed" />}
                                    </div>
                                    {m.description && !sun && <p className="text-[11px] text-slate-500 italic mt-1 ml-10 truncate max-w-xs" title={m.description}>{m.description}</p>}
                                    </td>
                                    <td className="px-2 py-2 text-center align-middle">{!sun && <input type="number" step="0.5" value={m.workHours || ''} disabled={isLocked} onChange={e => handleMissionChange(m.id, 'workHours', parseFloat(e.target.value) || 0)} className="w-20 p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-xs text-center outline-none disabled:bg-slate-200/50 disabled:cursor-not-allowed" />}</td>
                                    <td className="px-2 py-2 text-center align-middle">{!sun && <input type="number" step="0.5" value={m.travelHours || ''} disabled={isLocked} onChange={e => handleMissionChange(m.id, 'travelHours', parseFloat(e.target.value) || 0)} className="w-20 p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-xs text-center outline-none disabled:bg-slate-200/50 disabled:cursor-not-allowed" />}</td>
                                    <td className="px-2 py-2 text-center align-middle">{!sun && <input type="number" step="0.5" value={m.overtimeHours || ''} disabled={isLocked} onChange={e => handleMissionChange(m.id, 'overtimeHours', parseFloat(e.target.value) || 0)} className="w-20 p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-xs text-center outline-none disabled:bg-slate-200/50 disabled:cursor-not-allowed" />}</td>
                                    <td className={`px-2 py-2 text-center align-middle font-black text-sm ${dayTotal > 11 ? 'text-red-500' : 'text-slate-700'}`}>{!sun && missionTotal > 0 ? `${missionTotal}h` : ''}</td>
                                    <td className="px-2 py-2 text-center align-middle">{!sun && <input type="checkbox" checked={m.igd} disabled={isLocked} onChange={e => handleMissionChange(m.id, 'igd', e.target.checked)} className="w-6 h-6 rounded-md text-indigo-600 focus:ring-indigo-500 disabled:opacity-50" />}</td>
                                    <td className="px-4 py-2 text-center align-middle">
                                        {!sun && m.jobNumber && (
                                            <div className="flex items-center justify-center gap-2">
                                            {m.address && (
                                                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(m.address)}`} target="_blank" rel="noopener noreferrer" className="p-3 rounded-xl bg-slate-100 text-slate-400 hover:text-blue-600 transition-all" title="Itinéraire">
                                                    <MapPin size={18}/>
                                                </a>
                                            )}
                                            <button onClick={() => handleOpenForm(m)} className={`p-3 rounded-xl transition-all ${hasResponse ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:text-indigo-600'}`} title="Remplir PV">
                                                {hasResponse ? <CheckCircle2 size={18}/> : <FileText size={18}/>}
                                            </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="bg-slate-800 text-white font-black uppercase text-xs tracking-widest">
                            <tr>
                                <td className="px-4 py-4" colSpan={2}>Total Semaine</td>
                                <td className={`px-2 py-4 text-center ${weeklyTotals.work > 39 ? 'text-red-400 font-black' : ''}`}>{weeklyTotals.work}h</td>
                                <td className="px-2 py-4 text-center">{weeklyTotals.travel}h</td>
                                <td className="px-2 py-4 text-center">{weeklyTotals.overtime}h</td>
                                <td className="px-2 py-4 text-center font-black text-lg">{weeklyGrandTotal}h</td>
                                <td colSpan={2}></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            ) : (
                /* VUE CARTE (CARDS AVEC IFRAME) */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {dates.filter(d => !isSunday(d)).map(date => {
                         const daysMissions = localMissions.filter(m => isSameDay(new Date(m.date), date) && m.address && m.jobNumber);
                         
                         return (
                             <div key={date.toISOString()} className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                                    <h3 className="font-black text-slate-800 uppercase text-sm">{formatFrenchDate(date)}</h3>
                                </div>
                                {daysMissions.length > 0 ? (
                                    daysMissions.map(m => (
                                        <div key={m.id} className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg transition-all space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">{m.jobNumber}</p>
                                                    <p className="text-sm font-bold text-slate-800 mt-1 line-clamp-2">{m.description || 'Pas de description'}</p>
                                                </div>
                                                <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                                                    <MapPin size={16}/>
                                                </div>
                                            </div>
                                            
                                            {/* Carte Embed */}
                                            <div className="w-full h-32 bg-slate-100 rounded-2xl overflow-hidden relative">
                                                <iframe 
                                                    width="100%" 
                                                    height="100%" 
                                                    frameBorder="0" 
                                                    scrolling="no" 
                                                    src={`https://maps.google.com/maps?q=${encodeURIComponent(m.address || '')}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                                                    className="opacity-80 hover:opacity-100 transition-opacity"
                                                ></iframe>
                                            </div>
                                            
                                            <div className="space-y-2">
                                                <p className="text-xs text-slate-500 font-medium px-1 truncate"><MapPin size={12} className="inline mr-1"/>{m.address}</p>
                                                <a 
                                                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(m.address || '')}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
                                                >
                                                    <Navigation size={16} /> Lancer le GPS
                                                </a>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-6 rounded-3xl border-2 border-dashed border-slate-100 text-center">
                                        <p className="text-xs font-black text-slate-300 uppercase">Aucun déplacement prévu</p>
                                    </div>
                                )}
                             </div>
                         );
                    })}
                </div>
            )}
        </div>
      )}
      
      {/* FORMULAIRES LIBRES */}
      {onlyFormsView && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:hidden">
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-6">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Nouveau Rapport Libre</h2>
              {templates.map(t => (
                <button key={t.id} onClick={() => handleOpenForm(undefined, t)} className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl hover:border-indigo-600 flex items-center justify-between transition-all group">
                   <div className="flex items-center gap-4 text-left">
                      <div className="p-3 bg-white rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all"><FileText /></div>
                      <div><p className="font-black text-slate-800 uppercase text-xs">{t.name}</p><p className="text-[10px] text-slate-400 font-bold">{t.description}</p></div>
                   </div>
                   <Plus />
                </button>
              ))}
           </div>
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-6">Derniers envois</h2>
              <div className="space-y-3">
                 {responses.filter(r => r.technicianId === user.id).slice(0, 10).map(r => (
                    <div key={r.id} className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex justify-between items-center">
                       <p className="text-xs font-black text-emerald-800 uppercase tracking-tight truncate max-w-[200px]">AF: {r.data.job_number || '---'} • {format(new Date(r.submittedAt), 'dd/MM/yy HH:mm')}</p>
                       <CheckCircle2 className="text-emerald-500 shrink-0" size={16}/>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default TechnicianDashboard;
