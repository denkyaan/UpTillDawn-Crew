-- ============================================================
-- Migration 005: External Contacts + Kiosk PIN
-- Run this in your Supabase SQL editor or via CLI.
-- ============================================================

-- 1. Add kiosk_pin column to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS kiosk_pin TEXT;

-- 2. External contacts table
CREATE TABLE IF NOT EXISTS public.external_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    added_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    job_title TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Enable RLS
ALTER TABLE public.external_contacts ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for external_contacts
-- All authenticated users can read all external contacts (shared directory)
CREATE POLICY "authenticated_read_external_contacts"
  ON public.external_contacts FOR SELECT
  TO authenticated USING (true);

-- Any authenticated user can add external contacts
CREATE POLICY "authenticated_insert_external_contacts"
  ON public.external_contacts FOR INSERT
  TO authenticated WITH CHECK (added_by = auth.uid());

-- Only the person who added can update their contact
CREATE POLICY "owner_update_external_contacts"
  ON public.external_contacts FOR UPDATE
  TO authenticated USING (added_by = auth.uid());

-- Owner or admin can delete
CREATE POLICY "owner_or_admin_delete_external_contacts"
  ON public.external_contacts FOR DELETE
  TO authenticated USING (
    added_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 5. Updated_at trigger for external_contacts
CREATE TRIGGER set_external_contacts_updated_at
  BEFORE UPDATE ON public.external_contacts
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
