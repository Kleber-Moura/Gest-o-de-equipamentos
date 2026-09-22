import { supabase } from '@/lib/supabaseClient'
import type { PhoneInvoice, PhoneLine } from '@/types/domain'

/** Todas as linhas ativas, sem paginação — usado pelo painel de telefonia do
 * Dashboard, que precisa do conjunto completo para filtrar/agregar no cliente. */
export async function listAllPhoneLines(): Promise<PhoneLine[]> {
  const { data, error } = await supabase.from('phone_lines').select('*').is('deleted_at', null).order('number')
  if (error) throw error
  return data
}

/** Faturas importadas da aba "Fatura" da planilha original (ver migration
 * 20260812140000_phone_invoices e o anexo no relatório de migração). */
export async function listPhoneInvoices(): Promise<PhoneInvoice[]> {
  const { data, error } = await supabase.from('phone_invoices').select('*').order('invoice_date')
  if (error) throw error
  return data
}
