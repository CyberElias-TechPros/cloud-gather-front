-- Phase 1: Update admin user to cyberelias.tk@gmail.com
UPDATE public.admin_users 
SET email = 'cyberelias.tk@gmail.com' 
WHERE email = 'admin@cloudedifix.com';

-- If the admin user doesn't exist, insert it
INSERT INTO public.admin_users (email) 
VALUES ('cyberelias.tk@gmail.com') 
ON CONFLICT (email) DO NOTHING;

-- Update super admin function to use new email
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE email = public.get_current_user_email() 
    AND email = 'cyberelias.tk@gmail.com'
  );
$$;

-- Ensure all system settings exist with proper defaults
INSERT INTO public.system_settings (setting_key, setting_value, description) VALUES
  ('app_name', '"Cloud Edifix"', 'Application name displayed throughout the platform'),
  ('app_description', '"Advanced cloud storage management and file synchronization platform"', 'Application description'),
  ('app_version', '"1.0.0"', 'Current application version'),
  ('maintenance_mode', 'false', 'Enable maintenance mode to restrict access'),
  ('registration_enabled', 'true', 'Allow new user registrations'),
  ('email_verification_required', 'false', 'Require email verification for new accounts'),
  ('max_file_size_mb', '100', 'Maximum file size allowed for uploads in MB'),
  ('max_storage_per_user_gb', '50', 'Maximum storage allocation per user in GB'),
  ('allowed_file_types', '["image/*", "application/pdf", "text/*", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip", "application/x-rar-compressed"]', 'Allowed file types for upload'),
  ('backup_retention_days', '30', 'Number of days to retain backups'),
  ('session_timeout_minutes', '480', 'User session timeout in minutes'),
  ('password_min_length', '8', 'Minimum password length requirement'),
  ('password_require_uppercase', 'true', 'Require uppercase letters in passwords'),
  ('password_require_lowercase', 'true', 'Require lowercase letters in passwords'),
  ('password_require_numbers', 'true', 'Require numbers in passwords'),
  ('password_require_special', 'true', 'Require special characters in passwords'),
  ('two_factor_enabled', 'false', 'Enable two-factor authentication'),
  ('api_rate_limit_per_minute', '100', 'API requests per minute per user'),
  ('notification_email_enabled', 'true', 'Enable email notifications'),
  ('notification_push_enabled', 'false', 'Enable push notifications'),
  ('analytics_enabled', 'true', 'Enable usage analytics collection'),
  ('error_reporting_enabled', 'true', 'Enable error reporting and monitoring'),
  ('cdn_enabled', 'false', 'Enable CDN for file delivery'),
  ('compression_enabled', 'true', 'Enable file compression'),
  ('virus_scanning_enabled', 'false', 'Enable virus scanning for uploads'),
  ('watermark_enabled', 'false', 'Enable watermarking for images'),
  ('auto_backup_enabled', 'true', 'Enable automatic backups'),
  ('geo_blocking_enabled', 'false', 'Enable geographic access restrictions'),
  ('ip_whitelist_enabled', 'false', 'Enable IP address whitelisting'),
  ('audit_logging_enabled', 'true', 'Enable detailed audit logging'),
  ('data_retention_days', '365', 'Default data retention period in days'),
  ('encryption_at_rest', 'true', 'Enable encryption for stored files'),
  ('encryption_in_transit', 'true', 'Enable encryption for data transmission')
ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Create comprehensive provider configurations
INSERT INTO public.provider_configs (provider_name, is_enabled, client_id, client_secret) VALUES
  ('google_drive', true, '', ''),
  ('dropbox', true, '', ''),
  ('onedrive', true, '', ''),
  ('box', false, '', ''),
  ('amazon_s3', false, '', ''),
  ('backblaze', false, '', ''),
  ('mega', false, '', ''),
  ('pcloud', false, '', ''),
  ('icedrive', false, '', ''),
  ('yandex_disk', false, '', ''),
  ('sync', false, '', '')
ON CONFLICT (provider_name) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled;

-- Add missing indexes for better performance
CREATE INDEX IF NOT EXISTS idx_system_settings_setting_key ON public.system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_provider_configs_provider_name ON public.provider_configs(provider_name);
CREATE INDEX IF NOT EXISTS idx_provider_configs_is_enabled ON public.provider_configs(is_enabled);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);

-- Add role column to profiles table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='role') THEN
        ALTER TABLE public.profiles ADD COLUMN role VARCHAR(50) DEFAULT 'user';
    END IF;
END $$;

-- Set admin role for the super admin user
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Get the user ID for the super admin
    SELECT auth.uid() INTO admin_user_id 
    FROM auth.users 
    WHERE email = 'cyberelias.tk@gmail.com' 
    LIMIT 1;
    
    -- If user exists, update their role
    IF admin_user_id IS NOT NULL THEN
        UPDATE public.profiles 
        SET role = 'admin' 
        WHERE id = admin_user_id;
    END IF;
END $$;