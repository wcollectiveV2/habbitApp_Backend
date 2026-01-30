
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


-- Seed Organization Memberships (Linking Users to Orgs)

-- Manager -> Wcollective
INSERT INTO organization_members (organization_id, user_id, role, status)
SELECT o.id, u.id, 'admin', 'active'
FROM organizations o, users u
WHERE o.name = 'Wcollective' AND u.email = 'manager@wcollective.com'
ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'admin';

-- User -> Wcollective
INSERT INTO organization_members (organization_id, user_id, role, status)
SELECT o.id, u.id, 'member', 'active'
FROM organizations o, users u
WHERE o.name = 'Wcollective' AND u.email = 'user@wcollective.com'
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Coach -> Nest Wellness
INSERT INTO organization_members (organization_id, user_id, role, status)
SELECT o.id, u.id, 'coach', 'active'
FROM organizations o, users u
WHERE o.name = 'Nest Wellness' AND u.email = 'coach@nest.com'
ON CONFLICT (organization_id, user_id) DO UPDATE SET role = 'coach';
