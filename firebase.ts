// firebase.ts - API Client (remplace localStorage)
import { User, Mission, FormTemplate, FormResponse, AppSettings } from "./types";

// Noms des collections (pour compatibilité avec l'ancien code)
export const COLL_USERS = "users";
export const COLL_MISSIONS = "missions";
export const COLL_TEMPLATES = "templates";
export const COLL_RESPONSES = "responses";
export const COLL_SETTINGS = "settings";

// --- API CLIENT ---

// Cache local pour éviter trop de requêtes
let cache: Record<string, any[]> = {
  [COLL_USERS]: [],
  [COLL_MISSIONS]: [],
  [COLL_TEMPLATES]: [],
  [COLL_RESPONSES]: [],
  [COLL_SETTINGS]: [],
};

// Système d'abonnement pour mettre à jour l'UI
const listeners: Record<string, Array<(data: any[]) => void>> = {};

const notify = (collection: string, data: any[]) => {
  cache[collection] = data;
  if (listeners[collection]) {
    listeners[collection].forEach(cb => cb(data));
  }
};

// --- API CALLS ---

const API_BASE = '/api';

async function fetchFromAPI(endpoint: string): Promise<any> {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  return response.json();
}

async function postToAPI(endpoint: string, data: any): Promise<any> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  return response.json();
}

async function deleteFromAPI(endpoint: string): Promise<any> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  return response.json();
}

// --- COLLECTION LOADERS ---

async function loadUsers(): Promise<User[]> {
  const users = await fetchFromAPI('/users');
  notify(COLL_USERS, users);
  return users;
}

async function loadMissions(): Promise<Mission[]> {
  const missions = await fetchFromAPI('/missions');
  notify(COLL_MISSIONS, missions);
  return missions;
}

async function loadTemplates(): Promise<FormTemplate[]> {
  const templates = await fetchFromAPI('/templates');
  notify(COLL_TEMPLATES, templates);
  return templates;
}

async function loadResponses(): Promise<FormResponse[]> {
  const responses = await fetchFromAPI('/responses');
  notify(COLL_RESPONSES, responses);
  return responses;
}

async function loadSettings(): Promise<AppSettings[]> {
  const settings = await fetchFromAPI('/settings');
  // Les settings sont un objet unique, on le met dans un tableau pour compatibilité
  notify(COLL_SETTINGS, [{ id: 'app_config', ...settings }]);
  return [{ id: 'app_config', ...settings }];
}

/**
 * S'abonne aux changements d'une collection
 */
export const subscribe = (collection: string, callback: (data: any[]) => void) => {
  if (!listeners[collection]) listeners[collection] = [];
  listeners[collection].push(callback);
  
  // Charger les données initiales
  const loadData = async () => {
    try {
      switch (collection) {
        case COLL_USERS:
          await loadUsers();
          break;
        case COLL_MISSIONS:
          await loadMissions();
          break;
        case COLL_TEMPLATES:
          await loadTemplates();
          break;
        case COLL_RESPONSES:
          await loadResponses();
          break;
        case COLL_SETTINGS:
          await loadSettings();
          break;
        default:
          callback([]);
      }
    } catch (error) {
      console.error(`Error loading ${collection}:`, error);
      callback([]);
    }
  };
  
  loadData();

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
  try {
    const payload = { ...data, id };
    
    switch (collectionName) {
      case COLL_USERS:
        await postToAPI('/users', payload);
        await loadUsers();
        break;
      case COLL_MISSIONS:
        await postToAPI('/missions', payload);
        await loadMissions();
        break;
      case COLL_TEMPLATES:
        await postToAPI('/templates', payload);
        await loadTemplates();
        break;
      case COLL_RESPONSES:
        await postToAPI('/responses', payload);
        await loadResponses();
        break;
      case COLL_SETTINGS:
        await postToAPI('/settings', data); // Settings n'a pas besoin de l'id
        await loadSettings();
        break;
    }
  } catch (error) {
    console.error(`Error saving document in ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Supprime un document
 */
export const deleteDocument = async (collectionName: string, id: string) => {
  try {
    switch (collectionName) {
      case COLL_USERS:
        await deleteFromAPI(`/users?id=${id}`);
        await loadUsers();
        break;
      case COLL_MISSIONS:
        await deleteFromAPI(`/missions?id=${id}`);
        await loadMissions();
        break;
      case COLL_TEMPLATES:
        await deleteFromAPI(`/templates?id=${id}`);
        await loadTemplates();
        break;
      case COLL_RESPONSES:
        await deleteFromAPI(`/responses?id=${id}`);
        await loadResponses();
        break;
    }
  } catch (error) {
    console.error(`Error deleting document in ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Sauvegarde en masse
 */
export const batchSaveMissions = async (missions: Mission[]) => {
  try {
    await postToAPI('/missions', missions);
    await loadMissions();
  } catch (error) {
    console.error('Error batch saving missions:', error);
    throw error;
  }
};

/**
 * Initialise la base de données avec les données par défaut si elle est vide
 */
export const seedDatabaseIfEmpty = async (
  defaultUsers: User[], 
  defaultTemplates: FormTemplate[], 
  defaultMissions: Mission[]
) => {
  try {
    await postToAPI('/seed', {
      users: defaultUsers,
      templates: defaultTemplates,
      missions: defaultMissions,
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    // Ne pas throw car cela pourrait bloquer l'app si la DB est déjà initialisée
  }
};
