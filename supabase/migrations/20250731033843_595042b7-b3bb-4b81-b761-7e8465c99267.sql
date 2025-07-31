
-- Create provider_configs table for OAuth credentials
CREATE TABLE IF NOT EXISTS public.provider_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name VARCHAR(50) NOT NULL UNIQUE,
  client_id TEXT,
  client_secret TEXT,
  is_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create api_keys table for API key management
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix VARCHAR(10) NOT NULL,
  permissions JSONB DEFAULT '["read"]'::jsonb,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create system_settings table for global configuration
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default provider configurations (only if they don't exist)
INSERT INTO public.provider_configs (provider_name, is_enabled) 
SELECT provider_name, false FROM (
  VALUES 
    ('google-drive'),
    ('dropbox'),
    ('onedrive'),
    ('box'),
    ('amazon-s3'),
    ('backblaze'),
    ('mega'),
    ('pcloud'),
    ('yandex-disk'),
    ('icedrive'),
    ('sync')
) AS providers(provider_name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.provider_configs WHERE provider_configs.provider_name = providers.provider_name
);

-- Insert default system settings (only if they don't exist)
INSERT INTO public.system_settings (setting_key, setting_value, description) 
SELECT setting_key, setting_value::jsonb, description FROM (
  VALUES 
    ('maintenance_mode', 'false', 'Enable/disable maintenance mode'),
    ('max_file_size', '104857600', 'Maximum file size in bytes (100MB)'),
    ('max_storage_per_user', '5368709120', 'Maximum storage per user in bytes (5GB)'),
    ('allowed_file_types', '["image/*", "application/pdf", "text/*", "application/vnd.openxmlformats-officedocument.*"]', 'Allowed file MIME types')
) AS settings(setting_key, setting_value, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_settings WHERE system_settings.setting_key = settings.setting_key
);

-- Enable RLS on new tables
ALTER TABLE public.provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Enable RLS on existing tables if not already enabled
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check admin status
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = auth.email()
  );
$$;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own files" ON public.files;
DROP POLICY IF EXISTS "Users can create their own files" ON public.files;
DROP POLICY IF EXISTS "Users can update their own files" ON public.files;
DROP POLICY IF EXISTS "Users can delete their own files" ON public.files;

-- Create RLS policies for files table
CREATE POLICY "Users can view their own files" ON public.files
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own files" ON public.files
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own files" ON public.files
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own files" ON public.files
FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for storage_providers
DROP POLICY IF EXISTS "Users can view their own providers" ON public.storage_providers;
DROP POLICY IF EXISTS "Users can create their own providers" ON public.storage_providers;
DROP POLICY IF EXISTS "Users can update their own providers" ON public.storage_providers;
DROP POLICY IF EXISTS "Users can delete their own providers" ON public.storage_providers;

CREATE POLICY "Users can view their own providers" ON public.storage_providers
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own providers" ON public.storage_providers
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own providers" ON public.storage_providers
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own providers" ON public.storage_providers
FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for file_shares
DROP POLICY IF EXISTS "Users can view shares they own or are shared with" ON public.file_shares;
DROP POLICY IF EXISTS "Users can create shares for their own files" ON public.file_shares;
DROP POLICY IF EXISTS "Users can update shares they own" ON public.file_shares;
DROP POLICY IF EXISTS "Users can delete shares they own" ON public.file_shares;

CREATE POLICY "Users can view shares they own or are shared with" ON public.file_shares
FOR SELECT USING (
  auth.uid() = owner_id OR 
  auth.uid() = shared_with_id OR
  auth.email() = shared_with_email
);

CREATE POLICY "Users can create shares for their own files" ON public.file_shares
FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update shares they own" ON public.file_shares
FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete shares they own" ON public.file_shares
FOR DELETE USING (auth.uid() = owner_id);

-- Create RLS policies for profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- Create admin policies for provider_configs
CREATE POLICY "Admins can view all provider configs" ON public.provider_configs
FOR SELECT USING (public.is_admin_user());

CREATE POLICY "Admins can update provider configs" ON public.provider_configs
FOR UPDATE USING (public.is_admin_user());

-- Create admin policies for system_settings
CREATE POLICY "Admins can view system settings" ON public.system_settings
FOR SELECT USING (public.is_admin_user());

CREATE POLICY "Admins can update system settings" ON public.system_settings
FOR UPDATE USING (public.is_admin_user());

-- Create policies for api_keys
CREATE POLICY "Users can view their own API keys" ON public.api_keys
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys" ON public.api_keys
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys" ON public.api_keys
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys" ON public.api_keys
FOR DELETE USING (auth.uid() = user_id);

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_provider_configs_updated_at ON public.provider_configs;
DROP TRIGGER IF EXISTS update_api_keys_updated_at ON public.api_keys;
DROP TRIGGER IF EXISTS update_system_settings_updated_at ON public.system_settings;

CREATE TRIGGER update_provider_configs_updated_at
    BEFORE UPDATE ON public.provider_configs
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON public.api_keys
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_system_settings_updated_at
    BEFORE UPDATE ON public.system_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- Enable realtime for critical tables
ALTER TABLE public.files REPLICA IDENTITY FULL;
ALTER TABLE public.storage_providers REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.files;
ALTER PUBLICATION supabase_realtime ADD TABLE public.storage_providers;
