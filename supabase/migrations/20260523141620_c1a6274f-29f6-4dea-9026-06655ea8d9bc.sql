
-- Remove broad SELECT policy on storage.objects for card-images.
-- The bucket is public, so files remain accessible via /storage/v1/object/public/card-images/<path>
-- without any RLS. Removing the policy prevents listing/discovery via the storage API.
DROP POLICY IF EXISTS "Card images publicly readable" ON storage.objects;
