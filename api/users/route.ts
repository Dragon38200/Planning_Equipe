// api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAllUsers, saveUser, deleteUser } from '../../lib/db';

// GET - Récupérer tous les utilisateurs
export async function GET() {
  try {
    const users = await getAllUsers();
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST - Créer ou mettre à jour un utilisateur
export async function POST(request: NextRequest) {
  try {
    const user = await request.json();
    await saveUser(user);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving user:', error);
    return NextResponse.json({ error: 'Failed to save user' }, { status: 500 });
  }
}

// DELETE - Supprimer un utilisateur
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    await deleteUser(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
