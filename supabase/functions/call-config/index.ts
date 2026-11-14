const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

Deno.serve((req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET' && req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed.' }), { status: 405, headers: corsHeaders });
  const iceServers: Record<string, unknown>[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  const urlsRaw = Deno.env.get('TURN_URLS') || '';
  const username = Deno.env.get('TURN_USERNAME') || '';
  const credential = Deno.env.get('TURN_CREDENTIAL') || '';
  const urls = urlsRaw.split(',').map((url) => url.trim()).filter(Boolean);
  if (urls.length && username && credential) iceServers.push({ urls, username, credential });
  return new Response(JSON.stringify({ iceServers, turnConfigured: iceServers.length > 2 }), { status: 200, headers: corsHeaders });
});
