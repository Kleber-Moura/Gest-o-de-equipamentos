import { supabase } from '@/lib/supabaseClient'
import type { InvoiceUpload } from '@/types/domain'

export async function listInvoiceUploads(): Promise<InvoiceUpload[]> {
  const { data, error } = await supabase.from('invoice_uploads').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data
}

interface FunctionErrorBody {
  error?: string
}

/** Sobe o PDF direto pro Storage (RLS já garante que só MASTER grava no bucket)
 * e chama a Edge Function que lê a fatura com o Gemini e grava em phone_invoices. */
export async function uploadInvoice(file: File, carrierId: string): Promise<InvoiceUpload> {
  const path = `${carrierId}/${Date.now()}-${file.name}`

  const { error: uploadErr } = await supabase.storage.from('phone-invoices').upload(path, file, {
    contentType: file.type || 'application/pdf',
  })
  if (uploadErr) throw new Error(uploadErr.message)

  const { data, error } = await supabase.functions.invoke('process-invoice', {
    body: { storage_path: path, file_name: file.name, carrier_id: carrierId },
  })

  if (error) {
    const context = (error as { context?: Response }).context
    if (context && typeof context.json === 'function') {
      try {
        const parsed = (await context.json()) as FunctionErrorBody
        throw new Error(parsed.error ?? error.message)
      } catch {
        throw new Error(error.message)
      }
    }
    throw new Error(error.message)
  }

  const errorBody = data as FunctionErrorBody
  if (errorBody?.error) throw new Error(errorBody.error)
  return data as InvoiceUpload
}
