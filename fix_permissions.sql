-- Allow anonymous users to update the quotes table
-- This is necessary to save the file URLs after upload
-- Run this in the Supabase SQL Editor

-- 1. Drop existing update policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Enable update for all users" ON "public"."quotes";
DROP POLICY IF EXISTS "Enable update access for all users" ON "public"."quotes";

-- 2. Create the policy to allow updates
CREATE POLICY "Enable update for all users" 
ON "public"."quotes" 
FOR UPDATE 
TO public 
USING (true) 
WITH CHECK (true);

-- 3. Ensure INSERT is also allowed (just in case)
DROP POLICY IF EXISTS "Enable insert for all users" ON "public"."quotes";
CREATE POLICY "Enable insert for all users" 
ON "public"."quotes" 
FOR INSERT 
TO public 
WITH CHECK (true);

-- 4. Verify storage bucket is public (crucial for viewing files)
UPDATE storage.buckets
SET public = true
WHERE id = 'quote_attachments';
