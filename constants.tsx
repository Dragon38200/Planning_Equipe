
import { Role, User, FormTemplate } from './types';

export const DEFAULT_ADMIN: User = { 
  id: 'admin', 
  name: 'Administrateur Général', 
  initials: 'AD', 
  role: Role.ADMIN,
  password: 'admin' 
};

export const INITIAL_MANAGERS: User[] = [
  { id: 'remig', name: 'Rémi Girard', initials: 'RG', role: Role.MANAGER, password: '1234' },
  { id: 'jeans', name: 'Jean Sabatier', initials: 'JS', role: Role.MANAGER, password: '1234' },
];

export const INITIAL_TECHNICIANS: User[] = Array.from({ length: 15 }, (_, i) => ({
  id: `tech${(i + 1).toString().padStart(2, '0')}`,
  name: `Technicien ${i + 1}`,
  initials: `T${i + 1}`,
  role: Role.TECHNICIAN,
  password: '1234'
}));

export const JOB_NUMBER_REGEX = /^[A-Z]{2}-A\d{2}-\d{4}$/;

export const DEFAULT_TEMPLATES: FormTemplate[] = [
  {
    id: 'tpl-pv-rec-mounier',
    name: 'PV de Réception Travaux (Mounier)',
    description: 'Procès-Verbal de Réception des Travaux Client (Réf: FOR-SSE-014-1-VI)',
    createdAt: new Date().toISOString(),
    fields: [
      { id: 'client_name', label: 'Client', type: 'text', required: true },
      { id: 'cmd_number', label: 'Numéro de commande client', type: 'text', required: false },
      { id: 'job_number', label: 'N° d\'Affaires', type: 'text', required: true },
      { id: 'job_label', label: 'Libellé de l\'affaire', type: 'text', required: true },
      { id: 'rep_client', label: 'Représenté par (Client)', type: 'text', required: true },
      { id: 'rep_mounier', label: 'Représenté par (Mounier)', type: 'text', required: true },
      { id: 'acceptance_type', label: 'Décision (Sans réserve / Avec réserves)', type: 'checkbox', required: true },
      { id: 'date_effet', label: 'Date d\'effet', type: 'date', required: true },
      { id: 'reserves_list', label: 'Liste des réserves (si applicable)', type: 'textarea', required: false },
      { id: 'dest_emails', label: 'Destinataires (Emails séparés par une virgule)', type: 'text', required: false },
      { id: 'sig_client', label: 'Signature Client', type: 'signature', required: true },
      { id: 'sig_entrepreneur', label: 'Signature Entrepreneur (Mounier)', type: 'signature', required: true }
    ]
  },
  {
    id: 'tpl-interv',
    name: 'Rapport Intervention Standard',
    description: 'Compte rendu technique de fin de chantier rapide.',
    createdAt: new Date().toISOString(),
    fields: [
      { id: 'f1', label: 'Travaux effectués', type: 'textarea', required: true },
      { id: 'f4', label: 'Temps passé (h)', type: 'number', required: true },
      { id: 'f5', label: 'Signature Client', type: 'signature', required: true }
    ]
  }
];
