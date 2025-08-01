
-- Phase 1: Fix Database Permissions and Security

-- 1. Remove problematic RLS policies that reference non-existent tables or incorrect auth usage
DROP POLICY IF EXISTS "Allow admin users to modify blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Allow super admins to modify admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Allow authenticated users to view admin users" ON public.admin_users;
DROP POLICY IF EXISTS "Users can view files shared with them" ON public.files;

-- 2. Create proper security definer functions for admin checks
CREATE OR REPLACE FUNCTION public.get_current_user_email()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(auth.email(), '');
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = public.get_current_user_email() 
    AND email = 'admin@cloudedifix.com'
  );
$$;

-- 3. Recreate proper RLS policies
CREATE POLICY "Admin users can modify blog posts" 
  ON public.blog_posts 
  FOR ALL 
  USING (public.is_admin_user());

CREATE POLICY "Super admin can modify admin users" 
  ON public.admin_users 
  FOR ALL 
  USING (public.is_super_admin());

CREATE POLICY "Authenticated users can view admin users" 
  ON public.admin_users 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view files shared with them" 
  ON public.files 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.file_shares 
      WHERE file_shares.file_id = files.id 
      AND (
        file_shares.shared_with_id = auth.uid() 
        OR file_shares.shared_with_email = public.get_current_user_email()
      )
    )
  );

-- 4. Create missing tables for complete functionality
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  permissions JSONB DEFAULT '["read"]'::jsonb,
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  joined_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.usage_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_type VARCHAR(100) NOT NULL,
  metric_value NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Add RLS policies for new tables
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Team policies
CREATE POLICY "Users can view teams they belong to" 
  ON public.teams 
  FOR SELECT 
  USING (
    owner_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.team_members 
      WHERE team_id = teams.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Team owners can manage their teams" 
  ON public.teams 
  FOR ALL 
  USING (owner_id = auth.uid());

CREATE POLICY "Users can view team memberships they belong to" 
  ON public.team_members 
  FOR SELECT 
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.teams 
      WHERE id = team_members.team_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Team owners can manage memberships" 
  ON public.team_members 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.teams 
      WHERE id = team_members.team_id AND owner_id = auth.uid()
    )
  );

-- Analytics policies
CREATE POLICY "Users can view their own analytics" 
  ON public.usage_analytics 
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "System can insert analytics" 
  ON public.usage_analytics 
  FOR INSERT 
  WITH CHECK (user_id = auth.uid());

-- Audit log policies
CREATE POLICY "Admins can view all audit logs" 
  ON public.audit_logs 
  FOR SELECT 
  USING (public.is_admin_user());

CREATE POLICY "Users can view their own audit logs" 
  ON public.audit_logs 
  FOR SELECT 
  USING (user_id = auth.uid());

CREATE POLICY "System can insert audit logs" 
  ON public.audit_logs 
  FOR INSERT 
  WITH CHECK (true);

-- 6. Seed the super admin user
INSERT INTO public.admin_users (email) 
VALUES ('admin@cloudedifix.com') 
ON CONFLICT (email) DO NOTHING;

-- 7. Add missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_files_user_id ON public.files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_parent_folder_id ON public.files(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_files_last_accessed_at ON public.files(last_accessed_at);
CREATE INDEX IF NOT EXISTS idx_file_shares_file_id ON public.file_shares(file_id);
CREATE INDEX IF NOT EXISTS idx_file_shares_shared_with_id ON public.file_shares(shared_with_id);
CREATE INDEX IF NOT EXISTS idx_storage_providers_user_id ON public.storage_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_usage_analytics_user_id ON public.usage_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);

-- 8. Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
