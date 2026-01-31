
export enum Role {
  TECHNICIAN = 'TECHNICIAN',
  MANAGER = 'MANAGER',
  ADMIN = 'ADMIN'
}

export enum MissionType {
  WORK = 'WORK',
  LEAVE = 'CONGE',
  SICK = 'MALADIE',
  TRAINING = 'FORMATION'
}

export enum MissionStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED'
}

export interface User {
  id: string; 
  name: string;
  initials: string;
  role: Role;
  password?: string; 
  email?: string;
  avatarUrl?: string;
}

export interface AppSettings {
  appName: string;
  appLogoUrl?: string;
}

export interface Mission {
  id: string;
  date: string; 
  jobNumber: string; 
  hours: number;
  type: MissionType;
  status: MissionStatus;
  technicianId: string;
  managerInitials: string;
  igd: boolean;
  description?: string; 
  address?: string; 
  latitude?: number;
  longitude?: number;
  rejectionComment?: string;
}

export interface WeekSelection {
  year: number;
  weekNumber: number;
}

// --- Nouveaux types pour les Formulaires ---

export type FieldType = 'text' | 'number' | 'checkbox' | 'date' | 'textarea' | 'signature';

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  fields: FormField[];
  createdAt: string;
}

export interface FormResponse {
  id: string;
  missionId?: string; // Optionnel si formulaire "libre"
  templateId: string;
  technicianId: string;
  submittedAt: string;
  data: Record<string, any>;
  signature?: string; // Image base64
}