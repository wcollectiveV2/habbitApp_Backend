
import os

file_path = '/Users/youssefdiouri/Workspace/ChrisLO Project/Core/vercel-backend/seed-e2e-tests.sql'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Restore 'active' status to organization_members values
# We stripped it by accident.
# Values look like: ('...', '...', 'admin'),
# We want: ('...', '...', 'admin', 'active'),
content = content.replace("', 'admin'),", "', 'admin', 'active'),")
content = content.replace("', 'member'),", "', 'member', 'active'),")
content = content.replace("', 'manager'),", "', 'manager', 'active'),")
# Handle the last item in a list (ends with \n or ;) or ')' vs '),'?
# The file has: ('...', 'member')\n ON CONFLICT...
content = content.replace("', 'member')\n", "', 'member', 'active')\n")
content = content.replace("', 'admin')\n", "', 'admin', 'active')\n") # unlikely to be last
content = content.replace("', 'manager')\n", "', 'manager', 'active')\n")

# 2. Add organization_id back to PROTOCOLS challenges INSERT
# Search for the INSERT line in PROTOCOLS section.
# It currently ends with "created_by, rewards)"
# Use a unique string to identify the Protocols insert
protocols_marker = "-- PROTOCOLS (Advanced challenges with organization context)"
if protocols_marker in content:
    # Find the INSERT after this marker
    parts = content.split(protocols_marker)
    pre = parts[0]
    post = parts[1]
    
    # In 'post', find the INSERT INTO challenges ... rewards)
    # Replace ONLY the first occurrence in 'post'
    post = post.replace("created_by, rewards)", "created_by, rewards, organization_id)", 1)
    
    content = pre + protocols_marker + post

with open(file_path, 'w') as f:
    f.write(content)
