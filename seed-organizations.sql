
-- Seed Organizations
-- Using WHERE NOT EXISTS to avoid duplicates since name is not unique constraint

INSERT INTO organizations (name)
SELECT 'Wcollective'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Wcollective');

INSERT INTO organizations (name)
SELECT 'Nest Wellness'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'Nest Wellness');

INSERT INTO organizations (name)
SELECT 'coffee test'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = 'coffee test');
