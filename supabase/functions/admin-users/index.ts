// Edge Function: administração de usuários (criar, resetar senha, editar perfil,
// excluir). Existe porque essas operações mexem em auth.users e exigem a
// SERVICE_ROLE_KEY — que nunca pode ser exposta ao frontend (regra do projeto).
// A chave fica só nas variáveis de ambiente da function, injetadas automaticamente
// pelo Supabase; o browser nunca a vê. Toda ação exige que quem chama seja MASTER
// aprovado — verificado aqui, no servidor, e não confiado ao frontend.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace('Bearer ', '')
    if (!jwt) return json({ error: 'Não autenticado' }, 401)

    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user: caller },
      error: callerErr,
    } = await callerClient.auth.getUser(jwt)
    if (callerErr || !caller) return json({ error: 'Não autenticado' }, 401)

    // Cliente com service role — só usado depois de confirmar que quem chamou é MASTER.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: callerProfile } = await admin
      .from('app_profiles')
      .select('role,status')
      .eq('id', caller.id)
      .single()

    if (callerProfile?.role !== 'MASTER' || callerProfile?.status !== 'APPROVED') {
      return json({ error: 'Apenas o usuário MASTER pode administrar usuários' }, 403)
    }

    const body = await req.json()

    switch (body.action) {
      case 'create':
        return await handleCreate(admin, caller.id, body)
      case 'reset_password':
        return await handleResetPassword(admin, caller.id, body)
      case 'update_profile':
        return await handleUpdateProfile(admin, caller.id, body)
      case 'delete':
        return await handleDelete(admin, caller.id, body)
      default:
        return json({ error: 'Ação desconhecida' }, 400)
    }
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erro interno' }, 500)
  }
})

// deno-lint-ignore no-explicit-any
async function handleCreate(admin: any, actorId: string, body: any) {
  const { email, password, name, role, department_id, location_id } = body
  if (!email || !password || !name) return json({ error: 'E-mail, senha e nome são obrigatórios' }, 400)
  if (String(password).length < 8) return json({ error: 'A senha deve ter ao menos 8 caracteres' }, 400)

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })
  if (createErr) return json({ error: createErr.message }, 400)

  const userId = created.user.id

  // O trigger handle_new_user já criou a linha em app_profiles (PENDING/USER) —
  // aqui só finalizamos com os dados escolhidos pelo MASTER na criação.
  const { error: updErr } = await admin
    .from('app_profiles')
    .update({
      role: role ?? 'USER',
      status: 'APPROVED',
      department_id: department_id ?? null,
      location_id: location_id ?? null,
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (updErr) return json({ error: updErr.message }, 400)

  await admin.from('audit_logs').insert({
    actor_user_id: actorId,
    entity_type: 'app_profiles',
    entity_id: userId,
    action: 'CREATE_USER',
    old_value: null,
    new_value: { email, name, role: role ?? 'USER' },
  })

  return json({ id: userId })
}

// deno-lint-ignore no-explicit-any
async function handleResetPassword(admin: any, actorId: string, body: any) {
  const { user_id, new_password } = body
  if (!user_id || !new_password) return json({ error: 'Usuário e nova senha são obrigatórios' }, 400)
  if (String(new_password).length < 8) return json({ error: 'A senha deve ter ao menos 8 caracteres' }, 400)

  const { error } = await admin.auth.admin.updateUserById(user_id, { password: new_password })
  if (error) return json({ error: error.message }, 400)

  await admin.from('audit_logs').insert({
    actor_user_id: actorId,
    entity_type: 'app_profiles',
    entity_id: user_id,
    action: 'RESET_PASSWORD',
    old_value: null,
    new_value: null,
  })

  return json({ ok: true })
}

// deno-lint-ignore no-explicit-any
async function handleUpdateProfile(admin: any, actorId: string, body: any) {
  const { user_id, name, email, department_id, location_id } = body
  if (!user_id || !name || !email) return json({ error: 'Usuário, nome e e-mail são obrigatórios' }, 400)

  const { data: before } = await admin
    .from('app_profiles')
    .select('name,email,department_id,location_id')
    .eq('id', user_id)
    .single()
  if (!before) return json({ error: 'Usuário não encontrado' }, 404)

  if (email !== before.email) {
    const { error: emailErr } = await admin.auth.admin.updateUserById(user_id, { email, email_confirm: true })
    if (emailErr) return json({ error: emailErr.message }, 400)
  }

  const { error } = await admin
    .from('app_profiles')
    .update({ name, email, department_id: department_id ?? null, location_id: location_id ?? null })
    .eq('id', user_id)
  if (error) return json({ error: error.message }, 400)

  await admin.from('audit_logs').insert({
    actor_user_id: actorId,
    entity_type: 'app_profiles',
    entity_id: user_id,
    action: 'UPDATE_PROFILE',
    old_value: before,
    new_value: { name, email, department_id: department_id ?? null, location_id: location_id ?? null },
  })

  return json({ ok: true })
}

// deno-lint-ignore no-explicit-any
async function handleDelete(admin: any, actorId: string, body: any) {
  const { user_id } = body
  if (!user_id) return json({ error: 'Usuário é obrigatório' }, 400)
  if (user_id === actorId) return json({ error: 'Não é possível excluir a própria conta' }, 400)

  const { data: target } = await admin.from('app_profiles').select('role,name,email').eq('id', user_id).single()
  if (!target) return json({ error: 'Usuário não encontrado' }, 404)

  if (target.role === 'MASTER') {
    const { count } = await admin
      .from('app_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'MASTER')
      .eq('status', 'APPROVED')
    if ((count ?? 0) <= 1) return json({ error: 'Não é possível excluir o último usuário MASTER' }, 400)
  }

  await admin.from('audit_logs').insert({
    actor_user_id: actorId,
    entity_type: 'app_profiles',
    entity_id: user_id,
    action: 'DELETE_USER',
    old_value: target,
    new_value: null,
  })

  // Exclui em auth.users — app_profiles cai em cascata (on delete cascade).
  const { error } = await admin.auth.admin.deleteUser(user_id)
  if (error) return json({ error: error.message }, 400)

  return json({ ok: true })
}
