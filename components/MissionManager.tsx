
import React, { useState, useMemo, useEffect } from 'react';
import { Mission, User, MissionType, MissionStatus } from '../types';
import { Search, SlidersHorizontal, Edit, Trash2, X, Save, Share2, Copy, Clock, Briefcase, Sun, Thermometer, GraduationCap } from 'lucide-react';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import MapView from './MapView';
import { useState } from 'react';

interface Props {
  missions: Mission[];
  technicians: User[];
  managers: User[];
  onUpdateMissions: (missions: Mission[]) => void;
  onRemoveMission: (missionId: string) => void;
}

const MissionManager: React.FC<Props> = ({ missions, technicians, managers, onUpdateMissions, onRemoveMission }) => {
  const [filters, setFilters] = useState({
    search: '',
    techIds: [] as string[],
    managerInitials: [] as string[],
    startDate: '',
    endDate: '',
  });
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [missionToDelete, setMissionToDelete] = useState<string | null>(null);
  const [stagedForSave, setStagedForSave] = useState<Mission | null>(null);

  const filteredMissions = useMemo(() => {
    let result = missions.filter(m => m.jobNumber || m.workHours > 0);

    if (filters.search) {
      result = result.filter(m => 
        m.jobNumber.toLowerCase().includes(filters.search.toLowerCase())
      );
    }
    if (filters.techIds.length > 0) {
      result = result.filter(m => filters.techIds.includes(m.technicianId));
    }
     if (filters.managerInitials.length > 0) {
      result = result.filter(m => filters.managerInitials.includes(m.managerInitials));
    }
    if (filters.startDate) {
      const start = startOfDay(new Date(filters.startDate));
      result = result.filter(m => new Date(m.date) >= start);
    }
    if (filters.endDate) {
      const end = endOfDay(new Date(filters.endDate));
      result = result.filter(m => new Date(m.date) <= end);
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [missions, filters]);

  const stats = useMemo(() => {
    let totalHours = 0;
    let workDays = 0;
    let leaveDays = 0;
    let sickDays = 0;
    let trainingDays = 0;

    filteredMissions.forEach(m => {
        totalHours += (m.workHours || 0) + (m.travelHours || 0) + (m.overtimeHours || 0);
        
        const jobUpper = (m.jobNumber || '').toUpperCase();
        // Détection du type basée sur le Type ou le code affaire
        const isLeave = m.type === MissionType.LEAVE || jobUpper.includes('CONGE');
        const isSick = m.type === MissionType.SICK || jobUpper.includes('MALADIE');
        const isTraining = m.type === MissionType.TRAINING || jobUpper.includes('FORMATION');

        if (isLeave) leaveDays++;
        else if (isSick) sickDays++;
        else if (isTraining) trainingDays++;
        else workDays++; // Par défaut, tout le reste est du travail
    });

    return { totalHours, workDays, leaveDays, sickDays, trainingDays };
  }, [filteredMissions]);

  const handleUpdateFilter = (key: keyof typeof filters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  const handleEditMission = (mission: Mission) => {
      setEditingMission({ ...mission });
  };
  
  const handleDuplicateMission = (mission: Mission) => {
      const newMission: Mission = {
          ...mission,
          id: `m-copy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          status: MissionStatus.SUBMITTED // Reset status on copy
      };
      onUpdateMissions([newMission]);
  };
  
  const handleStageSave = () => {
      if (!editingMission) return;
      setStagedForSave(editingMission);
      setEditingMission(null);
  }

  const handleConfirmBulkUpdate = () => {
    if (!stagedForSave) return;
    const { jobNumber, address, description } = stagedForSave;
    const updatedMissions = missions.map(mission => {
      if (mission.jobNumber === jobNumber) {
        return { ...mission, address, description };
      }
      return mission;
    });
    onUpdateMissions(updatedMissions);
    setStagedForSave(null);
  };

  const handleConfirmSingleUpdate = () => {
    if (!stagedForSave) return;
    onUpdateMissions([stagedForSave]);
    setStagedForSave(null);
  };

  const confirmDeletion = () => {
    if (missionToDelete) {
      onRemoveMission(missionToDelete);
      setMissionToDelete(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
       {/* Modale de Confirmation de Suppression */}
       {missionToDelete && (
        <div className="fixed inset-0 z-[101] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95">
            <h2 className="text-xl font-black text-slate-800 text-center">Confirmer la suppression</h2>
            <p className="text-slate-500 text-center mt-2 mb-8">Cette action est définitive. Voulez-vous vraiment supprimer cette intervention ?</p>
            <div className="flex gap-4">
              <button onClick={() => setMissionToDelete(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest">Annuler</button>
              <button onClick={confirmDeletion} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de Confirmation de Sauvegarde groupée */}
      {stagedForSave && (
        <div className="fixed inset-0 z-[101] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95">
            <div className="text-center">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6"><Share2 size={32}/></div>
                <h2 className="text-2xl font-black text-slate-800">Mise à jour groupée</h2>
                <p className="text-slate-500 mt-2 mb-8">L'adresse et la description seront appliquées à toutes les interventions de l'affaire <strong className="font-black text-indigo-600">{stagedForSave.jobNumber}</strong>. <br/>Comment voulez-vous procéder ?</p>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={handleConfirmBulkUpdate} className="w-full text-center py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2"><Share2 size={16}/> Mettre à jour pour tout</button>
              <button onClick={handleConfirmSingleUpdate} className="w-full text-center py-5 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2"><Copy size={16}/> Modifier cette ligne seulement</button>
              <button onClick={() => setStagedForSave(null)} className="w-full text-center py-4 text-slate-400 font-bold text-xs uppercase mt-4">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALE D'ÉDITION --- */}
      {editingMission && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-2 rounded-xl"><Edit size={20}/></div>
                <h2 className="text-lg font-black uppercase tracking-tight">Modifier l'Intervention</h2>
              </div>
              <button onClick={() => setEditingMission(null)} className="p-2 hover:bg-white/10 rounded-full"><X /></button>
            </div>
            <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">N° Affaire</label>
                        <input type="text" value={editingMission.jobNumber} onChange={e => setEditingMission(m => m ? {...m, jobNumber: e.target.value.toUpperCase()} : null)} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                     <div className="md:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Adresse du chantier</label>
                        <input type="text" value={editingMission.address || ''} onChange={e => setEditingMission(m => m ? {...m, address: e.target.value} : null)} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div className="grid grid-cols-3 gap-4 md:col-span-4 border-t pt-6">
                         <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">H. Travail</label>
                            <input type="number" step="0.5" value={editingMission.workHours || ''} onChange={e => setEditingMission(m => m ? {...m, workHours: parseFloat(e.target.value) || 0} : null)} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">H. Trajet</label>
                            <input type="number" step="0.5" value={editingMission.travelHours || ''} onChange={e => setEditingMission(m => m ? {...m, travelHours: parseFloat(e.target.value) || 0} : null)} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">H. Sup</label>
                            <input type="number" step="0.5" value={editingMission.overtimeHours || ''} onChange={e => setEditingMission(m => m ? {...m, overtimeHours: parseFloat(e.target.value) || 0} : null)} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                        </div>
                    </div>
                    <div className="md:col-span-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Description / Informations</label>
                        <textarea value={editingMission.description || ''} onChange={e => setEditingMission(m => m ? {...m, description: e.target.value} : null)} className="w-full p-4 bg-slate-50 border rounded-2xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px]"></textarea>
                    </div>
                </div>
                 <div className="flex gap-4 pt-4 border-t">
                  <button onClick={() => setEditingMission(null)} className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200">Annuler</button>
                  <button onClick={handleStageSave} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-700"><Save className="inline-block mr-2" size={16}/> Enregistrer</button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* --- FILTRES --- */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="text-slate-400" />
          <h3 className="text-sm font-black text-slate-600 uppercase tracking-widest">Filtres</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Rechercher par N° d'affaire..."
              value={filters.search}
              onChange={e => handleUpdateFilter('search', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-4 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <input
            type="date"
            value={filters.startDate}
            onChange={e => handleUpdateFilter('startDate', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold text-sm text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={e => handleUpdateFilter('endDate', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 font-bold text-sm text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase self-center pr-2">Techniciens:</span>
          {technicians.map(tech => (
            <button
              key={tech.id}
              onClick={() => {
                const newTechIds = filters.techIds.includes(tech.id)
                  ? filters.techIds.filter(id => id !== tech.id)
                  : [...filters.techIds, tech.id];
                handleUpdateFilter('techIds', newTechIds);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-black border-2 transition-all ${
                filters.techIds.includes(tech.id)
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
              }`}
            >
              {tech.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
           <span className="text-[10px] font-black text-slate-400 uppercase self-center pr-2">Managers:</span>
            {managers.map(manager => (
            <button
              key={manager.id}
              onClick={() => {
                const newManagerInitials = filters.managerInitials.includes(manager.initials)
                  ? filters.managerInitials.filter(id => id !== manager.initials)
                  : [...filters.managerInitials, manager.initials];
                handleUpdateFilter('managerInitials', newManagerInitials);
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-black border-2 transition-all ${
                filters.managerInitials.includes(manager.initials)
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
              }`}
            >
              {manager.initials}
            </button>
          ))}
        </div>
      </div>
      
      {/* --- STATS --- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Heures Totales */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-center items-center text-center gap-2 shadow-sm">
            <div className="p-3 bg-slate-100 rounded-full text-slate-500"><Clock size={20}/></div>
            <div>
                <p className="text-2xl font-black text-slate-800">{stats.totalHours.toLocaleString('fr-FR')} h</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Heures Totales</p>
            </div>
        </div>
        {/* Jours Travaillés */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-center items-center text-center gap-2 shadow-sm">
            <div className="p-3 bg-blue-50 rounded-full text-blue-600"><Briefcase size={20}/></div>
            <div>
                <p className="text-2xl font-black text-slate-800">{stats.workDays} j</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Jours Travaillés</p>
            </div>
        </div>
        {/* Congés */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-center items-center text-center gap-2 shadow-sm">
            <div className="p-3 bg-emerald-50 rounded-full text-emerald-600"><Sun size={20}/></div>
            <div>
                <p className="text-2xl font-black text-slate-800">{stats.leaveDays} j</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Congés</p>
            </div>
        </div>
        {/* Maladie */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-center items-center text-center gap-2 shadow-sm">
            <div className="p-3 bg-amber-50 rounded-full text-amber-600"><Thermometer size={20}/></div>
            <div>
                <p className="text-2xl font-black text-slate-800">{stats.sickDays} j</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Maladie</p>
            </div>
        </div>
        {/* Formation */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-center items-center text-center gap-2 shadow-sm">
            <div className="p-3 bg-indigo-50 rounded-full text-indigo-600"><GraduationCap size={20}/></div>
            <div>
                <p className="text-2xl font-black text-slate-800">{stats.trainingDays} j</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Formation</p>
            </div>
        </div>
      </div>


      {/* --- LISTE DES INTERVENTIONS --- */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Technicien</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">N° Affaire</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">H. Travail</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">H. Trajet</th>
                 <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">H. Sup</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Adresse</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMissions.map(mission => {
                const tech = technicians.find(t => t.id === mission.technicianId);
                return (
                  <tr key={mission.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-sm text-slate-800 whitespace-nowrap">{format(parseISO(mission.date), 'dd/MM/yyyy')}</td>
                    <td className="px-6 py-4 font-bold text-sm text-slate-600 whitespace-nowrap">{tech?.name || mission.technicianId}</td>
                    <td className="px-6 py-4 font-black text-sm text-indigo-600 whitespace-nowrap">{mission.jobNumber || ''}</td>
                    <td className="px-6 py-4 font-bold text-sm text-slate-600 text-center">{(mission.workHours || 0)}h</td>
                    <td className="px-6 py-4 font-bold text-sm text-slate-600 text-center">{(mission.travelHours || 0)}h</td>
                    <td className="px-6 py-4 font-bold text-sm text-slate-600 text-center">{(mission.overtimeHours || 0)}h</td>
                    <td className="px-6 py-4 text-xs text-slate-500 truncate max-w-xs">{mission.address || 'N/A'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                         <button onClick={() => handleDuplicateMission(mission)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Dupliquer la ligne"><Copy size={16} /></button>
                        <button onClick={() => handleEditMission(mission)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit size={16} /></button>
                        <button onClick={() => setMissionToDelete(mission.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredMissions.length === 0 && (
            <div className="text-center py-20">
                <p className="font-black text-slate-500">Aucune intervention trouvée</p>
                <p className="text-sm text-slate-400">Essayez d'ajuster vos filtres de recherche.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MissionManager;
