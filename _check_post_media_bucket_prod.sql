-- Check if post-media bucket exists in production
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE name = 'post-media';
