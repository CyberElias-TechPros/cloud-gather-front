
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

interface AdminRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ 
  children, 
  redirectTo = '/dashboard'
}) => {
  const { user, loading: authLoading } = useAuth();

  // Check if user is admin
  const { data: isAdmin, isLoading: adminLoading } = useQuery({
    queryKey: ['admin-check', user?.id],
    queryFn: async () => {
      if (!user?.email) return false;
      
      const { data, error } = await supabase
        .from('admin_users')
        .select('id')
        .eq('email', user.email)
        .single();

      return !error && !!data;
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (authLoading || adminLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingSpinner size="lg" text="Checking permissions..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
