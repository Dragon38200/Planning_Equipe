// api/missions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAllMissions, saveMission, batchSaveMissions, deleteMission } from '../../lib/db';

// GET - Récupérer toutes les missions
export async function GET() {
  try {
    const missions = await getAllMissions();
    return NextResponse.json(missions);
  } catch (error) {
    console.error('Error fetching missions:', error);
    return NextResponse.json({ error: 'Failed to fetch missions' }, { status: 500 });
  }
}

// POST - Créer ou mettre à jour une ou plusieurs missions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Si c'est un tableau, utiliser batchSave
    if (Array.isArray(body)) {
      await batchSaveMissions(body);
    } else {
      await saveMission(body);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving mission(s):', error);
    return NextResponse.json({ error: 'Failed to save mission(s)' }, { status: 500 });
  }
}

// DELETE - Supprimer une mission
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Mission ID is required' }, { status: 400 });
    }
    
    await deleteMission(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting mission:', error);
    return NextResponse.json({ error: 'Failed to delete mission' }, { status: 500 });
  }
}
