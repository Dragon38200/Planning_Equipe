
import { Role, User, FormTemplate } from './types';

export const DEFAULT_ADMIN: User = { 
  id: 'admin', 
  name: 'Administrateur', 
  initials: 'AD', 
  role: Role.ADMIN,
  password: 'admin',
  email: 'admin@mounier.fr',
  phone: '0600000000'
};

// Logo Mounier stylisé (Fond Indigo, Usine Blanche, 3 points)
export const DEFAULT_APP_LOGO = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgdmlld0JveD0iMCAwIDUxMiA1MTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjUxMiIgaGVpZ2h0PSI1MTIiIHJ4PSIxMjgiIGZpbGw9IiM0RjQ2RTUiLz48cGF0aCBkPSJNMTI4IDM4NEgzODRWMjMwTDMwOS4zMzMgMjgxLjMzM1YyMDQuNjY3TDIzNC42NjcgMjU2VjE3OS4zMzNMMTI4IDI1NlYzODRaIiBmaWxsPSJ3aGl0ZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIzMCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxjaXJjbGUgY3g9IjE5MiIgY3k9IjMyMCIgcj0iMjQiIGZpbGw9IiM0RjQ2RTUiLz48Y2lyY2xlIGN4PSIyNTYiIGN5PSIzMjAiIHI9IjI0IiBmaWxsPSIjNEY0NkU1Ii8+PGNpcmNsZSBjeD0iMzIwIiBjeT0iMzIwIiByPSIyNCIgZmlsbD0iIzRGNDZFNSIvPjwvc3ZnPg==";

export const INITIAL_MANAGERS: User[] = [
  { id: 'grebert.r', name: 'Remi Grebert', initials: 'RG', role: Role.MANAGER, password: '1234', email: 'remi.grebert@mounier.fr', phone: '06 12 34 56 78' },
  { id: 'gardon.a', name: 'Arnaud Gardon', initials: 'AG', role: Role.MANAGER, password: '1234', email: 'arnaud.gardon@mounier.fr', phone: '06 98 76 54 32' },
  { id: 'dombey.s', name: 'Sebastien Dombey', initials: 'SD', role: Role.MANAGER, password: '1234', email: 'sebastien.dombey@mounier.fr', phone: '06 11 22 33 44' },
  { id: 'duffet.y', name: 'Yoann Duffet', initials: 'YD', role: Role.MANAGER, password: '1234', email: 'yoann.duffet@mounier.fr', phone: '06 55 44 33 22' },
  { id: 'goncalves.f', name: 'Francis Goncalves', initials: 'FG', role: Role.MANAGER, password: '1234', email: 'francis.goncalves@mounier.fr', phone: '06 66 77 88 99' },
  { id: 'saidi.h', name: 'Heidi Saidi', initials: 'HS', role: Role.MANAGER, password: '1234', email: 'heidi.saidi@mounier.fr', phone: '06 00 11 22 33' },
  { id: 'mounier.j', name: 'Johan Mounier', initials: 'JM', role: Role.MANAGER, password: '1234', email: 'johan.mounier@mounier.fr', phone: '06 99 88 77 66' },
  { id: 'martins.p', name: 'Philippe Martins', initials: 'PM', role: Role.MANAGER, password: '1234', email: 'philippe.martins@mounier.fr', phone: '06 44 55 66 77' },
  { id: 'mercier.f', name: 'Francois Mercier', initials: 'FM', role: Role.MANAGER, password: '1234', email: 'francis.mercier@mounier.fr', phone: '06 22 33 44 55' },
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
    id: 'tpl-mise-en-chantier',
    name: 'Mise en Chantier',
    description: 'Checklist de démarrage, sécurité et état des lieux.',
    createdAt: new Date().toISOString(),
    fields: [
      { id: 'job_number', label: 'N° Affaire', type: 'text', required: true },
      { id: 'date', label: 'Date', type: 'date', required: true },
      { id: 'address', label: 'Adresse Chantier', type: 'text', required: true },
      { id: 'technician', label: 'Chef de chantier / Technicien', type: 'text', required: true },
      { id: 'ppsps_read', label: 'PPSPS ou Plan de prévention lu et compris ?', type: 'checkbox', required: true },
      { id: 'authorization', label: 'Autorisation de travail / Permis feu valides ?', type: 'checkbox', required: true },
      { id: 'epi_check', label: 'Port des EPI respecté (Casque, Chaussures, Gants...) ?', type: 'checkbox', required: true },
      { id: 'balisage', label: 'Balisage de la zone effectué ?', type: 'checkbox', required: true },
      { id: 'materials_check', label: 'Matériel nécessaire disponible ?', type: 'checkbox', required: false },
      { id: 'comments', label: 'Observations / Risques spécifiques', type: 'textarea', required: false },
      { id: 'photo_zone', label: 'Photo de la zone de travail / Balisage', type: 'photo', required: false },
      { id: 'signature', label: 'Signature Responsable Chantier', type: 'signature', required: true }
    ]
  },
  {
    id: 'tpl-compte-rendu',
    name: 'Compte Rendu d\'Intervention',
    description: 'Rapport détaillé avec photos et signatures pour le client.',
    createdAt: new Date().toISOString(),
    fields: [
      { id: 'job_number', label: 'N° Affaire', type: 'text', required: true },
      { id: 'client_name', label: 'Client', type: 'text', required: true },
      { id: 'designation', label: 'Désignation', type: 'text', required: true },
      { id: 'address', label: 'Adresse Intervention', type: 'text', required: true },
      { id: 'client_contact', label: 'Nom du contact Client', type: 'text', required: false },
      { id: 'client_email', label: 'Adresse Mail Client', type: 'email', required: false },
      { id: 'manager_id', label: 'Nom du Chargé d\'Affaire', type: 'select', required: true, options: [] }, 
      { id: 'manager_phone', label: 'Tél. Chargé d\'Affaire', type: 'text', required: false, readOnly: true },
      { id: 'manager_email', label: 'Email Chargé d\'Affaire', type: 'text', required: false, readOnly: true },
      { id: 'travel_time', label: 'Temps de Trajet (h)', type: 'number', required: true },
      { id: 'work_time', label: 'Temps d\'Intervention (h)', type: 'number', required: true },
      { id: 'description', label: 'Descriptif de l\'intervention', type: 'textarea', required: true },
      { id: 'photos', label: 'Photos du chantier (Max 10)', type: 'photo_gallery', required: false },
      { id: 'sig_client', label: 'Signature Client', type: 'signature', required: true },
      { id: 'sig_tech', label: 'Signature Technicien', type: 'signature', required: true }
    ]
  },
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
