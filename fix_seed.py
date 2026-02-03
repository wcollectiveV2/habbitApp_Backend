
import os

file_path = '/Users/youssefdiouri/Workspace/ChrisLO Project/Core/vercel-backend/seed-e2e-tests.sql'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Replace Password Hash
old_hash = '$2a$10$4.KfjCxtAo0r6DC3724VbOnHJ4xqpFosqhAhGjwcJiULuo3R/0YG.'
new_hash = '$2a$10$bbNxqIwv1Wc5.AL0xm4m7.C945lALJDd2Cj6NtHGLFK5O6ZKPD4Aa'
content = content.replace(old_hash, new_hash)

# 2. Fix activity_feed column name
content = content.replace('INSERT INTO activity_feed (id, user_id, type, content, metadata, created_at)', 
                          'INSERT INTO activity_feed (id, user_id, activity_type, content, metadata, created_at)')

# 3. Fix challenge_participants (multiple blocks)
# Block 1
content = content.replace('INSERT INTO challenge_participants (challenge_id, user_id, joined_at, progress, status)', 
                          'INSERT INTO challenge_participants (challenge_id, user_id, joined_at, progress)')

# Remove ", 'active'" and ", 'completed'" from values
# This is tricky with regex, but let's see if simple replace works for the specific lines in the file
content = content.replace(", 'active'),", "),")
content = content.replace(", 'completed'),", "),")
content = content.replace(", 'active')", ")") # End of statement
content = content.replace(", 'completed')", ")") # End of statement

# Also remove status from ON CONFLICT update
content = content.replace('    progress = EXCLUDED.progress,\n    status = EXCLUDED.status;', 
                          '    progress = EXCLUDED.progress;')

# 4. Fix challenges insert (remove organization_id)
# This is complex because values are positional.
# The seed has: INSERT INTO challenges (..., organization_id) VALUES (..., 'uuid')
# I should probably just comment out the whole PROTOCOLS section or fix it properly.
# For now, I'll attempt to remove organization_id column and the last value from the tuples.
# However, regular expressions might be safer here.

import re

# Remove organization_id from the INSERT columns
content = content.replace(', organization_id)', ')')

# Remove the last GUID value from the values tuples in the PROTOCOLS section which looks like they have organization_id
# The values look like: 'e2e00002-0000-0000-0000-000000000002'), or NULL),
# IMPORTANT: This might affect other inserts if I'm not careful.
# The `challenges` table inserts in PROTOCOLS section are the only ones with organization_id at the end.

# Let's use regex to remove the last value for challenges in PROTOCOLS
# Pattern: , 'e2e...-...' ) -> )
content = re.sub(r", 'e2e[0-9a-f-]{36}'\)", ")", content)
content = re.sub(r", NULL\)", ")", content)

# Remove the organization_id from ON CONFLICT updates
content = content.replace("    organization_id = EXCLUDED.organization_id;", "")
content = content.replace("    is_public = EXCLUDED.is_public,\n", "    is_public = EXCLUDED.is_public;\n") 
# The above replace might leave a semicolon in the middle if there was a comma.
# Original:
#     is_public = EXCLUDED.is_public,
#     organization_id = EXCLUDED.organization_id;

# So if I remove the last line, I need to make sure the previous line ends with ;
content = content.replace("    is_public = EXCLUDED.is_public,\n    organization_id = EXCLUDED.organization_id;", "    is_public = EXCLUDED.is_public;")

with open(file_path, 'w') as f:
    f.write(content)

