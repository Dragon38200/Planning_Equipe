
import { kv } from '@vercel/kv';
import { User, Mission, FormTemplate, FormResponse, AppSettings } from '../types';
import { DEFAULT_ADMIN, INITIAL_MANAGERS, INITIAL_TECHNICIANS, DEFAULT_TEMPLATES } from '../constants';
import { getInitialMissions } from '../data';

interface AppData {
  users: User[];
  missions: Mission[];
  templates: FormTemplate[];
  responses: FormResponse[];
  appSettings: AppSettings;
}

const DATABASE_KEY = 'planit-mounier-db';

function getInitialData(): AppData {
  return {
    missions: getInitialMissions(),
    users: [DEFAULT_ADMIN, ...INITIAL_MANAGERS, ...INITIAL_TECHNICIANS],
    templates: DEFAULT_TEMPLATES,
    responses: [],
    appSettings: { appName: 'PLANIT-MOUNIER', appLogoUrl: '' }
  };
}

export default async function handler(request: Request) {
  try {
    if (request.method === 'GET') {
      let data: AppData | null = await kv.get(DATABASE_KEY);
      
      if (!data) {
        console.log("No data found in KV, serving initial data.");
        data = getInitialData();
        // Optionnel : sauvegarder les données initiales si elles n'existent pas.
        await kv.set(DATABASE_KEY, data);
      }
      
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'POST') {
      const body: AppData = await request.json();

      // Valider les données reçues (vérification simple)
      if (!body.users || !body.missions) {
        return new Response(JSON.stringify({ error: 'Invalid data structure' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      await kv.set(DATABASE_KEY, body);
      
      return new Response(JSON.stringify({ success: true, message: 'Data saved successfully.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Gérer les autres méthodes HTTP
    return new Response(JSON.stringify({ error: `Method ${request.method} Not Allowed` }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return new Response(JSON.stringify({ error: 'Internal Server Error', details: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Configuration pour Vercel pour s'assurer que c'est une fonction Edge
export const config = {
  runtime: 'edge',
};
