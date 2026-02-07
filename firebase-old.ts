import { User, Mission, FormTemplate, FormResponse, AppSettings } from "./types";

// Noms des collections (Clés LocalStorage)
export const COLL_USERS = "users";
export const COLL_MISSIONS = "missions";
export const COLL_TEMPLATES = "templates";
export const COLL_RESPONSES = "responses";
export const COLL_SETTINGS = "settings";

// --- LOCAL STORAGE ADAPTER ---

// Système simple d'abonnement pour mettre à jour l'UI quand le localStorage change
const listeners: Record<string, Array<(data: any[]) => void>> = {};

// Charge les données depuis le localStorage
const load = (key: string): any[] => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : [];
  } catch (e) {
    console.error(`Erreur de lecture LocalStorage pour ${key}`, e);
    return [];
  }
};

// Sauvegarde et notifie les abonnés
const save = (key: string, data: any[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    notify(key, data);
  } catch (e) {
    console.error(`Erreur d'écriture LocalStorage pour ${key}`, e);
  }
};

const notify = (key: string, data: any[]) => {
  if (listeners[key]) {
    listeners[key].forEach(cb => cb(data));
  }
};

/**
 * S'abonne aux changements d'une collection
 */
export const subscribe = (collection: string, callback: (data: any[]) => void) => {
  if (!listeners[collection]) listeners[collection] = [];
  listeners[collection].push(callback);
  
  // Appel initial immédiat avec les données courantes
  callback(load(collection));

  // Fonction de nettoyage (unsubscribe)
  return () => {
    listeners[collection] = listeners[collection].filter(cb => cb !== callback);
  };
};

export const db = true;

/**
 * Sauvegarde ou met à jour un document
 */
export const saveDocument = async (collectionName: string, id: string, data: any) => {
    // Petit délai pour simuler l'asynchronisme et ne pas bloquer l'UI
    await new Promise(r => setTimeout(r, 10));
    
    const items = load(collectionName);
    // Gestion spéciale pour les settings qui sont souvent un objet unique mais stockés en tableau ici
    const index = items.findIndex((i: any) => i.id === id || (collectionName === COLL_SETTINGS && i.id === 'app_config'));
    
    if (index >= 0) {
        items[index] = { ...items[index], ...data };
    } else {
        items.push({ ...data, id });
    }
    save(collectionName, items);
};

/**
 * Supprime un document
 */
export const deleteDocument = async (collectionName: string, id: string) => {
    await new Promise(r => setTimeout(r, 10));
    let items = load(collectionName);
    items = items.filter((i: any) => i.id !== id);
    save(collectionName, items);
};

/**
 * Sauvegarde en masse
 */
export const batchSaveMissions = async (missions: Mission[]) => {
    await new Promise(r => setTimeout(r, 10));
    const items = load(COLL_MISSIONS);
    missions.forEach(m => {
        const idx = items.findIndex((i: any) => i.id === m.id);
        if (idx >= 0) items[idx] = m;
        else items.push(m);
    });
    save(COLL_MISSIONS, items);
};

/**
 * Initialise la base de données locale avec les données par défaut si elle est vide
 */
export const seedDatabaseIfEmpty = async (
    defaultUsers: User[], 
    defaultTemplates: FormTemplate[], 
    defaultMissions: Mission[]
) => {
    if (!localStorage.getItem(COLL_USERS)) save(COLL_USERS, defaultUsers);
    if (!localStorage.getItem(COLL_TEMPLATES)) save(COLL_TEMPLATES, defaultTemplates);
    if (!localStorage.getItem(COLL_MISSIONS)) save(COLL_MISSIONS, defaultMissions);
    if (!localStorage.getItem(COLL_SETTINGS)) save(COLL_SETTINGS, [{ id: 'app_config', appName: 'PLANIT-MOUNIER', appLogoUrl: '' }]);
};
