ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1));

UPDATE users
SET is_admin = 1
WHERE username = 'phamhai0508' COLLATE NOCASE;
