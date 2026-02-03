-- ============================================================================
-- Migration: Organization Types and Invitation System
-- Description: Adds organization types (product/company), parent hierarchy,
--              and invitation link system with expiration
-- ============================================================================

-- 1. Add organization type enum and columns
DO $$ BEGIN
    CREATE TYPE organization_type AS ENUM ('product', 'company');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add type column to organizations
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS type organization_type DEFAULT 'company';

-- Add parent_id for organization hierarchy (product orgs can have company parents)
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Add description field for organizations
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Create index for parent lookups
CREATE INDEX IF NOT EXISTS idx_organizations_parent_id ON organizations(parent_id);
CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(type);

-- ============================================================================
-- 2. Organization Invitations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Invitation token (used in URL: ?token=xxx)
    token VARCHAR(64) UNIQUE NOT NULL,
    
    -- Who created the invitation
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Optional: specific email this invitation is for (null = open link)
    email VARCHAR(255),
    
    -- Role to assign when invitation is accepted
    role VARCHAR(50) DEFAULT 'member',
    
    -- Expiration handling
    expires_at TIMESTAMP NOT NULL,
    
    -- Usage limits
    max_uses INT DEFAULT 1,
    current_uses INT DEFAULT 0,
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'expired', 'revoked', 'exhausted'
    
    -- Metadata for routing
    redirect_url TEXT, -- Where to redirect after acceptance
    metadata JSONB DEFAULT '{}', -- Additional data (challengeId, etc.)
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for invitation lookups
CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invitations_org_id ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_status ON organization_invitations(status);
CREATE INDEX IF NOT EXISTS idx_org_invitations_expires_at ON organization_invitations(expires_at);

-- ============================================================================
-- 3. Update Users table for super_admin role support
-- ============================================================================

-- Note: The existing roles TEXT[] already supports 'super_admin'
-- We just need to ensure the role hierarchy is respected in code

-- Add organization_id to users for primary organization affiliation (optional)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS primary_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_primary_org ON users(primary_organization_id);

-- ============================================================================
-- 4. Audit Log Table for Super Admin Actions
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who performed the action
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Action details
    action VARCHAR(100) NOT NULL, -- 'promote_admin', 'demote_admin', 'reset_password', etc.
    target_type VARCHAR(50) NOT NULL, -- 'user', 'organization', etc.
    target_id UUID NOT NULL,
    
    -- Before/After state for auditing
    previous_state JSONB,
    new_state JSONB,
    
    -- Additional context
    ip_address VARCHAR(45),
    user_agent TEXT,
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON admin_audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON admin_audit_logs(created_at);

-- ============================================================================
-- 5. Helper function to generate secure tokens
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_invitation_token() RETURNS VARCHAR(64) AS $$
DECLARE
    token VARCHAR(64);
BEGIN
    -- Generate a secure random token
    token := encode(gen_random_bytes(32), 'hex');
    RETURN token;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. Function to auto-expire invitations
-- ============================================================================

CREATE OR REPLACE FUNCTION expire_old_invitations() RETURNS void AS $$
BEGIN
    UPDATE organization_invitations 
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active' 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. Update existing organizations to have a default type
-- ============================================================================

UPDATE organizations SET type = 'company' WHERE type IS NULL;
