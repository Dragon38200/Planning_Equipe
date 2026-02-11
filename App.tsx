import React, { useCallback, useEffect, useRef, useState } from 'react';
import { User, Role, Mission, WeekSelection, AppSettings, FormTemplate, FormResponse, FormField } from './types';
import { DEFAULT_APP_LOGO, DEFAULT_ADMIN, INITIAL_MANAGERS, INITIAL_TECHNICIANS, DEFAULT_TEMPLATES } from './constants';
import { getInitialMissions } from './data';
import { getCurrentWeekInfo, exportToCSV } from './utils';
import TechnicianDashboard from './components/TechnicianDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import AdminDashboard from './components/AdminDashboard';
import MissionManager from './components/MissionManager';
import { LogOut, Factory, Calendar, ClipboardList, BookOpen, Search, Eye, FileText, CheckCircle2, X, Trash2, Plus, Printer, AlertCircle, Settings, FileSpreadsheet, Download, Briefcase, Lock, ArrowRight, User as UserIcon, Loader2, PenTool, CheckSquare, Square, Camera, FilePlus, Mail, Image as ImageIcon, HardHat, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
// @ts-ignore
import html2canvas from 'html2canvas';
// @ts-ignore
import { jsPDF } from 'jspdf';
// @ts-ignore
import JSZip from 'jszip';

// LOCAL STORAGE IMPORTS (Replacing Firebase)
import { COLL_USERS, COLL_MISSIONS, COLL_TEMPLATES, COLL_RESPONSES, COLL_SETTINGS, saveDocument, deleteDocument, batchSaveMissions, seedDatabaseIfEmpty, subscribe } from './firebase';

// --- FONCTION DE COMPRESSION D'IMAGE ---
const compressImage = (file: File, maxWidth: number = 1920, quality: number = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

// --- HELPER COMPONENTS (DEFINED BEFORE APP TO AVOID HOISTING ISSUES) ---

const SharedFormModal: React.FC<{
  user: User;
  template: FormTemplate;
  users: User[];
  initialData: Record<string, any>;
  onClose: () => void;
  onSave: (response: FormResponse) => void;
}> = ({ user, template, users, initialData, onClose, onSave }) => {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [activeSignatureFieldId, setActiveSignatureFieldId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Update formData when initialData changes
  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);
  
  // Fill Select Options (Managers)
  const hydratedFields = template.fields.map(f => {
      if (f.id === 'manager_id' && (!f.options || f.options.length === 0)) {
          return { ...f, options: users.filter(u => u.role === Role.MANAGER).map(m => m.name) };
      }
      return f;
  });

  const handleSave = async () => {
      const errors: string[] = [];
      hydratedFields.forEach(f => {
          if (f.required) {
              const val = formData[f.id];
              if (f.type === 'checkbox') {
                  if (val === undefined || val === null) errors.push(f.label);
              } else if (f.type === 'photo_gallery') {
                 // check if empty?
              } else {
                  if (!val || String(val).trim() === '') errors.push(f.label);
              }
          }
      });
      
      if (errors.length > 0) {
          setValidationErrors(errors);
          const el = document.getElementById('shared-form-content');
          if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
          return;
      }
      
      setIsSubmitting(true);
      
      const response: FormResponse = {
          id: `res-${Date.now()}`,
          templateId: template.id,
          technicianId: user.id,
          submittedAt: new Date().toISOString(),
          data: formData
      };
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onSave(response);
      setIsSubmitting(false);
  };
  
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

  return (
    <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
      {activeSignatureFieldId && (
        <div className="fixed inset-0 z-[250] bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
              <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
                 <h3 className="text-sm font-black uppercase tracking-widest">Signer le document</h3>
                 <button onClick={() => setActiveSignatureFieldId(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X /></button>
              </div>
              <div className="p-8 space-y-6">
                <div className="relative border-2 border-slate-200 rounded-2xl bg-slate-50 overflow-hidden h-64 touch-none">
                   <canvas ref={canvasRef} width={500} height={300} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={endDrawing} onMouseOut={endDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={endDrawing} className="w-full h-full cursor-crosshair" />
                </div>
                <div className="flex gap-4">
                   <button onClick={clearSignature} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest">Effacer</button>
                   <button onClick={() => setActiveSignatureFieldId(null)} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">Valider</button>
                </div>
              </div>
           </div>
        </div>
      )}
      
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
          <div className="p-6 bg-indigo-600 text-white flex justify-between items-center shrink-0">
              <h2 className="text-lg font-black uppercase tracking-tight">{template.name}</h2>
              <button disabled={isSubmitting} onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X/></button>
          </div>
          
          <div id="shared-form-content" className="p-10 overflow-y-auto flex-1 space-y-8 bg-white">
              {validationErrors.length > 0 && (
                  <div className="bg-red-50 border-2 border-red-200 p-6 rounded-2xl flex items-start gap-4 animate-in shake">
                      <AlertCircle className="text-red-600 shrink-0" size={24} />
                      <div>
                          <p className="text-sm font-black text-red-800 uppercase mb-1">Erreurs de validation :</p>
                          <ul className="list-disc list-inside text-xs font-bold text-red-600">
                              {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
                          </ul>
                      </div>
                  </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {hydratedFields.map(field => (
                      <div key={field.id} className={`${['textarea', 'signature', 'photo', 'photo_gallery'].includes(field.type) ? 'md:col-span-2' : ''} space-y-2`}>
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">{field.label} {field.required && <span className="text-red-500">*</span>}</label>
                          {field.type === 'textarea' ? (
                              <textarea value={formData[field.id] || ''} onChange={e => setFormData({...formData, [field.id]: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none min-h-[120px]" disabled={field.readOnly} />
                          ) : field.type === 'select' ? (
                              <select value={formData[field.id] || ''} onChange={e => setFormData({...formData, [field.id]: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none" disabled={field.readOnly}>
                                  <option value="">Sélectionner...</option>
                                  {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                          ) : field.type === 'checkbox' ? (
                              <button type="button" onClick={() => !field.readOnly && setFormData({...formData, [field.id]: !formData[field.id]})} className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between font-black transition-all ${formData[field.id] ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-400'}`} disabled={field.readOnly}>
                                  {formData[field.id] ? 'OUI / SANS RÉSERVE' : 'NON / AVEC RÉSERVE'}
                                  {formData[field.id] ? <CheckSquare size={20}/> : <Square size={20}/>}
                              </button>
                          ) : field.type === 'signature' ? (
                              <div onClick={() => !isSubmitting && setActiveSignatureFieldId(field.id)} className={`relative h-32 border-2 border-dashed rounded-2xl bg-slate-50 flex items-center justify-center cursor-pointer transition-all ${formData[field.id] ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 hover:bg-indigo-50/50'}`}>
                                  {formData[field.id] ? <img src={formData[field.id]} alt="Signed" className="h-full object-contain grayscale" /> : <div className="text-slate-400 flex flex-col items-center gap-1 font-black text-[9px] uppercase tracking-tighter"><PenTool size={20}/><p>Cliquer pour signer</p></div>}
                              </div>
                          ) : field.type === 'photo' ? (
                              <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-2xl cursor-pointer bg-slate-50 hover:bg-indigo-50/50 transition-all ${formData[field.id] ? 'border-emerald-500' : 'border-slate-200'}`}>
                                  {formData[field.id] ? (
                                      <div className="relative w-full h-full p-2"><img src={formData[field.id]} className="w-full h-full object-contain rounded-xl" alt="Preview"/><button type="button" onClick={(e) => {e.preventDefault(); setFormData(p => ({...p, [field.id]: null}))}} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"><X size={12}/></button></div>
                                  ) : (
                                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                          <Camera className="w-8 h-8 mb-2 text-slate-400" />
                                          <p className="mb-2 text-xs text-slate-500"><span className="font-bold">Cliquez pour prendre une photo</span></p>
                                      </div>
                                  )}
                                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                          try {
                                              const compressedImage = await compressImage(file, 1920, 0.7);
                                              setFormData(p => ({...p, [field.id]: compressedImage}));
                                          } catch (error) {
                                              console.error('Erreur compression:', error);
                                              const reader = new FileReader();
                                              reader.onloadend = () => setFormData(p => ({...p, [field.id]: reader.result}));
                                              reader.readAsDataURL(file);
                                          }
                                      }
                                  }} />
                              </label>
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
                                              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
                                                  const file = e.target.files?.[0];
                                                  if (file) {
                                                      try {
                                                          const compressedImage = await compressImage(file, 1920, 0.7);
                                                          const current = Array.isArray(formData[field.id]) ? formData[field.id] : [];
                                                          if(current.length < 10) setFormData(p => ({...p, [field.id]: [...current, compressedImage]}));
                                                      } catch (error) {
                                                          console.error('Erreur compression:', error);
                                                          const reader = new FileReader();
                                                          reader.onloadend = () => {
                                                              const current = Array.isArray(formData[field.id]) ? formData[field.id] : [];
                                                              if(current.length < 10) setFormData(p => ({...p, [field.id]: [...current, reader.result]}));
                                                          };
                                                          reader.readAsDataURL(file);
                                                      }
                                                  }
                                              }} />
                                          </label>
                                      )}
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-bold italic">{Array.isArray(formData[field.id]) ? formData[field.id].length : 0} / 10 photos</p>
                              </div>
                          ) : (
                              <input type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} step={field.type === 'number' ? '0.5' : undefined} value={formData[field.id] || ''} onChange={e => setFormData({...formData, [field.id]: e.target.value})} className={`w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none ${field.readOnly ? 'bg-slate-100 text-slate-500' : ''}`} disabled={field.readOnly} />
                          )}
                      </div>
                  ))}
              </div>
              
              <div className="pt-6">
                  <button onClick={handleSave} disabled={isSubmitting} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 flex items-center justify-center gap-2">
                      {isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                      Enregistrer le rapport
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
};

const FormTemplateManager: React.FC<{ templates: FormTemplate[], onUpdateTemplates: (t: FormTemplate[]) => void }> = ({ templates, onUpdateTemplates }) => {
    const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(null);

    const handleSave = () => {
        if (!editingTemplate) return;
        if (!editingTemplate.name) return alert("Le nom est obligatoire");
        const isNew = !templates.find(t => t.id === editingTemplate.id);
        const newTemplates = isNew ? [...templates, editingTemplate] : templates.map(t => t.id === editingTemplate.id ? editingTemplate : t);
        onUpdateTemplates(newTemplates);
        setEditingTemplate(null);
    };

    const handleDelete = (id: string) => {
        if (window.confirm("Supprimer ce modèle ?")) onUpdateTemplates(templates.filter(t => t.id !== id));
    };
    
    const addField = () => {
        if (!editingTemplate) return;
        setEditingTemplate({
            ...editingTemplate,
            fields: [...editingTemplate.fields, { id: `f_${Date.now()}`, label: 'Nouveau Champ', type: 'text', required: false }]
        });
    };
    
    const updateField = (idx: number, updates: Partial<FormField>) => {
        if (!editingTemplate) return;
        const newFields = [...editingTemplate.fields];
        newFields[idx] = { ...newFields[idx], ...updates };
        setEditingTemplate({ ...editingTemplate, fields: newFields });
    };

    const removeField = (idx: number) => {
        if (!editingTemplate) return;
        const newFields = [...editingTemplate.fields];
        newFields.splice(idx, 1);
        setEditingTemplate({ ...editingTemplate, fields: newFields });
    };

    if (editingTemplate) {
        return (
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-6 animate-in slide-in-from-bottom-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                    <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{editingTemplate.id.startsWith('new') ? 'Créer un modèle' : 'Modifier le modèle'}</h2>
                    <button onClick={() => setEditingTemplate(null)} className="p-2 hover:bg-slate-100 rounded-full"><X/></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nom du modèle</label><input type="text" value={editingTemplate.name} onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-500" /></div>
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label><input type="text" value={editingTemplate.description} onChange={e => setEditingTemplate({...editingTemplate, description: e.target.value})} className="w-full mt-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-500" /></div>
                </div>
                <div className="space-y-4">
                    <div className="flex justify-between items-center"><h3 className="text-sm font-black text-slate-600 uppercase tracking-widest">Champs du formulaire</h3><button onClick={addField} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase hover:bg-indigo-100 flex items-center gap-2"><Plus size={14}/> Ajouter un champ</button></div>
                    <div className="space-y-3">
                        {editingTemplate.fields.map((field, idx) => (
                            <div key={field.id} className="flex gap-3 items-start p-4 bg-slate-50 border border-slate-200 rounded-xl group">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 flex-1">
                                    <input type="text" placeholder="ID" value={field.id} onChange={e => updateField(idx, {id: e.target.value})} className="bg-white p-2 rounded-lg border border-slate-200 text-xs font-mono" />
                                    <input type="text" placeholder="Label" value={field.label} onChange={e => updateField(idx, {label: e.target.value})} className="bg-white p-2 rounded-lg border border-slate-200 text-xs font-bold md:col-span-2" />
                                    <select value={field.type} onChange={e => updateField(idx, {type: e.target.value as any})} className="bg-white p-2 rounded-lg border border-slate-200 text-xs font-bold"><option value="text">Texte</option><option value="textarea">Zone de texte</option><option value="number">Nombre</option><option value="date">Date</option><option value="checkbox">Case à cocher</option><option value="signature">Signature</option><option value="photo">Photo (Unique)</option><option value="photo_gallery">Galerie Photos</option><option value="select">Liste déroulante</option></select>
                                </div>
                                <div className="flex flex-col gap-2 items-center pt-1">
                                    <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={field.required} onChange={e => updateField(idx, {required: e.target.checked})} className="w-4 h-4 rounded text-indigo-600" /><span className="text-[9px] font-black text-slate-400 uppercase">Req</span></label>
                                    <button onClick={() => removeField(idx)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                                </div>
                            </div>
                        ))}
                         {editingTemplate.fields.length === 0 && <div className="p-8 text-center text-slate-400 font-bold italic border-2 border-dashed border-slate-100 rounded-xl">Aucun champ défini. Ajoutez-en un !</div>}
                    </div>
                </div>
                <div className="flex gap-4 pt-4 border-t border-slate-100">
                    <button onClick={() => setEditingTemplate(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-xs hover:bg-slate-200">Annuler</button>
                    <button onClick={handleSave} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs hover:bg-indigo-700 shadow-lg shadow-indigo-200">Enregistrer le modèle</button>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <button onClick={() => setEditingTemplate({ id: `tpl-${Date.now()}`, name: 'Nouveau Modèle', description: '', fields: [], createdAt: new Date().toISOString() })} className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-4 min-h-[200px] hover:border-indigo-400 hover:bg-indigo-50/10 transition-all group">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-300 group-hover:text-indigo-600 group-hover:scale-110 transition-all shadow-sm"><Plus size={32}/></div>
                <p className="font-black text-slate-400 uppercase text-xs tracking-widest group-hover:text-indigo-600">Créer un modèle</p>
            </button>
            {templates.map(t => (
                <div key={t.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-lg hover:shadow-xl transition-all flex flex-col justify-between space-y-4">
                    <div>
                        <div className="flex justify-between items-start mb-2">
                             <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><FileText size={24}/></div>
                             <div className="flex gap-1">
                                 <button onClick={() => setEditingTemplate(t)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg hover:text-indigo-600"><Edit2 size={16}/></button>
                                 <button onClick={() => handleDelete(t.id)} className="p-2 text-slate-400 hover:bg-red-50 rounded-lg hover:text-red-600"><Trash2 size={16}/></button>
                             </div>
                        </div>
                        <h3 className="text-lg font-black text-slate-800 uppercase leading-none">{t.name}</h3>
                        <p className="text-xs text-slate-500 font-bold mt-2 line-clamp-2">{t.description}</p>
                    </div>
                    <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-300 uppercase">{t.fields.length} Champs</span>
                        <span className="text-[10px] font-bold text-slate-300">{new Date(t.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

const GlobalFormsHistory: React.FC<{ responses: FormResponse[], templates: FormTemplate[], users: User[], appSettings: AppSettings }> = ({ responses, templates, users, appSettings }) => {
  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null);
  const [search, setSearch] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const filtered = responses.filter(r => {
      const t = templates.find(t => t.id === r.templateId);
      const u = users.find(u => u.id === r.technicianId);
      const searchStr = (search || '').toLowerCase();
      return (
          (t?.name || '').toLowerCase().includes(searchStr) ||
          (u?.name || '').toLowerCase().includes(searchStr) ||
          (r.data.job_number || '').toLowerCase().includes(searchStr)
      );
  }).sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  const handleAction = async (action: 'download' | 'email') => {
      if (!selectedResponse) return;
      const element = document.getElementById('report-print-area');
      if (!element) return;

      if (action === 'email') setIsSendingEmail(true);

      try {
          // Correction pour capturer tout le contenu, même hors écran
          const canvas = await html2canvas(element, { 
              scale: 2, 
              useCORS: true,
              allowTaint: true,
              scrollY: -window.scrollY,
              scrollX: -window.scrollX,
              windowHeight: element.scrollHeight,
              windowWidth: element.scrollWidth,
              height: element.scrollHeight,
              width: element.scrollWidth
          });
          const imgData = canvas.toDataURL('image/jpeg', 0.7);
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
          
          let heightLeft = pdfHeight;
          let position = 0;
          
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= pdf.internal.pageSize.getHeight();

          while (heightLeft >= 0) {
            position = heightLeft - pdfHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= pdf.internal.pageSize.getHeight();
          }

          if (action === 'download') {
              pdf.save(`Rapport_${selectedResponse.data.job_number || 'Intervention'}.pdf`);
          } else {
              const email = prompt("Email du destinataire :", selectedResponse.data.client_email || "");
              if (!email) { setIsSendingEmail(false); return; }

              const pdfBase64 = pdf.output('datauristring').split(',')[1];
              
              const res = await fetch('/api/send-email', {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify({
                      to: email,
                      subject: `Rapport: ${selectedResponse.data.job_number || 'Intervention'}`,
                      html: `<p>Bonjour,</p><p>Veuillez trouver ci-joint le rapport d'intervention.</p>`,
                      attachments: [{filename: `Rapport.pdf`, content: pdfBase64}]
                  })
              });
              
              if(res.ok) alert("Email envoyé !");
              else alert("Erreur lors de l'envoi. Vérifiez la configuration serveur.");
          }

      } catch(e) {
          console.error(e);
          alert("Erreur lors de la génération du document.");
      } finally {
          setIsSendingEmail(false);
      }
  };

  return (
      <div className="space-y-6">
          {selectedResponse && (
             <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-3xl max-h-[90vh] flex flex-col rounded-[2.5rem] shadow-2xl relative animate-in zoom-in-95 overflow-hidden">
                    <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0">
                        <h3 className="font-black text-slate-800 uppercase tracking-tight">Aperçu du Rapport</h3>
                        <button onClick={() => setSelectedResponse(null)} className="p-2 hover:bg-slate-200 rounded-full"><X/></button>
                    </div>

                    <div id="report-print-area" className="p-10 overflow-y-auto bg-white flex-1">
                        <div className="flex justify-between items-start mb-8 pb-6 border-b border-slate-100">
                             <div>
                                <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{templates.find(t => t.id === selectedResponse.templateId)?.name}</h1>
                                <p className="text-xs font-bold text-slate-500 mt-1">Émis le {format(new Date(selectedResponse.submittedAt), 'dd/MM/yyyy à HH:mm')}</p>
                                <p className="text-xs font-bold text-slate-500">Par {users.find(u => u.id === selectedResponse.technicianId)?.name || selectedResponse.technicianId}</p>
                             </div>
                             {(appSettings.reportLogoUrl || appSettings.appLogoUrl) && (
                                 <img src={appSettings.reportLogoUrl || appSettings.appLogoUrl} className="h-20 w-auto object-contain" alt="Logo" />
                             )}
                        </div>

                        <div className="space-y-6">
                             {templates.find(t => t.id === selectedResponse.templateId)?.fields.map(field => (
                                 <div key={field.id} className="border-b border-slate-50 pb-4 last:border-0 break-inside-avoid">
                                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{field.label}</p>
                                     {field.type === 'signature' ? (
                                         selectedResponse.data[field.id] ? <img src={selectedResponse.data[field.id]} alt="Signature" className="h-16 object-contain border border-slate-200 rounded-lg" /> : <span className="text-xs italic text-slate-300">Non signé</span>
                                     ) : field.type === 'photo' ? (
                                         selectedResponse.data[field.id] ? <img src={selectedResponse.data[field.id]} alt="Photo" className="h-32 object-contain border border-slate-200 rounded-lg" /> : <span className="text-xs italic text-slate-300">Aucune photo</span>
                                     ) : field.type === 'photo_gallery' ? (
                                          <div className="flex gap-2 flex-wrap">
                                              {Array.isArray(selectedResponse.data[field.id]) && selectedResponse.data[field.id].map((img: string, i: number) => (
                                                  <img key={i} src={img} className="h-24 w-24 object-cover rounded-lg border border-slate-200" />
                                              ))}
                                              {(!selectedResponse.data[field.id] || selectedResponse.data[field.id].length === 0) && <span className="text-xs italic text-slate-300">Galerie vide</span>}
                                          </div>
                                     ) : (
                                         <p className="text-sm font-bold text-slate-800 whitespace-pre-wrap">
                                             {field.type === 'checkbox' 
                                                ? (selectedResponse.data[field.id] ? 'OUI' : 'NON') 
                                                : (selectedResponse.data[field.id]?.toString() || '-')}
                                         </p>
                                     )}
                                 </div>
                             ))}
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4 shrink-0">
                        <button onClick={() => handleAction('download')} className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-slate-700 transition-all">
                            <Printer size={16} /> Imprimer PDF
                        </button>
                        <button onClick={() => handleAction('email')} disabled={isSendingEmail} className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50">
                            {isSendingEmail ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />} Envoyer par Mail
                        </button>
                    </div>
                </div>
             </div>
          )}

          <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
             <div className="flex items-center gap-5">
                 <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200"><FileText size={28}/></div>
                 <div><h2 className="text-2xl font-black text-slate-800">Historique des Rapports</h2><p className="text-slate-500 text-sm font-medium">Consultez et téléchargez les rapports envoyés.</p></div>
             </div>
             <div className="relative">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                 <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-64" />
             </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
              <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Modèle</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Technicien</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Affaire / Info</th>
                          <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filtered.map(r => {
                          const t = templates.find(temp => temp.id === r.templateId);
                          const u = users.find(user => user.id === r.technicianId);
                          return (
                              <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-6 py-4 font-bold text-sm text-slate-800">{format(new Date(r.submittedAt), 'dd/MM/yyyy HH:mm')}</td>
                                  <td className="px-6 py-4 font-bold text-sm text-indigo-600">{t?.name || 'Inconnu'}</td>
                                  <td className="px-6 py-4 font-bold text-sm text-slate-600">{u?.name || r.technicianId}</td>
                                  <td className="px-6 py-4 text-xs font-bold text-slate-500 truncate max-w-xs">{r.data.job_number || r.data.client_name || '-'}</td>
                                  <td className="px-6 py-4 text-right">
                                      <button onClick={() => setSelectedResponse(r)} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-xl transition-all"><Eye size={18}/></button>
                                  </td>
                              </tr>
                          );
                      })}
                      {filtered.length === 0 && (
                          <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-bold">Aucun rapport trouvé.</td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
  );
};

// --- APP COMPONENT ---

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [missions, setMissions] = React.useState<Mission[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [templates, setTemplates] = React.useState<FormTemplate[]>([]);
  const [responses, setResponses] = React.useState<FormResponse[]>([]);
  const [appSettings, setAppSettings] = React.useState<AppSettings>({ appName: 'PLANIT-MOUNIER', appLogoUrl: '', customLogos: [] });
  
  const [currentWeek, setCurrentWeek] = React.useState<WeekSelection>(getCurrentWeekInfo());
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [activeTab, setActiveTab] = React.useState<'PLANNING' | 'FORMS' | 'ADMIN'>('PLANNING');
  const [managerView, setManagerView] = React.useState<'PLANNING' | 'GESTION'>('PLANNING');
  const [adminFormsView, setAdminFormsView] = React.useState<'TEMPLATES' | 'HISTORY'>('TEMPLATES');
  const [loginId, setLoginId] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');
  const [loginError, setLoginError] = React.useState('');

  // --- GLOBAL FORM STATE ---
  const [globalFormTemplate, setGlobalFormTemplate] = useState<FormTemplate | null>(null);
  const [globalFormData, setGlobalFormData] = useState<Record<string, any>>({});

  // LOGIQUE LOGOS :
  // Logo 1 : Défaut / Ancien principal
  const logo1 = appSettings.customLogos?.[0] || appSettings.appLogoUrl || DEFAULT_APP_LOGO;
  // Logo 2 : Nouveau Principal (remplace Logo 1 si présent)
  const logo2 = appSettings.customLogos?.[1];
  // Logo 3 : Secondaire (ajouté à côté)
  const logo3 = appSettings.customLogos?.[2];

  // Le logo principal affiché est Logo 2 s'il existe, sinon Logo 1
  const mainDisplayLogo = logo2 || logo1;

  // --- INITIALISATION & LISTENERS LOCAL STORAGE ---
  useEffect(() => {
    setIsLoading(true);

    // 1. Initialiser les données par défaut si la DB est vide
    const initDb = async () => {
        try {
            await seedDatabaseIfEmpty(
                [DEFAULT_ADMIN, ...INITIAL_MANAGERS, ...INITIAL_TECHNICIANS],
                DEFAULT_TEMPLATES,
                getInitialMissions()
            );
        } catch (e) {
            console.error("Erreur seeding:", e);
        }
    };
    initDb();

    // 2. Créer les listeners (abonnements aux changements locaux)
    const unsubUsers = subscribe(COLL_USERS, (data) => setUsers(data as User[]));
    const unsubMissions = subscribe(COLL_MISSIONS, (data) => setMissions(data as Mission[]));
    const unsubTemplates = subscribe(COLL_TEMPLATES, (data) => setTemplates(data as FormTemplate[]));
    const unsubResponses = subscribe(COLL_RESPONSES, (data) => setResponses(data as FormResponse[]));
    const unsubSettings = subscribe(COLL_SETTINGS, (data) => {
        const config = data.find((d: any) => d.id === 'app_config');
        if (config) setAppSettings(config as AppSettings);
        else setAppSettings({ appName: 'PLANIT-MOUNIER', appLogoUrl: '', customLogos: [] });
        
        // Tout est chargé
        setIsLoading(false);
    });

    // Cleanup au démontage
    return () => {
        unsubUsers();
        unsubMissions();
        unsubTemplates();
        unsubResponses();
        unsubSettings();
    };
  }, []);

  // --- HANDLERS ACTIONS ---

  const handleUpdateUsers = async (newUsers: User[], oldId?: string, newId?: string) => {
    // Cas modification ID : Suppression ancien doc, création nouveau
    if (oldId && newId && oldId !== newId) {
        await deleteDocument(COLL_USERS, oldId);
        
        // Mettre à jour les missions liées
        const userMissions = missions.filter(m => m.technicianId === oldId);
        const updatedMissions = userMissions.map(m => ({ ...m, technicianId: newId }));
        if (updatedMissions.length > 0) {
            await batchSaveMissions(updatedMissions);
        }
    }

    const promises = newUsers.map(u => saveDocument(COLL_USERS, u.id, u));
    await Promise.all(promises);
  };
  
  const handleSaveResponse = async (response: FormResponse) => {
      await saveDocument(COLL_RESPONSES, response.id, response);
  };

  const handleUpdateTemplates = async (newTemplates: FormTemplate[]) => {
      // Identifier les supprimés
      const currentIds = templates.map(t => t.id);
      const newIds = newTemplates.map(t => t.id);
      const toDelete = currentIds.filter(id => !newIds.includes(id));
      
      const promises = [];
      // Suppression
      for (const id of toDelete) {
          promises.push(deleteDocument(COLL_TEMPLATES, id));
      }
      // Sauvegarde/Mise à jour
      for (const t of newTemplates) {
          promises.push(saveDocument(COLL_TEMPLATES, t.id, t));
      }
      await Promise.all(promises);
  };

  const handleAppendMissions = async (newMissions: Mission[]) => {
      await batchSaveMissions(newMissions);
  };

  const updateMissions = async (m: Mission[]) => {
      await batchSaveMissions(m);
  };

  const removeMissionById = async (id: string) => {
      await deleteDocument(COLL_MISSIONS, id);
  };
  
  const updateAppSettings = async (settings: AppSettings) => {
      await saveDocument(COLL_SETTINGS, 'app_config', settings);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.id === loginId);
    if (!user || user.password !== loginPassword) { setLoginError('Identifiants incorrects.'); return; }
    setCurrentUser(user); setActiveTab('PLANNING');
  };
  
  const handleLogout = () => { setCurrentUser(null); setLoginId(''); setLoginPassword(''); setLoginError(''); };

  const handleOpenGlobalForm = (templateId: string, initialData: Record<string, any> = {}) => {
      const tpl = templates.find(t => t.id === templateId);
      if (tpl) {
          setGlobalFormTemplate(tpl);
          setGlobalFormData(initialData);
      } else {
          alert(`Le modèle (ID: ${templateId}) est introuvable.`);
      }
  };

  const renderManagerContent = () => {
      const technicians = users.filter(u => u.role === Role.TECHNICIAN);
      const managers = users.filter(u => u.role === Role.MANAGER);
      return (
        <div className="space-y-8">
            <div className="flex justify-center gap-4 print:hidden">
                <button onClick={() => setManagerView('PLANNING')} className={`px-8 py-3 rounded-xl text-[10px] font-black border-2 transition-all ${managerView === 'PLANNING' ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>PLANNING VISUEL</button>
                <button onClick={() => setManagerView('GESTION')} className={`px-8 py-3 rounded-xl text-[10px] font-black border-2 transition-all ${managerView === 'GESTION' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>GESTION DES INTERVENTIONS</button>
            </div>
            {managerView === 'PLANNING' ? (
                <ManagerDashboard 
                    user={currentUser!} 
                    missions={missions} 
                    technicians={technicians} 
                    onUpdateMissions={updateMissions} 
                    onRemoveMission={removeMissionById} 
                    responses={responses} 
                    templates={templates} 
                    onOpenForm={(templateId, data) => handleOpenGlobalForm(templateId, data)}
                />
            ) : (
                <MissionManager missions={missions} technicians={technicians} managers={managers} onUpdateMissions={updateMissions} onRemoveMission={removeMissionById} />
            )}
        </div>
      );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-6">
        <Loader2 size={64} className="animate-spin text-indigo-400" />
        <div className="text-center">
            <h1 className="text-3xl font-black uppercase tracking-tight">Chargement de l'application</h1>
            <p className="text-indigo-200/70 mt-2">Démarrage...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
     return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 text-red-800 gap-6 p-4">
        <AlertCircle size={64} className="text-red-400" />
        <div className="text-center">
            <h1 className="text-3xl font-black uppercase tracking-tight">Erreur Critique</h1>
            <p className="text-red-600 mt-2">{error}</p>
        </div>
         <button onClick={() => window.location.reload()} className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl">Réessayer</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-inter">
      {currentUser && (
        <nav className="bg-white/90 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-50 shadow-sm print:hidden">
          <div className="max-w-screen-2xl mx-auto px-4 h-20 flex justify-between items-center">
            <div className="flex items-center gap-4">
               {/* Affichage Logo 2 (Principal) */}
               <img src={mainDisplayLogo} alt="Logo" className="h-10 w-auto object-contain rounded-lg" />
               {/* Affichage Logo 3 (Secondaire) à côté */}
               {logo3 && <img src={logo3} alt="Logo Secondaire" className="h-10 w-auto object-contain rounded-lg" />}
               
              <span className="text-xl font-black text-slate-800 uppercase tracking-tighter hidden md:inline">{appSettings.appName}</span>
              <div className="flex gap-2 ml-4">
                  <button onClick={() => handleOpenGlobalForm('tpl-compte-rendu')} className="hidden md:flex px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"><FilePlus size={16}/> Compte Rendu</button>
                  <button onClick={() => handleOpenGlobalForm('tpl-mise-en-chantier')} className="hidden md:flex px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"><HardHat size={16}/> Mise en Chantier</button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => handleOpenGlobalForm('tpl-mise-en-chantier')} className="md:hidden p-2 bg-emerald-600 text-white rounded-lg"><HardHat size={20}/></button>
              <button onClick={() => handleOpenGlobalForm('tpl-compte-rendu')} className="md:hidden p-2 bg-indigo-600 text-white rounded-lg"><FilePlus size={20}/></button>
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">{currentUser.initials}</div>
                <span className="hidden md:inline text-xs font-black text-slate-800">{currentUser.name}</span>
              </div>
              <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><LogOut size={20} /></button>
            </div>
          </div>
        </nav>
      )}

      {/* --- SHARED FORM MODAL --- */}
      {globalFormTemplate && currentUser && (
          <SharedFormModal 
            user={currentUser} 
            template={globalFormTemplate} 
            users={users} 
            initialData={globalFormData}
            onClose={() => { setGlobalFormTemplate(null); setGlobalFormData({}); }} 
            onSave={(response) => { handleSaveResponse(response); setGlobalFormTemplate(null); setGlobalFormData({}); }}
          />
      )}
      
      {!currentUser ? (
        <div className="min-h-screen relative flex items-center justify-center bg-slate-900 overflow-hidden font-inter">
            {/* IMAGE DE FOND DRAGON - PLEIN ECRAN */}
             <div className="absolute inset-0 z-0">
                <img 
                   src="https://images.unsplash.com/photo-1599707367072-cd6ad66acc40?q=80&w=2000&auto=format&fit=crop" 
                   alt="Dragon Background" 
                   className="w-full h-full object-cover opacity-30 mix-blend-luminosity filter contrast-125"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900/90 to-indigo-950/80 mix-blend-multiply"></div>
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-transparent to-slate-950/80"></div>
             </div>

             {/* CONTENU CENTRAL */}
             <div className="relative z-10 w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-700">
                
                {/* Logo et Titre */}
                <div className="text-center mb-10">
                   {/* Container pillule pour les logos */}
                   <div className="inline-flex p-6 bg-white/5 backdrop-blur-xl rounded-[2rem] border border-white/10 mb-6 shadow-2xl relative group hover:scale-105 transition-transform duration-500 items-center justify-center gap-6">
                      <div className="absolute inset-0 bg-indigo-500/20 rounded-[2rem] blur-xl group-hover:bg-indigo-500/30 transition-all"></div>
                      
                      {/* Logo Principal (Logo 2 ou 1) */}
                      <img src={mainDisplayLogo} alt="Logo Principal" className="h-20 w-auto object-contain relative z-10 drop-shadow-2xl" />
                      
                      {/* Logo Secondaire (Logo 3) avec séparateur si présent */}
                      {logo3 && (
                        <>
                            <div className="h-12 w-px bg-white/20 relative z-10"></div>
                            <img src={logo3} alt="Logo Secondaire" className="h-20 w-auto object-contain relative z-10 drop-shadow-2xl" />
                        </>
                      )}
                   </div>
                   
                   <h1 className="text-5xl font-black text-white uppercase tracking-tighter mb-3 drop-shadow-lg">
                      {appSettings.appName}
                   </h1>
                   <div className="h-1 w-20 bg-gradient-to-r from-transparent via-indigo-500 to-transparent mx-auto mb-4 opacity-80"></div>
                   <p className="text-indigo-200/70 font-bold text-sm uppercase tracking-widest">PORTAIL DE GESTION DES INTERVENTIONS DE MOUNIER ELECTRICITE</p>
                </div>

                {/* Carte de Connexion */}
                <div className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] p-8 shadow-2xl border border-white/20 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>
                    
                    <h2 className="text-2xl font-black text-slate-800 mb-6 text-center uppercase tracking-tight">Connexion</h2>

                    {loginError && (
                       <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl flex items-center gap-3 animate-in slide-in-from-top-2">
                          <AlertCircle className="text-red-500 shrink-0" size={20}/>
                          <p className="text-xs font-bold text-red-700">{loginError}</p>
                       </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                       <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-3">Identifiant</label>
                          <div className="relative group">
                             <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20}/>
                             <input 
                                type="text" 
                                placeholder="ex: nom.p" 
                                value={loginId} 
                                onChange={e => setLoginId(e.target.value)} 
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-inner" 
                             />
                          </div>
                       </div>
                       
                       <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-3">Mot de passe</label>
                          <div className="relative group">
                             <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20}/>
                             <input 
                                type="password" 
                                placeholder="••••••••" 
                                value={loginPassword} 
                                onChange={e => setLoginPassword(e.target.value)} 
                                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-inner" 
                             />
                          </div>
                       </div>

                       <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-600 hover:shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2 group mt-4 transform active:scale-95 duration-200">
                          Se Connecter <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/>
                       </button>
                    </form>
                </div>
                
                <div className="mt-8 text-center opacity-60 hover:opacity-100 transition-opacity">
                   <p className="text-[9px] text-white font-black uppercase tracking-[0.2em]">© {new Date().getFullYear()} Mounier - Tous droits réservés</p>
                </div>
             </div>
        </div>
      ) : (
        <main className="max-w-screen-2xl mx-auto px-4 py-10 print:p-0 print:m-0">
          <div className="flex justify-center mb-10 gap-2 print:hidden">
             {currentUser.role === Role.TECHNICIAN && <button onClick={() => setActiveTab('PLANNING')} className={`px-6 py-3 rounded-2xl text-[11px] font-black transition-all ${activeTab === 'PLANNING' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-500 hover:bg-slate-50'}`}><Calendar size={16} className="inline mr-2"/> PLANNING</button>}
             {(currentUser.role === Role.MANAGER || currentUser.role === Role.ADMIN) && <button onClick={() => setActiveTab('PLANNING')} className={`px-6 py-3 rounded-2xl text-[11px] font-black transition-all ${activeTab === 'PLANNING' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-500 hover:bg-slate-50'}`}><Briefcase size={16} className="inline mr-2"/> PLANNING & GESTION</button>}
            <button onClick={() => setActiveTab('FORMS')} className={`px-6 py-3 rounded-2xl text-[11px] font-black transition-all ${activeTab === 'FORMS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-500 hover:bg-slate-50'}`}><ClipboardList size={16} className="inline mr-2"/> FORMULAIRES</button>
            {currentUser.role === Role.ADMIN && <button onClick={() => setActiveTab('ADMIN')} className={`px-6 py-3 rounded-2xl text-[11px] font-black transition-all ${activeTab === 'ADMIN' ? 'bg-slate-800 text-white shadow-lg shadow-slate-200' : 'bg-white text-slate-500 hover:bg-slate-50'}`}><Settings size={16} className="inline mr-2"/> ADMIN</button>}
          </div>

          {activeTab === 'PLANNING' && (
            currentUser.role === Role.TECHNICIAN ? (
              <TechnicianDashboard user={currentUser} missions={missions} week={currentWeek} onWeekChange={setCurrentWeek} onUpdateMissions={updateMissions} templates={templates} responses={responses} onSaveResponse={handleSaveResponse} onlyPlanningView />
            ) : (
                renderManagerContent()
            )
          )}
          
          {activeTab === 'FORMS' && (
            currentUser.role === Role.TECHNICIAN ? (
              <TechnicianDashboard user={currentUser} missions={missions} week={currentWeek} onWeekChange={setCurrentWeek} onUpdateMissions={updateMissions} templates={templates} responses={responses} onSaveResponse={handleSaveResponse} onlyFormsView />
            ) : currentUser.role === Role.ADMIN ? (
              <div className="space-y-8">
                 <div className="flex justify-center gap-4 print:hidden">
                    <button onClick={() => setAdminFormsView('TEMPLATES')} className={`px-8 py-3 rounded-xl text-[10px] font-black border-2 transition-all ${adminFormsView === 'TEMPLATES' ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>GESTION DES MODÈLES</button>
                    <button onClick={() => setAdminFormsView('HISTORY')} className={`px-8 py-3 rounded-xl text-[10px] font-black border-2 transition-all ${adminFormsView === 'HISTORY' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>CONSULTATION DES RAPPORTS</button>
                 </div>
                 {adminFormsView === 'TEMPLATES' ? (
                   <FormTemplateManager templates={templates} onUpdateTemplates={handleUpdateTemplates} />
                 ) : (
                   <GlobalFormsHistory responses={responses} templates={templates} users={users} appSettings={appSettings} />
                 )}
              </div>
            ) : (
               <div className="bg-white p-12 rounded-[2.5rem] border border-slate-200 text-center space-y-4 print:hidden">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><BookOpen size={32}/></div>
                  <h2 className="text-2xl font-black text-slate-800">Visualisation des Formulaires</h2>
                  <p className="text-slate-500">Utilisez le planning pour consulter les rapports remplis par vos techniciens.</p>
               </div>
            )
          )}

          {activeTab === 'ADMIN' && currentUser.role === Role.ADMIN && (
            <AdminDashboard 
              users={users} 
              onUpdateUsers={handleUpdateUsers} 
              appSettings={appSettings} 
              onUpdateAppSettings={updateAppSettings} 
              missions={missions} 
              onAppendMissions={handleAppendMissions} 
            />
          )}
        </main>
      )}
    </div>
  );
};

export default App;