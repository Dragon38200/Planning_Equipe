import React, { useCallback, useEffect, useRef, useState } from 'react';
import { User, Role, Mission, WeekSelection, AppSettings, FormTemplate, FormResponse } from './types';
import { DEFAULT_APP_LOGO, DEFAULT_ADMIN, INITIAL_MANAGERS, INITIAL_TECHNICIANS, DEFAULT_TEMPLATES } from './constants';
import { getInitialMissions } from './data';
import { getCurrentWeekInfo, exportToCSV } from './utils';
import TechnicianDashboard from './components/TechnicianDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import AdminDashboard from './components/AdminDashboard';
import MissionManager from './components/MissionManager';
import { LogOut, Factory, Calendar, ClipboardList, BookOpen, Search, Eye, FileText, CheckCircle2, X, Trash2, Plus, Printer, AlertCircle, Settings, FileSpreadsheet, Download, Briefcase, Lock, ArrowRight, User as UserIcon, Loader2, PenTool, CheckSquare, Square, Camera, FilePlus, Mail, Image as ImageIcon } from 'lucide-react';
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

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [missions, setMissions] = React.useState<Mission[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [templates, setTemplates] = React.useState<FormTemplate[]>([]);
  const [responses, setResponses] = React.useState<FormResponse[]>([]);
  const [appSettings, setAppSettings] = React.useState<AppSettings>({ appName: 'PLANIT-MOUNIER', appLogoUrl: '' });
  
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
        else setAppSettings({ appName: 'PLANIT-MOUNIER', appLogoUrl: '' });
        
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

  const handleOpenGlobalForm = () => {
      const tpl = templates.find(t => t.id === 'tpl-compte-rendu');
      if (tpl) setGlobalFormTemplate(tpl);
      else alert("Le modèle 'Compte Rendu d'Intervention' est introuvable.");
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
                <ManagerDashboard user={currentUser!} missions={missions} technicians={technicians} onUpdateMissions={updateMissions} onRemoveMission={removeMissionById} responses={responses} templates={templates} />
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
               <img src={appSettings.appLogoUrl || DEFAULT_APP_LOGO} alt="Logo" className="h-10 w-auto object-contain rounded-lg" />
              <span className="text-xl font-black text-slate-800 uppercase tracking-tighter">{appSettings.appName}</span>
              <button onClick={handleOpenGlobalForm} className="hidden md:flex ml-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"><FilePlus size={16}/> Nouveau Compte Rendu</button>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={handleOpenGlobalForm} className="md:hidden p-2 bg-indigo-600 text-white rounded-lg"><FilePlus size={20}/></button>
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
            onClose={() => setGlobalFormTemplate(null)} 
            onSave={(response) => { handleSaveResponse(response); setGlobalFormTemplate(null); }}
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
                   <div className="inline-flex p-6 bg-white/5 backdrop-blur-xl rounded-full border border-white/10 mb-6 shadow-2xl relative group hover:scale-105 transition-transform duration-500">
                      <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl group-hover:bg-indigo-500/30 transition-all"></div>
                      <img src={appSettings.appLogoUrl || DEFAULT_APP_LOGO} alt="Logo" className="h-20 w-auto object-contain relative z-10 drop-shadow-2xl" />
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

// --- SHARED FORM MODAL COMPONENT (FOR ALL USERS) ---
interface SharedFormModalProps {
    user: User;
    template: FormTemplate;
    users: User[]; // For manager lookup
    onClose: () => void;
    onSave: (response: FormResponse) => void;
}

const SharedFormModal: React.FC<SharedFormModalProps> = ({ user, template, users, onClose, onSave }) => {
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [activeSignatureFieldId, setActiveSignatureFieldId] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Auto-fill Manager Info
    useEffect(() => {
        if (template.id === 'tpl-compte-rendu' && formData['manager_id']) {
            const manager = users.find(u => u.id === formData['manager_id']);
            if (manager) {
                setFormData(prev => ({
                    ...prev,
                    manager_phone: manager.phone || 'Non renseigné',
                    manager_email: manager.email || 'Non renseigné'
                }));
            }
        }
    }, [formData['manager_id'], users, template.id]);

    const handleSave = () => {
        const errors: string[] = [];
        template.fields.forEach(f => {
            if (f.required) {
                const val = formData[f.id];
                if (f.type === 'checkbox') {
                    if (val === undefined || val === null) errors.push(f.label);
                } else if (f.type === 'photo_gallery') {
                    // Optional typically, but strict check if needed
                } else {
                    if (!val || String(val).trim() === '') errors.push(f.label);
                }
            }
        });

        if (errors.length > 0) {
            setValidationErrors(errors);
            const modalContent = document.getElementById('shared-form-modal-content');
            if (modalContent) modalContent.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setIsSubmitting(true);
        // Simulate async
        setTimeout(() => {
            const response: FormResponse = {
                id: `res-${Date.now()}`,
                templateId: template.id,
                technicianId: user.id,
                submittedAt: new Date().toISOString(),
                data: { ...formData }
            };
            onSave(response);
            setIsSubmitting(false);
        }, 500);
    };

    // Signature Logic
    const startDrawing = (e: any) => { setIsDrawing(true); const ctx = canvasRef.current?.getContext('2d'); if(ctx && canvasRef.current) { const rect = canvasRef.current.getBoundingClientRect(); ctx.beginPath(); ctx.moveTo((e.touches ? e.touches[0].clientX : e.clientX) - rect.left, (e.touches ? e.touches[0].clientY : e.clientY) - rect.top); } };
    const draw = (e: any) => { if (!isDrawing || !canvasRef.current) return; const ctx = canvasRef.current.getContext('2d'); if(ctx) { const rect = canvasRef.current.getBoundingClientRect(); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#000'; ctx.lineTo((e.touches ? e.touches[0].clientX : e.clientX) - rect.left, (e.touches ? e.touches[0].clientY : e.clientY) - rect.top); ctx.stroke(); } };
    const endDrawing = () => { setIsDrawing(false); if (canvasRef.current && activeSignatureFieldId) { setFormData(prev => ({ ...prev, [activeSignatureFieldId]: canvasRef.current!.toDataURL('image/png') })); } };
    const clearSignature = () => { const ctx = canvasRef.current?.getContext('2d'); ctx?.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height); if (activeSignatureFieldId) { setFormData(prev => { const n = {...prev}; delete n[activeSignatureFieldId]; return n; }); } };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 print:hidden">
            {activeSignatureFieldId && (
                <div className="fixed inset-0 z-[250] bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
                    <div className="p-5 bg-slate-900 text-white flex justify-between items-center"><h3 className="text-sm font-black uppercase tracking-widest">Signer</h3><button onClick={() => setActiveSignatureFieldId(null)} className="p-2 hover:bg-white/10 rounded-full"><X /></button></div>
                    <div className="p-8 space-y-6">
                        <div className="relative border-2 border-slate-200 rounded-2xl bg-slate-50 overflow-hidden h-64 touch-none"><canvas ref={canvasRef} width={500} height={300} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={endDrawing} onMouseOut={endDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={endDrawing} className="w-full h-full cursor-crosshair" /></div>
                        <div className="flex gap-4"><button onClick={clearSignature} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-[10px]">Effacer</button><button onClick={() => setActiveSignatureFieldId(null)} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px]">Valider</button></div>
                    </div>
                </div>
                </div>
            )}
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
                <div className="p-6 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3"><div className="p-2 bg-white/20 rounded-xl"><FileText size={20}/></div><h2 className="text-lg font-black uppercase tracking-tight truncate">{template.name}</h2></div>
                    <button disabled={isSubmitting} onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X /></button>
                </div>
                <div id="shared-form-modal-content" className="p-8 md:p-10 overflow-y-auto flex-1 space-y-8 scrollbar-thin bg-white">
                    {validationErrors.length > 0 && (<div className="bg-red-50 border-2 border-red-200 p-6 rounded-2xl flex items-start gap-4"><AlertCircle className="text-red-600 shrink-0" size={24} /><div><p className="text-sm font-black text-red-800 uppercase mb-1">Erreurs :</p><ul className="list-disc list-inside text-xs font-bold text-red-600">{validationErrors.map((err, i) => <li key={i}>{err}</li>)}</ul></div></div>)}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {template.fields.map(field => (
                            <div key={field.id} className={`${['textarea','signature','photo','photo_gallery'].includes(field.type) ? 'md:col-span-2' : ''} space-y-2`}>
                                <label className={`text-[10px] font-black uppercase tracking-widest px-1 ${validationErrors.includes(field.label) ? 'text-red-500' : 'text-slate-400'}`}>{field.label} {field.required && '*'}</label>
                                {field.type === 'signature' ? (
                                    <div onClick={() => !isSubmitting && setActiveSignatureFieldId(field.id)} className={`relative h-32 border-2 border-dashed rounded-2xl bg-slate-50 flex items-center justify-center cursor-pointer ${formData[field.id] ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200'}`}>{formData[field.id] ? <img src={formData[field.id]} alt="Signed" className="h-full object-contain grayscale" /> : <div className="text-slate-400 flex flex-col items-center gap-1 font-black text-[9px] uppercase"><PenTool size={20}/><p>Signer</p></div>}</div>
                                ) : field.type === 'photo' ? (
                                    <label className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer bg-slate-50 hover:bg-indigo-50/50 ${formData[field.id] ? 'border-emerald-500' : 'border-slate-200'}`}>
                                        {formData[field.id] ? <div className="relative w-full h-full p-2"><img src={formData[field.id]} className="w-full h-full object-contain rounded-xl" alt="Preview"/><button onClick={(e)=>{e.preventDefault(); setFormData(p=>({...p,[field.id]:null}))}} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"><X size={12}/></button></div> : <div className="flex flex-col items-center justify-center"><Camera className="w-8 h-8 mb-2 text-slate-400" /><p className="text-xs text-slate-500 font-bold">Prendre une photo</p></div>}
                                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onloadend = () => setFormData(p => ({...p, [field.id]: r.result})); r.readAsDataURL(f); }}} />
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
                                ) : field.type === 'select' ? (
                                    <select disabled={isSubmitting || field.readOnly} value={formData[field.id] || ''} onChange={e => setFormData(p => ({...p, [field.id]: e.target.value}))} className="w-full p-5 bg-slate-50 border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-800">
                                        <option value="">Sélectionner...</option>
                                        {/* Logic specific for Manager selection */}
                                        {field.id === 'manager_id' 
                                            ? users.filter(u => u.role === Role.MANAGER).map(u => <option key={u.id} value={u.id}>{u.name}</option>)
                                            : field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)
                                        }
                                    </select>
                                ) : field.type === 'textarea' ? (
                                    <textarea disabled={isSubmitting || field.readOnly} value={formData[field.id] || ''} onChange={e => setFormData(p => ({...p, [field.id]: e.target.value}))} className="w-full p-5 bg-slate-50 border-2 border-slate-200 rounded-2xl min-h-[140px] outline-none focus:border-indigo-500 font-bold text-slate-800" />
                                ) : (
                                    <input disabled={isSubmitting || field.readOnly} type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'} step={field.type === 'number' ? '0.5' : undefined} value={formData[field.id] || ''} onChange={e => setFormData(p => ({...p, [field.id]: e.target.value}))} className={`w-full p-5 bg-slate-50 border-2 rounded-2xl outline-none focus:border-indigo-500 font-bold text-slate-800 ${field.readOnly ? 'bg-slate-100 text-slate-500' : 'border-slate-200'}`} />
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="pt-8"><button type="button" disabled={isSubmitting} onClick={handleSave} className="w-full py-6 rounded-3xl font-black uppercase tracking-widest text-sm shadow-2xl bg-slate-900 text-white hover:bg-emerald-600 flex items-center justify-center gap-3">{isSubmitting ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} ENVOYER LE RAPPORT</button></div>
                </div>
            </div>
        </div>
    );
};

const FormTemplateManager: React.FC<{ templates: FormTemplate[], onUpdateTemplates: (t: FormTemplate[]) => void }> = ({ templates, onUpdateTemplates }) => {
  const [editingTemplate, setEditingTemplate] = React.useState<Partial<FormTemplate> | null>(null);
  const [previewingTemplate, setPreviewingTemplate] = React.useState<FormTemplate | null>(null);

  const handleAddTemplate = () => setEditingTemplate({ id: `tpl-${Date.now()}`, name: 'Nouveau Formulaire', fields: [], description: '' });
  const handleAddField = () => { if (editingTemplate) setEditingTemplate({ ...editingTemplate, fields: [...(editingTemplate.fields || []), { id: `f-${Date.now()}`, label: 'Nouveau Champ', type: 'text', required: false }] }); };
  const handleSave = () => {
    if (!editingTemplate?.name) return;
    const fullTemplate = { ...editingTemplate, createdAt: editingTemplate.createdAt || new Date().toISOString() } as FormTemplate;
    onUpdateTemplates([...templates.filter(t => t.id !== fullTemplate.id), fullTemplate]);
    setEditingTemplate(null);
  };

  return (
    <div className="space-y-6">
       {previewingTemplate && (
         <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
             <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
               <div className="flex items-center gap-3"><div className="p-2 bg-white/20 rounded-xl"><Eye size={20}/></div><h2 className="text-lg font-black uppercase tracking-tight truncate">Aperçu : {previewingTemplate.name}</h2></div>
               <button onClick={() => setPreviewingTemplate(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X /></button>
             </div>
             <div className="p-10 overflow-y-auto flex-1 space-y-6 scrollbar-thin">
                {previewingTemplate.fields.map(field => (
                  <div key={field.id} className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest px-1 text-slate-400">{field.label} {field.required && <span className="text-red-500">*</span>}</label>
                    { field.type === 'textarea' ? <div className="w-full p-5 bg-slate-50 border-2 rounded-2xl min-h-[120px] border-slate-200"></div>
                    : field.type === 'signature' ? <div className="w-full p-5 h-32 bg-slate-50 border-2 border-dashed rounded-2xl border-slate-200"></div>
                    : (field.type === 'photo' || field.type === 'photo_gallery') ? <div className="w-full p-5 h-32 bg-slate-50 border-2 border-dashed rounded-2xl border-slate-200 flex items-center justify-center"><Camera className="text-slate-300"/></div>
                    : field.type === 'checkbox' ? <div className="w-full p-5 bg-slate-50 border-2 rounded-2xl border-slate-200 font-bold text-slate-400">NON</div>
                    : <div className="w-full p-5 bg-slate-50 border-2 rounded-2xl border-slate-200"></div> }
                  </div>
                ))}
             </div>
             <button onClick={() => setPreviewingTemplate(null)} className="m-8 py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800">Fermer</button>
           </div>
         </div>
       )}
      <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="flex items-center gap-5"><div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200"><ClipboardList size={28}/></div><div><h2 className="text-2xl font-black text-slate-800">Gestion des Formulaires</h2><p className="text-slate-500 text-sm font-medium">Définissez les documents techniques pour le terrain.</p></div></div>
        <button onClick={handleAddTemplate} className="px-8 py-4 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-slate-700 transition-all">+ Créer un modèle</button>
      </div>
      {editingTemplate ? (
        <div className="bg-white p-10 rounded-[2.5rem] border-2 border-blue-500 shadow-2xl animate-in fade-in zoom-in-95">
          <div className="flex justify-between mb-8 pb-4 border-b"><h3 className="text-xl font-black text-slate-800">Configuration du modèle</h3><button onClick={() => setEditingTemplate(null)} className="text-slate-400 hover:text-red-500"><X /></button></div>
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nom du document</label><input type="text" value={editingTemplate.name || ''} onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" /></div><div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Description</label><input type="text" value={editingTemplate.description || ''} onChange={e => setEditingTemplate({...editingTemplate, description: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none" /></div></div>
            <div className="space-y-4">
              <div className="flex items-center justify-between"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Champs du formulaire</h4><button onClick={handleAddField} className="text-xs font-black text-blue-600 hover:underline">+ Ajouter un champ</button></div>
              <div className="space-y-3">
                {editingTemplate.fields?.map((field, idx) => (<div key={field.id} className="flex flex-col md:flex-row gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200 items-center group">
                    <input type="text" value={field.label} onChange={e => { const newFields = [...editingTemplate.fields!]; newFields[idx].label = e.target.value; setEditingTemplate({...editingTemplate, fields: newFields}); }} className="flex-1 p-3 bg-white border rounded-xl text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                    <select value={field.type} onChange={e => { const newFields = [...editingTemplate.fields!]; newFields[idx].type = e.target.value as any; setEditingTemplate({...editingTemplate, fields: newFields}); }} className="w-full md:w-auto p-3 bg-white border rounded-xl text-xs font-black focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"><option value="text">Texte Court</option><option value="textarea">Zone de texte</option><option value="number">Nombre</option><option value="checkbox">Case à cocher (Oui/Non)</option><option value="date">Date</option><option value="signature">Zone de Signature</option><option value="email">Email</option><option value="photo">Photo (Unique)</option><option value="photo_gallery">Galerie Photos (Max 10)</option><option value="select">Liste Déroulante</option></select>
                    {field.type === 'select' && <input type="text" placeholder="Options (séparées par virgule)" value={field.options?.join(',') || ''} onChange={e => { const newFields = [...editingTemplate.fields!]; newFields[idx].options = e.target.value.split(',').map(s=>s.trim()); setEditingTemplate({...editingTemplate, fields: newFields}); }} className="w-40 p-3 bg-white border rounded-xl text-xs font-black focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />}
                    <div className="flex items-center gap-2"><input type="checkbox" checked={field.readOnly} onChange={e => { const newFields = [...editingTemplate.fields!]; newFields[idx].readOnly = e.target.checked; setEditingTemplate({...editingTemplate, fields: newFields}); }} /><span className="text-[10px] uppercase font-black text-slate-400">Lecture seule</span></div>
                    <button onClick={() => { const newFields = editingTemplate.fields!.filter(f => f.id !== field.id); setEditingTemplate({...editingTemplate, fields: newFields}); }} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={20}/></button>
                </div>))}
              </div>
            </div>
            <div className="flex gap-4 pt-4"><button onClick={handleSave} className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all">ENREGISTRER LE MODELE</button><button onClick={() => setEditingTemplate(null)} className="px-10 py-5 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase">Annuler</button></div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(t => (<div key={t.id} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:border-blue-500 transition-all group flex flex-col h-full"><div className="flex justify-between items-start mb-6"><div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all"><ClipboardList size={28}/></div><div className="px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black text-slate-500 uppercase">{t.fields.length} champs</div></div><h3 className="text-xl font-black text-slate-800 tracking-tight">{t.name}</h3><p className="text-xs text-slate-400 mt-2 font-medium flex-1">{t.description || 'Pas de description.'}</p><div className="flex gap-2 mt-8"><button onClick={() => setPreviewingTemplate(t)} className="p-3 text-slate-400 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-xl transition-all"><Eye size={18}/></button><button onClick={() => setEditingTemplate(t)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-black hover:bg-blue-600 hover:text-white transition-all uppercase tracking-widest">Modifier</button><button onClick={() => { if(confirm("Supprimer?")) onUpdateTemplates(templates.filter(temp => temp.id !== t.id)); }} className="p-3 text-red-500 bg-red-50 hover:bg-red-600 hover:text-white rounded-xl transition-all"><Trash2 size={18}/></button></div></div>))}
          <button onClick={handleAddTemplate} className="bg-slate-50 border-2 border-dashed border-slate-200 p-8 rounded-[2rem] flex flex-col items-center justify-center gap-4 text-slate-400 hover:border-blue-500 transition-all min-h-[240px]"><Plus size={32}/><span className="font-black text-xs uppercase tracking-widest">Nouveau modèle</span></button>
        </div>
      )}
    </div>
  );
};

const GlobalFormsHistory: React.FC<{ responses: FormResponse[], templates: FormTemplate[], users: User[], appSettings: AppSettings }> = ({ responses, templates, users, appSettings }) => {
  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null);
  const [search, setSearch] = useState('');

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

  // Placeholder PDF generation
  const generatePDF = async (response: FormResponse) => {
      alert("Fonctionnalité de téléchargement PDF à implémenter.");
  };

  return (
      <div className="space-y-6">
          {selectedResponse && (
             <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] p-8 relative animate-in zoom-in-95">
                    <button onClick={() => setSelectedResponse(null)} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-full"><X/></button>
                    <h2 className="text-2xl font-black text-slate-800 mb-6 uppercase">Détails du rapport</h2>
                    <div className="space-y-4">
                         {templates.find(t => t.id === selectedResponse.templateId)?.fields.map(field => (
                             <div key={field.id} className="border-b border-slate-100 pb-2">
                                 <p className="text-[10px] font-black text-slate-400 uppercase">{field.label}</p>
                                 {field.type === 'signature' || field.type === 'photo' ? (
                                     selectedResponse.data[field.id] ? <img src={selectedResponse.data[field.id]} alt={field.label} className="h-20 object-contain rounded-lg border border-slate-200" /> : <span className="text-xs italic text-slate-400">Non renseigné</span>
                                 ) : field.type === 'photo_gallery' ? (
                                      <div className="flex gap-2 flex-wrap">
                                          {Array.isArray(selectedResponse.data[field.id]) && selectedResponse.data[field.id].map((img: string, i: number) => (
                                              <img key={i} src={img} className="h-20 w-20 object-cover rounded-lg border border-slate-200" />
                                          ))}
                                      </div>
                                 ) : (
                                     <p className="text-sm font-bold text-slate-800">
                                         {field.type === 'checkbox' 
                                            ? (selectedResponse.data[field.id] ? 'OUI' : 'NON') 
                                            : (selectedResponse.data[field.id]?.toString() || '-')}
                                     </p>
                                 )}
                             </div>
                         ))}
                    </div>
                    <div className="mt-8 pt-6 border-t flex gap-4">
                        <button onClick={() => generatePDF(selectedResponse)} className="flex-1 py-4 bg-slate-900 text-white rounded-xl font-black uppercase text-xs">Télécharger PDF</button>
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

export default App;
