// api/missions.ts - Vercel Serverless Function
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

interface Mission {
  id: string;
  date: string;
  jobNumber: string;
  workHours: number;
  travelHours: number;
  overtimeHours: number;
  type: string;
  status: string;
  technicianId: string;
  managerInitials: string;
  igd: boolean;
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rejectionComment?: string;
}

function transformMission(dbMission: any): Mission {
  return {
    id: dbMission.id,
    date: dbMission.date,
    jobNumber: dbMission.job_number,
    workHours: Number(dbMission.work_hours),
    travelHours: Number(dbMission.travel_hours),
    overtimeHours: Number(dbMission.overtime_hours),
    type: dbMission.type,
    status: dbMission.status,
    technicianId: dbMission.technician_id,
    managerInitials: dbMission.manager_initials,
    igd: dbMission.igd,
    description: dbMission.description,
    address: dbMission.address,
    latitude: dbMission.latitude,
    longitude: dbMission.longitude,
    rejectionComment: dbMission.rejection_comment,
  };
}

async function saveMission(mission: Mission) {
  await sql`
    INSERT INTO missions (
      id, date, job_number, work_hours, travel_hours, overtime_hours, 
      type, status, technician_id, manager_initials, igd, 
      description, address, latitude, longitude, rejection_comment
    )
    VALUES (
      ${mission.id}, ${mission.date}, ${mission.jobNumber}, 
      ${mission.workHours}, ${mission.travelHours}, ${mission.overtimeHours},
      ${mission.type}, ${mission.status}, ${mission.technicianId}, 
      ${mission.managerInitials}, ${mission.igd},
      ${mission.description || null}, ${mission.address || null}, 
      ${mission.latitude || null}, ${mission.longitude || null}, 
      ${mission.rejectionComment || null}
    )
    ON CONFLICT (id)
    DO UPDATE SET
      date = EXCLUDED.date,
      job_number = EXCLUDED.job_number,
      work_hours = EXCLUDED.work_hours,
      travel_hours = EXCLUDED.travel_hours,
      overtime_hours = EXCLUDED.overtime_hours,
      type = EXCLUDED.type,
      status = EXCLUDED.status,
      technician_id = EXCLUDED.technician_id,
      manager_initials = EXCLUDED.manager_initials,
      igd = EXCLUDED.igd,
      description = EXCLUDED.description,
      address = EXCLUDED.address,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      rejection_comment = EXCLUDED.rejection_comment
  `;
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
      const { rows } = await sql`SELECT * FROM missions ORDER BY date DESC`;
      const missions = rows.map(transformMission);
      return res.status(200).json(missions);
    }

    if (req.method === 'POST') {
      const body = req.body;
      
      if (Array.isArray(body)) {
        // Batch save
        for (const mission of body) {
          await saveMission(mission);
        }
      } else {
        await saveMission(body);
      }
      
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Mission ID is required' });
      }
      
      await sql`DELETE FROM missions WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Error in /api/missions:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
