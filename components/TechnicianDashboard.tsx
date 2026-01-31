
import React, { useState, useEffect, useRef } from 'react';
import { User, Mission, WeekSelection, MissionType, MissionStatus, FormTemplate, FormResponse, FormField } from '../types';
import { getWeekDates, formatFrenchDate, isSunday } from '../utils';
import { CheckSquare, Square, X, FileText, Plus, CheckCircle2, PenTool, Loader2, AlertCircle, MapPin } from 'lucide-react';
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
          jobNumber: '', hours: 0, type: MissionType.WORK, status: MissionStatus.PENDING, technicianId: user.id, managerInitials: '', igd: false, description: '', address: ''
        });
      });
    });
    setLocalMissions(synced);
  }, [week, missions, user.id]);

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
        const lastJobResponse = [...responses].reverse().find(r => r.data.job_number === mission.jobNumber);
        setFormData({
          job_number: mission.jobNumber,
          client_name: lastJobResponse?.data.client_name || '',
          job_label: lastJobResponse?.data.job_label || '',
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
        // Pour les checkbox, false est une valeur valide
        if (f.type === 'checkbox') {
          if (val === undefined || val === null) errors.push(f.label);
        } else {
          if (!val || String(val).trim() === '') errors.push(f.label);
        }
      }
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      // On scrolle vers le haut de la modale pour montrer les erreurs
      const modalContent = document.getElementById('form-modal-content');
      if (modalContent) modalContent.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    setValidationErrors([]);

    // On utilise un try/finally sans délai pour garantir l'exécution
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
      
      // Fermeture immédiate
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
              
              {/* Message d'erreur si champs manquants */}
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
                  <div key={field.id} className={`${field.type === 'textarea' || field.type === 'signature' ? 'md:col-span-2' : ''} space-y-2`}>
                    <label className={`text-[10px] font-black uppercase tracking-widest px-1 transition-colors ${validationErrors.includes(field.label) ? 'text-red-500' : 'text-slate-400'}`}>
                      {field.label} {field.required && <span className="text-red-500 font-bold">*</span>}
                    </label>
                    
                    {field.type === 'signature' ? (
                      <div onClick={() => !isSubmitting && setActiveSignatureFieldId(field.id)} className={`relative h-32 border-2 border-dashed rounded-2xl bg-slate-50 flex items-center justify-center cursor-pointer transition-all ${formData[field.id] ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 hover:bg-indigo-50/50'} ${validationErrors.includes(field.label) ? 'border-red-300 bg-red-50/30' : ''}`}>
                         {formData[field.id] ? <img src={formData[field.id]} alt="Signed" className="h-full object-contain grayscale" /> : <div className="text-slate-400 flex flex-col items-center gap-1 font-black text-[9px] uppercase tracking-tighter"><PenTool size={20}/><p>Cliquer pour signer</p></div>}
                      </div>
                    ) : field.type === 'checkbox' ? (
                      <button 
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setFormData(p => ({...p, [field.id]: !p[field.id]}))} 
                        className={`w-full p-5 rounded-2xl border-2 font-black flex items-center justify-between transition-all ${formData[field.id] ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                      >
                        {field.id === 'acceptance_type' ? (formData[field.id] ? 'SANS RÉSERVE' : 'AVEC RÉSERVE(S)') : (formData[field.id] ? 'OUI' : 'NON')}
                        {formData[field.id] ? <CheckSquare size={20} /> : <Square size={20} />}
                      </button>
                    ) : field.type === 'textarea' ? (
                      <textarea 
                        disabled={isSubmitting}
                        value={formData[field.id] || ''} 
                        onChange={e => setFormData(p => ({...p, [field.id]: e.target.value}))} 
                        className={`w-full p-5 bg-slate-50 border-2 rounded-2xl min-h-[140px] outline-none focus:border-indigo-500 font-bold text-slate-800 transition-colors ${validationErrors.includes(field.label) ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`} 
                      />
                    ) : (
                      <input 
                        disabled={isSubmitting}
                        type={field.type} 
                        value={formData[field.id] || ''} 
                        onChange={e => setFormData(p => ({...p, [field.id]: e.target.value}))} 
                        className={`w-full p-5 bg-slate-50 border-2 rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-800 transition-colors ${validationErrors.includes(field.label) ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`} 
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

      {/* PLANNING */}
      {onlyPlanningView && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden print:hidden">
           <table className="w-full text-left">
              <thead className="bg-slate-50 border-b">
                 <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest"><th className="px-8 py-5">Jour</th><th className="px-8 py-5">Affaire</th><th className="px-8 py-5 text-center">Heures</th><th className="px-8 py-5 text-center">Actions</th></tr>
              </thead>
              <tbody className="divide-y">
                 {localMissions.map((m, idx) => {
                    const sun = isSunday(new Date(m.date));
                    const hasResponse = responses.some(r => r.missionId === m.id);
                    return (
                      <tr key={m.id} className={`${sun ? 'bg-slate-50/50' : 'hover:bg-slate-50/30'}`}>
                         <td className="px-8 py-6">{idx % 2 === 0 && <span className="text-sm font-black text-slate-800 capitalize">{formatFrenchDate(new Date(m.date))}</span>}</td>
                         <td className="px-8 py-6">{!sun && <input type="text" placeholder="N° AFFAIRE" value={m.jobNumber} onChange={e => onUpdateMissions([{...m, jobNumber: e.target.value.toUpperCase()}])} className="w-full max-w-[140px] p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm outline-none focus:ring-2 focus:ring-indigo-500" />}</td>
                         <td className="px-8 py-6 text-center">{!sun && <input type="number" step="0.5" value={m.hours || ''} onChange={e => onUpdateMissions([{...m, hours: parseFloat(e.target.value) || 0}])} className="w-20 p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm text-center outline-none" />}</td>
                         <td className="px-8 py-6 text-center">
                            {!sun && m.jobNumber && (
                               <div className="flex items-center justify-center gap-2">
                                  {m.address && (
                                     <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(m.address)}`} target="_blank" rel="noopener noreferrer" className="p-4 rounded-2xl bg-slate-100 text-slate-400 hover:text-blue-600 transition-all" title="Itinéraire">
                                        <MapPin />
                                     </a>
                                  )}
                                  <button onClick={() => handleOpenForm(m)} className={`p-4 rounded-2xl transition-all ${hasResponse ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:text-indigo-600'}`} title="Remplir PV">
                                     {hasResponse ? <CheckCircle2 /> : <FileText />}
                                  </button>
                               </div>
                            )}
                         </td>
                      </tr>
                    );
                 })}
              </tbody>
           </table>
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