
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (authLoading) return;
      
      if (!user) {
        window.location.href = '/auth';
        return;
      }

      try {
        // Check if user is admin by email
        const { data, error } = await supabase
          .from('admin_users')
          .select('email')
          .eq('email', user.email)
          .single();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        setIsAdmin(!!data);
        
        if (!data) {
          toast.error('Access denied. Admin privileges required.');
          window.location.href = '/dashboard';
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        toast.error('Error verifying admin access');
        window.location.href = '/dashboard';
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Verifying admin access...</span>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return <>{children}</>;
};

export default AdminRoute;
