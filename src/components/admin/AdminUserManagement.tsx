
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, UserPlus, UserMinus, Shield } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const AdminUserManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const queryClient = useQueryClient();

  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['admin-profiles', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.ilike('display_name', `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const { data: adminUsers, isLoading: adminLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const addAdminMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase
        .from('admin_users')
        .insert({ email })
        .select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Admin user added successfully');
      setNewAdminEmail('');
      setIsAddingAdmin(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to add admin: ${error.message}`);
    }
  });

  const removeAdminMutation = useMutation({
    mutationFn: async (email: string) => {
      if (email === 'admin@cloudedifix.com') {
        throw new Error('Cannot remove super admin');
      }
      
      const { error } = await supabase
        .from('admin_users')
        .delete()
        .eq('email', email);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Admin user removed successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to remove admin: ${error.message}`);
    }
  });

  const handleAddAdmin = () => {
    if (newAdminEmail) {
      addAdminMutation.mutate(newAdminEmail);
    }
  };

  const isAdmin = (email: string) => {
    return adminUsers?.some(admin => admin.email === email);
  };

  if (profilesLoading || adminLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
          <p className="text-muted-foreground">
            Manage users and admin permissions
          </p>
        </div>
        
        <Dialog open={isAddingAdmin} onOpenChange={setIsAddingAdmin}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Admin User</DialogTitle>
              <DialogDescription>
                Grant admin privileges to a user by their email address.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  className="col-span-3"
                  placeholder="user@example.com"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddAdmin} disabled={addAdminMutation.isPending}>
                {addAdminMutation.isPending ? 'Adding...' : 'Add Admin'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Admin Users */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Users</CardTitle>
          <CardDescription>
            Users with administrative privileges
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {adminUsers?.map((admin) => (
              <div key={admin.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <Shield className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{admin.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Admin since {new Date(admin.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {admin.email === 'admin@cloudedifix.com' && (
                    <Badge variant="secondary">Super Admin</Badge>
                  )}
                </div>
                {admin.email !== 'admin@cloudedifix.com' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeAdminMutation.mutate(admin.email)}
                    disabled={removeAdminMutation.isPending}
                  >
                    <UserMinus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* All Users */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Complete list of registered users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {profiles?.map((profile) => (
              <div key={profile.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {profile.display_name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{profile.display_name || 'Unnamed User'}</p>
                    <p className="text-sm text-muted-foreground">
                      Joined {new Date(profile.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {isAdmin(profile.display_name || '') && (
                    <Badge variant="secondary">Admin</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUserManagement;
