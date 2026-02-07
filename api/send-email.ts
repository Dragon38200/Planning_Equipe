import { Resend } from 'resend';
import { Buffer } from 'node:buffer';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  // CORS Headers for development if needed
  const headers = {
    'Content-Type': 'application/json',
  };

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  try {
    const body = await request.json();
    const { to, subject, html, attachments } = body;
    
    const apiKey = process.env.RESEND_API_KEY || 're_hJiidYri_G9N3eQiPE4Kjg4oEKG4A4kuM';

    if (!apiKey) {
      console.error("RESEND_API_KEY is missing.");
      return new Response(JSON.stringify({ error: 'Server configuration error: Missing API Key' }), { status: 500, headers });
    }

    const resend = new Resend(apiKey);
    const fromEmail = 'Planit-Mounier <onboarding@resend.dev>'; 

    const emailPayload: any = {
      from: fromEmail,
      to: [to], 
      subject: subject,
      html: html,
    };

    // Gestion des pièces jointes (PDF)
    if (attachments && Array.isArray(attachments)) {
        emailPayload.attachments = attachments.map((att: any) => ({
            filename: att.filename,
            content: Buffer.from(att.content, 'base64'),
        }));
    }

    const data = await resend.emails.send(emailPayload);

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