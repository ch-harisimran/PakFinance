-- Storage for profile photos.
--
-- One bucket, and every object in it lives under a folder named for the owner's
-- user id: `avatars/<uid>/<file>`. That path convention is what the policies
-- below key on, so a user can only write inside their own folder — the bucket
-- being public makes photos *readable*, never writable.
--
-- Public read is deliberate. An avatar is shown in the top bar of every page;
-- signing a URL for it on every render would add a round trip to each request to
-- protect a picture the user chose to display. Nothing else goes in this bucket.
--
-- The 2 MB cap and the MIME allowlist are enforced by Storage itself, not just
-- by the upload form, so a crafted request cannot push a 4 GB file or an SVG —
-- SVG is excluded on purpose, since it can carry script and is served from our
-- own origin.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  TRUE,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
--> statement-breakpoint

-- Policies are dropped first so this migration can be re-run safely.
DROP POLICY IF EXISTS "avatars are publicly readable" ON storage.objects;--> statement-breakpoint
DROP POLICY IF EXISTS "users upload their own avatar" ON storage.objects;--> statement-breakpoint
DROP POLICY IF EXISTS "users replace their own avatar" ON storage.objects;--> statement-breakpoint
DROP POLICY IF EXISTS "users delete their own avatar" ON storage.objects;--> statement-breakpoint

CREATE POLICY "avatars are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
--> statement-breakpoint

-- (storage.foldername(name))[1] is the first path segment — the owner's uid.
CREATE POLICY "users upload their own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
--> statement-breakpoint

CREATE POLICY "users replace their own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
--> statement-breakpoint

CREATE POLICY "users delete their own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
