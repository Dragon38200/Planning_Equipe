// api/templates.ts - Vercel Serverless Function
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

interface FormTemplate {
  id: string;
  name: string;
  description: string;
  fields: any[];
  createdAt: string;
}

function transformTemplate(dbTemplate: any): FormTemplate {
  return {
    id: dbTemplate.id,
    name: dbTemplate.name,
    description: dbTemplate.description,
    fields: dbTemplate.fields,
    createdAt: dbTemplate.created_at?.toISOString() || new Date().toISOString(),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const { rows } = await sql`SELECT * FROM form_templates ORDER BY name`;
      const templates = rows.map(transformTemplate);
      return res.status(200).json(templates);
    }

    if (req.method === 'POST') {
      const template = req.body as FormTemplate;
      
      await sql`
        INSERT INTO form_templates (id, name, description, fields)
        VALUES (
          ${template.id}, 
          ${template.name}, 
          ${template.description}, 
          ${JSON.stringify(template.fields)}::jsonb
        )
        ON CONFLICT (id)
        DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          fields = EXCLUDED.fields
      `;
      
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Template ID is required' });
      }
      
      await sql`DELETE FROM form_templates WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Error in /api/templates:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
