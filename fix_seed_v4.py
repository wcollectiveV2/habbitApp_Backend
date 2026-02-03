
import os
import re

file_path = '/Users/youssefdiouri/Workspace/ChrisLO Project/Core/vercel-backend/seed-e2e-tests.sql'

with open(file_path, 'r') as f:
    content = f.read()

# Fix activity_feed: Remove 'id' column and UUID value
# Search for: INSERT INTO activity_feed (id, user_id, activity_type, title, metadata, created_at)
# Replace with: INSERT INTO activity_feed (user_id, activity_type, title, metadata, created_at)
content = content.replace('INSERT INTO activity_feed (id, user_id, activity_type, title,', 
                          'INSERT INTO activity_feed (user_id, activity_type, title,')

# Now remove the UUID from values.
# Values look like: ('e2e00005-0000-0000-0000-000000000001', 'e2e...', ...)
# We can use regex to remove the first quoted string in the tuple if it matches UUID format?
# Or just replace the specific UUIDs used in the file.
uuids_to_remove = [
    "'e2e00005-0000-0000-0000-000000000001', ",
    "'e2e00005-0000-0000-0000-000000000002', ",
    "'e2e00005-0000-0000-0000-000000000003', ",
    "'e2e00005-0000-0000-0000-000000000004', ",
    "'e2e00005-0000-0000-0000-000000000005', "
]

for uuid_str in uuids_to_remove:
    content = content.replace(uuid_str, "")

# ON CONFLICT (id) will also fail if ID is not provided or it's serial.
# If we don't provide ID, we can't conflict on it easily unless we know the ID or conflict on unique constraint?
# activity_feed definition:
# CREATE TABLE ... (
#   id SERIAL PRIMARY KEY,
#   ...
# );
# No other unique constraints listed in schema.
# So we should REMOVE the ON CONFLICT clause for activity_feed completely.
# It ends with:
# ON CONFLICT (id) DO UPDATE SET 
#    title = EXCLUDED.title,
#    metadata = EXCLUDED.metadata;

# We'll replace this block with ";"
pattern = r"ON CONFLICT \(id\) DO UPDATE SET\s+title = EXCLUDED\.title,\s+metadata = EXCLUDED\.metadata;"
content = re.sub(pattern, ";", content)

# Check if regex worked? Multiline?
# If re.sub failed, use simple replace string if exact match
on_conflict_block = """ON CONFLICT (id) DO UPDATE SET 
    title = EXCLUDED.title,
    metadata = EXCLUDED.metadata;"""
content = content.replace(on_conflict_block, ";")


with open(file_path, 'w') as f:
    f.write(content)
