import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') ?? 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey)
    return json({ error: 'Server configuration is incomplete' }, 500);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  let body: {
    action?: string;
    purpose?: string;
    token?: string;
    consent?: boolean;
    participantId?: string;
    registrationId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  if (body.action === 'verify' || body.action === 'consent') {
    if (!body.token || body.token.length < 32 || body.token.length > 256) {
      return json({ error: 'Invalid verification token' }, 400);
    }
    if (body.action === 'consent' && body.consent !== true) {
      return json({ error: 'Explicit guardian consent is required' }, 400);
    }
    const functionName =
      body.action === 'consent' ? 'confirm_guardian_consent' : 'confirm_guardian_verification';
    const { data, error } = await admin.rpc(functionName, {
      p_token_hash: await sha256(body.token),
    });
    if (error) return json({ error: 'Guardian confirmation could not be completed' }, 500);
    if (!data) return json({ error: 'This link is invalid, expired or already used' }, 400);
    return json({ verified: true });
  }

  if (body.action !== 'send') return json({ error: 'Unsupported action' }, 400);
  const purpose = body.purpose === 'consent' ? 'consent' : 'verification';
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401);

  const jwt = authorization.slice('Bearer '.length);
  const { data: authData, error: authError } = await admin.auth.getUser(jwt);
  if (authError || !authData.user) return json({ error: 'Authentication required' }, 401);
  const userId = authData.user.id;
  // The registration row is keyed by the participant's authenticated profile ID.
  // Never accept a client-supplied identifier that differs from the JWT subject.
  if (
    !body.participantId ||
    !body.registrationId ||
    body.participantId !== userId ||
    body.registrationId !== userId
  ) {
    return json(
      { error: 'Participant or registration does not match the authenticated user' },
      403,
    );
  }

  const { data: registration, error: registrationError } = await admin
    .from('participant_registrations')
    .select(
      'user_id, guardian_full_name, guardian_phone, guardian_email, guardian_verified_at, guardian_verified_email, parental_consent_at, step_3_completed_at, terms_version, terms_accepted_at, privacy_version, privacy_accepted_at',
    )
    .eq('user_id', body.registrationId)
    .maybeSingle();
  const validGuardianRecord = Boolean(
    registration &&
      registration.user_id === body.participantId &&
      registration.step_3_completed_at &&
      registration.guardian_full_name &&
      registration.guardian_full_name.trim().length >= 3 &&
      registration.guardian_phone &&
      registration.guardian_phone.trim().length >= 6 &&
      registration.guardian_email &&
      /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(registration.guardian_email),
  );
  if (registrationError || !validGuardianRecord) {
    return json({ error: 'Save valid guardian information before requesting a link' }, 400);
  }
  if (purpose === 'verification' && registration.guardian_verified_at) {
    return json({ verified: true, alreadyVerified: true });
  }
  let guardianConsentVersion: string | null = null;
  if (purpose === 'consent') {
    if (
      !registration.guardian_verified_at ||
      registration.guardian_verified_email !== registration.guardian_email ||
      !registration.terms_accepted_at ||
      !registration.privacy_accepted_at ||
      !registration.terms_version ||
      !registration.privacy_version ||
      registration.parental_consent_at
    ) {
      return json(
        { error: 'Verify the guardian email and save approved legal agreements first' },
        400,
      );
    }
    const { data: documents, error: documentsError } = await admin
      .from('legal_documents')
      .select('document_type, version')
      .eq('is_current', true)
      .not('approved_at', 'is', null);
    if (documentsError) return json({ error: 'Could not verify current legal versions' }, 500);
    const currentTerms = documents?.find((document) => document.document_type === 'terms');
    const currentPrivacy = documents?.find((document) => document.document_type === 'privacy');
    const currentGuardianConsent = documents?.find(
      (document) => document.document_type === 'guardian_consent',
    );
    if (
      currentTerms?.version !== registration.terms_version ||
      currentPrivacy?.version !== registration.privacy_version ||
      !currentGuardianConsent?.version
    ) {
      return json(
        { error: 'Legal documents changed. Review and accept the current versions again.' },
        409,
      );
    }
    guardianConsentVersion = currentGuardianConsent.version;
  }

  const { count, error: countError } = await admin
    .from('guardian_verification_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());
  if (countError) return json({ error: 'Could not check email request limits' }, 500);
  if ((count ?? 0) >= 3) return json({ error: 'Too many requests. Try again in 15 minutes.' }, 429);

  const token = randomToken();
  const tokenHash = await sha256(token);
  const { error: revokeError } = await admin
    .from('guardian_verification_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('used_at', null);
  if (revokeError) return json({ error: 'Could not prepare a new link' }, 500);

  const { error: insertError } = await admin.from('guardian_verification_tokens').insert({
    user_id: userId,
    guardian_email: registration.guardian_email,
    token_hash: tokenHash,
    purpose,
    terms_version: purpose === 'consent' ? registration.terms_version : null,
    privacy_version: purpose === 'consent' ? registration.privacy_version : null,
    guardian_consent_version: purpose === 'consent' ? guardianConsentVersion : null,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
  if (insertError) return json({ error: 'Could not create guardian link' }, 500);

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('GUARDIAN_VERIFICATION_FROM');
  const siteUrl = Deno.env.get('SITE_URL');
  if (!resendKey || !from || !siteUrl) {
    await admin
      .from('guardian_verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token_hash', tokenHash);
    return json({ error: 'Guardian email delivery is not configured on the server' }, 503);
  }

  const link = new URL('/guardian-verification', siteUrl);
  link.hash = new URLSearchParams({ token, purpose }).toString();
  const verificationMessage =
    '<p>A participant has entered this address as their parent/guardian contact.</p>' +
    '<p>Open this single-use link within 30 minutes to verify the email address:</p>' +
    '<p><a href="' +
    link.toString() +
    '">Verify guardian email</a></p>' +
    '<p>Email verification does not constitute parental consent.</p>';
  const consentMessage =
    '<p>A participant has completed the legal-agreements step and requests your explicit consent.</p>' +
    '<p>Please review the current Terms and Conditions, Privacy Policy and approved guardian consent declaration on the secure page before deciding.</p>' +
    '<p><a href="' +
    link.toString() +
    '">Review documents and provide guardian consent</a></p>' +
    '<p>This link is single-use and expires in 30 minutes. Consent is recorded separately from email verification.</p>';

  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [registration.guardian_email],
      subject:
        purpose === 'consent'
          ? 'Youth Leaders Academy — parental consent requested'
          : 'Youth Leaders Academy — verify guardian email',
      html: purpose === 'consent' ? consentMessage : verificationMessage,
    }),
  });
  if (!emailResponse.ok) {
    await admin
      .from('guardian_verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token_hash', tokenHash);
    return json({ error: 'The guardian email could not be sent' }, 502);
  }
  return json({ sent: true });
});
