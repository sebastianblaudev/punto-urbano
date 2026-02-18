DO $$
DECLARE
    column_exists boolean;
BEGIN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'category') INTO column_exists;
    RAISE NOTICE 'Clients table has category column: %', column_exists;
END $$;
