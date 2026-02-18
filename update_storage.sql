-- Add columns for file URLs to quotes table
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS invoice_url TEXT,
ADD COLUMN IF NOT EXISTS voucher_url TEXT;

-- Create a storage bucket for quote attachments if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('quote_attachments', 'quote_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow public access to view files
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'quote_attachments' );

-- Policy to allow authenticated users to upload files
CREATE POLICY "Authenticated Upload" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'quote_attachments' AND auth.role() = 'anon' );

-- Policy to allow authenticated users to update files
CREATE POLICY "Authenticated Update" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'quote_attachments' AND auth.role() = 'anon' );
