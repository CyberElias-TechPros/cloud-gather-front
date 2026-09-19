import React from "react";
import { Seo } from "@/components/common/Seo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminUserManagement from "@/components/admin/AdminUserManagement";
import AdminSystemSettings from "@/components/admin/AdminSystemSettings";

/**
 * Admin console. Route access is already gated by AdminRoute (is_admin_user
 * RPC); all data below is additionally protected by server-side RLS policies,
 * so the UI is convenience, not the security boundary.
 */
const AdminPage = () => {
  return (
    <div className="space-y-6">
      <Seo title="Admin console" description="CloudGather admin" path="/admin" noIndex />
      <div>
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Admin console</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Platform overview, user management and system configuration.
          </p>
        </header>

        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="settings">System settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <AdminDashboard />
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <AdminUserManagement />
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <AdminSystemSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminPage;
