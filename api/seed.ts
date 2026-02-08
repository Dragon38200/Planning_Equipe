// api/seed.ts - Vercel Serverless Function
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Vérifier si la base est déjà initialisée
    const { rows: userRows } = await sql`SELECT COUNT(*) as count FROM users`;
    
    if (Number(userRows[0].count) > 0) {
      return res.status(200).json({ 
        message: 'Database already seeded',
        alreadySeeded: true 
      });
    }

    console.log('Seeding database with default data...');

    // Créer l'administrateur
    await sql`
      INSERT INTO users (id, name, initials, role, password, email, phone)
      VALUES ('admin', 'Administrateur', 'ADM', 'ADMIN', 'admin123', 'admin@mounier.fr', NULL)
    `;

    // Créer les chargés d'affaires
    await sql`
      INSERT INTO users (id, name, initials, role, password, email, phone)
      VALUES 
        ('jmdupont', 'Jean-Marc Dupont', 'JMD', 'MANAGER', 'jmd2024', 'jm.dupont@mounier.fr', '06 12 34 56 78'),
        ('lbernard', 'Luc Bernard', 'LB', 'MANAGER', 'lb2024', 'l.bernard@mounier.fr', '06 23 45 67 89')
    `;

    // Créer les techniciens
    await sql`
      INSERT INTO users (id, name, initials, role, password, email, phone)
      VALUES 
        ('jmartin', 'Julien Martin', 'JM', 'TECHNICIAN', 'jm2024', 'j.martin@mounier.fr', '06 34 56 78 90'),
        ('pdurand', 'Pierre Durand', 'PD', 'TECHNICIAN', 'pd2024', 'p.durand@mounier.fr', '06 45 67 89 01'),
        ('mleroy', 'Marc Leroy', 'ML', 'TECHNICIAN', 'ml2024', 'm.leroy@mounier.fr', '06 56 78 90 12'),
        ('trobinson', 'Thomas Robinson', 'TR', 'TECHNICIAN', 'tr2024', 't.robinson@mounier.fr', '06 67 89 01 23')
    `;

    // Créer un template de formulaire par défaut
    const defaultTemplate = {
      id: 'tpl-fiche-intervention',
      name: 'Fiche d\'Intervention Standard',
      description: 'Formulaire standard pour les interventions terrain',
      fields: [
        { id: 'client_name', label: 'Nom du client', type: 'text', required: true },
        { id: 'site_address', label: 'Adresse du site', type: 'textarea', required: true },
        { id: 'intervention_date', label: 'Date d\'intervention', type: 'date', required: true },
        { id: 'work_description', label: 'Description des travaux', type: 'textarea', required: true },
        { id: 'materials_used', label: 'Matériaux utilisés', type: 'textarea', required: false },
        { id: 'client_signature', label: 'Signature du client', type: 'signature', required: true },
        { id: 'tech_signature', label: 'Signature du technicien', type: 'signature', required: true },
        { id: 'photos', label: 'Photos du chantier', type: 'photo_gallery', required: false }
      ]
    };

    await sql`
      INSERT INTO form_templates (id, name, description, fields)
      VALUES (
        ${defaultTemplate.id},
        ${defaultTemplate.name},
        ${defaultTemplate.description},
        ${JSON.stringify(defaultTemplate.fields)}::jsonb
      )
    `;

    // Créer quelques missions d'exemple
    const today = new Date();
    const missions = [
      {
        id: 'mission-1',
        date: today.toISOString().split('T')[0],
        jobNumber: 'CH-2024-001',
        workHours: 7,
        travelHours: 1,
        overtimeHours: 0,
        type: 'WORK',
        status: 'SUBMITTED',
        technicianId: 'jmartin',
        managerInitials: 'JMD',
        igd: false,
        description: 'Installation électrique - Bureau Paris 15',
        address: '123 Rue de la Convention, 75015 Paris'
      },
      {
        id: 'mission-2',
        date: today.toISOString().split('T')[0],
        jobNumber: 'CH-2024-002',
        workHours: 6.5,
        travelHours: 1.5,
        overtimeHours: 0,
        type: 'WORK',
        status: 'PENDING',
        technicianId: 'pdurand',
        managerInitials: 'LB',
        igd: true,
        description: 'Maintenance préventive - Usine Bobigny',
        address: '45 Avenue Jean Jaurès, 93000 Bobigny'
      }
    ];

    for (const mission of missions) {
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
          ${mission.description}, ${mission.address},
          NULL, NULL, NULL
        )
      `;
    }

    // Créer les paramètres par défaut
    await sql`
      INSERT INTO app_settings (id, app_name, app_logo_url, report_logo_url, custom_logos)
      VALUES ('app_config', 'PLANIT-MOUNIER', '', NULL, '[]'::jsonb)
    `;

    console.log('Database seeded successfully!');

    return res.status(200).json({ 
      success: true, 
      message: 'Database seeded successfully',
      created: {
        users: 7,
        templates: 1,
        missions: 2,
        settings: 1
      }
    });
  } catch (error: any) {
    console.error('Error seeding database:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to seed database',
      details: error.toString()
    });
  }
}
