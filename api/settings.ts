// api/settings.ts - Vercel Serverless Function
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

interface AppSettings {
  appName: string;
  appLogoUrl?: string;
  reportLogoUrl?: string;
  customLogos?: string[];
}

function transformSettings(dbSettings: any): AppSettings {
  return {
    appName: dbSettings.app_name,
    appLogoUrl: dbSettings.app_logo_url,
    reportLogoUrl: dbSettings.report_logo_url,
    customLogos: dbSettings.custom_logos || [],
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { rows } = await sql`SELECT * FROM app_settings WHERE id = 'app_config' LIMIT 1`;
      
      if (rows.length === 0) {
        // Créer les paramètres par défaut
        const defaultSettings: AppSettings = {
          appName: 'PLANIT-MOUNIER',
          appLogoUrl: '',
          customLogos: [],
        };
        
        await sql`
          INSERT INTO app_settings (id, app_name, app_logo_url, report_logo_url, custom_logos)
          VALUES (
            'app_config', 
            ${defaultSettings.appName}, 
            ${defaultSettings.appLogoUrl || null}, 
            ${defaultSettings.reportLogoUrl || null}, 
            ${JSON.stringify(defaultSettings.customLogos || [])}::jsonb
          )
        `;
        
        return res.status(200).json(defaultSettings);
      }
      
      return res.status(200).json(transformSettings(rows[0]));
    }

    if (req.method === 'POST') {
      const settings = req.body as AppSettings;
      
      await sql`
        INSERT INTO app_settings (id, app_name, app_logo_url, report_logo_url, custom_logos)
        VALUES (
          'app_config', 
          ${settings.appName}, 
          ${settings.appLogoUrl || null}, 
          ${settings.reportLogoUrl || null}, 
          ${JSON.stringify(settings.customLogos || [])}::jsonb
        )
        ON CONFLICT (id)
        DO UPDATE SET
          app_name = EXCLUDED.app_name,
          app_logo_url = EXCLUDED.app_logo_url,
          report_logo_url = EXCLUDED.report_logo_url,
          custom_logos = EXCLUDED.custom_logos
      `;
      
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Error in /api/settings:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
