// Ce fichier est désactivé car l'application est repassée en mode LocalStorage pur.
// La dépendance @vercel/kv a été retirée.

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  return new Response(JSON.stringify({ message: 'Serverless Data API is disabled in Local Mode.' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}