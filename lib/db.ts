// lib/db.ts
import { sql } from '@vercel/postgres';
import { User, Mission, FormTemplate, FormResponse, AppSettings } from '../types';

// --- TYPES POUR LES RÉPONSES DE LA DB ---

interface DbUser extends Omit<User, 'avatarUrl'> {
  avatar_url?: string;
  created_at?: Date;
  updated_at?: Date;
}

interface DbMission {
  id: string;
  date: string;
  job_number: string;
  work_hours: number;
  travel_hours: number;
  overtime_hours: number;
  type: string;
  status: string;
  technician_id: string;
  manager_initials: string;
  igd: boolean;
  description?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rejection_comment?: string;
  created_at?: Date;
  updated_at?: Date;
}

interface DbFormTemplate {
  id: string;
  name: string;
  description: string;
  fields: any; // JSONB
  created_at?: Date;
  updated_at?: Date;
}

interface DbFormResponse {
  id: string;
  mission_id?: string;
  template_id: string;
  technician_id: string;
  submitted_at: string;
  data: any; // JSONB
  signature?: string;
  created_at?: Date;
  updated_at?: Date;
}

interface DbAppSettings {
  id: string;
  app_name: string;
  app_logo_url?: string;
  report_logo_url?: string;
  custom_logos?: any; // JSONB
  created_at?: Date;
  updated_at?: Date;
}

// --- TRANSFORMATIONS (DB <-> APP) ---

const transformUser = (dbUser: DbUser): User => ({
  id: dbUser.id,
  name: dbUser.name,
  initials: dbUser.initials,
  role: dbUser.role,
  password: dbUser.password,
  email: dbUser.email,
  phone: dbUser.phone,
  avatarUrl: dbUser.avatar_url,
});

const transformMission = (dbMission: DbMission): Mission => ({
  id: dbMission.id,
  date: dbMission.date,
  jobNumber: dbMission.job_number,
  workHours: Number(dbMission.work_hours),
  travelHours: Number(dbMission.travel_hours),
  overtimeHours: Number(dbMission.overtime_hours),
  type: dbMission.type as any,
  status: dbMission.status as any,
  technicianId: dbMission.technician_id,
  managerInitials: dbMission.manager_initials,
  igd: dbMission.igd,
  description: dbMission.description,
  address: dbMission.address,
  latitude: dbMission.latitude,
  longitude: dbMission.longitude,
  rejectionComment: dbMission.rejection_comment,
});

const transformTemplate = (dbTemplate: DbFormTemplate): FormTemplate => ({
  id: dbTemplate.id,
  name: dbTemplate.name,
  description: dbTemplate.description,
  fields: dbTemplate.fields,
  createdAt: dbTemplate.created_at?.toISOString() || new Date().toISOString(),
});

const transformResponse = (dbResponse: DbFormResponse): FormResponse => ({
  id: dbResponse.id,
  missionId: dbResponse.mission_id,
  templateId: dbResponse.template_id,
  technicianId: dbResponse.technician_id,
  submittedAt: dbResponse.submitted_at,
  data: dbResponse.data,
  signature: dbResponse.signature,
});

const transformSettings = (dbSettings: DbAppSettings): AppSettings => ({
  appName: dbSettings.app_name,
  appLogoUrl: dbSettings.app_logo_url,
  reportLogoUrl: dbSettings.report_logo_url,
  customLogos: dbSettings.custom_logos || [],
});

// --- USERS ---

export async function getAllUsers(): Promise<User[]> {
  const { rows } = await sql<DbUser>`SELECT * FROM users ORDER BY name`;
  return rows.map(transformUser);
}

export async function saveUser(user: User): Promise<void> {
  await sql`
    INSERT INTO users (id, name, initials, role, password, email, phone, avatar_url)
    VALUES (${user.id}, ${user.name}, ${user.initials}, ${user.role}, ${user.password || null}, ${user.email || null}, ${user.phone || null}, ${user.avatarUrl || null})
    ON CONFLICT (id) 
    DO UPDATE SET 
      name = EXCLUDED.name,
      initials = EXCLUDED.initials,
      role = EXCLUDED.role,
      password = EXCLUDED.password,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      avatar_url = EXCLUDED.avatar_url
  `;
}

export async function deleteUser(id: string): Promise<void> {
  await sql`DELETE FROM users WHERE id = ${id}`;
}

// --- MISSIONS ---

export async function getAllMissions(): Promise<Mission[]> {
  const { rows } = await sql<DbMission>`SELECT * FROM missions ORDER BY date DESC`;
  return rows.map(transformMission);
}

export async function saveMission(mission: Mission): Promise<void> {
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

export async function batchSaveMissions(missions: Mission[]): Promise<void> {
  // Utiliser une transaction pour sauvegarder plusieurs missions
  for (const mission of missions) {
    await saveMission(mission);
  }
}

export async function deleteMission(id: string): Promise<void> {
  await sql`DELETE FROM missions WHERE id = ${id}`;
}

// --- FORM TEMPLATES ---

export async function getAllTemplates(): Promise<FormTemplate[]> {
  const { rows } = await sql<DbFormTemplate>`SELECT * FROM form_templates ORDER BY name`;
  return rows.map(transformTemplate);
}

export async function saveTemplate(template: FormTemplate): Promise<void> {
  await sql`
    INSERT INTO form_templates (id, name, description, fields)
    VALUES (${template.id}, ${template.name}, ${template.description}, ${JSON.stringify(template.fields)}::jsonb)
    ON CONFLICT (id)
    DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      fields = EXCLUDED.fields
  `;
}

export async function deleteTemplate(id: string): Promise<void> {
  await sql`DELETE FROM form_templates WHERE id = ${id}`;
}

// --- FORM RESPONSES ---

export async function getAllResponses(): Promise<FormResponse[]> {
  const { rows } = await sql<DbFormResponse>`SELECT * FROM form_responses ORDER BY submitted_at DESC`;
  return rows.map(transformResponse);
}

export async function saveResponse(response: FormResponse): Promise<void> {
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
}

export async function deleteResponse(id: string): Promise<void> {
  await sql`DELETE FROM form_responses WHERE id = ${id}`;
}

// --- APP SETTINGS ---

export async function getAppSettings(): Promise<AppSettings> {
  const { rows } = await sql<DbAppSettings>`SELECT * FROM app_settings WHERE id = 'app_config' LIMIT 1`;
  
  if (rows.length === 0) {
    // Créer les paramètres par défaut
    const defaultSettings: AppSettings = {
      appName: 'PLANIT-MOUNIER',
      appLogoUrl: '',
      customLogos: [],
    };
    await saveAppSettings(defaultSettings);
    return defaultSettings;
  }
  
  return transformSettings(rows[0]);
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
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
}

// --- SEED FUNCTIONS ---

export async function seedDatabaseIfEmpty(
  defaultUsers: User[],
  defaultTemplates: FormTemplate[],
  defaultMissions: Mission[]
): Promise<void> {
  // Vérifier si la base est vide
  const { rows: userRows } = await sql`SELECT COUNT(*) as count FROM users`;
  
  if (Number(userRows[0].count) === 0) {
    console.log('Seeding database with default data...');
    
    // Insérer les utilisateurs
    for (const user of defaultUsers) {
      await saveUser(user);
    }
    
    // Insérer les templates
    for (const template of defaultTemplates) {
      await saveTemplate(template);
    }
    
    // Insérer les missions
    for (const mission of defaultMissions) {
      await saveMission(mission);
    }
    
    console.log('Database seeded successfully!');
  }
}
