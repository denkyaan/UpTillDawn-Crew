// Generated from components/administration/operational-work-queue.tsx by modern/scripts/generate-original-actions.mjs. Do not edit.
import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { administrationAccess } from "@/lib/administration/access";
import { administrationDeadline } from "@/lib/administration/deadline";
type Kind = 'logistics' | 'permits' | 'tasks';
export async function saveCase(form: FormData) {
    'use server';
    const access = await administrationAccess();
    if (!access.ok)
        redirect('/portals');
    const kind = String(form.get('kind')) as Kind;
    if (!['logistics', 'permits', 'tasks'].includes(kind))
        throw Error('Invalid case type');
    const db = access.db as unknown as SupabaseClient;
    const action = String(form.get('action') ?? 'create'), id = String(form.get('id') ?? '');
    if (action === 'create') {
        const title = String(form.get('title') ?? '').trim(), details = String(form.get('details') ?? '').trim(), event = String(form.get('event') ?? '');
        if (title.length < 3 || title.length > 180 || details.length > 4000 || event && !/^[0-9a-f-]{36}$/i.test(event))
            throw Error('Invalid case');
        const due = administrationDeadline(String(form.get('deadline') ?? ''));
        const { error } = await db.from('admin_operational_obligations').insert({ kind, title, details, event_id: event || null, due_at: due, created_by: access.user.id });
        if (error)
            throw Error('Case could not be saved');
    }
    else if (action === 'edit') {
        const title = String(form.get('title') ?? '').trim(), details = String(form.get('details') ?? '').trim(), status = String(form.get('status') ?? '');
        if (!/^[0-9a-f-]{36}$/i.test(id) || !['open', 'rejected'].includes(status) || title.length < 3 || title.length > 180 || details.length > 4000)
            throw Error('Invalid case edit');
        const due = administrationDeadline(String(form.get('deadline') ?? ''));
        const { data, error } = await db.from('admin_operational_obligations').update({ title, details, due_at: due }).eq('id', id).eq('kind', kind).eq('status', status).eq('updated_at', String(form.get('updated_at') ?? '')).select('id');
        if (error || data?.length !== 1)
            throw Error('Case changed; reload before retrying');
    }
    else {
        if (!/^[0-9a-f-]{36}$/i.test(id) || !['submitted', 'approved', 'rejected', 'completed'].includes(action))
            throw Error('Invalid case transition');
        if (['approved', 'rejected'].includes(action) && !access.user.realIsAdmin)
            throw Error('Admin required');
        if (['approved', 'rejected'].includes(action)) {
            const { data: caseRow, error: lookupError } = await db.from('admin_operational_obligations')
                .select('created_by').eq('id', id).eq('kind', kind).eq('status', 'submitted').maybeSingle();
            if (lookupError || !caseRow)
                throw Error('Submitted case not found');
        }
        const status = String(form.get('status') ?? ''), note = String(form.get('note') ?? '').trim();
        if (note.length > 2000 || (action === 'rejected' && note.length < 3))
            throw Error('Rejection reason required');
        const { data, error } = await db.from('admin_operational_obligations').update(action === 'rejected' ? { status: action, review_note: note } : { status: action }).eq('id', id).eq('kind', kind).eq('status', status).eq('updated_at', String(form.get('updated_at') ?? '')).select('id');
        if (error || data?.length !== 1)
            throw Error('Case changed; reload before retrying');
    }
    revalidatePath('/portals/administration/modules/' + kind);
}
