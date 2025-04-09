
import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { 
  Tabs, TabsList, TabsTrigger, TabsContent 
} from '@/components/ui/tabs';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { SecuritySettings } from '@/components/settings/SecuritySettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { FileSharingSettings } from '@/components/settings/FileSharingSettings';
import { DisplaySettings } from '@/components/settings/DisplaySettings';
import { APISettings } from '@/components/settings/APISettings';

const SettingsPage = () => {
  return (
    <AppLayout title="Settings">
      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="grid grid-cols-3 md:grid-cols-6 mb-4">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="sharing">File Sharing</TabsTrigger>
          <TabsTrigger value="display">Display</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
        </TabsList>
        
        <TabsContent value="account" className="mt-0">
          <AccountSettings />
        </TabsContent>
        
        <TabsContent value="security" className="mt-0">
          <SecuritySettings />
        </TabsContent>
        
        <TabsContent value="notifications" className="mt-0">
          <NotificationSettings />
        </TabsContent>
        
        <TabsContent value="sharing" className="mt-0">
          <FileSharingSettings />
        </TabsContent>
        
        <TabsContent value="display" className="mt-0">
          <DisplaySettings />
        </TabsContent>
        
        <TabsContent value="api" className="mt-0">
          <APISettings />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default SettingsPage;
