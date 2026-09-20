// Edge Function: create-staff
//
// Lets an ACTIVE ADMIN of this business create a login (email + password) and
// give it a role, from inside the app. Creating a login needs the project's
// service-role key, which must never reach the browser — so it lives here, in
// the same Supabase project as the business database, injected by Supabase
// (SUPABASE_SERVICE_ROLE_KEY). One deployment per business project; each one
// only ever touches its own project's users.
//
// Nothing here changes tables or RLS. It:
//   1. checks the caller's JWT and that they are an active admin (staff_profiles),
//   2. creates the auth user (email pre-confirmed, so they can sign in at once),
//   3. inserts their staff_profiles row; if that fails, removes the new login.
//
// Deploy:  supabase functions deploy create-staff --project-ref <ref> --use-api

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' })

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authHeader = req.headers.get('Authorization')
  if (!url || !anonKey || !serviceKey) return reply(500, { error: 'Function is not configured.' })
  if (!authHeader) return reply(401, { error: 'Sign in first.' })

  // 1. Who is calling, and are they an active admin of this business?
  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: userData, error: userError } = await asCaller.auth.getUser()
  if (userError || !userData.user) return reply(401, { error: 'Your session has expired. Sign in again.' })
  const { data: me, error: meError } = await asCaller
    .from('staff_profiles')
    .select('role, status')
    .eq('user_id', userData.user.id)
    .maybeSingle()
  if (meError || !me || me.role !== 'admin' || me.status !== 'active') {
    return reply(403, { error: 'Only an active administrator can create logins.' })
  }

  // 2. Validate the request.
  let input: { email?: unknown; password?: unknown; full_name?: unknown; role?: unknown }
  try {
    input = await req.json()
  } catch {
    return reply(400, { error: 'Invalid request.' })
  }
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const fullName = typeof input.full_name === 'string' ? input.full_name.trim() : ''
  const role = input.role === 'admin' ? 'admin' : input.role === 'staff' ? 'staff' : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: 'Enter a valid email address.' })
  if (password.length < 8) return reply(400, { error: 'The password must be at least 8 characters.' })
  if (!fullName) return reply(400, { error: 'Enter the person’s name.' })
  if (!role) return reply(400, { error: 'Choose a role.' })

  // 3. Create the login, then its role row.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (createError || !created.user) {
    const taken = /already|registered|exists/i.test(createError?.message ?? '')
    return reply(taken ? 409 : 400, {
      error: taken ? 'A login with this email already exists in this business.' : (createError?.message ?? 'Could not create the login.'),
    })
  }

  const { error: profileError } = await admin
    .from('staff_profiles')
    .insert({ user_id: created.user.id, full_name: fullName, role, status: 'active' })
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return reply(500, { error: 'The login could not be given access, so it was not created. ' + profileError.message })
  }

  return reply(200, { user_id: created.user.id, email, role })
})
