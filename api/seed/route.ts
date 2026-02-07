// api/seed/route.ts
import { NextResponse } from 'next/server';
import { seedDatabaseIfEmpty } from '../../lib/db';
import { DEFAULT_ADMIN, INITIAL_MANAGERS, INITIAL_TECHNICIANS, DEFAULT_TEMPLATES } from '../../constants';
import { getInitialMissions } from '../../data';

// POST - Initialiser la base de données avec les données par défaut
export async function POST() {
  try {
    await seedDatabaseIfEmpty(
      [DEFAULT_ADMIN, ...INITIAL_MANAGERS, ...INITIAL_TECHNICIANS],
      DEFAULT_TEMPLATES,
      getInitialMissions()
    );
    
    return NextResponse.json({ success: true, message: 'Database seeded successfully' });
  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json({ error: 'Failed to seed database' }, { status: 500 });
  }
}
