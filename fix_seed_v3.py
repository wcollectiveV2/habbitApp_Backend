
import os
import re

file_path = '/Users/youssefdiouri/Workspace/ChrisLO Project/Core/vercel-backend/seed-e2e-tests.sql'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Fix activity_feed column name (content -> title)
content = content.replace('INSERT INTO activity_feed (id, user_id, activity_type, content,', 
                          'INSERT INTO activity_feed (id, user_id, activity_type, title,')
                          
# Also in ON CONFLICT
content = content.replace("    content = EXCLUDED.content,", "    title = EXCLUDED.title,")

# 2. Fix Challenge 9011 (missing NULL for organization_id)
# This was stripped by global replacement of ", NULL)" -> ")"
# We look for the specific line.
search_str = "'{\"xp\": 300, \"badge\": \"Hydration Hero\"}')"
replace_str = "'{\"xp\": 300, \"badge\": \"Hydration Hero\"}', NULL)"
content = content.replace(search_str, replace_str)

# If it has a comma at the end
search_str_comma = "'{\"xp\": 300, \"badge\": \"Hydration Hero\"}'),"
replace_str_comma = "'{\"xp\": 300, \"badge\": \"Hydration Hero\"}', NULL),"
content = content.replace(search_str_comma, replace_str_comma)

with open(file_path, 'w') as f:
    f.write(content)
