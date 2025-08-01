
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminUserManagement from '@/components/admin/AdminUserManagement';
import AdminSystemSettings from '@/components/admin/AdminSystemSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

const AdminPage = () => {
  const { user, loading } = useAuth();

  const { data: isAdmin, isLoading: isAdminLoading } = useQuery({
    queryKey: ['is-admin', user?.email],
    queryFn: async () => {
      if (!user?.email) return false;
      
      const { data, error } = await supabase
        .from('admin_users')
        .select('email')
        .eq('email', user.email)
        .single();
      
      if (error) {
        console.error('Error checking admin status:', error);
        return false;
      }
      
      return !!data;
    },
    enabled: !!user?.email
  });

  // Show loading state
  if (loading || isAdminLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect if not logged in
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Show access denied if not admin
  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <AlertCircle className="h-5 w-5 mr-2" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don't have permission to access the admin panel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Only administrators can access this page. If you believe you should have access, 
              please contact the system administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-lg text-muted-foreground">
          Manage your Cloud Edifix platform
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="dashboard" className="mt-6">
          <AdminDashboard />
        </TabsContent>
        
        <TabsContent value="users" className="mt-6">
          <AdminUserManagement />
        </TabsContent>
        
        <TabsContent value="settings" className="mt-6">
          <AdminSystemSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPage;
