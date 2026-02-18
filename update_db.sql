-- Add category to payments if missing
ALTER TABLE payments ADD COLUMN IF NOT EXISTS category text;

-- Add category to clients if missing
ALTER TABLE clients ADD COLUMN IF NOT EXISTS category text;
