
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

// === INTERFACE POUR LES DONNÉES CENTRALISÉES ===
interface AppData {
  users: User[];
  missions: Mission[];
  templates: FormTemplate[];
  responses: FormResponse[];
  appSettings: AppSettings;
}

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
  const [isSaving, setIsSaving] = React.useState(false);

  const [activeTab, setActiveTab] = React.useState<'PLANNING' | 'FORMS' | 'ADMIN'>('PLANNING');
  const [managerView, setManagerView] = React.useState<'PLANNING' | 'GESTION'>('PLANNING');
  const [adminFormsView, setAdminFormsView] = React.useState<'TEMPLATES' | 'HISTORY'>('TEMPLATES');
  const [loginId, setLoginId] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');
  const [loginError, setLoginError] = React.useState('');

  // --- GLOBAL FORM STATE ---
  const [globalFormTemplate, setGlobalFormTemplate] = useState<FormTemplate | null>(null);

  // === FONCTIONS API VERCEL KV ===
  
  // Charger les données depuis Vercel KV
  const loadData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/data', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data: AppData = await response.json();
      
      setUsers(data.users || []);
      setMissions(data.missions || []);
      setTemplates(data.templates || []);
      setResponses(data.responses || []);
      setAppSettings(data.appSettings || { appName: 'PLANIT-MOUNIER', appLogoUrl: '' });
      
      setError(null);
    } catch (e: any) {
      console.error('Erreur chargement données:', e);
      setError(`Impossible de charger les données: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Sauvegarder les données vers Vercel KV
  const saveData = async (updatedData: Partial<AppData>) => {
    try {
      setIsSaving(true);
      
      // Construire l'objet complet avec les données actuelles + modifications
      const dataToSave: AppData = {
        users: updatedData.users !== undefined ? updatedData.users : users,
        missions: updatedData.missions !== undefined ? updatedData.missions : missions,
        templates: updatedData.templates !== undefined ? updatedData.templates : templates,
        responses: updatedData.responses !== undefined ? updatedData.responses : responses,
        appSettings: updatedData.appSettings !== undefined ? updatedData.appSettings : appSettings,
      };

      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave)
      });

      if (!response.ok) {
        throw new Error(`Erreur sauvegarde: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // Mettre à jour l'état local immédiatement pour une meilleure UX
        if (updatedData.users) setUsers(updatedData.users);
        if (updatedData.missions) setMissions(updatedData.missions);
        if (updatedData.templates) setTemplates(updatedData.templates);
        if (updatedData.responses) setResponses(updatedData.responses);
        if (updatedData.appSettings) setAppSettings(updatedData.appSettings);
      } else {
        throw new Error(result.error || 'Erreur inconnue');
      }
      
    } catch (e: any) {
      console.error('Erreur sauvegarde:', e);
      setError(`Erreur lors de la sauvegarde: ${e.message}`);
      throw e; // Re-throw pour que les composants puissent gérer l'erreur
    } finally {
      setIsSaving(false);
    }
  };

  // === INITIALISATION AU CHARGEMENT ===
  useEffect(() => {
    loadData();
    
    // Optionnel: Rafraîchir périodiquement les données (sync multi-utilisateurs)
    const interval = setInterval(() => {
      if (!isSaving) { // Ne pas recharger pendant une sauvegarde
        loadData();
      }
    }, 30000); // Toutes les 30 secondes

    return () => clearInterval(interval);
  }, []);

  // === HANDLERS ACTIONS (AVEC SAUVEGARDE VERCEL KV) ===

  const handleUpdateUsers = async (newUsers: User[], oldId?: string, newId?: string) => {
    try {
      // Gérer le changement d'ID
      if (oldId && newId && oldId !== newId) {
        // Mettre à jour les missions liées
        const updatedMissions = missions.map(m => 
          m.technicianId === oldId ? { ...m, technicianId: newId } : m
        );
        await saveData({ users: newUsers, missions: updatedMissions });
      } else {
        await saveData({ users: newUsers });
      }
    } catch (e) {
      console.error('Erreur mise à jour utilisateurs:', e);
    }
  };
  
  const handleSaveResponse = async (response: FormResponse) => {
    try {
      const updatedResponses = [...responses];
      const existingIndex = updatedResponses.findIndex(r => r.id === response.id);
      
      if (existingIndex >= 0) {
        updatedResponses[existingIndex] = response;
      } else {
        updatedResponses.push(response);
      }
      
      await saveData({ responses: updatedResponses });
    } catch (e) {
      console.error('Erreur sauvegarde réponse:', e);
    }
  };

  const handleUpdateTemplates = async (newTemplates: FormTemplate[]) => {
    try {
      await saveData({ templates: newTemplates });
    } catch (e) {
      console.error('Erreur mise à jour templates:', e);
    }
  };

  const handleAppendMissions = async (newMissions: Mission[]) => {
    try {
      const updatedMissions = [...missions, ...newMissions];
      await saveData({ missions: updatedMissions });
    } catch (e) {
      console.error('Erreur ajout missions:', e);
    }
  };

  const updateMissions = async (m: Mission[]) => {
    try {
      await saveData({ missions: m });
    } catch (e) {
      console.error('Erreur mise à jour missions:', e);
    }
  };

  const handleDeleteMission = async (missionId: string) => {
    try {
      const updatedMissions = missions.filter(m => m.id !== missionId);
      await saveData({ missions: updatedMissions });
    } catch (e) {
      console.error('Erreur suppression mission:', e);
    }
  };

  const handleUpdateAppSettings = async (settings: AppSettings) => {
    try {
      await saveData({ appSettings: settings });
    } catch (e) {
      console.error('Erreur mise à jour paramètres:', e);
    }
  };

  // === RESTE DU CODE (LOGIN, UI, etc.) ===
  // Note: Le reste du code reste identique à la version Firebase
  // Je mets uniquement les parties essentielles ici

  const handleLogin = () => {
    const foundUser = users.find(
      u => u.id === loginId && u.password === loginPassword
    );
    
    if (foundUser) {
      setCurrentUser(foundUser);
      setLoginError('');
      setLoginId('');
      setLoginPassword('');
    } else {
      setLoginError('Identifiant ou mot de passe incorrect');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('PLANNING');
  };

  // === ECRAN DE CHARGEMENT ===
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Chargement des données...</p>
        </div>
      </div>
    );
  }

  // === ECRAN D'ERREUR ===
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Erreur de connexion</h2>
          <p className="text-gray-600 mb-6 text-center">{error}</p>
          <button
            onClick={loadData}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Loader2 className="w-5 h-5" />
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // === ECRAN DE LOGIN ===
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            {appSettings.appLogoUrl ? (
              <img 
                src={appSettings.appLogoUrl} 
                alt="Logo" 
                className="h-20 mx-auto mb-4 object-contain"
              />
            ) : (
              <Factory className="w-16 h-16 text-blue-600 mx-auto mb-4" />
            )}
            <h1 className="text-3xl font-bold text-gray-800">{appSettings.appName}</h1>
            <p className="text-gray-500 mt-2">Gestion des chantiers</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Identifiant
              </label>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Votre identifiant"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {loginError && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={!loginId || !loginPassword}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-5 h-5" />
              Se connecter
            </button>
          </div>

          {isSaving && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Synchronisation...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // === INTERFACE PRINCIPALE (après login) ===
  // Le reste du code UI reste identique, j'inclus juste la structure de base
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {appSettings.appLogoUrl ? (
                <img 
                  src={appSettings.appLogoUrl} 
                  alt="Logo" 
                  className="h-10 object-contain"
                />
              ) : (
                <Factory className="w-8 h-8 text-blue-600" />
              )}
              <div>
                <h1 className="text-xl font-bold text-gray-800">{appSettings.appName}</h1>
                <p className="text-xs text-gray-500">
                  Connecté : {currentUser.name} ({currentUser.role})
                </p>
              </div>
            </div>

            {isSaving && (
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-full">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sauvegarde...</span>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenu principal - Les composants TechnicianDashboard, ManagerDashboard, etc. */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentUser.role === Role.TECHNICIAN && (
          <TechnicianDashboard
            currentUser={currentUser}
            missions={missions}
            users={users}
            templates={templates}
            onSaveMission={async (mission) => {
              const updatedMissions = [...missions];
              const existingIndex = updatedMissions.findIndex(m => m.id === mission.id);
              if (existingIndex >= 0) {
                updatedMissions[existingIndex] = mission;
              } else {
                updatedMissions.push(mission);
              }
              await updateMissions(updatedMissions);
            }}
            onDeleteMission={handleDeleteMission}
            onSaveResponse={handleSaveResponse}
            responses={responses}
          />
        )}

        {currentUser.role === Role.MANAGER && (
          <ManagerDashboard
            currentUser={currentUser}
            missions={missions}
            users={users}
            onUpdateMissions={updateMissions}
            currentWeek={currentWeek}
            onWeekChange={setCurrentWeek}
          />
        )}

        {currentUser.role === Role.ADMIN && (
          <AdminDashboard
            users={users}
            missions={missions}
            templates={templates}
            responses={responses}
            appSettings={appSettings}
            onUpdateUsers={handleUpdateUsers}
            onUpdateMissions={updateMissions}
            onUpdateTemplates={handleUpdateTemplates}
            onUpdateAppSettings={handleUpdateAppSettings}
            currentWeek={currentWeek}
            onWeekChange={setCurrentWeek}
          />
        )}
      </main>
    </div>
  );
};

export default App;
