// api/templates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAllTemplates, saveTemplate, deleteTemplate } from '../../lib/db';

// GET - Récupérer tous les templates
export async function GET() {
  try {
    const templates = await getAllTemplates();
    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// POST - Créer ou mettre à jour un template
export async function POST(request: NextRequest) {
  try {
    const template = await request.json();
    await saveTemplate(template);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving template:', error);
    return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
  }
}

// DELETE - Supprimer un template
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }
    
    await deleteTemplate(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
