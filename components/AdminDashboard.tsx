import React, { useState, useRef, useEffect } from 'react';
import { User, Role, AppSettings, Mission, MissionType, MissionStatus } from '../types';
import { exportToCSV, parseCSV, normalizeString, getCurrentWeekInfo } from '../utils';
import { 
  UserPlus, Trash2, Edit2, Shield, HardHat, Settings, Check, X, 
  ImageIcon, LayoutTemplate, Download, Upload, Database, Camera, 
  Trash, History, RotateCcw, FileUp, FileSpreadsheet, Contact, 
  AlertTriangle, Loader2, CheckCircle2, FileText, Play, FileCheck, Eye, Save, Table, Search
} from 'lucide-react';

interface Props {
  users: User[];
  onUpdateUsers: (users: User[], oldId?: string, newId?: string) => void;
  appSettings: AppSettings;
  onUpdateAppSettings: (settings: AppSettings) => void;
  missions: Mission[];
  // FIX: Renamed onRestoreDatabase to onAppendMissions and updated its signature to align with App.tsx and improve component API.
  onAppendMissions: (newMissions: Mission[]) => void;
}

const AdminDashboard: React.FC<Props> = ({ users, onUpdateUsers, appSettings, onUpdateAppSettings, missions, onAppendMissions }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({
    name: '', initials: '', role: Role.TECHNICIAN, id: '', email: '', password: '', avatarUrl: ''
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  const [stagedMissions, setStagedMissions] = useState<{file: File, rows: string[][], headers: string[]} | null>(null);
  const [stagedUsers, setStagedUsers] = useState<{file: File, rows: string[][], headers: string[]} | null>(null);

  const csvMissionsRef = useRef<HTMLInputElement>(null);
  const csvUsersRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [settingsForm, setSettingsForm] = useState<AppSettings>(appSettings);

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    if (type === 'success') setTimeout(() => setStatusMessage(null), 8000);
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
    if (missions.length === 0) { showStatus('error', "Aucune mission à exporter."); return; }
    const data = missions.map(m => ({
      DATE: m.date.split('T')[0],
      AFFAIRE: m.jobNumber,
      TECHNICEN: m.technicianId,
      HEURES: m.hours,
      IGD: m.igd ? 'OUI' : 'NON',
      INFO: m.description || '',
      ADRESSE: m.address || ''
    }));
    exportToCSV(data, `ARCHIVE_MISSIONS_${new Date().toISOString().split('T')[0]}.csv`);
    showStatus('success', "Export Missions CSV généré.");
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
    showStatus('success', "Export Équipe CSV généré.");
  };

  const handleStageMissions = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setStagedMissions({ file, rows, headers: rows[0] });
    } catch (err) { showStatus('error', "Fichier illisible."); }
    finally { setIsProcessing(false); e.target.value = ''; }
  };

  const processMissions = async () => {
    if (!stagedMissions) return;
    setIsProcessing(true);
    try {
      const rows = stagedMissions.rows;
      const headers = rows[0].map(h => normalizeString(h));
      const findIdx = (kw: string[]) => headers.findIndex(h => kw.some(k => h.includes(normalizeString(k))));
      const idxDate = findIdx(['date', 'jour']);
      const idxJob = findIdx(['affaire', 'job', 'code']);
      const idxCA = findIdx(['ca', 'manager', 'initiale']);
      const idxTech = findIdx(['tech', 'login', 'intervenant', 'user', 'id']);
      const idxHours = findIdx(['heure', 'hour', 'duree']);
      const idxIgd = findIdx(['igd', 'frais', 'deplacement']);
      const idxAddr = findIdx(['adresse', 'lieu', 'address', 'chantier', 'site']);
      const idxLat = findIdx(['lat', 'latitude']);
      const idxLon = findIdx(['lon', 'long', 'longitude']);

      if (idxDate === -1 || idxJob === -1 || idxTech === -1) throw new Error(`Colonnes Missions obligatoires manquantes.`);

      const imported = rows.slice(1).map((row, i) => {
        let dateStr = (row[idxDate] || '').trim();
        if (!dateStr) return null;
        if (dateStr.includes('/')) {
          const p = dateStr.split('/');
          if (p.length === 3) dateStr = `${p[2]}-${p[1]}-${p[0]}`;
        }
        const hVal = idxHours !== -1 ? parseFloat(String(row[idxHours]).replace(',', '.')) : 8;
        const igdVal = idxIgd !== -1 ? ['OUI', '1', 'TRUE', 'OK', 'IGD', 'X'].includes(String(row[idxIgd]).toUpperCase()) : false;
        const latVal = idxLat !== -1 ? parseFloat(String(row[idxLat]).replace(',', '.')) : undefined;
        const lonVal = idxLon !== -1 ? parseFloat(String(row[idxLon]).replace(',', '.')) : undefined;

        return {
          id: `m-imp-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          date: new Date(dateStr).toISOString(),
          jobNumber: (row[idxJob] || '').toUpperCase(),
          managerInitials: idxCA !== -1 ? (row[idxCA] || '').toUpperCase().slice(0, 3) : '??',
          technicianId: (row[idxTech] || '').toLowerCase().replace(/\s/g, ''),
          hours: isNaN(hVal) ? 0 : hVal,
          igd: igdVal,
          type: MissionType.WORK,
          status: MissionStatus.SUBMITTED,
          description: '',
          address: idxAddr !== -1 ? (row[idxAddr] || '').trim() : '',
          latitude: isNaN(latVal as number) ? undefined : latVal,
          longitude: isNaN(lonVal as number) ? undefined : lonVal,
        } as Mission;
      }).filter(m => m !== null && m.technicianId);

      if (imported.length > 0) {
        // FIX: Replaced onRestoreDatabase with onAppendMissions and passed only the newly imported missions.
        onAppendMissions(imported as Mission[]);
        setStagedMissions(null);
      }
    } catch (err) { showStatus('error', err instanceof Error ? err.message : "Erreur."); }
    finally { setIsProcessing(false); }
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
    finally { setIsProcessing(false); e.target.value = ''; }
  };

  const processUsers = async () => {
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
    const newUser: User = { id: formData.id.toLowerCase().replace(/\s/g, ''), name: formData.name, initials: formData.initials, role: formData.role || Role.TECHNICIAN, password: formData.password, email: formData.email || '', avatarUrl: formData.avatarUrl || '' };
    if (editingId) onUpdateUsers(users.map(u => u.id === editingId ? newUser : u), editingId, formData.id);
    else onUpdateUsers([...users, newUser]);
    setIsAdding(false); setEditingId(null); setFormData({ name: '', initials: '', role: Role.TECHNICIAN, id: '', email: '', password: '', avatarUrl: '' });
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500 relative">
      {isProcessing && (
        <div className="fixed inset-0 z-[999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center">
           <div className="bg-white p-12 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full">
              <Loader2 className="text-indigo-600 animate-spin" size={64} />
              <p className="text-2xl font-black text-slate-800">Traitement...</p>
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
              <div><h1 className="text-2xl font-black text-slate-800 tracking-tight">Identité</h1><p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Nom et logo de l'entreprise.</p></div>
            </div>
            <div className="flex-1 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nom de l'application</label>
                <input type="text" value={settingsForm.appName} onChange={e => setSettingsForm({...settingsForm, appName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"/>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Logo</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center overflow-hidden">
                    {settingsForm.appLogoUrl ? <img src={settingsForm.appLogoUrl} alt="Logo" className="max-w-full max-h-full object-contain" /> : <ImageIcon className="text-slate-300" size={32} />}
                  </div>
                  <input type="file" ref={logoInputRef} onChange={async (e) => {
                     const f = e.target.files?.[0]; if (f) { const reader = new FileReader(); reader.onload = () => setSettingsForm({...settingsForm, appLogoUrl: reader.result as string}); reader.readAsDataURL(f); }
                  }} accept="image/*" className="hidden" />
                  <div className="flex-1 flex gap-2">
                    <button onClick={() => logoInputRef.current?.click()} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-200">Modifier</button>
                    {settingsForm.appLogoUrl && <button onClick={() => setSettingsForm({...settingsForm, appLogoUrl: ''})} className="p-3 text-red-500 hover:bg-red-50 rounded-xl"><Trash size={16}/></button>}
                  </div>
                </div>
              </div>
            </div>
            <button onClick={() => { onUpdateAppSettings(settingsForm); showStatus('success', 'Paramètres mis à jour.'); }} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black text-sm uppercase hover:bg-slate-700 flex items-center justify-center gap-2 shadow-lg shadow-slate-200 mt-4"><Save size={16} /> Appliquer</button>
          </div>

          {/* MAINTENANCE */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 space-y-6 flex flex-col">
            <input type="file" ref={csvMissionsRef} onChange={handleStageMissions} accept=".csv" className="hidden" />
            <input type="file" ref={csvUsersRef} onChange={handleStageUsers} accept=".csv" className="hidden" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="bg-slate-800 p-3.5 rounded-2xl text-white shadow-xl shadow-slate-300"><Database size={28} /></div>
                <div><h1 className="text-2xl font-black text-slate-800 tracking-tight">Maintenance</h1><p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Imports, exports et actions critiques.</p></div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
               {/* IMPORT MISSIONS */}
               <div className={`p-6 rounded-3xl border-2 transition-all ${stagedMissions ? 'bg-blue-50/70 border-blue-200 ring-8 ring-blue-500/5' : 'bg-slate-50/70 border-slate-200 border-dashed'}`}>
                  <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-3 text-sm font-black text-slate-800 uppercase tracking-widest"><FileSpreadsheet className="text-emerald-600"/> Missions</div>
                     <button onClick={handleExportMissionsCSV} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase hover:bg-emerald-700 shadow-lg shadow-emerald-200 flex items-center gap-2"><Download size={16}/> Exporter</button>
                  </div>
                  {!stagedMissions ? (
                     <button onClick={() => csvMissionsRef.current?.click()} className="w-full py-5 bg-white border border-slate-200 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-100/50 shadow-sm flex items-center justify-center gap-2">
                        <Upload size={18} /> Importer un CSV
                     </button>
                  ) : (
                    <ImportPreview type="missions" file={stagedMissions.file} headers={stagedMissions.headers} rows={stagedMissions.rows} onCancel={() => setStagedMissions(null)} onConfirm={processMissions} color="blue" />
                  )}
               </div>

               {/* IMPORT EQUIPE */}
               <div className={`p-6 rounded-3xl border-2 transition-all ${stagedUsers ? 'bg-sky-50/70 border-sky-200 ring-8 ring-sky-500/5' : 'bg-slate-50/70 border-slate-200 border-dashed'}`}>
                  <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-3 text-sm font-black text-slate-800 uppercase tracking-widest"><Contact className="text-sky-600"/> Équipe</div>
                     <button onClick={handleExportUsersCSV} className="px-5 py-2.5 bg-sky-600 text-white rounded-xl text-xs font-black uppercase hover:bg-sky-700 shadow-lg shadow-sky-200 flex items-center gap-2"><Download size={16}/> Exporter</button>
                  </div>
                  {!stagedUsers ? (
                     <button onClick={() => csvUsersRef.current?.click()} className="w-full py-5 bg-white border border-slate-200 rounded-2xl text-sm font-black uppercase text-slate-500 hover:bg-slate-100/50 shadow-sm flex items-center justify-center gap-2">
                        <Upload size={18} /> Importer un CSV
                     </button>
                  ) : (
                    <ImportPreview type="users" file={stagedUsers.file} headers={stagedUsers.headers} rows={stagedUsers.rows} onCancel={() => setStagedUsers(null)} onConfirm={processUsers} color="sky" />
                  )}
               </div>
            </div>
            
            <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between">
               <button onClick={() => { localStorage.removeItem('plani_geocache'); showStatus('success', 'Cache GPS réinitialisé.'); }} className="text-[10px] font-black text-slate-400 hover:text-indigo-600">Vider Cache GPS</button>
               <button onClick={() => { if(confirm("Supprimer TOUTES les missions ? Action irréversible.")) { localStorage.removeItem('plantit_missions'); window.location.reload(); } }} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all"><RotateCcw size={12} /> Reset Missions</button>
            </div>
          </div>
      </div>

      <div className="flex items-center justify-between bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40">
        <div className="flex items-center gap-5">
          <div className="bg-slate-800 p-3.5 rounded-2xl text-white shadow-xl shadow-slate-300"><Settings size={28} /></div>
          <div><h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none mb-1">Membres de l'Équipe</h1><p className="text-slate-400 font-medium">Contrôle manuel des utilisateurs.</p></div>
        </div>
        <button onClick={() => { setIsAdding(true); setEditingId(null); setFormData({ name: '', initials: '', role: Role.TECHNICIAN, id: '', email: '', password: '1234', avatarUrl: '' }); }} className="flex items-center gap-2 px-8 py-4 bg-slate-800 text-white rounded-2xl font-black hover:bg-slate-700 shadow-lg shadow-slate-300"><UserPlus size={18} /> Ajouter</button>
      </div>

      {(isAdding || editingId) && (
        <div className="bg-white p-8 rounded-3xl border-2 border-indigo-100 shadow-2xl shadow-indigo-100/50 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">{editingId ? <Edit2 size={20} /> : <UserPlus size={20} />}{editingId ? `Profil : ${formData.name}` : "Nouveau membre"}</h2>
            <button onClick={() => {setIsAdding(false); setEditingId(null);}} className="text-slate-400 hover:text-slate-600"><X /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="md:col-span-1 flex flex-col items-center border-r border-slate-100 pr-6 space-y-4">
              <div className="relative group">
                <div className="w-28 h-28 rounded-3xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                  {formData.avatarUrl ? <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <ImageIcon className="text-slate-300" size={32} />}
                </div>
                <input type="file" ref={avatarInputRef} onChange={async (e) => {
                  const f = e.target.files?.[0]; if (f) { const reader = new FileReader(); reader.onload = () => setFormData({...formData, avatarUrl: reader.result as string}); reader.readAsDataURL(f); }
                }} accept="image/*" className="hidden" />
                <button onClick={() => avatarInputRef.current?.click()} className="absolute -bottom-2 -right-2 p-2 bg-indigo-600 text-white rounded-xl shadow-xl shadow-indigo-200"><Camera size={14} /></button>
              </div>
              <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as Role})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500">
                <option value={Role.TECHNICIAN}>Technicien</option>
                <option value={Role.MANAGER}>Chargé d'Affaires</option>
                <option value={Role.ADMIN}>Administrateur</option>
              </select>
            </div>
            <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Login *</label><input type="text" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"/></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Mot de passe *</label><input type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"/></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nom Complet *</label><input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"/></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Initiales *</label><input type="text" value={formData.initials} maxLength={3} onChange={e => setFormData({...formData, initials: e.target.value.toUpperCase()})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"/></div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-100"><button onClick={handleSaveUser} className="px-8 py-3 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-slate-200 hover:bg-slate-700">Enregistrer</button></div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
        <UserSection title="Chargés d'Affaires" icon={<Shield className="text-indigo-600" />} users={users.filter(u => u.role === Role.MANAGER)} onEdit={user => {setEditingId(user.id); setFormData(user); window.scrollTo({top:0, behavior:'smooth'});}} onDelete={id => { if(id!=='admin'&&confirm("Supprimer?")) onUpdateUsers(users.filter(u=>u.id!==id)); }} />
        <UserSection title="Techniciens" icon={<HardHat className="text-orange-500" />} users={users.filter(u => u.role === Role.TECHNICIAN)} onEdit={user => {setEditingId(user.id); setFormData(user); window.scrollTo({top:0, behavior:'smooth'});}} onDelete={id => { if(confirm("Supprimer?")) onUpdateUsers(users.filter(u=>u.id!==id)); }} />
        <UserSection title="Admin" icon={<Settings className="text-slate-500" />} users={users.filter(u => u.role === Role.ADMIN)} onEdit={user => {setEditingId(user.id); setFormData(user); window.scrollTo({top:0, behavior:'smooth'});}} onDelete={id => { if(id!=='admin'&&confirm("Supprimer?")) onUpdateUsers(users.filter(u=>u.id!==id)); }} />
      </div>
    </div>
  );
};

// Composant d'aperçu d'importation amélioré
const ImportPreview: React.FC<{ type: 'missions' | 'users', file: File, headers: string[], rows: string[][], onCancel: () => void, onConfirm: () => void, color: string }> = ({ type, file, headers, rows, onCancel, onConfirm, color }) => {
  const diagnostic = () => {
    const h = headers.map(v => normalizeString(v));
    const fields = type === 'users' ? [
      { n: 'LOGIN', k: ['login', 'id', 'user'] },
      { n: 'NOM', k: ['nom', 'name', 'complet'] },
      { n: 'INITIALES', k: ['initial', 'trigramme', 'code'] }
    ] : [
      { n: 'DATE', k: ['date', 'jour'] },
      { n: 'AFFAIRE', k: ['affaire', 'job', 'code'] },
      { n: 'TECH', k: ['tech', 'login', 'intervenant'] },
      { n: 'ADRESSE', k: ['adresse', 'lieu', 'address', 'chantier', 'site'] }
    ];
    
    return fields.map(f => {
      const idx = h.findIndex(val => f.k.some(kw => val.includes(kw)));
      return { field: f.n, found: idx !== -1, index: idx };
    });
  };

  const diagResults = diagnostic();
  const isValid = diagResults.filter(d => ['LOGIN', 'NOM', 'INITIALES', 'DATE', 'AFFAIRE', 'TECH'].includes(d.field)).every(d => d.found);

  return (
    <div className="space-y-5 animate-in slide-in-from-top-2">
       <div className={`p-4 bg-white rounded-2xl border border-${color}-200 flex items-center justify-between shadow-sm`}>
          <div className="flex items-center gap-3 min-w-0">
             <div className={`bg-${color}-600 p-2.5 rounded-xl text-white`}><FileText size={20}/></div>
             <div className="flex flex-col min-w-0">
                <span className={`text-[10px] font-black text-${color}-900 uppercase`}>Fichier déposé ({type})</span>
                <span className="text-sm font-bold text-slate-700 truncate">{file.name}</span>
             </div>
          </div>
          <button onClick={onCancel} className="p-2 text-red-500 hover:bg-red-50 rounded-xl shrink-0"><X size={24}/></button>
       </div>

       <div className="bg-white/50 p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Détection des colonnes ({type === 'users' ? 'Équipe' : 'Import'})</div>
          <div className="grid grid-cols-2 gap-2">
             {diagResults.map(d => (
                <div key={d.field} className={`px-3 py-2 rounded-lg border text-xs font-black flex items-center justify-between ${d.found ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                   <span>{d.field}</span>
                   {d.found ? <CheckCircle2 size={14}/> : <AlertTriangle size={14}/>}
                </div>
             ))}
          </div>
          {!isValid && <p className="text-[9px] text-red-600 font-bold mt-2 uppercase">Certaines colonnes obligatoires sont manquantes.</p>}
       </div>

       <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-200"><Table size={12}/> Aperçu (5 premières lignes)</div>
          <div className="overflow-x-auto max-h-[180px] scrollbar-thin">
             <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white shadow-sm">
                   <tr>{headers.map((h, i) => <th key={i} className="px-3 py-2 text-[9px] font-black text-slate-500 border-r border-b border-slate-100 whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody>
                   {rows.slice(1, 6).map((row, ri) => (
                      <tr key={ri} className="border-b border-slate-100 last:border-0">
                         {headers.map((_, ci) => <td key={ci} className="px-3 py-1.5 text-[10px] font-medium text-slate-600 border-r border-slate-100 whitespace-nowrap">{row[ci] || ''}</td>)}
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>
       </div>

       <button onClick={onConfirm} disabled={!isValid} className={`w-full py-5 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] ${isValid ? `bg-${color}-600 hover:bg-${color}-700 shadow-${color}-200` : 'bg-slate-300 cursor-not-allowed grayscale'}`}>
          {isValid ? <Play size={20} /> : <AlertTriangle size={20} />}
          {isValid ? `Valider l'importation` : "Colonnes obligatoires manquantes"}
       </button>
    </div>
  );
};

const UserSection: React.FC<{ title: string, icon: React.ReactNode, users: User[], onEdit: (u: User) => void, onDelete: (id: string) => void }> = ({ title, icon, users, onEdit, onDelete }) => (
  <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/40 overflow-hidden flex flex-col">
    <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
      <div className="flex items-center gap-3 font-black text-slate-800 text-xs uppercase tracking-widest">{icon}{title}</div>
      <span className="bg-white px-2 py-0.5 rounded-full text-[10px] font-black text-slate-500 border border-slate-200">{users.length}</span>
    </div>
    <div className="flex-1 divide-y divide-slate-100">
      {users.map(u => (
        <div key={u.id} className="p-4 flex items-center justify-between group hover:bg-slate-50/50 transition-all">
          <div className="flex items-center gap-3">
            {u.avatarUrl ? <img src={u.avatarUrl} alt={u.name} className="w-9 h-9 rounded-xl object-cover border-2 border-white shadow-md" /> : <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ring-4 ring-white ${u.role === Role.ADMIN ? 'bg-slate-900 text-white' : u.role === Role.MANAGER ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'}`}>{u.initials}</div>}
            <div className="text-sm font-black text-slate-800 truncate max-w-[120px]">{u.name}</div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
            <button onClick={() => onEdit(u)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 size={16} /></button>
            <button onClick={() => onDelete(u.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default AdminDashboard;