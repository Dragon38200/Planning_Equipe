import { User, Mission, FormTemplate, FormResponse, AppSettings } from "./types";

// Noms des collections (Correspondance avec les clés de l'objet AppData)
export const COLL_USERS = "users";
export const COLL_MISSIONS = "missions";
export const COLL_TEMPLATES = "templates";
export const COLL_RESPONSES = "responses";
export const COLL_SETTINGS = "settings";

// --- VERCEL KV ADAPTER (VIA API) ---

// Cache local des données (Miroir de la DB)
let cache: {
  users: User[];
  missions: Mission[];
  templates: FormTemplate[];
  responses: FormResponse[];
  appSettings: AppSettings;
} = {
  users: [],
  missions: [],
  templates: [],
  responses: [],
  appSettings: { appName: 'PLANIT-MOUNIER', appLogoUrl: '' }
};

let isLoaded = false;
let saveTimeout: any = null;
const listeners: Record<string, Array<(data: any[]) => void>> = {};
const LOCAL_STORAGE_BACKUP_KEY = 'planit-mounier-backup';

// Récupère les données depuis l'API (qui lit Vercel KV) ou LocalStorage en fallback
const fetchData = async () => {
  if (isLoaded) return;
  
  let apiSuccess = false;
  
  try {
    // Appel vers l'endpoint api/data.ts
    // Le timeout permet de ne pas bloquer trop longtemps si le serveur ne répond pas
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 3000);
    
    const res = await fetch('/api/data', { signal: controller.signal });
    clearTimeout(id);

    if (res.ok) {
      const data = await res.json();
      cache = {
        users: data.users || [],
        missions: data.missions || [],
        templates: data.templates || [],
        responses: data.responses || [],
        appSettings: data.appSettings || { appName: 'PLANIT-MOUNIER', appLogoUrl: '' }
      };
      apiSuccess = true;
      console.log("Données chargées depuis Vercel KV");
    } else {
      console.warn(`API Vercel non disponible (${res.status} ${res.statusText}). Passage en mode hors-ligne.`);
    }
  } catch (e) {
    console.warn("Impossible de joindre l'API Vercel. Passage en mode hors-ligne.", e);
  }

  // Si l'API a échoué, on tente de récupérer le backup LocalStorage
  if (!apiSuccess) {
      const local = localStorage.getItem(LOCAL_STORAGE_BACKUP_KEY);
      if (local) {
          try {
              const parsed = JSON.parse(local);
              // On fusionne prudemment
              cache = { ...cache, ...parsed };
              console.log("Données restaurées depuis le backup local.");
          } catch(e) {
              console.error("Backup local corrompu.", e);
          }
      }
  }

  isLoaded = true;
  notifyAll();
};

// Envoie les données vers l'API (qui écrit dans Vercel KV)
const syncWithServer = () => {
  // 1. Sauvegarde locale immédiate (Backup)
  try {
    localStorage.setItem(LOCAL_STORAGE_BACKUP_KEY, JSON.stringify(cache));
  } catch (e) {
    console.error("Erreur sauvegarde locale", e);
  }

  // 2. Synchro Cloud différée
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cache)
      });
      if (!res.ok) throw new Error(`Erreur API: ${res.statusText}`);
      console.log('Données synchronisées avec Vercel KV');
    } catch (e) {
      console.error('Echec synchro Vercel (Données sauvegardées localement):', e);
    }
  }, 1000); 
};

// Helper pour récupérer la bonne partie du cache selon le nom de collection
const getDataForKey = (key: string): any[] => {
  if (key === COLL_USERS) return cache.users;
  if (key === COLL_MISSIONS) return cache.missions;
  if (key === COLL_TEMPLATES) return cache.templates;
  if (key === COLL_RESPONSES) return cache.responses;
  if (key === COLL_SETTINGS) return [cache.appSettings]; // On retourne un tableau pour uniformiser l'API
  return [];
};

const notify = (key: string) => {
  if (listeners[key]) {
    const data = getDataForKey(key);
    listeners[key].forEach(cb => cb(data));
  }
};

const notifyAll = () => {
  Object.keys(listeners).forEach(key => notify(key));
};

/**
 * S'abonne aux changements d'une collection
 * Cette fonction est utilisée par App.tsx pour mettre à jour l'interface
 */
export const subscribe = (collection: string, callback: (data: any[]) => void) => {
  if (!listeners[collection]) listeners[collection] = [];
  listeners[collection].push(callback);
  
  // Si les données ne sont pas chargées, on lance le fetch
  if (!isLoaded) {
    fetchData().then(() => {
        // Une fois chargé (succès ou échec/fallback), on notifie
        callback(getDataForKey(collection));
    });
  } else {
    // Sinon on renvoie immédiatement les données du cache
    callback(getDataForKey(collection));
  }

  // Désabonnement
  return () => {
    listeners[collection] = listeners[collection].filter(cb => cb !== callback);
  };
};

export const db = true; // Indicateur pour App.tsx que la DB est "prête"

/**
 * Sauvegarde ou met à jour un document
 */
export const saveDocument = async (collectionName: string, id: string, data: any) => {
    if (!isLoaded) await fetchData();

    // Mise à jour optimiste du cache local
    if (collectionName === COLL_USERS) {
        const idx = cache.users.findIndex(u => u.id === id);
        if (idx >= 0) cache.users[idx] = { ...cache.users[idx], ...data };
        else cache.users.push({ ...data, id });
    } else if (collectionName === COLL_MISSIONS) {
        const idx = cache.missions.findIndex(m => m.id === id);
        if (idx >= 0) cache.missions[idx] = { ...cache.missions[idx], ...data };
        else cache.missions.push({ ...data, id });
    } else if (collectionName === COLL_TEMPLATES) {
        const idx = cache.templates.findIndex(t => t.id === id);
        if (idx >= 0) cache.templates[idx] = { ...cache.templates[idx], ...data };
        else cache.templates.push({ ...data, id });
    } else if (collectionName === COLL_RESPONSES) {
        const idx = cache.responses.findIndex(r => r.id === id);
        if (idx >= 0) cache.responses[idx] = { ...cache.responses[idx], ...data };
        else cache.responses.push({ ...data, id });
    } else if (collectionName === COLL_SETTINGS) {
        cache.appSettings = { ...cache.appSettings, ...data };
    }

    notify(collectionName);
    syncWithServer(); // Envoi en background vers Vercel
};

/**
 * Supprime un document
 */
export const deleteDocument = async (collectionName: string, id: string) => {
    if (!isLoaded) await fetchData();

    if (collectionName === COLL_USERS) {
        cache.users = cache.users.filter(u => u.id !== id);
    } else if (collectionName === COLL_MISSIONS) {
        cache.missions = cache.missions.filter(m => m.id !== id);
    } else if (collectionName === COLL_TEMPLATES) {
        cache.templates = cache.templates.filter(t => t.id !== id);
    } else if (collectionName === COLL_RESPONSES) {
        cache.responses = cache.responses.filter(r => r.id !== id);
    }
    
    notify(collectionName);
    syncWithServer();
};

/**
 * Sauvegarde en masse
 */
export const batchSaveMissions = async (missions: Mission[]) => {
    if (!isLoaded) await fetchData();
    
    missions.forEach(m => {
        const idx = cache.missions.findIndex(existing => existing.id === m.id);
        if (idx >= 0) cache.missions[idx] = m;
        else cache.missions.push(m);
    });

    notify(COLL_MISSIONS);
    syncWithServer();
};

/**
 * Initialise la base (Géré côté serveur par api/data.ts, ici on force juste le chargement)
 */
export const seedDatabaseIfEmpty = async (
    defaultUsers: User[], 
    defaultTemplates: FormTemplate[], 
    defaultMissions: Mission[]
) => {
    if (!isLoaded) await fetchData();
};