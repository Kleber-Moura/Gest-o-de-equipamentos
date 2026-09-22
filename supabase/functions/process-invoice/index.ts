// Edge Function: lê uma fatura de telefonia (PDF, Vivo ou Claro) usando o Gemini
// e grava os valores por linha em phone_invoices. Roda com a SERVICE_ROLE_KEY
// (nunca exposta ao frontend) e a GEMINI_API_KEY (secret da function, nunca no
// código-fonte). Só MASTER pode chamar — verificado aqui, no servidor.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_MODEL = 'gemini-flash-latest'

const EXTRACTION_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      number: { type: 'STRING', description: 'Número da linha exatamente como aparece na fatura, com DDD' },
      amount: { type: 'NUMBER', description: 'Valor cobrado dessa linha em reais, só o número' },
      date: { type: 'STRING', description: 'Data de referência/vencimento da fatura no formato AAAA-MM-DD' },
    },
    required: ['number', 'amount', 'date'],
  },
}

const EXTRACTION_PROMPT = `Você está analisando uma fatura de telefonia/internet corporativa brasileira.
Extraia TODAS as linhas cobradas nesta fatura. Para cada linha, retorne:
- number: o número da linha exatamente como aparece no documento, com DDD.
- amount: o valor cobrado dessa linha em reais, apenas o número (use ponto decimal, sem "R$").
- date: a data de referência/vencimento da fatura, no formato AAAA-MM-DD.
Se a fatura cobrir várias linhas, retorne uma entrada para cada uma. Não invente valores:
se não conseguir ler um número ou valor com certeza, não inclua essa linha no resultado.`

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')

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

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: callerProfile } = await admin
      .from('app_profiles')
      .select('role,status')
      .eq('id', caller.id)
      .single()

    if (callerProfile?.role !== 'MASTER' || callerProfile?.status !== 'APPROVED') {
      return json({ error: 'Apenas o usuário MASTER pode processar faturas' }, 403)
    }

    if (!GEMINI_API_KEY) {
      return json({ error: 'GEMINI_API_KEY não configurada nos secrets da function' }, 500)
    }

    const { storage_path, file_name, carrier_id } = await req.json()
    if (!storage_path || !file_name || !carrier_id) {
      return json({ error: 'storage_path, file_name e carrier_id são obrigatórios' }, 400)
    }

    const { data: uploadRow, error: insertErr } = await admin
      .from('invoice_uploads')
      .insert({ carrier_id, file_name, storage_path, uploaded_by: caller.id, status: 'PROCESSING' })
      .select()
      .single()
    if (insertErr) return json({ error: insertErr.message }, 400)

    try {
      const { data: fileBlob, error: downloadErr } = await admin.storage.from('phone-invoices').download(storage_path)
      if (downloadErr || !fileBlob) throw new Error(downloadErr?.message ?? 'Falha ao baixar o arquivo enviado')

      const bytes = new Uint8Array(await fileBlob.arrayBuffer())
      let binary = ''
      const chunkSize = 0x8000
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
      }
      const base64 = btoa(binary)

      const geminiResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-goog-api-key': GEMINI_API_KEY },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inline_data: { mime_type: 'application/pdf', data: base64 } },
                  { text: EXTRACTION_PROMPT },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: EXTRACTION_SCHEMA,
            },
          }),
        },
      )

      if (!geminiResp.ok) {
        const errText = await geminiResp.text()
        throw new Error(`Gemini API: ${geminiResp.status} ${errText.slice(0, 300)}`)
      }

      const geminiBody = await geminiResp.json()
      const text = geminiBody?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!text) throw new Error('Gemini não retornou conteúdo extraído')

      const extracted = JSON.parse(text) as Array<{ number: string; amount: number; date: string }>

      const { data: carrierRow } = await admin.from('carriers').select('id').eq('id', carrier_id).single()
      if (!carrierRow) throw new Error('Operadora não encontrada')

      let matched = 0
      for (const item of extracted) {
        const rawDigits = digitsOnly(item.number)
        if (!rawDigits || !item.date || item.amount == null) continue

        const { data: line } = await admin
          .from('phone_lines')
          .select('id')
          .eq('number', `+55${rawDigits}`)
          .maybeSingle()

        if (line) matched++

        const { error: upsertErr } = await admin.from('phone_invoices').upsert(
          {
            phone_line_id: line?.id ?? null,
            raw_number: rawDigits,
            carrier_id,
            amount: item.amount,
            invoice_date: item.date,
            upload_id: uploadRow.id,
          },
          { onConflict: 'raw_number,carrier_id,invoice_date' },
        )
        if (upsertErr) throw new Error(`Falha ao gravar linha ${item.number}: ${upsertErr.message}`)
      }

      const { data: finalRow, error: updateErr } = await admin
        .from('invoice_uploads')
        .update({
          status: 'DONE',
          lines_extracted: extracted.length,
          lines_matched: matched,
          completed_at: new Date().toISOString(),
        })
        .eq('id', uploadRow.id)
        .select()
        .single()
      if (updateErr) throw new Error(updateErr.message)

      await admin.from('audit_logs').insert({
        actor_user_id: caller.id,
        entity_type: 'invoice_uploads',
        entity_id: uploadRow.id,
        action: 'PROCESS_INVOICE',
        old_value: null,
        new_value: { file_name, lines_extracted: extracted.length, lines_matched: matched },
      })

      return json(finalRow)
    } catch (processErr) {
      const message = processErr instanceof Error ? processErr.message : 'Erro ao processar a fatura'
      await admin
        .from('invoice_uploads')
        .update({ status: 'ERROR', error_message: message, completed_at: new Date().toISOString() })
        .eq('id', uploadRow.id)
      return json({ error: message }, 400)
    }
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erro interno' }, 500)
  }
})
