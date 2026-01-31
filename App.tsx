

import React, { useState, useEffect, useRef } from 'react';
import { User, Role, Mission, WeekSelection, AppSettings, FormTemplate, FormResponse } from './types';
import { INITIAL_MANAGERS, INITIAL_TECHNICIANS, DEFAULT_ADMIN, DEFAULT_TEMPLATES } from './constants';
import { getCurrentWeekInfo, exportToCSV } from './utils';
import TechnicianDashboard from './components/TechnicianDashboard';
import ManagerDashboard from './components/ManagerDashboard';
import AdminDashboard from './components/AdminDashboard';
import { LogOut, Factory, Calendar, ClipboardList, BookOpen, Search, Eye, FileText, CheckCircle2, X, Trash2, Plus, Printer, AlertCircle, Settings, FileSpreadsheet, Download } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [currentWeek, setCurrentWeek] = useState<WeekSelection>(getCurrentWeekInfo());
  const [appSettings, setAppSettings] = useState<AppSettings>({ appName: 'PLANIT-MOUNIER', appLogoUrl: '' });

  const [activeTab, setActiveTab] = useState<'PLANNING' | 'FORMS' | 'ADMIN'>('PLANNING');
  const [adminFormsView, setAdminFormsView] = useState<'TEMPLATES' | 'HISTORY'>('TEMPLATES');
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const isRestoring = useRef(false);

  useEffect(() => {
    try {
      const savedMissions = localStorage.getItem('plantit_missions');
      if (savedMissions) setMissions(JSON.parse(savedMissions));
      const savedUsers = localStorage.getItem('plantit_users');
      if (savedUsers) setUsers(JSON.parse(savedUsers));
      else {
        const initialUsers = [DEFAULT_ADMIN, ...INITIAL_MANAGERS, ...INITIAL_TECHNICIANS];
        setUsers(initialUsers); localStorage.setItem('plantit_users', JSON.stringify(initialUsers));
      }
      const savedTemplates = localStorage.getItem('plantit_templates');
      if (savedTemplates && JSON.parse(savedTemplates).length > 0) setTemplates(JSON.parse(savedTemplates));
      else { setTemplates(DEFAULT_TEMPLATES); localStorage.setItem('plantit_templates', JSON.stringify(DEFAULT_TEMPLATES)); }
      const savedResponses = localStorage.getItem('plantit_responses');
      if (savedResponses) setResponses(JSON.parse(savedResponses));
      const savedSettings = localStorage.getItem('plantit_settings');
      if (savedSettings) setAppSettings(JSON.parse(savedSettings));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { if (!isRestoring.current) localStorage.setItem('plantit_missions', JSON.stringify(missions)); }, [missions]);
  useEffect(() => { localStorage.setItem('plantit_templates', JSON.stringify(templates)); }, [templates]);
  useEffect(() => { localStorage.setItem('plantit_responses', JSON.stringify(responses)); }, [responses]);

  const handleUpdateUsers = (newUsers: User[]) => { setUsers(newUsers); localStorage.setItem('plantit_users', JSON.stringify(newUsers)); };
  const handleSaveResponse = (response: FormResponse) => { setResponses(prev => [...prev.filter(r => r.id !== response.id), response]); };
  const handleUpdateTemplates = (newTemplates: FormTemplate[]) => setTemplates(newTemplates);
  
  const handleRestoreDatabase = (data: { missions: Mission[], users: User[], settings: AppSettings }) => {
    setMissions(data.missions);
    setUsers(data.users);
    setAppSettings(data.settings);
  };
  
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.id === loginId);
    if (!user || user.password !== loginPassword) { setLoginError('Identifiants incorrects.'); return; }
    setCurrentUser(user); setActiveTab('PLANNING');
  };
  
  const handleLogout = () => { setCurrentUser(null); setLoginId(''); };
  const updateMissions = (m: Mission[]) => { const ids = new Set(m.map(mi => mi.id)); setMissions(prev => [...prev.filter(mi => !ids.has(mi.id)), ...m]); };
  const removeMissionById = (id: string) => setMissions(prev => prev.filter(m => m.id !== id));

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-white/90 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-50 shadow-sm print:hidden">
        <div className="max-w-screen-2xl mx-auto px-4 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="bg-slate-800 text-white p-2 rounded-xl"><Factory size={24} /></div>
            <span className="text-xl font-black text-slate-800 uppercase tracking-tighter">{appSettings.appName}</span>
          </div>
          <div className="flex items-center gap-4">
            {currentUser && (
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black">{currentUser.initials}</div>
                <span className="hidden md:inline text-xs font-black text-slate-800">{currentUser.name}</span>
              </div>
            )}
            {currentUser && <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><LogOut size={20} /></button>}
          </div>
        </div>
      </nav>
      
      {!currentUser ? (
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
          <form onSubmit={handleLogin} className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-200 w-full max-w-md space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">Accès Plani-Mounier</h1>
              <p className="text-slate-400 font-medium">Connectez-vous à votre espace.</p>
            </div>
            {loginError && <p className="text-red-500 text-sm font-bold bg-red-50 p-4 rounded-2xl text-center border border-red-100">{loginError}</p>}
            <div className="space-y-4">
              <input type="text" placeholder="Identifiant" value={loginId} onChange={e => setLoginId(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold transition-all" />
              <input type="password" placeholder="Mot de passe" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold transition-all" />
            </div>
            <button className="w-full py-5 bg-slate-800 text-white rounded-2xl font-black hover:bg-slate-700 transition-all shadow-xl shadow-slate-200">SE CONNECTER</button>
          </form>
        </div>
      ) : (
        <main className="max-w-screen-2xl mx-auto px-4 py-10 print:p-0 print:m-0">
          <div className="flex justify-center mb-10 gap-2 print:hidden">
            <button onClick={() => setActiveTab('PLANNING')} className={`px-6 py-3 rounded-2xl text-[11px] font-black transition-all ${activeTab === 'PLANNING' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-500 hover:bg-slate-50'}`}><Calendar size={16} className="inline mr-2"/> PLANNING</button>
            <button onClick={() => setActiveTab('FORMS')} className={`px-6 py-3 rounded-2xl text-[11px] font-black transition-all ${activeTab === 'FORMS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-500 hover:bg-slate-50'}`}><ClipboardList size={16} className="inline mr-2"/> FORMULAIRES</button>
            {currentUser.role === Role.ADMIN && <button onClick={() => setActiveTab('ADMIN')} className={`px-6 py-3 rounded-2xl text-[11px] font-black transition-all ${activeTab === 'ADMIN' ? 'bg-slate-800 text-white shadow-lg shadow-slate-200' : 'bg-white text-slate-500 hover:bg-slate-50'}`}><Settings size={16} className="inline mr-2"/> ADMIN</button>}
          </div>

          {activeTab === 'PLANNING' && (
            currentUser.role === Role.TECHNICIAN ? (
              <TechnicianDashboard user={currentUser} missions={missions} week={currentWeek} onWeekChange={setCurrentWeek} onUpdateMissions={updateMissions} templates={templates} responses={responses} onSaveResponse={handleSaveResponse} onlyPlanningView />
            ) : (
              <ManagerDashboard user={currentUser} missions={missions} technicians={users.filter(u => u.role === Role.TECHNICIAN)} onUpdateMissions={updateMissions} onRemoveMission={removeMissionById} responses={responses} templates={templates} />
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
                   <GlobalFormsHistory responses={responses} templates={templates} technicians={users.filter(u => u.role === Role.TECHNICIAN)} />
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
              onUpdateAppSettings={setAppSettings} 
              missions={missions} 
              onRestoreDatabase={handleRestoreDatabase} 
            />
          )}
        </main>
      )}
    </div>
  );
};

const GlobalFormsHistory: React.FC<{ responses: FormResponse[], templates: FormTemplate[], technicians: User[] }> = ({ responses, templates, technicians }) => {
  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const sortedResponses = [...responses].sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  // --- LOGIQUE D'IMPRESSION (V3 - NOUVELLE FENÊTRE) ---
  const handlePrint = () => {
    const reportElement = document.getElementById('printable-report');
    if (!reportElement) return;

    const printWindow = window.open('', '_blank', 'height=800,width=800');
    if (!printWindow) { alert("Le navigateur a bloqué l'ouverture de la fenêtre d'impression."); return; }
    
    printWindow.document.write('<html><head><title>Impression PV de Réception</title>');
    printWindow.document.write('<script src="https://cdn.tailwindcss.com"><\/script>');
    printWindow.document.write('<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">');
    printWindow.document.write('<style>body { font-family: "Inter", sans-serif; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } @page { size: A4; margin: 15mm; }</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(reportElement.innerHTML);
    printWindow.document.write('<script>setTimeout(() => { window.print(); window.close(); }, 500);</script>');
    printWindow.document.write('</body></html>');
    printWindow.document.close();
  };
  
  const handleExportResponseCSV = () => {
    if (!selectedResponse) return;
    const template = templates.find(t => t.id === selectedResponse.templateId);
    if (!template) { alert("Modèle de formulaire introuvable."); return; }

    const rowData: Record<string, any> = {
      'ID_Rapport': selectedResponse.id,
      'Date_Soumission': format(new Date(selectedResponse.submittedAt), 'yyyy-MM-dd HH:mm'),
      'Technicien_ID': selectedResponse.technicianId,
    };

    template.fields.forEach(field => {
        let value = selectedResponse.data[field.id];
        if (field.type === 'checkbox') {
            if (field.id === 'acceptance_type') value = value ? 'SANS RÉSERVE' : 'AVEC RÉSERVE(S)';
            else value = value ? 'OUI' : 'NON';
        } else if (field.type === 'signature') {
            value = value ? '[SIGNATURE FOURNIE]' : '[NON SIGNÉ]';
        }
        const headerKey = field.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_]/g, '').replace(/\s+/g, '_');
        rowData[headerKey] = value || '';
    });
    
    exportToCSV([rowData], `PV_AFFAIRE_${selectedResponse.data.job_number || selectedResponse.id.slice(-4)}.csv`);
  };

  const handleBulkExportCSV = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) { alert("Modèle introuvable."); return; }

    const relevantResponses = responses.filter(r => r.templateId === templateId);
    if (relevantResponses.length === 0) {
        alert(`Aucun rapport de type "${template.name}" à exporter.`);
        setIsExporting(false);
        return;
    }

    const csvData = relevantResponses.map(response => {
        const rowData: Record<string, any> = {
            'ID_Rapport': response.id,
            'Date_Soumission': format(new Date(response.submittedAt), 'yyyy-MM-dd HH:mm'),
            'Technicien_ID': response.technicianId,
            'Nom_Technicien': technicians.find(t => t.id === response.technicianId)?.name || '',
        };

        template.fields.forEach(field => {
            let value = response.data[field.id];
            if (field.type === 'checkbox') {
                if (field.id === 'acceptance_type') value = value ? 'SANS RÉSERVE' : 'AVEC RÉSERVE(S)';
                else value = value ? 'OUI' : 'NON';
            } else if (field.type === 'signature') {
                value = value ? '[SIGNATURE FOURNIE]' : '[NON SIGNÉ]';
            }
            const headerKey = field.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_]/g, '').replace(/\s+/g, '_');
            rowData[headerKey] = value || '';
        });

        return rowData;
    });
    
    const safeTemplateName = template.name.replace(/[^a-zA-Z0-9]/g, '_');
    exportToCSV(csvData, `EXPORT_${safeTemplateName}_${new Date().toISOString().split('T')[0]}.csv`);
    setIsExporting(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Modale d'Export en masse */}
      {isExporting && (
        <div className="fixed inset-0 z-[250] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
                <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl"><FileSpreadsheet size={20}/></div>
                        <h2 className="text-lg font-black uppercase tracking-tight">Exporter les rapports</h2>
                    </div>
                    <button onClick={() => setIsExporting(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X /></button>
                </div>
                <div className="p-8 space-y-4">
                    <p className="text-sm text-slate-600 font-medium text-center pb-2">Sélectionnez le type de rapport à exporter en masse :</p>
                    {templates.map(template => (
                        <button 
                            key={template.id} 
                            onClick={() => handleBulkExportCSV(template.id)}
                            className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl hover:border-emerald-600 flex items-center justify-between transition-all group"
                        >
                            <div className="flex items-center gap-4 text-left">
                                <div className="p-3 bg-white rounded-2xl text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all"><FileText /></div>
                                <div>
                                    <p className="font-black text-slate-800 uppercase text-xs">{template.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">{template.description}</p>
                                </div>
                            </div>
                            <Download className="text-slate-400 group-hover:text-emerald-600" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* Modale de visualisation de rapport unique */}
      {selectedResponse && (
        <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
               <div className="flex items-center gap-4">
                  <div className="bg-blue-500 p-2.5 rounded-2xl text-white shadow-xl shadow-blue-500/20"><FileText size={20}/></div>
                  <div><h2 className="text-lg font-black uppercase tracking-tight">Visualisation Rapport</h2><p className="text-[9px] font-black opacity-60 uppercase tracking-widest">Technicien: {technicians.find(t => t.id === selectedResponse.technicianId)?.name || 'N/A'}</p></div>
               </div>
               <div className="flex items-center gap-3">
                  <button onClick={handleExportResponseCSV} className="px-5 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black flex items-center gap-2 uppercase hover:bg-emerald-700 transition-all shadow-lg active:scale-95"><FileSpreadsheet size={16}/> EXPORTER CSV</button>
                  <button onClick={handlePrint} className="px-5 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black flex items-center gap-2 uppercase hover:bg-indigo-700 transition-all shadow-lg active:scale-95"><Printer size={16}/> IMPRIMER PDF</button>
                  <button onClick={() => setSelectedResponse(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X /></button>
               </div>
            </div>

            {/* --- ZONE DU RAPPORT PROFESSIONNEL --- */}
            <div id="printable-report" className="p-12 overflow-y-auto flex-1 space-y-12 scrollbar-thin bg-white">
               <div className="flex justify-between items-start border-b-2 border-slate-900 pb-8">
                  <div className="flex items-center gap-6">
                      <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMWUyOTNiIiBzdHJva2Utd2lkdGg9IjgiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTE1IDg1IEwxNSAxNSBMNTAgNjAgTDg1IDE1IEw4NSA4NSIgLz48L2c+PC9zdmc+" alt="Logo Mounier" className="h-16 w-16" />
                      <div>
                         <h1 className="text-3xl font-black text-slate-900 uppercase leading-none mb-1">MOUNIER</h1>
                         <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">CLIMATISATION - ELECTRICITE - PROCEDES INDUSTRIELS</p>
                         <p className="text-[9px] text-slate-400 font-bold">27 Avenue ZAC de Chassagne - 69360 TERNAY</p>
                      </div>
                  </div>
                  <div className="text-right">
                     <p className="text-2xl font-black text-indigo-600 uppercase tracking-tighter">PV de Réception</p>
                     <p className="text-xs font-black text-slate-800">N° {selectedResponse.id.slice(-6).toUpperCase()}</p>
                     <p className="text-xs font-black text-slate-800 uppercase tracking-tighter">Date : {format(new Date(selectedResponse.submittedAt), 'dd/MM/yyyy')}</p>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-8">
                  <div className="col-span-2 p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Identification du chantier</p>
                     <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                        <div><p className="text-[8px] font-black text-slate-400 uppercase">CLIENT</p><p className="text-sm font-black text-slate-900">{selectedResponse.data.client_name || '-'}</p></div>
                        <div><p className="text-[8px] font-black text-slate-400 uppercase">N° COMMANDE</p><p className="text-sm font-black text-slate-900">{selectedResponse.data.cmd_number || '-'}</p></div>
                        <div><p className="text-[8px] font-black text-slate-400 uppercase">N° D'AFFAIRE</p><p className="text-sm font-black text-slate-900">{selectedResponse.data.job_number || '-'}</p></div>
                        <div><p className="text-[8px] font-black text-slate-400 uppercase">LIBELLÉ</p><p className="text-sm font-black text-slate-900">{selectedResponse.data.job_label || '-'}</p></div>
                     </div>
                  </div>
                  <div className="col-span-2 p-6 border-2 border-slate-100 rounded-[2rem] flex items-center gap-6">
                     <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-xl shadow-lg ${selectedResponse.data.acceptance_type ? 'bg-emerald-500 shadow-emerald-100' : 'bg-red-500 shadow-red-100'}`}>{selectedResponse.data.acceptance_type ? '✔' : '!'}</div>
                     <div>
                        <p className="text-lg font-black text-slate-900 uppercase leading-none mb-1">{selectedResponse.data.acceptance_type ? "Travaux acceptés sans réserve" : "Travaux acceptés avec réserve(s)"}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date d'effet : {selectedResponse.data.date_effet || '-'}</p>
                     </div>
                  </div>
                  {!selectedResponse.data.acceptance_type && (<div className="col-span-2 space-y-2"><p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Détail des réserves</p><div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] min-h-[100px] text-xs font-medium text-slate-700 whitespace-pre-wrap">{selectedResponse.data.reserves_list || 'Aucune réserve mentionnée.'}</div></div>)}
                  <div className="col-span-1 space-y-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Entrepreneur (Mounier)</p><div className="relative h-44 border-2 border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center justify-center bg-slate-50/50 overflow-hidden">{selectedResponse.data.sig_entrepreneur && <img src={selectedResponse.data.sig_entrepreneur} alt="Signature Mounier" className="max-h-full max-w-full object-contain mix-blend-multiply" />}<p className="absolute bottom-4 text-[9px] font-black text-slate-400 uppercase">{selectedResponse.data.rep_mounier || '-'}</p></div></div>
                  <div className="col-span-1 space-y-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Client</p><div className="relative h-44 border-2 border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center justify-center bg-slate-50/50 overflow-hidden">{selectedResponse.data.sig_client && <img src={selectedResponse.data.sig_client} alt="Signature Client" className="max-h-full max-w-full object-contain mix-blend-multiply" />}<p className="absolute bottom-4 text-[9px] font-black text-slate-400 uppercase">{selectedResponse.data.rep_client || '-'}</p></div></div>
               </div>
               <div className="mt-12 pt-8 border-t border-slate-100 text-center"><p className="text-[8px] text-slate-300 font-black uppercase tracking-[0.3em]">Document généré électroniquement par Plani-Mounier © {new Date().getFullYear()}</p></div>
            </div>
            <button onClick={() => setSelectedResponse(null)} className="m-8 py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800">Fermer la vue</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
        <div className="p-8 border-b bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-100"><Search size={24}/></div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Historique des Rapports</h2>
            </div>
            <button onClick={() => setIsExporting(true)} className="px-5 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black flex items-center gap-2 uppercase hover:bg-emerald-700 transition-all shadow-lg active:scale-95">
                <FileSpreadsheet size={16}/> EXPORTER TOUT (CSV)
            </button>
        </div>
        <div className="divide-y divide-slate-100">
           {sortedResponses.map(r => {
                const tech = technicians.find(tec => tec.id === r.technicianId);
                return (<div key={r.id} className="p-6 flex items-center justify-between group hover:bg-slate-50/50 transition-all"><div className="flex items-center gap-6"><div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${r.data.acceptance_type ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{r.data.acceptance_type ? <CheckCircle2 size={24}/> : <AlertCircle size={24}/>}</div><div><div className="flex items-center gap-2 mb-1"><p className="font-black text-slate-800 text-sm uppercase">PV DE RÉCEPTION • AF-{r.data.job_number || 'N/A'}</p>{r.data.client_name && <span className="px-2 py-0.5 bg-slate-100 rounded-md text-[9px] font-black text-slate-400 uppercase tracking-tighter">{r.data.client_name}</span>}</div><p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Le {format(new Date(r.submittedAt), 'Pp', {locale: fr})} par {tech?.name || r.technicianId}</p></div></div><button onClick={() => setSelectedResponse(r)} className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all flex items-center gap-2 shadow-sm"><Eye size={16}/> Consulter / Imprimer</button></div>);
           })}
        </div>
      </div>
    </div>
  );
};

const FormTemplateManager: React.FC<{ templates: FormTemplate[], onUpdateTemplates: (t: FormTemplate[]) => void }> = ({ templates, onUpdateTemplates }) => {
  const [editingTemplate, setEditingTemplate] = useState<Partial<FormTemplate> | null>(null);
  const [previewingTemplate, setPreviewingTemplate] = useState<FormTemplate | null>(null);

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
                {editingTemplate.fields?.map((field, idx) => (<div key={field.id} className="flex flex-col md:flex-row gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200 items-center group"><input type="text" value={field.label} onChange={e => { const newFields = [...editingTemplate.fields!]; newFields[idx].label = e.target.value; setEditingTemplate({...editingTemplate, fields: newFields}); }} className="flex-1 p-3 bg-white border rounded-xl text-sm font-black focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" /><select value={field.type} onChange={e => { const newFields = [...editingTemplate.fields!]; newFields[idx].type = e.target.value as any; setEditingTemplate({...editingTemplate, fields: newFields}); }} className="w-full md:w-auto p-3 bg-white border rounded-xl text-xs font-black focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"><option value="text">Texte Court</option><option value="textarea">Zone de texte</option><option value="number">Nombre</option><option value="checkbox">Case à cocher (Oui/Non)</option><option value="date">Date</option><option value="signature">Zone de Signature</option></select><button onClick={() => { const newFields = editingTemplate.fields!.filter(f => f.id !== field.id); setEditingTemplate({...editingTemplate, fields: newFields}); }} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={20}/></button></div>))}
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

export default App;