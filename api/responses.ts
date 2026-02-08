// api/responses.ts - Vercel Serverless Function
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

interface FormResponse {
  id: string;
  missionId?: string;
  templateId: string;
  technicianId: string;
  submittedAt: string;
  data: Record<string, any>;
  signature?: string;
}

function transformResponse(dbResponse: any): FormResponse {
  return {
    id: dbResponse.id,
    missionId: dbResponse.mission_id,
    templateId: dbResponse.template_id,
    technicianId: dbResponse.technician_id,
    submittedAt: dbResponse.submitted_at,
    data: dbResponse.data,
    signature: dbResponse.signature,
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
      const { rows } = await sql`SELECT * FROM form_responses ORDER BY submitted_at DESC`;
      const responses = rows.map(transformResponse);
      return res.status(200).json(responses);
    }

    if (req.method === 'POST') {
      const response = req.body as FormResponse;
      
      await sql`
        INSERT INTO form_responses (id, mission_id, template_id, technician_id, submitted_at, data, signature)
        VALUES (
          ${response.id}, 
          ${response.missionId || null}, 
          ${response.templateId}, 
          ${response.technicianId}, 
          ${response.submittedAt}, 
          ${JSON.stringify(response.data)}::jsonb, 
          ${response.signature || null}
        )
        ON CONFLICT (id)
        DO UPDATE SET
          mission_id = EXCLUDED.mission_id,
          template_id = EXCLUDED.template_id,
          technician_id = EXCLUDED.technician_id,
          submitted_at = EXCLUDED.submitted_at,
          data = EXCLUDED.data,
          signature = EXCLUDED.signature
      `;
      
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Response ID is required' });
      }
      
      await sql`DELETE FROM form_responses WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Error in /api/responses:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
