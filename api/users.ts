// api/users.ts - Vercel Serverless Function
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '@vercel/postgres';

// Type User de l'application
interface User {
  id: string;
  name: string;
  initials: string;
  role: string;
  password?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
}

// Transformation DB -> App
function transformUser(dbUser: any): User {
  return {
    id: dbUser.id,
    name: dbUser.name,
    initials: dbUser.initials,
    role: dbUser.role,
    password: dbUser.password,
    email: dbUser.email,
    phone: dbUser.phone,
    avatarUrl: dbUser.avatar_url,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // GET - Récupérer tous les utilisateurs
    if (req.method === 'GET') {
      const { rows } = await sql`SELECT * FROM users ORDER BY name`;
      const users = rows.map(transformUser);
      return res.status(200).json(users);
    }

    // POST - Créer ou mettre à jour un utilisateur
    if (req.method === 'POST') {
      const user = req.body as User;
      
      await sql`
        INSERT INTO users (id, name, initials, role, password, email, phone, avatar_url)
        VALUES (
          ${user.id}, 
          ${user.name}, 
          ${user.initials}, 
          ${user.role}, 
          ${user.password || null}, 
          ${user.email || null}, 
          ${user.phone || null}, 
          ${user.avatarUrl || null}
        )
        ON CONFLICT (id) 
        DO UPDATE SET 
          name = EXCLUDED.name,
          initials = EXCLUDED.initials,
          role = EXCLUDED.role,
          password = EXCLUDED.password,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          avatar_url = EXCLUDED.avatar_url
      `;
      
      return res.status(200).json({ success: true });
    }

    // DELETE - Supprimer un utilisateur
    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'User ID is required' });
      }
      
      await sql`DELETE FROM users WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Error in /api/users:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
