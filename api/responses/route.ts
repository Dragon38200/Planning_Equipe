// api/responses/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAllResponses, saveResponse, deleteResponse } from '../../lib/db';

// GET - Récupérer toutes les réponses
export async function GET() {
  try {
    const responses = await getAllResponses();
    return NextResponse.json(responses);
  } catch (error) {
    console.error('Error fetching responses:', error);
    return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 });
  }
}

// POST - Créer ou mettre à jour une réponse
export async function POST(request: NextRequest) {
  try {
    const response = await request.json();
    await saveResponse(response);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving response:', error);
    return NextResponse.json({ error: 'Failed to save response' }, { status: 500 });
  }
}

// DELETE - Supprimer une réponse
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Response ID is required' }, { status: 400 });
    }
    
    await deleteResponse(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting response:', error);
    return NextResponse.json({ error: 'Failed to delete response' }, { status: 500 });
  }
}
