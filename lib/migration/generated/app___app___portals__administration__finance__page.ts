// Generated from app/(app)/portals/administration/finance/page.tsx by modern/scripts/generate-original-actions.mjs. Do not edit.
import "server-only"
import { financialAmountCents, totalFinancialCents, reconcileFinanceInvoice } from "@/lib/administration/finance-reconciliation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { validateUploadSecurity, safeUploadName } from "@/lib/upload-security";
import { financialAttachmentPayload } from "@/lib/administration/financial-attachment-integrity";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/crew-server";
import { canOpenPortal, type PortalAssignment } from "@/lib/portal-access";
import { currentPortalAssignments } from "@/lib/portal-access-server";
async function requireAdministration() {
    const current = await getCurrentUser();
    if (!current)
        redirect('/login');
    if ((!current.approved || Boolean(current.account_blocked)) && !current.isOwner)
        redirect('/portals');
    const supabase = await createClient();
    // The parent layout and PortalSwitcher reuse this verified read per request.
    // Privileged accounts skip it; all other users remain fail-closed.
    if (!current.realIsAdmin && !current.isOwner) {
        const { data, error } = await currentPortalAssignments();
        if (error || !canOpenPortal('administration', (data ?? []) as PortalAssignment[], {
            approved: current.approved, blocked: current.account_blocked === true,
        }))
            redirect('/portals');
    }
    return { supabase, isAdmin: current.realIsAdmin || current.isOwner };
}
export async function createCounterparty(formData: FormData) {
    'use server';
    const { supabase } = await requireAdministration();
    const name = String(formData.get('name') ?? '').trim();
    const kind = String(formData.get('kind') ?? '');
    const email = String(formData.get('email') ?? '').trim();
    const streetAddress = String(formData.get('street_address') ?? '').trim();
    const postalCode = String(formData.get('postal_code') ?? '').trim();
    const city = String(formData.get('city') ?? '').trim();
    const countryCode = String(formData.get('country_code') ?? '').trim().toUpperCase();
    const iban = String(formData.get('iban') ?? '').replace(/\s+/g, '').toUpperCase();
    const bic = String(formData.get('bic') ?? '').replace(/\s+/g, '').toUpperCase();
    const paymentTermsRaw = String(formData.get('payment_terms_days') ?? '').trim();
    const paymentTermsDays = paymentTermsRaw === '' ? null : Number(paymentTermsRaw);
    if (streetAddress.length > 300 || postalCode.length > 32 || city.length > 120 || (countryCode && !/^[A-Z]{2}$/.test(countryCode)) || (iban && !/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) || (bic && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(bic)) || (paymentTermsDays !== null && (!Number.isInteger(paymentTermsDays) || paymentTermsDays < 0 || paymentTermsDays > 365)))
        redirect('/portals/administration/finance?error=1');
    const billingDetails = { street_address: streetAddress || null, postal_code: postalCode || null, city: city || null, country_code: countryCode || null, iban: iban || null, bic: bic || null, payment_terms_days: paymentTermsDays };
    const vatNumber = String(formData.get('vat_number') ?? '').trim();
    const enterpriseNumber = String(formData.get('enterprise_number') ?? '').trim();
    const peppolEndpoint = String(formData.get('peppol_endpoint') ?? '').trim();
    if (peppolEndpoint.length > 200 || /[\u0000-\u001f]/.test(peppolEndpoint))
        redirect('/portals/administration/finance?error=1');
    if (!name || name.length > 200 || !['customer', 'supplier', 'both'].includes(kind) || email.length > 320 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || vatNumber.length > 32 || enterpriseNumber.length > 32)
        redirect('/portals/administration/finance?error=1');
    const { error } = await (supabase as unknown as SupabaseClient).from('admin_counterparties').insert({ name, kind, email: email || null, vat_number: vatNumber || null, enterprise_number: enterpriseNumber || null, peppol_endpoint: peppolEndpoint || null, ...billingDetails });
    if (error)
        redirect('/portals/administration/finance?error=1');
    revalidatePath('/portals/administration/finance');
    redirect('/portals/administration/finance');
}
export async function updateCounterparty(formData: FormData) {
    'use server';
    const { supabase } = await requireAdministration();
    const id = String(formData.get('counterparty_id') ?? '');
    const name = String(formData.get('name') ?? '').trim();
    const kind = String(formData.get('kind') ?? '');
    const email = String(formData.get('email') ?? '').trim();
    const streetAddress = String(formData.get('street_address') ?? '').trim();
    const postalCode = String(formData.get('postal_code') ?? '').trim();
    const city = String(formData.get('city') ?? '').trim();
    const countryCode = String(formData.get('country_code') ?? '').trim().toUpperCase();
    const iban = String(formData.get('iban') ?? '').replace(/\s+/g, '').toUpperCase();
    const bic = String(formData.get('bic') ?? '').replace(/\s+/g, '').toUpperCase();
    const paymentTermsRaw = String(formData.get('payment_terms_days') ?? '').trim();
    const paymentTermsDays = paymentTermsRaw === '' ? null : Number(paymentTermsRaw);
    if (streetAddress.length > 300 || postalCode.length > 32 || city.length > 120 || (countryCode && !/^[A-Z]{2}$/.test(countryCode)) || (iban && !/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) || (bic && !/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(bic)) || (paymentTermsDays !== null && (!Number.isInteger(paymentTermsDays) || paymentTermsDays < 0 || paymentTermsDays > 365)))
        redirect('/portals/administration/finance?error=1');
    const billingDetails = { street_address: streetAddress || null, postal_code: postalCode || null, city: city || null, country_code: countryCode || null, iban: iban || null, bic: bic || null, payment_terms_days: paymentTermsDays };
    const vatNumber = String(formData.get('vat_number') ?? '').trim();
    const enterpriseNumber = String(formData.get('enterprise_number') ?? '').trim();
    const peppolEndpoint = String(formData.get('peppol_endpoint') ?? '').trim();
    if (peppolEndpoint.length > 200 || /[\u0000-\u001f]/.test(peppolEndpoint))
        redirect('/portals/administration/finance?error=1');
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(id) || !name || name.length > 200 || !['customer', 'supplier', 'both'].includes(kind) || email.length > 320 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || vatNumber.length > 32 || enterpriseNumber.length > 32)
        redirect('/portals/administration/finance?error=1');
    const { data, error } = await (supabase as unknown as SupabaseClient).from('admin_counterparties').update({ name, kind, email: email || null, vat_number: vatNumber || null, enterprise_number: enterpriseNumber || null, peppol_endpoint: peppolEndpoint || null, ...billingDetails }).eq('id', id).select('id');
    if (error || data?.length !== 1)
        redirect('/portals/administration/finance?error=1');
    revalidatePath('/portals/administration/finance');
    redirect('/portals/administration/finance');
}
export async function createDraft(formData: FormData) {
    'use server';
    const { supabase } = await requireAdministration();
    const kind = String(formData.get('kind') ?? '');
    const allowed = ['sales_invoice', 'purchase_invoice', 'credit_note', 'expense', 'quote'];
    if (!allowed.includes(kind))
        return;
    const netRaw = String(formData.get('net_amount') ?? '').trim();
    const taxRaw = String(formData.get('tax_amount') ?? '').trim();
    // Reject empty and over-precise amounts server-side, even when browser validation is bypassed.
    const validAmount = (value: string) => /^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(value);
    if (!validAmount(netRaw) || !validAmount(taxRaw))
        redirect('/portals/administration/finance?error=1');
    const net = Number(netRaw);
    const tax = Number(taxRaw);
    const documentNumber = String(formData.get('document_number') ?? '').trim().slice(0, 100);
    const issueDate = String(formData.get('issue_date') ?? '');
    let dueDate = String(formData.get('due_date') ?? '');
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const validDate = (value: string) => !value || (datePattern.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
    if (!validDate(issueDate) || !validDate(dueDate) || (dueDate && (!issueDate || dueDate < issueDate)))
        redirect('/portals/administration/finance?error=1');
    const notes = String(formData.get('notes') ?? '').trim().slice(0, 2000);
    const eventId = String(formData.get('event_id') ?? '');
    const counterpartyId = String(formData.get('counterparty_id') ?? '');
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (eventId && !uuid.test(eventId))
        redirect('/portals/administration/finance?error=1');
    if (eventId) {
        const { data: event, error: eventError } = await supabase.from('events').select('id').eq('id', eventId).maybeSingle();
        if (eventError || !event)
            redirect('/portals/administration/finance?error=1');
    }
    if (counterpartyId && !uuid.test(counterpartyId))
        redirect('/portals/administration/finance?error=1');
    if (counterpartyId) {
        const { data: party, error: partyError } = await (supabase as unknown as SupabaseClient).from('admin_counterparties').select('id,kind,payment_terms_days').eq('id', counterpartyId).single();
        if (partyError || !party || (kind === 'sales_invoice' && !['customer', 'both'].includes(party.kind)) || (kind === 'purchase_invoice' && !['supplier', 'both'].includes(party.kind)))
            redirect('/portals/administration/finance?error=1');
        if (!dueDate && issueDate && ['sales_invoice', 'purchase_invoice'].includes(kind) && Number.isInteger(party.payment_terms_days) && party.payment_terms_days >= 0 && party.payment_terms_days <= 365) {
            const due = new Date(issueDate + 'T12:00:00Z');
            due.setUTCDate(due.getUTCDate() + party.payment_terms_days);
            dueDate = due.toISOString().slice(0, 10);
        }
    }
    const originalInvoiceId = String(formData.get('original_invoice_id') ?? '');
    if (kind === 'credit_note') {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(originalInvoiceId))
            redirect('/portals/administration/finance?error=1');
        const { data: original } = await supabase.from('admin_financial_documents').select('id,kind,status').eq('id', originalInvoiceId).single();
        if (!original || !['sales_invoice', 'purchase_invoice'].includes(original.kind) || !['approved', 'issued', 'paid'].includes(original.status))
            redirect('/portals/administration/finance?error=1');
    }
    const { error } = await supabase.from('admin_financial_documents').insert({
        kind, document_number: documentNumber || null, net_amount: net, tax_amount: tax, event_id: eventId || null,
        notes: notes || null, status: 'draft', currency: 'EUR', counterparty_id: counterpartyId || null, issue_date: issueDate || null, due_date: dueDate || null,
        original_invoice_id: kind === 'credit_note' ? originalInvoiceId : null,
    });
    if (error)
        redirect('/portals/administration/finance?error=1');
    revalidatePath('/portals/administration/finance');
    redirect('/portals/administration/finance');
}
export async function addInvoiceLine(formData: FormData) {
    'use server';
    const { supabase } = await requireAdministration();
    const documentId = String(formData.get('document_id') ?? '');
    const description = String(formData.get('description') ?? '').trim();
    const quantityRaw = String(formData.get('quantity') ?? '').trim();
    const unitPriceRaw = String(formData.get('unit_price') ?? '').trim();
    const vatRateRaw = String(formData.get('vat_rate') ?? '').trim();
    // Reject empty, negative and non-decimal inputs before Number() can coerce them.
    const validDecimal = (value: string) => /^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(value);
    if (!validDecimal(quantityRaw) || !validDecimal(unitPriceRaw) || !validDecimal(vatRateRaw))
        redirect('/portals/administration/finance?error=1');
    const quantity = Number(quantityRaw);
    const unitPrice = Number(unitPriceRaw);
    const vatRate = Number(vatRateRaw);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documentId) || !description || description.length > 500 || ![quantity, unitPrice, vatRate].every(Number.isFinite) || quantity <= 0 || quantity > 100000 || unitPrice < 0 || unitPrice > 999999999 || vatRate < 0 || vatRate > 100)
        redirect('/portals/administration/finance?error=1');
    const { data: document } = await supabase.from('admin_financial_documents').select('id,status').eq('id', documentId).single();
    if (!document || document.status !== 'draft')
        redirect('/portals/administration/finance?error=1');
    const { error } = await supabase.from('admin_financial_lines').insert({ document_id: documentId, description, quantity, unit_price: unitPrice, vat_rate: vatRate });
    if (error)
        redirect('/portals/administration/finance?error=1');
    revalidatePath('/portals/administration/finance');
    redirect('/portals/administration/finance');
}
export async function updateInvoiceLine(formData: FormData) {
    'use server';
    const { supabase } = await requireAdministration();
    const documentId = String(formData.get('document_id') ?? '');
    const lineId = String(formData.get('line_id') ?? '');
    const description = String(formData.get('description') ?? '').trim();
    const quantityRaw = String(formData.get('quantity') ?? '').trim();
    const unitPriceRaw = String(formData.get('unit_price') ?? '').trim();
    const vatRateRaw = String(formData.get('vat_rate') ?? '').trim();
    // Reject empty, negative and non-decimal inputs before Number() can coerce them.
    const validDecimal = (value: string) => /^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(value);
    if (!validDecimal(quantityRaw) || !validDecimal(unitPriceRaw) || !validDecimal(vatRateRaw))
        redirect('/portals/administration/finance?error=1');
    const quantity = Number(quantityRaw);
    const unitPrice = Number(unitPriceRaw);
    const vatRate = Number(vatRateRaw);
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(documentId) || !uuid.test(lineId) || !description || description.length > 500 || ![quantity, unitPrice, vatRate].every(Number.isFinite) || quantity <= 0 || quantity > 100000 || unitPrice < 0 || unitPrice > 999999999 || vatRate < 0 || vatRate > 100)
        redirect('/portals/administration/finance?error=1');
    const { data: document, error: lookupError } = await supabase.from('admin_financial_documents').select('status').eq('id', documentId).maybeSingle();
    if (lookupError || document?.status !== 'draft')
        redirect('/portals/administration/finance?error=1');
    const { data, error } = await supabase.from('admin_financial_lines').update({ description, quantity, unit_price: unitPrice, vat_rate: vatRate }).eq('id', lineId).eq('document_id', documentId).select('id');
    if (error || data?.length !== 1)
        redirect('/portals/administration/finance?error=1');
    revalidatePath('/portals/administration/finance');
    redirect('/portals/administration/finance');
}
export async function removeInvoiceLine(formData: FormData) {
    'use server';
    const { supabase } = await requireAdministration();
    const documentId = String(formData.get('document_id') ?? '');
    const lineId = String(formData.get('line_id') ?? '');
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(documentId) || !uuid.test(lineId))
        redirect('/portals/administration/finance?error=1');
    const { data: document, error: lookupError } = await supabase.from('admin_financial_documents').select('id,status').eq('id', documentId).single();
    if (lookupError || document?.status !== 'draft')
        redirect('/portals/administration/finance?error=1');
    const { data: deleted, error } = await supabase.from('admin_financial_lines').delete().eq('id', lineId).eq('document_id', documentId).select('id');
    if (error || deleted?.length !== 1)
        redirect('/portals/administration/finance?error=1');
    revalidatePath('/portals/administration/finance');
    redirect('/portals/administration/finance');
}
export async function updateDraftCounterparty(formData: FormData) {
    'use server';
    const { supabase } = await requireAdministration();
    const id = String(formData.get('document_id') ?? '');
    const counterpartyId = String(formData.get('counterparty_id') ?? '');
    const useTerms = formData.get('use_payment_terms') === 'on';
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(id) || (counterpartyId && !uuid.test(counterpartyId)))
        redirect('/portals/administration/finance?error=1');
    const { data: document, error: documentError } = await supabase.from('admin_financial_documents').select('kind,status,issue_date').eq('id', id).maybeSingle();
    if (documentError || !document || document.status !== 'draft')
        redirect('/portals/administration/finance?error=1');
    let calculatedDueDate: string | null = null;
    if (useTerms && (!counterpartyId || !document.issue_date || !['sales_invoice', 'purchase_invoice'].includes(document.kind)))
        redirect('/portals/administration/finance?error=1');
    if (useTerms) {
        const issueDate = document.issue_date as string;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate) || Number.isNaN(Date.parse(issueDate)) || new Date(issueDate).toISOString().slice(0, 10) !== issueDate)
            redirect('/portals/administration/finance?error=1');
    }
    if (counterpartyId) {
        const { data: party, error: partyError } = await (supabase as unknown as SupabaseClient).from('admin_counterparties').select('kind,payment_terms_days').eq('id', counterpartyId).maybeSingle();
        if (partyError || !party || (document.kind === 'sales_invoice' && !['customer', 'both'].includes(party.kind)) || (document.kind === 'purchase_invoice' && !['supplier', 'both'].includes(party.kind)))
            redirect('/portals/administration/finance?error=1');
        if (useTerms) {
            if (!Number.isInteger(party.payment_terms_days) || party.payment_terms_days < 0 || party.payment_terms_days > 365)
                redirect('/portals/administration/finance?error=1');
            const due = new Date(document.issue_date + 'T12:00:00Z');
            due.setUTCDate(due.getUTCDate() + party.payment_terms_days);
            calculatedDueDate = due.toISOString().slice(0, 10);
        }
    }
    const patch = useTerms ? { counterparty_id: counterpartyId || null, due_date: calculatedDueDate } : { counterparty_id: counterpartyId || null };
    const { data, error } = await supabase.from('admin_financial_documents').update(patch).eq('id', id).eq('status', 'draft').select('id');
    if (error || data?.length !== 1)
        redirect('/portals/administration/finance?error=1');
    revalidatePath('/portals/administration/finance');
    redirect('/portals/administration/finance');
}
export async function updateDraftNotes(formData: FormData) {
    'use server';
    const { supabase } = await requireAdministration();
    const id = String(formData.get('document_id') ?? '');
    const notes = String(formData.get('notes') ?? '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || notes.length > 2000)
        redirect('/portals/administration/finance?error=1');
    const { data, error } = await supabase.from('admin_financial_documents').update({ notes: notes || null }).eq('id', id).eq('status', 'draft').select('id');
    if (error || data?.length !== 1)
        redirect('/portals/administration/finance?error=1');
    revalidatePath('/portals/administration/finance');
    redirect('/portals/administration/finance');
}
export async function updateDraftDocumentNumber(formData: FormData) {
    'use server';
    const { supabase } = await requireAdministration();
    const id = String(formData.get('document_id') ?? '');
    const documentNumber = String(formData.get('document_number') ?? '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || documentNumber.length > 100)
        redirect('/portals/administration/finance?error=1');
    const { data, error } = await supabase.from('admin_financial_documents').update({ document_number: documentNumber || null }).eq('id', id).eq('status', 'draft').select('id');
    if (error || data?.length !== 1)
        redirect('/portals/administration/finance?error=1');
    revalidatePath('/portals/administration/finance');
    redirect('/portals/administration/finance');
}
export async function updateInvoiceDates(formData: FormData) {
    'use server';
    const { supabase } = await requireAdministration();
    const id = String(formData.get('document_id') ?? '');
    const issueDate = String(formData.get('issue_date') ?? '');
    let dueDate = String(formData.get('due_date') ?? '');
    const useTerms = formData.get('use_payment_terms') === 'on';
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const validDate = (value: string) => !value || (datePattern.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
    if (!uuid.test(id) || !validDate(issueDate) || !validDate(dueDate) || (dueDate && (!issueDate || dueDate < issueDate)))
        redirect('/portals/administration/finance?error=1');
    if (useTerms) {
        if (!issueDate)
            redirect('/portals/administration/finance?error=1');
        const { data: document, error: documentError } = await supabase.from('admin_financial_documents').select('kind,counterparty_id').eq('id', id).eq('status', 'draft').maybeSingle();
        if (documentError || !document || !['sales_invoice', 'purchase_invoice'].includes(document.kind) || !document.counterparty_id)
            redirect('/portals/administration/finance?error=1');
        const { data: party, error: partyError } = await (supabase as unknown as SupabaseClient).from('admin_counterparties').select('payment_terms_days').eq('id', document.counterparty_id).maybeSingle();
        if (partyError || !party || !Number.isInteger(party.payment_terms_days) || party.payment_terms_days < 0 || party.payment_terms_days > 365)
            redirect('/portals/administration/finance?error=1');
        const due = new Date(issueDate + 'T12:00:00Z');
        due.setUTCDate(due.getUTCDate() + party.payment_terms_days);
        dueDate = due.toISOString().slice(0, 10);
    }
    const { data, error } = await supabase.from('admin_financial_documents').update({ issue_date: issueDate || null, due_date: dueDate || null }).eq('id', id).eq('status', 'draft').select('id');
    if (error || data?.length !== 1)
        redirect('/portals/administration/finance?error=1');
    revalidatePath('/portals/administration/finance');
    redirect('/portals/administration/finance');
}
async function reminderOutstanding(supabase: SupabaseClient, documentId: string): Promise<number | null> {
    // Reuse the same exact-cent settlement calculation used for recording payments.
    const settlement = await loadFinancialSettlement(supabase, documentId);
    if (!settlement || settlement.kind !== 'sales_invoice' || settlement.grossCents <= 0 || settlement.overpaymentCents !== 0)
        return null;
    return settlement.outstandingCents / 100;
}
function belgianToday(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export async function createPaymentReminder(formData: FormData) {
    'use server';
    const { supabase } = await requireAdministration();
    const documentId = String(formData.get('document_id') ?? '');
    const recipient = String(formData.get('recipient_email') ?? '').trim();
    const subject = String(formData.get('subject') ?? '').trim();
    const body = String(formData.get('body') ?? '').trim();
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(documentId) || recipient.length < 3 || recipient.length > 320 || !recipient.includes('@') || subject.length < 1 || subject.length > 200 || body.length < 1 || body.length > 10000)
        redirect('/portals/administration/finance?error=1');
    const { data: invoice, error: invoiceError } = await supabase.from('admin_financial_documents').select('id,kind,status,gross_amount,due_date').eq('id', documentId).maybeSingle();
    if (invoiceError || !invoice || invoice.kind !== 'sales_invoice' || !['approved', 'issued'].includes(invoice.status) || !invoice.due_date || invoice.due_date >= belgianToday())
        redirect('/portals/administration/finance?error=1');
    const outstanding = await reminderOutstanding(supabase as unknown as SupabaseClient, documentId);
    if (outstanding === null || outstanding <= 0.005)
        redirect('/portals/administration/finance?error=1');
    const { data: existing, error: lookupError } = await (supabase as unknown as SupabaseClient).from('admin_payment_reminders').select('reminder_number').eq('document_id', documentId).order('reminder_number', { ascending: false }).limit(1);
    if (lookupError)
        redirect('/portals/administration/finance?error=1');
    const next = (Number(existing?.[0]?.reminder_number ?? 0)) + 1;
    if (next > 9)
        redirect('/portals/administration/finance?error=1');
    const { error } = await (supabase as unknown as SupabaseClient).from('admin_payment_reminders').insert({ document_id: documentId, reminder_number: next, recipient_email: recipient, subject, body, status: 'draft' });
    if (error)
        redirect('/portals/administration/finance?error=1');
    revalidatePath('/portals/administration/finance');
    redirect('/portals/administration/finance');
}
export async function editPaymentReminderDraft(formData: FormData) {
    'use server';
    const { supabase } = await requireAdministration();
    const id = String(formData.get('reminder_id') ?? '');
    const revisionRaw = String(formData.get('expected_revision') ?? '');
    const revision = Number(revisionRaw);
    if (!/^[1-9]\d{0,9}$/.test(revisionRaw) || !Number.isSafeInteger(revision) || revision > 2147483647)
        redirect('/portals/administration/finance?error=1');
    const recipient = String(formData.get('recipient_email') ?? '').trim();
    const subject = String(formData.get('subject') ?? '').trim();
    const body = String(formData.get('body') ?? '').trim();
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(id) || recipient.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || !subject || subject.length > 200 || !body || body.length > 10000)
        redirect('/portals/administration/finance?error=1');
    const { data, error } = await (supabase as unknown as SupabaseClient).from('admin_payment_reminders').update({ recipient_email: recipient, subject, body }).eq('id', id).eq('status', 'draft').eq('revision', revision).select('id');
    if (error)
        redirect('/portals/administration/finance?error=1');
    if (data?.length !== 1)
        redirect('/portals/administration/finance?conflict=1');
    revalidatePath('/portals/administration/finance');
    redirect('/portals/administration/finance');
}
export async function updatePaymentReminder(formData: FormData) {
    'use server';
    const { supabase, isAdmin } = await requireAdministration();
    const id = String(formData.get('reminder_id') ?? '');
    const revisionRaw = String(formData.get('expected_revision') ?? '');
    const revision = Number(revisionRaw);
    if (!/^[1-9]\d{0,9}$/.test(revisionRaw) || !Number.isSafeInteger(revision) || revision > 2147483647)
        redirect('/portals/administration/finance?error=1');
    const status = String(formData.get('status') ?? '');
    if (!isAdmin || !['approved', 'cancelled'].includes(status) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        redirect('/portals/administration/finance?error=1');
    if (status === 'approved') {
        const { data: reminder, error: reminderError } = await (supabase as unknown as SupabaseClient).from('admin_payment_reminders').select('document_id').eq('id', id).eq('status', 'draft').maybeSingle();
        if (reminderError)
            redirect('/portals/administration/finance?error=1');
        if (!reminder)
            redirect('/portals/administration/finance?conflict=1');
        const { data: invoice, error: invoiceError } = await supabase.from('admin_financial_documents').select('kind,status,due_date,gross_amount').eq('id', reminder.document_id).maybeSingle();
        if (invoiceError || !invoice || invoice.kind !== 'sales_invoice' || !['approved', 'issued'].includes(invoice.status) || !invoice.due_date || invoice.due_date >= belgianToday())
            redirect('/portals/administration/finance?error=1');
        const outstanding = await reminderOutstanding(supabase as unknown as SupabaseClient, reminder.document_id);
        if (outstanding === null || outstanding <= 0.005)
            redirect('/portals/administration/finance?error=1');
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user)
        redirect('/login');
    const patch = status === 'approved' ? { status, approved_by: user.id, approved_at: new Date().toISOString() } : { status };
    const { data, error } = await (supabase as unknown as SupabaseClient).from('admin_payment_reminders').update(patch).eq('id', id).eq('status', 'draft').eq('revision', revision).select('id');
    if (error)
        redirect('/portals/administration/finance?error=1');
    if (data?.length !== 1)
        redirect('/portals/administration/finance?conflict=1');
    revalidatePath('/portals/administration/finance');
    redirect('/portals/administration/finance');
}
/** Query every relevant ledger entry, never assuming the first PostgREST page is complete.
 * Database triggers remain the authoritative protection against concurrent settlements. */
async function loadFinancialSettlement(db: SupabaseClient, documentId: string) {
    const [{ data: document, error: documentError }, { data: payments, error: paymentsError, count: paymentCount }, { data: credits, error: creditsError, count: creditCount }] = await Promise.all([
        db.from('admin_financial_documents').select('kind,status,gross_amount').eq('id', documentId).maybeSingle(),
        db.from('admin_financial_payments').select('amount', { count: 'exact' }).eq('document_id', documentId).limit(1000),
        db.from('admin_financial_documents').select('gross_amount', { count: 'exact' }).eq('kind', 'credit_note').eq('original_invoice_id', documentId).in('status', ['approved', 'issued', 'paid']).limit(1000)
    ]);
    if (documentError || !document || paymentsError || creditsError || paymentCount === null || creditCount === null || paymentCount > 1000 || creditCount > 1000 || payments?.length !== paymentCount || credits?.length !== creditCount)
        return null;
    try {
        const grossCents = financialAmountCents(document.gross_amount);
        const paidCents = totalFinancialCents((payments ?? []).map(payment => payment.amount));
        const creditedCents = totalFinancialCents((credits ?? []).map(credit => credit.gross_amount));
        const reconciliation = reconcileFinanceInvoice(grossCents, paidCents, creditedCents, document.status);
        return { ...document, grossCents, paidCents, creditedCents, ...reconciliation };
    }
    catch {
        return null;
    }
}
export async function recordFinancialPayment(formData: FormData) {
    'use server';
    const { supabase } = await requireAdministration();
    const documentId = String(formData.get('document_id') ?? '');
    // Repeated submissions of this rendered form share a ledger primary key.
    // This also prevents duplicates when no bank reference was entered.
    const paymentId = String(formData.get('payment_id') ?? '');
    const amountRaw = String(formData.get('amount') ?? '').trim();
    // Financial payments must be entered as exact decimal cents, never rounded from excess precision.
    if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(amountRaw))
        redirect('/portals/administration/finance?error=1');
    const amount = Number(amountRaw);
    const paidOn = String(formData.get('paid_on') ?? '');
    const bankReference = String(formData.get('bank_reference') ?? '').trim();
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid.test(documentId) || !uuid.test(paymentId) || !Number.isFinite(amount) || amount <= 0 || amount > 999999999 || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(paidOn) || bankReference.length > 200)
        redirect('/portals/administration/finance?error=1');
    const validDate = !Number.isNaN(Date.parse(paidOn)) && new Date(paidOn).toISOString().slice(0, 10) === paidOn;
    if (!validDate)
        redirect('/portals/administration/finance?error=1');
    let amountCents: number;
    try {
        amountCents = financialAmountCents(amount);
    }
    catch {
        redirect('/portals/administration/finance?error=1');
    }
    if (amountCents <= 0)
        redirect('/portals/administration/finance?error=1');
    const db = supabase as unknown as SupabaseClient;
    const matchesPayment = (payment: {
        document_id: string;
        amount: unknown;
        paid_on: string;
        bank_reference: string | null;
    }) => payment.document_id === documentId && Number(payment.amount) === amount && payment.paid_on === paidOn && payment.bank_reference === (bankReference || null);
    const existingPayment = async () => {
        const { data, error } = await db.from('admin_financial_payments').select('document_id,amount,paid_on,bank_reference').eq('id', paymentId).maybeSingle();
        if (error)
            redirect('/portals/administration/finance?error=1');
        return data;
    };
    // A response can be lost after a successful insert. Recognize an exact replay
    // before checking the now-reduced balance, without accepting altered payloads.
    const previous = await existingPayment();
    if (previous) {
        if (!matchesPayment(previous))
            redirect('/portals/administration/finance?error=1');
        revalidatePath('/portals/administration/finance');
        redirect('/portals/administration/finance');
    }
    const requireRecordedReplay = async () => {
        const recorded = await existingPayment();
        if (!recorded || !matchesPayment(recorded))
            redirect('/portals/administration/finance?error=1');
    };
    const settlement = await loadFinancialSettlement(db, documentId);
    if (!settlement || !['approved', 'issued', 'paid'].includes(settlement.status) || amountCents > settlement.outstandingCents) {
        // A concurrent replay may have used the remaining balance after our lookup.
        await requireRecordedReplay();
    }
    else {
        const { error } = await db.from('admin_financial_payments').insert({
            id: paymentId, document_id: documentId, amount, paid_on: paidOn, bank_reference: bankReference || null
        });
        // Primary-key uniqueness decides the winner if both requests passed the
        // balance check. Do not treat unrelated insert failures as successful replays.
        if (error)
            await requireRecordedReplay();
    }
    revalidatePath('/portals/administration/finance');
    redirect('/portals/administration/finance');
}
export async function updateFinancialStatus(formData: FormData) {
    'use server';
    const { supabase, isAdmin } = await requireAdministration();
    const id = String(formData.get('document_id') ?? '');
    const status = String(formData.get('status') ?? '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
        return;
    const allowed = isAdmin ? ['review', 'approved', 'issued', 'paid', 'void'] : ['review'];
    if (!allowed.includes(status))
        return;
    const { data: existing, error: lookupError } = await supabase.from('admin_financial_documents').select('status').eq('id', id).single();
    if (lookupError || !existing)
        return;
    const transitions: Record<string, string[]> = {
        draft: ['review'], review: ['approved'], approved: ['issued', 'paid', 'void'], issued: ['paid', 'void']
    };
    if (!transitions[existing.status]?.includes(status))
        return;
    if (status === 'paid') {
        const settlement = await loadFinancialSettlement(supabase as unknown as SupabaseClient, id);
        if (!settlement || settlement.grossCents <= 0 || settlement.outstandingCents !== 0 || settlement.overpaymentCents !== 0)
            redirect('/portals/administration/finance?error=1');
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user)
        return;
    const patch: {
        status: string;
        approved_by?: string;
        approved_at?: string;
    } = { status };
    if (status === 'approved') {
        patch.approved_by = user.id;
        patch.approved_at = new Date().toISOString();
    }
    const { data: updated, error } = await supabase.from('admin_financial_documents').update(patch).eq('id', id).eq('status', existing.status).select('id');
    if (error || updated?.length !== 1)
        redirect('/portals/administration/finance?error=1');
    revalidatePath('/portals/administration/finance');
    redirect('/portals/administration/finance');
}
export async function uploadFinancialAttachment(formData: FormData) {
    'use server';
    const { supabase } = await requireAdministration();
    const documentId = String(formData.get('document_id') ?? '');
    const file = formData.get('file');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documentId) || !(file instanceof File))
        return;
    const { data: document } = await supabase.from('admin_financial_documents').select('id,status').eq('id', documentId).single();
    if (!document || !['draft', 'review'].includes(document.status))
        return;
    let validation;
    try {
        validation = await validateUploadSecurity(file);
    }
    catch {
        redirect('/portals/administration/finance?error=1');
    }
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(validation.mime))
        redirect('/portals/administration/finance?error=1');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user)
        return;
    let payload;
    try {
        payload = await financialAttachmentPayload(file);
    }
    catch {
        redirect('/portals/administration/finance?error=1');
    }
    if (payload.bytes.byteLength !== validation.size)
        redirect('/portals/administration/finance?error=1');
    // Check before uploading, then rely on the unique database index for
    // concurrent requests. Historical objects with unknown hashes remain
    // visible without claiming that their integrity has been established.
    const { data: existing, error: checkError } = await (supabase as unknown as SupabaseClient)
        .from('admin_financial_attachments').select('id')
        .eq('document_id', documentId).eq('sha256', payload.sha256).limit(1).maybeSingle();
    if (checkError)
        redirect('/portals/administration/finance?error=1');
    if (existing)
        redirect('/portals/administration/finance?duplicate=1');
    const path = user.id + '/' + randomUUID() + '.' + validation.extension;
    const { error: uploadError } = await supabase.storage.from('admin-financial-attachments').upload(path, payload.bytes, { contentType: validation.mime, upsert: false });
    if (uploadError)
        redirect('/portals/administration/finance?error=1');
    const { error: linkError } = await (supabase as unknown as SupabaseClient).from('admin_financial_attachments').insert({
        document_id: documentId, storage_path: path, original_name: safeUploadName(file.name),
        mime_type: validation.mime, size_bytes: validation.size, uploaded_by: user.id,
        sha256: payload.sha256,
    });
    if (linkError) {
        // Never leave orphan storage objects when metadata registration fails,
        // including the race where another request inserted the same checksum.
        const { error: cleanupError } = await supabase.storage.from('admin-financial-attachments').remove([path]);
        if (cleanupError)
            console.error('[Finance] attachment cleanup failed', cleanupError.message);
        redirect('/portals/administration/finance?' + (linkError.code === '23505' ? 'duplicate=1' : 'error=1'));
    }
    revalidatePath('/portals/administration/finance');
    redirect('/portals/administration/finance');
}
