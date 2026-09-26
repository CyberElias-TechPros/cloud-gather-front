import React from "react";
import { useSearchParams } from "react-router-dom";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminUserManagement from "@/components/admin/AdminUserManagement";
import AdminSystemSettings from "@/components/admin/AdminSystemSettings";
import AdminContactInbox from "@/components/admin/AdminContactInbox";
import AdminBlogManager from "@/components/admin/AdminBlogManager";
import AdminAnnouncements from "@/components/admin/AdminAnnouncements";
import AdminAuditLog from "@/components/admin/AdminAuditLog";
import AdminOperations from "@/components/admin/AdminOperations";

const TABS = [
  { value: "dashboard", label: "Overview", element: <AdminDashboard /> },
  { value: "users", label: "Users", element: <AdminUserManagement /> },
  { value: "inbox", label: "Inbox", element: <AdminContactInbox /> },
  { value: "blog", label: "Blog", element: <AdminBlogManager /> },
  { value: "announcements", label: "Announcements", element: <AdminAnnouncements /> },
  { value: "operations", label: "Operations", element: <AdminOperations /> },
  { value: "audit", label: "Audit log", element: <AdminAuditLog /> },
  { value: "settings", label: "Settings", element: <AdminSystemSettings /> },
];

/**
 * Admin console. Route access is gated by AdminRoute on the client and by the
 * `requireAdmin` middleware on every /api/admin/* route — the UI is
 * convenience, the worker is the security boundary.
 */
const AdminPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((entry) => entry.value === params.get("tab")) ? params.get("tab")! : "dashboard";

  return (
    <div className="space-y-6">
      <Seo title="Admin console" description="CloudGather admin" path="/admin" noIndex />
      <PageHeader
        title="Admin console"
        description="Platform health, user management, content and system configuration."
      />

      <Tabs
        value={tab}
        onValueChange={(value) => setParams(value === "dashboard" ? {} : { tab: value }, { replace: true })}
      >
        <div className="overflow-x-auto pb-1">
          <TabsList>
            {TABS.map((entry) => (
              <TabsTrigger key={entry.value} value={entry.value}>
                {entry.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {TABS.map((entry) => (
          <TabsContent key={entry.value} value={entry.value} className="mt-4">
            {entry.element}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default AdminPage;
