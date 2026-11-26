import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_URL') ?? 'https://example.invalid',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response(405, { error: 'Method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return response(503, { error: 'Verification service is not configured.' });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: { action?: string; email?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return response(400, { error: 'Invalid request.' });
  }

  if (body.action === 'verify') {
    if (typeof body.token !== 'string' || body.token.length < 32 || body.token.length > 128) {
      return response(400, { error: 'Verification link is invalid or expired.' });
    }
    const { data, error } = await admin.rpc('verify_parent_email_token', { p_token: body.token });
    if (error || data !== true) return response(400, { error: 'Verification link is invalid, expired or already used.' });
    return response(200, { verified: true });
  }

  if (body.action !== 'send' || typeof body.email !== 'string') {
    return response(400, { error: 'Invalid request.' });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return response(401, { error: 'Authentication required.' });
  const jwt = authorization.slice('Bearer '.length);
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await caller.auth.getUser(jwt);
  if (userError || !userData.user || !userData.user.email_confirmed_at) {
    return response(401, { error: 'A verified participant session is required.' });
  }

  const { data: roleRow, error: roleError } = await caller
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (roleError || roleRow?.role !== 'participant') return response(403, { error: 'Participant account required.' });

  const { data: token, error: tokenError } = await admin.rpc('create_parent_email_verification', {
    p_user_id: userData.user.id,
    p_email: body.email.trim().toLowerCase(),
  });
  if (tokenError || typeof token !== 'string') {
    const limited = tokenError?.message?.includes('rate limit');
    return response(limited ? 429 : 400, {
      error: limited
        ? 'მოთხოვნების ლიმიტი ამოიწურა. სცადეთ მოგვიანებით.'
        : 'შეინახეთ მშობლის ელფოსტა და სცადეთ ხელახლა.',
    });
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL');
  const appUrl = Deno.env.get('APP_URL');
  if (!resendKey || !from || !appUrl) return response(503, { error: 'Email delivery is not configured.' });

  const verificationUrl = new URL('/register', appUrl);
  verificationUrl.searchParams.set('parent_token', token);
  const mail = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [body.email.trim().toLowerCase()],
      subject: 'მშობლის / მეურვის ელფოსტის დადასტურება',
      text: `ელფოსტის დასადასტურებლად გახსენით ბმული (მოქმედებს 30 წუთი, ერთჯერადია): ${verificationUrl.toString()}\n\nთუ ეს მოთხოვნა თქვენ არ გეკუთვნით, უგულებელყავით წერილი.`,
    }),
  });
  if (!mail.ok) {
    // Never return the token to the browser or include it in logs.
    return response(502, { error: 'დადასტურების წერილის გაგზავნა ვერ მოხერხდა. სცადეთ მოგვიანებით.' });
  }
  return response(200, { sent: true });
});
