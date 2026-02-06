
import { Role, User, FormTemplate } from './types';

export const DEFAULT_ADMIN: User = { 
  id: 'admin', 
  name: 'Administrateur', 
  initials: 'AD', 
  role: Role.ADMIN,
  password: 'admin' 
};

export const INITIAL_MANAGERS: User[] = [
  { id: 'grebert.r', name: 'Remi Grebert', initials: 'RG', role: Role.MANAGER, password: '1234' },
  { id: 'gardon.a', name: 'Arnaud Gardon', initials: 'AG', role: Role.MANAGER, password: '1234' },
  { id: 'dombey.s', name: 'Sebastien Dombey', initials: 'SD', role: Role.MANAGER, password: '1234' },
  { id: 'duffet.y', name: 'Yoann Duffet', initials: 'YD', role: Role.MANAGER, password: '1234' },
  { id: 'goncalves.f', name: 'Francis Goncalves', initials: 'FG', role: Role.MANAGER, password: '1234' },
  { id: 'saidi.h', name: 'Heidi Saidi', initials: 'HS', role: Role.MANAGER, password: '1234' },
  { id: 'mounier.j', name: 'Johan Mounier', initials: 'JM', role: Role.MANAGER, password: '1234' },
  { id: 'martins.p', name: 'Philippe Martins', initials: 'PM', role: Role.MANAGER, password: '1234' },
  { id: 'mercier.f', name: 'Francois Mercier', initials: 'FM', role: Role.MANAGER, password: '1234' },
];

export const INITIAL_TECHNICIANS: User[] = [
  { id: 'aloui.b', name: 'Kacem Aloui', initials: 'KA', role: Role.TECHNICIAN, password: '1234' },
  { id: 'aloui.r', name: 'Rayann Aloui', initials: 'RA', role: Role.TECHNICIAN, password: '1234' },
  { id: 'asensi.e', name: 'Esteban Asensi', initials: 'EA', role: Role.TECHNICIAN, password: '1234' },
  { id: 'bechaa.a', name: 'Abderraouf Bechaa', initials: 'AB', role: Role.TECHNICIAN, password: '1234' },
  { id: 'bonafe.m', name: 'Mickael Bonafe', initials: 'MB', role: Role.TECHNICIAN, password: '1234' },
  { id: 'colucci.a', name: 'Alexandre Colucci', initials: 'AC', role: Role.TECHNICIAN, password: '1234' },
  { id: 'constant.f', name: 'Florian Constant', initials: 'FC', role: Role.TECHNICIAN, password: '1234' },
  { id: 'dasilva.l', name: 'Lucas Dasilva', initials: 'LC', role: Role.TECHNICIAN, password: '1234' },
  { id: 'faure.a', name: 'Aurelien Faure', initials: 'AF', role: Role.TECHNICIAN, password: '1234' },
  { id: 'lopez.l', name: 'Lucas Lopez', initials: 'AL', role: Role.TECHNICIAN, password: '1234' },
  { id: 'maridet.m', name: 'Maxime Maridet', initials: 'MM', role: Role.TECHNICIAN, password: '1234' },
  { id: 'mellard.c', name: 'Christophe Mellard', initials: 'CM', role: Role.TECHNICIAN, password: '1234' },
  { id: 'merchat.f', name: 'Florian Merchat', initials: 'FM', role: Role.TECHNICIAN, password: '1234' },
  { id: 'mounier.h', name: 'Hugo Mounier', initials: 'HM', role: Role.TECHNICIAN, password: '1234' },
  { id: 'roesch.c', name: 'Cedric Roesch', initials: 'CR', role: Role.TECHNICIAN, password: '1234' },
  { id: 'theoleyre.y', name: 'Yoann Theoleyre', initials: 'YT', role: Role.TECHNICIAN, password: '1234' },
  { id: 'vial.f', name: 'Florian Vial', initials: 'FV', role: Role.TECHNICIAN, password: '1234' },
  { id: 'vial.l', name: 'Laurent Vial', initials: 'LV', role: Role.TECHNICIAN, password: '1234' },
  { id: 'vial.v', name: 'Valentin Vial', initials: 'VV', role: Role.TECHNICIAN, password: '1234' },
  { id: 'zidelmal.h', name: 'Hamid Zidelmal', initials: 'HZ', role: Role.TECHNICIAN, password: '1234' },
  { id: 'tech.sav', name: 'Technicien SAV', initials: 'TECH01', role: Role.TECHNICIAN, password: '1234' },
];

export const JOB_NUMBER_REGEX = /^[A-Z]{2}-A\d{2}-\d{4}$/;

export const DEFAULT_TEMPLATES: FormTemplate[] = [
  {
    id: 'tpl-pv-rec-mounier',
    name: 'PV de Réception Travaux (Mounier)',
    description: 'Procès-Verbal de Réception des Travaux Client (Réf: FOR-SSE-014-1-VI)',
    createdAt: new Date().toISOString(),
    fields: [
      { id: 'client_name', label: 'Client', type: 'text', required: true },
      { id: 'address', label: 'Adresse du chantier', type: 'text', required: false },
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
