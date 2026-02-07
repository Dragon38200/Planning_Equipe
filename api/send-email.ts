import { Resend } from 'resend';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  // CORS Headers for development if needed, though usually handled by Vite proxy / Vercel rewrites
  const headers = {
    'Content-Type': 'application/json',
  };

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const { to, subject, html } = await request.json();
    
    // Utilisation de la variable d'environnement (prioritaire) ou de la clé fournie
    const apiKey = process.env.RESEND_API_KEY || 're_hJiidYri_G9N3eQiPE4Kjg4oEKG4A4kuM';

    if (!apiKey) {
      console.error("RESEND_API_KEY is missing.");
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing API Key' }), { status: 500, headers });
    }

    const resend = new Resend(apiKey);

    // Note: 'onboarding@resend.dev' est l'adresse par défaut pour le testing Resend.
    // Cela ne fonctionne que vers l'email administrateur du compte Resend.
    // Pour la production, validez un domaine et utilisez 'ne-pas-repondre@votre-domaine.com'
    const fromEmail = 'Planit-Mounier <onboarding@resend.dev>'; 

    const data = await resend.emails.send({
      from: fromEmail,
      to: [to], 
      subject: subject,
      html: html,
    });

    if (data.error) {
        console.error("Resend API Error:", data.error);
        return new Response(JSON.stringify({ error: data.error.message || 'Erreur Resend inconnue' }), { status: 400, headers });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Email API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers });
  }
}