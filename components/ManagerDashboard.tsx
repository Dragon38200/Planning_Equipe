
import React, { useState, useMemo } from 'react';
import { User, Mission, FormResponse, MissionStatus, FormTemplate, MissionType } from '../types';
import { X, ChevronLeft, ChevronRight, ShieldCheck, ClipboardList, Clock, ShieldX, Sun, Thermometer, GraduationCap, Briefcase } from 'lucide-react';
import { isSameDay, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, isToday, startOfDay, endOfDay, getWeek, getYear } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  user: User;
  missions: Mission[];
  technicians: User[];
  onUpdateMissions: (m: Mission[]) => void;
  onRemoveMission: (id: string) => void;
  responses: FormResponse[];
  templates: FormTemplate[];
}

const getStatusIcon = (status: MissionStatus) => {
    switch(status) {
      case MissionStatus.VALIDATED: return <ShieldCheck className="text-emerald-500" size={14} />;
      case MissionStatus.REJECTED: return <ShieldX className="text-red-500" size={14} />;
      case MissionStatus.SUBMITTED: return <Clock className="text-blue-500" size={14} />;
      default: return null;
    }
};

const getTypeClasses = (mission: Mission): string => {
  const job = (mission.jobNumber || '').toUpperCase();

  if (job.includes('CONGE')) return 'bg-emerald-50 border-emerald-200 text-emerald-900';
  if (job.includes('MALADIE')) return 'bg-amber-50 border-amber-200 text-amber-900';
  if (job.includes('FORMATION')) return 'bg-indigo-50 border-indigo-200 text-indigo-900';
  
  return 'bg-slate-50 border-slate-200 text-slate-600';
};

const getTypeIcon = (mission: Mission) => {
    const job = (mission.jobNumber || '').toUpperCase();
    if (job.includes('CONGE')) return <Sun size={12} className="text-emerald-600" />;
    if (job.includes('MALADIE')) return <Thermometer size={12} className="text-amber-600" />;
    if (job.includes('FORMATION')) return <GraduationCap size={12} className="text-indigo-600" />;
    return <Briefcase size={12} className="text-slate-400" />;
};

const ManagerDashboard: React.FC<Props> = ({ user, missions, technicians, onUpdateMissions, onRemoveMission, responses, templates }) => {
  const [view, setView] = useState<'DAY' | 'WEEK' | 'MONTH'>('WEEK');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionComment, setRejectionComment] = useState("");
  const [activeResponse, setActiveResponse] = useState<FormResponse | null>(null);

  const days = useMemo(() => {
    let start = new Date();
    let end = new Date();

    if (view === 'WEEK') {
        start = startOfWeek(currentDate, { weekStartsOn: 1 });
        end = endOfWeek(currentDate, { weekStartsOn: 1 });
    } else if (view === 'MONTH') {
        start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
        end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    } else {
        start = startOfDay(currentDate);
        end = endOfDay(currentDate);
    }
    
    try {
        return eachDayOfInterval({ start, end });
    } catch (e) {
        return [];
    }
  }, [view, currentDate]);

  const stats = useMemo(() => {
    if (!days || days.length === 0) return { totalHours: 0, workDays: 0, leaveDays: 0, sickDays: 0, trainingDays: 0 };

    let totalHours = 0;
    let workDays = 0;
    let leaveDays = 0;
    let sickDays = 0;
    let trainingDays = 0;

    let start: Date;
    let end: Date;

    try {
        start = startOfDay(days[0]);
        end = endOfDay(days[days.length - 1]);
    } catch (e) {
        // En cas d'erreur de date (tableau vide ou invalide), on retourne des zéros pour éviter le crash
        return { totalHours: 0, workDays: 0, leaveDays: 0, sickDays: 0, trainingDays: 0 };
    }

    // Filtrer les missions visibles (techniciens affichés + plage de dates)
    const visibleMissions = missions.filter(m => {
        if (!m.date) return false;
        const d = new Date(m.date);
        if (isNaN(d.getTime())) return false; // Sécurité date invalide
        return d >= start && d <= end && technicians.some(t => t.id === m.technicianId);
    });

    visibleMissions.forEach(m => {
        totalHours += (m.workHours || 0) + (m.travelHours || 0) + (m.overtimeHours || 0);
        
        const jobUpper = (m.jobNumber || '').toUpperCase();
        const isLeave = m.type === MissionType.LEAVE || jobUpper.includes('CONGE');
        const isSick = m.type === MissionType.SICK || jobUpper.includes('MALADIE');
        const isTraining = m.type === MissionType.TRAINING || jobUpper.includes('FORMATION');

        if (isLeave) leaveDays++;
        else if (isSick) sickDays++;
        else if (isTraining) trainingDays++;
        else if ((m.workHours > 0 || m.travelHours > 0)) workDays++;
    });

    return { totalHours, workDays, leaveDays, sickDays, trainingDays };
  }, [missions, days, technicians]);

  const handlePrev = () => {
    if (view === 'WEEK') setCurrentDate(d => subWeeks(d, 1));
    else if (view === 'MONTH') setCurrentDate(d => subMonths(d, 1));
    else setCurrentDate(d => subDays(d, 1));
  };

  const handleNext = () => {
    if (view === 'WEEK') setCurrentDate(d => addWeeks(d, 1));
    else if (view === 'MONTH') setCurrentDate(d => addMonths(d, 1));
    else setCurrentDate(d => addDays(d, 1));
  };

  const handleValidate = () => {
      if (!selectedMission) return;
      onUpdateMissions([{ ...selectedMission, status: MissionStatus.VALIDATED, rejectionComment: undefined }]);
      setSelectedMission(null);
  };

  const handleReject = () => {
      if (!selectedMission) return;
      if (!isRejecting) { setIsRejecting(true); return; }
      onUpdateMissions([{ ...selectedMission, status: MissionStatus.REJECTED, rejectionComment }]);
      setSelectedMission(null);
      setIsRejecting(false);
      setRejectionComment("");
  };

  if (!days || days.length === 0) return <div>Chargement du calendrier...</div>;

  return (
    <div className="space-y-6">
        {/* MODALE MISSION */}
        {selectedMission && (
            <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                    <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                        <h3 className="text-lg font-black uppercase tracking-tight">Détails Intervention</h3>
                        <button onClick={() => {setSelectedMission(null); setIsRejecting(false);}} className="p-2 hover:bg-white/10 rounded-full"><X/></button>
                    </div>
                    <div className="p-8 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div><p className="text-[10px] text-slate-400 uppercase font-black">Date</p><p className="font-bold text-slate-800">{format(new Date(selectedMission.date), 'dd/MM/yyyy')}</p></div>
                            <div><p className="text-[10px] text-slate-400 uppercase font-black">Technicien</p><p className="font-bold text-slate-800">{technicians.find(t => t.id === selectedMission.technicianId)?.name}</p></div>
                            <div><p className="text-[10px] text-slate-400 uppercase font-black">Affaire</p><p className="font-black text-indigo-600">{selectedMission.jobNumber}</p></div>
                            <div><p className="text-[10px] text-slate-400 uppercase font-black">Heures</p><p className="font-bold text-slate-800">Tv: {selectedMission.workHours}h / Tr: {selectedMission.travelHours}h</p></div>
                            <div className="col-span-2"><p className="text-[10px] text-slate-400 uppercase font-black">Description</p><p className="font-medium text-slate-600 text-sm">{selectedMission.description || 'Aucune description'}</p></div>
                        </div>

                        {/* Rapports associés */}
                        <div className="pt-4 border-t border-slate-100">
                             <p className="text-[10px] text-slate-400 uppercase font-black mb-2">Rapports liés</p>
                             <div className="space-y-2">
                                {responses.filter(r => r.missionId === selectedMission.id).map(r => (
                                    <button key={r.id} onClick={() => setActiveResponse(r)} className="w-full p-3 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-xl flex items-center justify-between group transition-all">
                                        <div className="flex items-center gap-2">
                                            <ClipboardList size={16} className="text-indigo-600"/>
                                            <span className="text-xs font-bold text-slate-700">Rapport du {format(new Date(r.submittedAt), 'dd/MM HH:mm')}</span>
                                        </div>
                                    </button>
                                ))}
                                {responses.filter(r => r.missionId === selectedMission.id).length === 0 && <p className="text-xs text-slate-400 italic">Aucun rapport pour cette mission.</p>}
                             </div>
                        </div>

                        {/* Actions */}
                        {isRejecting ? (
                            <div className="bg-red-50 p-4 rounded-2xl space-y-3 animate-in fade-in slide-in-from-bottom-2">
                                <label className="text-xs font-black text-red-600 uppercase">Motif du rejet</label>
                                <textarea value={rejectionComment} onChange={e => setRejectionComment(e.target.value)} className="w-full p-3 border border-red-200 rounded-xl text-sm focus:outline-none focus:border-red-500" placeholder="Ex: Heures incorrectes..."></textarea>
                                <button onClick={handleReject} className="w-full py-3 bg-red-600 text-white rounded-xl font-black uppercase text-xs">Confirmer le rejet</button>
                            </div>
                        ) : (
                            <div className="flex gap-4 pt-4">
                                <button onClick={() => setIsRejecting(true)} className="flex-1 py-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-2xl font-black uppercase text-xs">Refuser</button>
                                <button onClick={handleValidate} className="flex-1 py-4 bg-emerald-600 text-white hover:bg-emerald-700 rounded-2xl font-black uppercase text-xs shadow-lg shadow-emerald-200">Valider</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
        
        {/* VIEW RESPONSE MODAL */}
        {activeResponse && (
             <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] p-8 relative animate-in zoom-in-95">
                    <button onClick={() => setActiveResponse(null)} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-full"><X/></button>
                    <h2 className="text-2xl font-black text-slate-800 mb-6 uppercase">Détails du rapport</h2>
                    <div className="space-y-4">
                         {templates.find(t => t.id === activeResponse.templateId)?.fields.map(field => (
                             <div key={field.id} className="border-b border-slate-100 pb-2">
                                 <p className="text-[10px] font-black text-slate-400 uppercase">{field.label}</p>
                                 <p className="text-sm font-bold text-slate-800">
                                     {field.type === 'checkbox' 
                                        ? (activeResponse.data[field.id] ? 'OUI / SANS RÉSERVE' : 'NON / AVEC RÉSERVE') 
                                        : (activeResponse.data[field.id]?.toString() || '-')}
                                 </p>
                             </div>
                         ))}
                    </div>
                </div>
             </div>
        )}

        {/* CONTROLS */}
        <div className="flex justify-between items-center bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4">
                <button onClick={handlePrev} className="p-3 bg-slate-100 rounded-xl hover:bg-indigo-100 hover:text-indigo-600 transition-colors"><ChevronLeft size={20}/></button>
                <div className="text-center">
                    <p className="text-lg font-black text-slate-800 uppercase tracking-tight">{view === 'WEEK' ? `Semaine ${getWeek(currentDate, {weekStartsOn: 1})} - ${getYear(currentDate)}` : format(currentDate, 'MMMM yyyy', {locale: fr})}</p>
                </div>
                <button onClick={handleNext} className="p-3 bg-slate-100 rounded-xl hover:bg-indigo-100 hover:text-indigo-600 transition-colors"><ChevronRight size={20}/></button>
                <button onClick={() => setCurrentDate(new Date())} className="ml-4 px-4 py-2 bg-slate-100 rounded-xl text-xs font-black uppercase text-slate-500 hover:bg-slate-200">Aujourd'hui</button>
            </div>
            <div className="flex bg-slate-100 p-1.5 rounded-xl">
                <button onClick={() => setView('WEEK')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${view === 'WEEK' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Semaine</button>
                <button onClick={() => setView('MONTH')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${view === 'MONTH' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Mois</button>
            </div>
        </div>

        {/* INDICATEURS DE PERFORMANCE (STATS) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
             <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-center items-center text-center gap-2 shadow-sm">
                <div className="p-2 bg-slate-100 rounded-full text-slate-500"><Clock size={16}/></div>
                <div><p className="text-xl font-black text-slate-800">{stats.totalHours.toLocaleString('fr-FR')} h</p><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total Heures</p></div>
             </div>
             <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-center items-center text-center gap-2 shadow-sm">
                <div className="p-2 bg-blue-50 rounded-full text-blue-600"><Briefcase size={16}/></div>
                <div><p className="text-xl font-black text-slate-800">{stats.workDays.toLocaleString('fr-FR', {maximumFractionDigits: 1})} j</p><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Travaillés</p></div>
             </div>
             <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-center items-center text-center gap-2 shadow-sm">
                <div className="p-2 bg-emerald-50 rounded-full text-emerald-600"><Sun size={16}/></div>
                <div><p className="text-xl font-black text-slate-800">{stats.leaveDays.toLocaleString('fr-FR', {maximumFractionDigits: 1})} j</p><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Congés</p></div>
             </div>
             <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-center items-center text-center gap-2 shadow-sm">
                <div className="p-2 bg-amber-50 rounded-full text-amber-600"><Thermometer size={16}/></div>
                <div><p className="text-xl font-black text-slate-800">{stats.sickDays.toLocaleString('fr-FR', {maximumFractionDigits: 1})} j</p><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Maladie</p></div>
             </div>
             <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-center items-center text-center gap-2 shadow-sm">
                <div className="p-2 bg-indigo-50 rounded-full text-indigo-600"><GraduationCap size={16}/></div>
                <div><p className="text-xl font-black text-slate-800">{stats.trainingDays.toLocaleString('fr-FR', {maximumFractionDigits: 1})} j</p><p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Formation</p></div>
             </div>
        </div>

        {/* GRID */}
        <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-xl overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr>
                        <th className="p-4 bg-slate-50 border-b border-r border-slate-200 w-48 min-w-[150px] sticky left-0 z-10 text-[10px] font-black uppercase text-slate-400 tracking-widest text-left">Technicien</th>
                        {days.map(day => (
                            <th key={day.toISOString()} className={`p-4 border-b border-slate-100 min-w-[140px] text-center ${isToday(day) ? 'bg-indigo-50' : ''}`}>
                                <p className="text-[10px] font-black uppercase text-slate-400">{format(day, 'EEEE', {locale: fr})}</p>
                                <p className={`text-xl font-black ${isToday(day) ? 'text-indigo-600' : 'text-slate-800'}`}>{format(day, 'd')}</p>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {technicians.map(tech => (
                        <tr key={tech.id} className="hover:bg-slate-50/50">
                            <td className="p-4 border-r border-slate-200 bg-white sticky left-0 z-10">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">{tech.initials}</div>
                                    <p className="font-bold text-sm text-slate-700 truncate">{tech.name}</p>
                                </div>
                            </td>
                            {days.map(day => {
                                const dayMissions = missions.filter(m => m.technicianId === tech.id && m.date && isSameDay(new Date(m.date), day));
                                return (
                                    <td key={day.toISOString()} className={`p-2 align-top h-32 border-l border-slate-50 ${isToday(day) ? 'bg-indigo-50/10' : ''}`}>
                                        <div className="space-y-2 h-full overflow-y-auto scrollbar-none">
                                            {dayMissions.length > 0 ? dayMissions.map(m => (
                                                <button key={m.id} onClick={() => setSelectedMission(m)} className={`w-full text-left p-2 rounded-xl border mb-1 transition-all hover:scale-[1.02] active:scale-95 shadow-sm ${getTypeClasses(m)}`}>
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div className="flex items-center gap-1.5">
                                                            {getTypeIcon(m)}
                                                            <span className="text-[10px] font-black">{m.jobNumber}</span>
                                                        </div>
                                                        {getStatusIcon(m.status)}
                                                    </div>
                                                    {(m.workHours > 0 || m.travelHours > 0) && <p className="text-[9px] font-bold opacity-80">{m.workHours}h / {m.travelHours}h</p>}
                                                </button>
                                            )) : (
                                                <div className="h-full rounded-xl border-2 border-dashed border-slate-100 flex items-center justify-center opacity-0 hover:opacity-100">
                                                    <span className="text-[10px] font-bold text-slate-300">-</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );
};

export default ManagerDashboard;
