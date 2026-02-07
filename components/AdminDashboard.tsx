import React, { useState, useRef, useEffect } from 'react';
import { User, Role, AppSettings, Mission, MissionType, MissionStatus, FormField } from '../types';
import { exportToCSV, parseCSV, normalizeString } from '../utils';
import { 
  UserPlus, Trash2, Edit2, Settings, X, 
  ImageIcon, LayoutTemplate, Download, Upload, Database, 
  Trash, FileSpreadsheet, Contact, 
  AlertTriangle, Loader2, CheckCircle2, Save, FileText
} from 'lucide-react';

interface Props {
  users: User[];
  onUpdateUsers: (users: User[], oldId?: string, newId?: string) => void;
  appSettings: AppSettings;
  onUpdateAppSettings: (settings: AppSettings) => void;
  missions: Mission[];
  onAppendMissions: (newMissions: Mission[]) => void;
}

const AdminDashboard: React.FC<Props> = ({ users, onUpdateUsers, appSettings, onUpdateAppSettings, missions, onAppendMissions }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({
    name: '', initials: '', role: Role.TECHNICIAN, id: '', email: '', phone: '', password: '', avatarUrl: ''
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [stagedUsers, setStagedUsers] = useState<{file: File, rows: string[][], headers: string[]} | null>(null);

  const csvMissionsRef = useRef<HTMLInputElement>(null);
  const csvUsersRef = useRef<HTMLInputElement>(null);
  const reportLogoInputRef = useRef<HTMLInputElement>(null);
  const [settingsForm, setSettingsForm] = useState<AppSettings>(appSettings);

  useEffect(() => {
    // Si pas de customLogos défini (vieux format), on initialise avec un tableau de 10 vides
    // Si appLogoUrl existait, on le met en index 0
    let logos = appSettings.customLogos;
    if (!logos || logos.length === 0) {
        logos = Array(10).fill('');
        if (appSettings.appLogoUrl) {
            logos[0] = appSettings.appLogoUrl;
        }
    } else {
        // S'assurer qu'il a bien 10 slots
        while (logos.length < 10) logos.push('');
    }

    setSettingsForm({ ...appSettings, customLogos: logos });
  }, [appSettings]);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const readFileContent = (file: File, encoding: string = 'UTF-8'): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file, encoding);
    });
  };

  const handleExportMissionsCSV = () => {
    const activeMissions = missions.filter(m => m.jobNumber && (m.workHours > 0 || m.travelHours > 0 || m.overtimeHours > 0));
    if (activeMissions.length === 0) { showStatus('error', "Aucune mission à exporter."); return; }
    const data = activeMissions.map(m => ({
      DATE: m.date.split('T')[0],
      AFFAIRE: m.jobNumber,
      TECHNICIEN: m.technicianId,
      HEURES_TRAVAIL: m.workHours,
      HEURES_TRAJET: m.travelHours,
      HEURES_SUP: m.overtimeHours,
      IGD: m.igd ? 'OUI' : 'NON',
      INFO: m.description || '',
      ADRESSE: m.address || ''
    }));
    exportToCSV(data, `ARCHIVE_MISSIONS_${new Date().toISOString().split('T')[0]}.csv`);
    showStatus('success', "Export des missions généré.");
  };

  const handleExportUsersCSV = () => {
    const data = users.map(u => ({
      LOGIN: u.id,
      NOM_COMPLET: u.name,
      INITIALES: u.initials,
      ROLE: u.role,
      MOT_DE_PASSE: u.password || '1234'
    }));
    exportToCSV(data, `ARCHIVE_EQUIPE_${new Date().toISOString().split('T')[0]}.csv`);
    showStatus('success', "Export de l'équipe généré.");
  };
  
  const handleImportMissions = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      let text = await readFileContent(file, 'UTF-8');
      let rows = parseCSV(text);
      if (rows.length < 2 || rows[0].length < 2) {
        text = await readFileContent(file, 'ISO-8859-1');
        rows = parseCSV(text);
      }

      const headers = rows[0].map(h => normalizeString(h));
      const findIdx = (kw: string[]) => headers.findIndex(h => kw.some(k => h.includes(normalizeString(k))));
      
      const idxDate = findIdx(['date', 'jour']);
      const idxJob = findIdx(['affaire', 'job', 'code']);
      const idxTech = findIdx(['tech', 'login', 'intervenant', 'user', 'id']);
      const idxWorkHours = findIdx(['heure', 'travail', 'hour', 'duree']);
      const idxTravelHours = findIdx(['trajet', 'transport', 'deplacement']);
      const idxOvertimeHours = findIdx(['sup', 'extra']);
      const idxAddr = findIdx(['adresse', 'lieu', 'address', 'chantier', 'site']);

      if (idxDate === -1 || idxJob === -1 || idxTech === -1) {
          throw new Error(`Colonnes obligatoires (DATE, AFFAIRE, TECH) manquantes.`);
      }

      const newMissions: Mission[] = rows.slice(1).map((row, i): Mission | null => {
          let dateStr = (row[idxDate] || '').trim();
          if (!dateStr) return null;
          if (dateStr.includes('/')) {
              const p = dateStr.split('/');
              if (p.length === 3) dateStr = `${p[2].length === 2 ? `20${p[2]}`: p[2]}-${p[1]}-${p[0]}`;
          }
          
          const jobNumber = (row[idxJob] || '').toUpperCase();
          let missionType = MissionType.WORK;
          if (jobNumber.includes('CONGE')) missionType = MissionType.LEAVE;
          else if (jobNumber.includes('MALADIE')) missionType = MissionType.SICK;
          else if (jobNumber.includes('FORMATION')) missionType = MissionType.TRAINING;
          
          const parseHours = (index: number) => isNaN(parseFloat(String(row[index] || '0').replace(',', '.'))) ? 0 : parseFloat(String(row[index] || '0').replace(',', '.'));

          const missionData: Mission = {
              id: `m-imp-${Date.now()}-${i}`,
              date: new Date(dateStr).toISOString(),
              jobNumber: jobNumber,
              managerInitials: '??',
              technicianId: (row[idxTech] || '').toLowerCase().replace(/\s/g, ''),
              workHours: parseHours(idxWorkHours),
              travelHours: idxTravelHours > -1 ? parseHours(idxTravelHours) : 0,
              overtimeHours: idxOvertimeHours > -1 ? parseHours(idxOvertimeHours) : 0,
              igd: false,
              type: missionType,
              status: MissionStatus.SUBMITTED,
              description: '',
              address: idxAddr !== -1 ? (row[idxAddr] || '').trim() : '',
          };
          return missionData;
      }).filter((m): m is Mission => m !== null && !!m.technicianId);
      
      onAppendMissions(newMissions);
      showStatus('success', `${newMissions.length} mission(s) ont été importée(s).`);

    } catch (err) { 
      showStatus('error', err instanceof Error ? err.message : "Fichier illisible ou format invalide.");
    } finally { 
      setIsProcessing(false); 
      if (e.target) e.target.value = '';
    }
  };

  const handleStageUsers = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      let text = await readFileContent(file, 'UTF-8');
      let rows = parseCSV(text);
      if (rows.length < 2 || rows[0].length < 2) {
        text = await readFileContent(file, 'ISO-8859-1');
        rows = parseCSV(text);
      }
      setStagedUsers({ file, rows, headers: rows[0] });
    } catch (err) { showStatus('error', "Fichier illisible."); }
    finally { setIsProcessing(false); if (e.target) e.target.value = ''; }
  };

  const processUsers = () => {
    if (!stagedUsers) return;
    setIsProcessing(true);
    try {
      const rows = stagedUsers.rows;
      const headers = rows[0].map(h => normalizeString(h));
      const findIdx = (kw: string[]) => headers.findIndex(h => kw.some(k => h.includes(normalizeString(k))));
      const idxId = findIdx(['login', 'identifiant', 'id', 'user']);
      const idxName = findIdx(['nom', 'name', 'complet']);
      const idxInit = findIdx(['initial', 'code', 'trigramme']);
      const idxRole = findIdx(['role', 'fonction', 'type']);
      const idxPass = findIdx(['pass', 'motdepasse', 'pwd']);

      if (idxId === -1 || idxName === -1 || idxInit === -1) throw new Error(`Colonnes Équipe obligatoires manquantes.`);

      const importedUsers = rows.slice(1).map(row => {
        const id = (row[idxId] || '').trim().toLowerCase().replace(/\s/g, '');
        if (!id) return null;
        const rRaw = (idxRole !== -1 ? row[idxRole] : '').toUpperCase();
        let role = Role.TECHNICIAN;
        if (rRaw.includes('ADMIN')) role = Role.ADMIN;
        else if (rRaw.includes('MANAGER') || rRaw.includes('AFFAIRE')) role = Role.MANAGER;
        return {
          id,
          name: (row[idxName] || '').trim(),
          initials: (row[idxInit] || '').trim().toUpperCase().slice(0, 3),
          role,
          password: (idxPass !== -1 ? row[idxPass] : '1234') || '1234',
          email: '',
          phone: '',
          avatarUrl: ''
        } as User;
      }).filter(u => u !== null) as User[];

      if (importedUsers.length > 0) {
        onUpdateUsers(importedUsers);
        showStatus('success', "Équipe mise à jour.");
        setStagedUsers(null);
      }
    } catch (err) { showStatus('error', err instanceof Error ? err.message : "Erreur."); }
    finally { setIsProcessing(false); }
  };

  const handleSaveUser = () => {
    if (!formData.id || !formData.name || !formData.initials || !formData.password) { showStatus('error', "Champs requis."); return; }
    const newUser: User = { 
        id: formData.id.toLowerCase().replace(/\s/g, ''), 
        name: formData.name, 
        initials: formData.initials, 
        role: formData.role || Role.TECHNICIAN, 
        password: formData.password, 
        email: formData.email || '', 
        phone: formData.phone || '',
        avatarUrl: formData.avatarUrl || '' 
    };
    if (editingId) onUpdateUsers(users.map(u => u.id === editingId ? newUser : u), editingId, formData.id);
    else onUpdateUsers([...users, newUser]);
    setIsAdding(false); setEditingId(null); setFormData({ name: '', initials: '', role: Role.TECHNICIAN, id: '', email: '', phone: '', password: '', avatarUrl: '' });
  };
  
  // Helper pour upload logo spécifique
  const handleLogoUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) {
          const reader = new FileReader();
          reader.onload = () => {
              const res = reader.result as string;
              const newLogos = [...(settingsForm.customLogos || [])];
              newLogos[index] = res;
              setSettingsForm({ ...settingsForm, customLogos: newLogos });
          };
          reader.readAsDataURL(f);
      }
  };

  const handleLogoDelete = (index: number) => {
      const newLogos = [...(settingsForm.customLogos || [])];
      newLogos[index] = '';
      setSettingsForm({ ...settingsForm, customLogos: newLogos });
  };
  
  const managers = users.filter(u => u.role === Role.MANAGER);
  const technicians = users.filter(u => u.role === Role.TECHNICIAN);
  const admins = users.filter(u => u.role === Role.ADMIN);

  const UserTable: React.FC<{userList: User[]}> = ({userList}) => (
    <div className="overflow-x-auto">
        <table className="w-full text-left">
            <thead className="border-b border-slate-100">
                <tr>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Nom</th>
                    <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Identifiant / Actions</th>
                </tr>
            </thead>
            <tbody>
              {userList.map(user => (
                <tr key={user.id} className="border-b border-slate-50 last:border-b-0">
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center font-black text-[10px] text-slate-500">{user.initials}</div><div><p className="font-bold text-sm text-slate-800">{user.name}</p><p className="text-[9px] text-slate-400">{user.phone}</p></div></div></td>
                  <td className="px-4 py-3">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-sm text-slate-500">{user.id}</span>
                        {user.id !== 'admin' && (
                          <div className="flex justify-end gap-1">
                            <button onClick={() => {setEditingId(user.id); setFormData(user); setIsAdding(false);}} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg"><Edit2 size={14}/></button>
                            <button onClick={() => { if(confirm("Supprimer?")) onUpdateUsers(users.filter(u => u.id !== user.id))}} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                          </div>
                        )}
                      </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
    </div>
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-500 relative">
      {isProcessing && (
        <div className="fixed inset-0 z-[999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full">
              <Loader2 className="text-indigo-600 animate-spin" size={64} />
              <p className="text-2xl font-black text-slate-800">Traitement en cours...</p>
              <p className="text-sm text-slate-500 text-center">Veuillez patienter.</p>
           </div>
        </div>
      )}

      {statusMessage && (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[1000] px-8 py-5 rounded-3xl shadow-2xl border flex items-center gap-5 animate-in slide-in-from-bottom-6 duration-500 max-w-lg w-full ${statusMessage.type === 'success' ? 'bg-emerald-600 text-white border-white/20' : 'bg-red-600 text-white border-white/20'}`}>
           {statusMessage.type === 'success' ? <CheckCircle2 size={32} /> : <AlertTriangle size={32} />}
           <span className="text-sm font-bold">{statusMessage.text}</span>
           <button onClick={() => setStatusMessage(null)} className="ml-auto p-2 hover:bg-white/10 rounded-2xl"><X size={20}/></button>
        </div>
      )}
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* IDENTITE */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 space-y-8 flex flex-col">
            <div className="flex items-center gap-5">
              <div className="bg-indigo-600 p-3.5 rounded-2xl text-white shadow-xl shadow-indigo-200"><LayoutTemplate size={28} /></div>
              <div><h1 className="text-2xl font-black text-slate-800 tracking-tight">Identité</h1><p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Nom et logos de l'entreprise.</p></div>
            </div>
            <div className="flex-1 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nom de l'application</label>
                <input type="text" value={settingsForm.appName} onChange={e => setSettingsForm({...settingsForm, appName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"/>
              </div>
              
              {/* GALERIE LOGOS */}
              <div className="space-y-4 pt-4 border-t">
                 <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">Galerie de Logos</h3>
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                     {Array.from({length: 10}).map((_, index) => (
                         <div key={index} className="flex flex-col gap-2">
                             <div className={`relative aspect-square bg-slate-50 border-2 border-dashed rounded-xl flex items-center justify-center overflow-hidden group ${index === 0 ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-200'}`}>
                                 {settingsForm.customLogos && settingsForm.customLogos[index] ? (
                                     <>
                                        <img src={settingsForm.customLogos[index]} alt={`Logo ${index+1}`} className="w-full h-full object-contain p-2" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <button onClick={() => handleLogoDelete(index)} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"><Trash2 size={16}/></button>
                                        </div>
                                     </>
                                 ) : (
                                     <div className="text-center p-2">
                                         <ImageIcon className={`${index === 0 ? 'text-indigo-300' : 'text-slate-300'} mx-auto mb-1`} size={20} />
                                         <p className="text-[8px] font-black uppercase text-slate-400">{index === 0 ? 'PRINCIPAL' : `LOGO ${index+1}`}</p>
                                     </div>
                                 )}
                                 <input type="file" onChange={(e) => handleLogoUpload(index, e)} accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" title={`Modifier Logo ${index+1}`} />
                             </div>
                         </div>
                     ))}
                 </div>
                 <p className="text-[10px] text-slate-400 italic">Le logo "Principal" remplace celui de la barre de navigation et de l'écran de connexion.</p>
              </div>

              {/* LOGO PDF (Séparé car usage spécifique rapport) */}
              <div className="space-y-2 border-t pt-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Logo pour les Rapports (PDF)</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden">
                    {settingsForm.reportLogoUrl ? <img src={settingsForm.reportLogoUrl} alt="Logo Rapport" className="max-w-full max-h-full object-contain" /> : <FileText className="text-slate-300" size={32} />}
                  </div>
                  <input type="file" ref={reportLogoInputRef} onChange={async (e) => {
                     const f = e.target.files?.[0]; if (f) { const reader = new FileReader(); reader.onload = () => setSettingsForm({...settingsForm, reportLogoUrl: reader.result as string}); reader.readAsDataURL(f); }
                  }} accept="image/*" className="hidden" />
                  <div className="flex-1 flex gap-2">
                    <button onClick={() => reportLogoInputRef.current?.click()} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-200">Choisir Image</button>
                    {settingsForm.reportLogoUrl && <button onClick={() => setSettingsForm({...settingsForm, reportLogoUrl: ''})} className="p-3 text-red-500 hover:bg-red-50 rounded-xl"><Trash size={16}/></button>}
                  </div>
                </div>
              </div>
            </div>
            <button onClick={() => { onUpdateAppSettings(settingsForm); showStatus('success', 'Paramètres mis à jour.'); }} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-sm uppercase hover:bg-slate-700 flex items-center justify-center gap-2 shadow-lg shadow-slate-200 mt-4"><Save size={16} /> Appliquer</button>
          </div>

          {/* MAINTENANCE */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 space-y-6 flex flex-col">
            <input type="file" ref={csvMissionsRef} onChange={handleImportMissions} accept=".csv" className="hidden" />
            <input type="file" ref={csvUsersRef} onChange={handleStageUsers} accept=".csv" className="hidden" />
            <div className="flex items-center gap-5">
              <div className="bg-slate-800 p-3.5 rounded-2xl text-white shadow-xl shadow-slate-200"><Database size={28} /></div>
              <div><h1 className="text-2xl font-black text-slate-800 tracking-tight">Données & Maintenance</h1><p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Import, export et réinitialisation.</p></div>
            </div>
            <div className="flex-1 flex flex-col gap-4">
                {/* Missions */}
                <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl space-y-4 flex flex-col">
                    <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center"><FileSpreadsheet className="text-emerald-600"/></div><h3 className="font-black text-slate-800">Missions</h3></div>
                    <p className="text-xs text-slate-500 font-medium flex-1">Gérez les interventions de votre planning en masse.</p>
                    <div className="flex gap-2">
                        <button onClick={() => csvMissionsRef.current?.click()} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5"><Upload size={14}/> Importer</button>
                        <button onClick={handleExportMissionsCSV} className="flex-1 py-3 bg-white text-emerald-800 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5"><Download size={14}/> Exporter</button>
                    </div>
                </div>
                {/* Équipe */}
                <div className="bg-slate-50 border border-slate-100 p-6 rounded-3xl space-y-4 flex flex-col">
                    <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center"><Contact className="text-blue-600"/></div><h3 className="font-black text-slate-800">Équipe</h3></div>
                    <p className="text-xs text-slate-500 font-medium flex-1">Gérez la liste des collaborateurs et leurs accès.</p>
                     <div className="flex gap-2">
                        <button onClick={() => csvUsersRef.current?.click()} className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5"><Upload size={14}/> Importer</button>
                        <button onClick={handleExportUsersCSV} className="flex-1 py-3 bg-white text-blue-800 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5"><Download size={14}/> Exporter</button>
                    </div>
                </div>
            </div>
             {stagedUsers && (
                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl space-y-4">
                    <p className="text-xs font-bold text-blue-800 text-center">Fichier <strong>{stagedUsers.file.name}</strong> prêt. {stagedUsers.rows.length-1} utilisateurs détectés.</p>
                    <div className="max-h-32 overflow-y-auto rounded-lg border bg-white scrollbar-thin">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50"><tr className="text-left">{stagedUsers.headers.map(h => <th key={h} className="p-2 font-bold">{h}</th>)}</tr></thead>
                            <tbody>{stagedUsers.rows.slice(1, 6).map((row, i) => <tr key={i} className="border-t">{row.map((cell, j) => <td key={j} className="p-2 truncate">{cell}</td>)}</tr>)}</tbody>
                        </table>
                    </div>
                    <p className="text-xs font-bold text-blue-800 text-center">Voulez-vous remplacer l'équipe actuelle ?</p>
                    <div className="flex gap-3"><button onClick={() => setStagedUsers(null)} className="flex-1 py-2 text-xs uppercase font-black bg-slate-100 rounded-lg">Non</button><button onClick={processUsers} className="flex-1 py-2 text-xs uppercase font-black bg-blue-600 text-white rounded-lg">Oui, Mettre à Jour</button></div>
                </div>
            )}
            <button onClick={() => { if (window.confirm("ACTION IRREVERSIBLE !\nVoulez-vous vraiment effacer TOUTES les données (missions, utilisateurs, rapports, etc.) ?")) { localStorage.clear(); window.location.reload(); } }} className="w-full py-4 bg-red-50 border-2 border-dashed border-red-200 text-red-600 rounded-2xl font-black text-sm uppercase hover:bg-red-100 hover:border-red-300 flex items-center justify-center gap-2"><Trash2 size={16} /> Réinitialiser l'application</button>
          </div>
      </div>
      
      {/* GESTION UTILISATEURS */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-5"><div className="bg-slate-100 p-3.5 rounded-2xl text-slate-500"><Contact size={28}/></div><div><h1 className="text-2xl font-black text-slate-800 tracking-tight">Gestion de l'équipe</h1><p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{users.length} membres</p></div></div>
          <button onClick={() => { setIsAdding(true); setEditingId(null); setFormData({name:'', initials:'', role: Role.TECHNICIAN, id:'', password:'1234', phone: '', email: ''})}} className="px-6 py-4 bg-slate-800 text-white rounded-2xl text-xs font-black uppercase flex items-center gap-2 shadow-lg hover:bg-slate-700"><UserPlus size={16}/> Ajouter</button>
        </div>
        
        {/* Formulaire d'ajout/édition */}
        {(isAdding || editingId) && (
            <div className="p-6 my-6 bg-slate-50 rounded-3xl border-2 border-indigo-200 space-y-6 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Identifiant (login)</label><input type="text" placeholder="prenom.n" value={formData.id || ''} onChange={e => setFormData({...formData, id: e.target.value})} className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"/></div>
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nom complet</label><input type="text" placeholder="Prénom Nom" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"/></div>
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Initiales</label><input type="text" placeholder="PN" value={formData.initials || ''} onChange={e => setFormData({...formData, initials: e.target.value.toUpperCase()})} className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"/></div>
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Rôle</label><select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as Role})} className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"><option value={Role.TECHNICIAN}>Technicien</option><option value={Role.MANAGER}>Chargé d'Affaires</option><option value={Role.ADMIN}>Administrateur</option></select></div>
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mot de passe</label><input type="text" value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"/></div>
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Téléphone</label><input type="text" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"/></div>
                    <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email</label><input type="text" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"/></div>
                </div>
                 <div className="flex justify-end gap-4">
                    <button onClick={() => {setIsAdding(false); setEditingId(null);}} className="px-6 py-3 bg-slate-100 text-slate-500 rounded-xl text-xs font-black uppercase">Annuler</button>
                    <button onClick={handleSaveUser} className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase">Enregistrer</button>
                </div>
            </div>
        )}

        {/* Listes par rôle */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-4">
                <h2 className="px-4 text-sm font-black text-indigo-600 uppercase tracking-widest">Chargés d'Affaires ({managers.length})</h2>
                <div className="bg-indigo-50/50 p-2 rounded-2xl border border-indigo-100"><UserTable userList={managers} /></div>
            </div>
            <div className="space-y-4">
                <h2 className="px-4 text-sm font-black text-emerald-600 uppercase tracking-widest">Techniciens ({technicians.length})</h2>
                 <div className="bg-emerald-50/50 p-2 rounded-2xl border border-emerald-100"><UserTable userList={technicians} /></div>
            </div>
            <div className="space-y-4">
                <h2 className="px-4 text-sm font-black text-slate-600 uppercase tracking-widest">Administrateurs ({admins.length})</h2>
                <div className="bg-slate-100/50 p-2 rounded-2xl border border-slate-200"><UserTable userList={admins} /></div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;