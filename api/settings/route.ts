// api/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAppSettings, saveAppSettings } from '../../lib/db';

// GET - Récupérer les paramètres de l'application
export async function GET() {
  try {
    const settings = await getAppSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// POST - Mettre à jour les paramètres de l'application
export async function POST(request: NextRequest) {
  try {
    const settings = await request.json();
    await saveAppSettings(settings);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
