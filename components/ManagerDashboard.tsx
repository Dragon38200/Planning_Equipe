
import React, { useState, useMemo } from 'react';
import { User, Mission, WeekSelection, FormResponse, MissionStatus, FormTemplate } from '../types';
import { getWeekDates, exportToCSV } from '../utils';
import { X, ChevronLeft, ChevronRight, ShieldCheck, ClipboardList, CheckCircle2, AlertCircle, FileText, Printer, FileSpreadsheet, MapPin } from 'lucide-react';
import { isSameDay, format } from 'date-fns';
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

const ManagerDashboard: React.FC<Props> = ({ user, missions, technicians, onUpdateMissions, onRemoveMission, responses, templates }) => {
  const [selectedWeek, setSelectedWeek] = useState<WeekSelection>(getWeekDates(new Date().getFullYear(), format(new Date(), 'w') as any) ? {year: new Date().getFullYear(), weekNumber: parseInt(format(new Date(), 'w'))} : {year: 2024, weekNumber: 1});
  const [activeResponse, setActiveResponse] = useState<FormResponse | null>(null);

  const currentWeekInfo = useMemo(() => {
    const d = new Date();
    const startOfYear = new Date(d.getFullYear(), 0, 1);
    const pastDaysOfYear = (d.getTime() - startOfYear.getTime()) / 86400000;
    return {
      year: d.getFullYear(),
      weekNumber: Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7)
    };
  }, []);

  const week = useMemo(() => selectedWeek || currentWeekInfo, [selectedWeek, currentWeekInfo]);
  const weekDates = getWeekDates(week.year, week.weekNumber);

  const relevantMissions = useMemo(() => {
    return missions.filter(m => {
      const mDate = new Date(m.date);
      return weekDates.some(d => isSameDay(mDate, d));
    });
  }, [missions, weekDates]);

  // --- LOGIQUE D'IMPRESSION (V3 - NOUVELLE FENÊTRE) ---
  const handlePrint = () => {
    const reportElement = document.getElementById('printable-report-mgr');
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
    if (!activeResponse) return;
    const template = templates.find(t => t.id === activeResponse.templateId);
    if (!template) { alert("Modèle de formulaire introuvable."); return; }

    const rowData: Record<string, any> = {
      'ID_Rapport': activeResponse.id,
      'Date_Soumission': format(new Date(activeResponse.submittedAt), 'yyyy-MM-dd HH:mm'),
      'Technicien_ID': activeResponse.technicianId,
    };

    template.fields.forEach(field => {
        let value = activeResponse.data[field.id];
        if (field.type === 'checkbox') {
             if (field.id === 'acceptance_type') value = value ? 'SANS RÉSERVE' : 'AVEC RÉSERVE(S)';
            else value = value ? 'OUI' : 'NON';
        } else if (field.type === 'signature') {
            value = value ? '[SIGNATURE FOURNIE]' : '[NON SIGNÉ]';
        }
        const headerKey = field.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_]/g, '').replace(/\s+/g, '_');
        rowData[headerKey] = value || '';
    });
    
    exportToCSV([rowData], `PV_AFFAIRE_${activeResponse.data.job_number || activeResponse.id.slice(-4)}.csv`);
  };


  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Visualisation Rapport */}
      {activeResponse && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                 <div className="bg-emerald-500 p-2.5 rounded-2xl text-white shadow-xl shadow-emerald-500/20"><FileText size={20}/></div>
                 <div>
                    <h2 className="text-lg font-black uppercase tracking-tight">PV de Réception</h2>
                    <p className="text-[9px] font-black opacity-60 uppercase tracking-widest">Technicien: {activeResponse.technicianId}</p>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                  <button onClick={handleExportResponseCSV} className="px-5 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black flex items-center gap-2 uppercase hover:bg-emerald-700 transition-all shadow-lg active:scale-95"><FileSpreadsheet size={16}/> EXPORTER CSV</button>
                  <button onClick={handlePrint} className="px-5 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black flex items-center gap-2 uppercase hover:bg-indigo-700 transition-all shadow-lg active:scale-95"><Printer size={16}/> IMPRIMER PDF</button>
                  <button onClick={() => setActiveResponse(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X /></button>
               </div>
            </div>
            
            {/* ZONE DU RAPPORT PROFESSIONNEL */}
            <div id="printable-report-mgr" className="p-12 overflow-y-auto flex-1 space-y-12 scrollbar-thin bg-white">
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
                     <p className="text-xs font-black text-slate-800">N° {activeResponse.id.slice(-6).toUpperCase()}</p>
                     <p className="text-xs font-black text-slate-800 uppercase tracking-tighter">Date : {format(new Date(activeResponse.submittedAt), 'dd/MM/yyyy')}</p>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-8">
                  <div className="col-span-2 p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Identification du chantier</p>
                     <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                        <div><p className="text-[8px] font-black text-slate-400 uppercase">CLIENT</p><p className="text-sm font-black text-slate-900">{activeResponse.data.client_name || '-'}</p></div>
                        <div><p className="text-[8px] font-black text-slate-400 uppercase">N° COMMANDE</p><p className="text-sm font-black text-slate-900">{activeResponse.data.cmd_number || '-'}</p></div>
                        <div><p className="text-[8px] font-black text-slate-400 uppercase">N° D'AFFAIRE</p><p className="text-sm font-black text-slate-900">{activeResponse.data.job_number || '-'}</p></div>
                        <div><p className="text-[8px] font-black text-slate-400 uppercase">LIBELLÉ</p><p className="text-sm font-black text-slate-900">{activeResponse.data.job_label || '-'}</p></div>
                     </div>
                  </div>
                  <div className="col-span-2 p-6 border-2 border-slate-100 rounded-[2rem] flex items-center gap-6">
                     <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-xl shadow-lg ${activeResponse.data.acceptance_type ? 'bg-emerald-500 shadow-emerald-100' : 'bg-red-500 shadow-red-100'}`}>{activeResponse.data.acceptance_type ? '✔' : '!'}</div>
                     <div>
                        <p className="text-lg font-black text-slate-900 uppercase leading-none mb-1">{activeResponse.data.acceptance_type ? "Travaux acceptés sans réserve" : "Travaux acceptés avec réserve(s)"}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date d'effet : {activeResponse.data.date_effet || '-'}</p>
                     </div>
                  </div>
                  {!activeResponse.data.acceptance_type && (<div className="col-span-2 space-y-2"><p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Détail des réserves</p><div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] min-h-[100px] text-xs font-medium text-slate-700 whitespace-pre-wrap">{activeResponse.data.reserves_list || 'Aucune réserve mentionnée.'}</div></div>)}
                  <div className="col-span-1 space-y-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Entrepreneur (Mounier)</p><div className="relative h-44 border-2 border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center justify-center bg-slate-50/50 overflow-hidden">{activeResponse.data.sig_entrepreneur && <img src={activeResponse.data.sig_entrepreneur} alt="Signature Mounier" className="max-h-full max-w-full object-contain mix-blend-multiply" />}<p className="absolute bottom-4 text-[9px] font-black text-slate-400 uppercase">{activeResponse.data.rep_mounier || '-'}</p></div></div>
                  <div className="col-span-1 space-y-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">Client</p><div className="relative h-44 border-2 border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center justify-center bg-slate-50/50 overflow-hidden">{activeResponse.data.sig_client && <img src={activeResponse.data.sig_client} alt="Signature Client" className="max-h-full max-w-full object-contain mix-blend-multiply" />}<p className="absolute bottom-4 text-[9px] font-black text-slate-400 uppercase">{activeResponse.data.rep_client || '-'}</p></div></div>
               </div>
               <div className="mt-8"><button onClick={() => setActiveResponse(null)} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800">Fermer la vue</button></div>
            </div>
          </div>
        </div>
      )}

      {/* Header et Tableau Manager */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl print:hidden">
        <div className="flex items-center gap-6"><div className="bg-slate-900 p-4 rounded-3xl text-white shadow-2xl shadow-slate-200"><ShieldCheck size={32} /></div><div><h1 className="text-3xl font-black text-slate-800 tracking-tight leading-none mb-1">Relevés de Chantiers</h1><p className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Supervision hebdomadaire • {user.initials}</p></div></div>
        <div className="flex items-center gap-4 bg-slate-100 p-2 rounded-2xl"><button onClick={() => setSelectedWeek({year: week.year, weekNumber: week.weekNumber - 1})} className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"><ChevronLeft size={20} /></button><div className="px-6 py-2 min-w-[140px] text-center text-xs font-black text-indigo-600 uppercase tracking-widest">Semaine {week.weekNumber}</div><button onClick={() => setSelectedWeek({year: week.year, weekNumber: week.weekNumber + 1})} className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"><ChevronRight size={20} /></button></div>
      </div>
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden print:hidden"><div className="overflow-x-auto"><table className="w-full text-left table-fixed min-w-[1000px]"><thead className="bg-slate-50/80 border-b border-slate-100"><tr><th className="w-64 px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Collaborateur</th>{weekDates.map(d => (<th key={d.toISOString()} className="px-4 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center border-l border-slate-100">{format(d, 'EEE d', {locale: fr})}</th>))}</tr></thead><tbody className="divide-y divide-slate-50">{technicians.map(tech => (<tr key={tech.id} className="group hover:bg-slate-50/30 transition-all"><td className="px-8 py-6 border-r border-slate-100 bg-white sticky left-0 z-10"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-xs text-slate-500">{tech.initials}</div><span className="font-black text-slate-800 text-sm tracking-tight">{tech.name}</span></div></td>{weekDates.map(date => { const dayMissions = relevantMissions.filter(m => m.technicianId === tech.id && isSameDay(new Date(m.date), date)); return (<td key={date.toISOString()} className="p-3 border-l border-slate-50 min-h-[100px] align-top"><div className="flex flex-col gap-2">{dayMissions.map(m => { const response = responses.find(r => r.missionId === m.id); if (!m.jobNumber) return null; return (<div key={m.id} className={`p-3 rounded-2xl text-[10px] font-black border-2 flex flex-col gap-2 transition-all ${response ? 'bg-emerald-50 border-emerald-100 text-emerald-900 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500'}`}><div className="flex justify-between items-start"><span className="truncate">{m.jobNumber}</span><div className="flex items-center gap-1"><span className="px-2 py-0.5 bg-white/50 rounded-lg">{m.hours}h</span>{m.address && (<a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(m.address)}`} target="_blank" rel="noopener noreferrer" className="p-1 rounded-md text-slate-400 hover:bg-blue-100 hover:text-blue-600" title="Itinéraire"><MapPin size={14}/></a>)}</div></div>{response && (<button onClick={() => setActiveResponse(response)} className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200"><ClipboardList size={12} /> VOIR PV</button>)}</div>);})}</div></td>);})}</tr>))}</tbody></table></div></div>
    </div>
  );
};

export default ManagerDashboard;