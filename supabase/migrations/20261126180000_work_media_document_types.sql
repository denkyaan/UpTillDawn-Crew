-- The original event-document forms accept these six validated document MIME
-- types. The historical work-media bucket still only admits image/video.
-- Extend this private bucket alone; do not modify existing scan/read policies
-- or mark any upload clean. Keep all existing permitted media types.
DO $migration$
BEGIN
  UPDATE storage.buckets
  SET allowed_mime_types = ARRAY(
    SELECT DISTINCT mime
    FROM unnest(coalesce(allowed_mime_types, ARRAY[]::text[]) || ARRAY[
      'image/jpeg','image/png','image/webp',
      'video/mp4','video/webm','video/quicktime',
      'text/plain',
    'text/csv',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]::text[]) AS mime
    ORDER BY mime
  )
  WHERE id='work-media' AND public=false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Private work-media bucket missing or public';
  END IF;
END;
$migration$;

-- Document-only MIME types may be uploaded only in the existing document
-- namespace by approved managers. Other media policies remain unchanged.
DROP POLICY IF EXISTS upt_work_media_document_upload_scope ON storage.objects;
CREATE POLICY upt_work_media_document_upload_scope
ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  bucket_id <> 'work-media'
  OR coalesce(metadata->>'mimetype','') NOT IN (
    'text/plain',
    'text/csv',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
  OR (
    public.upt_is_approved()
    AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
    AND (storage.foldername(name))[2]='document'
    AND (
      public.upt_is_admin((SELECT auth.uid()))
      OR public.upt_current_effective_role()='responsible_lead'
    )
  )
);
