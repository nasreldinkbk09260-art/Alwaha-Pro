const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

async function loadPublicManagementConfig() {
  const defaultConfig = {
    freeMarketRadiusKm: 15,
    dailyDirectMessages: 100,
    weeklyDirectMessages: 500,
    dailyMarketMessages: 50,
    weeklyMarketMessages: 250,
  };
  const url = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !serviceKey) return defaultConfig;
  try {
    const response = await fetch(
      `${url.replace(/\/$/, '')}/rest/v1/app_settings?key=eq.management_config_v1&select=value&limit=1`,
      {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        signal: AbortSignal.timeout(1800),
      },
    );
    if (!response.ok) return defaultConfig;
    const rows = await response.json();
    const config = rows?.[0]?.value ? JSON.parse(rows[0].value) : {};
    const free = config?.free || {};
    const bounded = (value: unknown, fallback: number, min: number, max: number) => {
      const number = Number(value);
      return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
    };
    return {
      freeMarketRadiusKm: bounded(free.local_market_radius_km, 15, 1, 100),
      dailyDirectMessages: bounded(free.daily_direct_messages, 100, 0, 100000),
      weeklyDirectMessages: bounded(free.weekly_direct_messages, 500, 0, 500000),
      dailyMarketMessages: bounded(free.daily_market_messages, 50, 0, 100000),
      weeklyMarketMessages: bounded(free.weekly_market_messages, 250, 0, 500000),
    };
  } catch (error) {
    console.warn('[call-config] Public management settings fallback:', error instanceof Error ? error.message : 'unavailable');
    return defaultConfig;
  }
}

Deno.serve(async (req: Request) => {
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
  const management = await loadPublicManagementConfig();
  return new Response(JSON.stringify({
    iceServers,
    turnConfigured: iceServers.length > 2,
    market: { freeRadiusKm: management.freeMarketRadiusKm },
    messagingQuotas: {
      dailyDirectMessages: management.dailyDirectMessages,
      weeklyDirectMessages: management.weeklyDirectMessages,
      dailyMarketMessages: management.dailyMarketMessages,
      weeklyMarketMessages: management.weeklyMarketMessages,
    },
  }), { status: 200, headers: corsHeaders });
});
