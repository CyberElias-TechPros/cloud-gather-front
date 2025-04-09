
import React, { useState } from 'react';
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
import { AdvancedStorageSettings } from '@/components/settings/AdvancedStorageSettings';
import { UploadPreferences } from '@/components/settings/UploadPreferences';
import { toast } from 'sonner';

const SettingsPage = () => {
  // Advanced Storage Settings state
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [deduplicationEnabled, setDeduplicationEnabled] = useState(true);
  const [compressionEnabled, setCompressionEnabled] = useState(true);
  const [autoOrganizeEnabled, setAutoOrganizeEnabled] = useState(false);
  const [versioningEnabled, setVersioningEnabled] = useState(true);
  const [maxVersions, setMaxVersions] = useState(5);
  const [storageTier, setStorageTier] = useState<'standard' | 'archive' | 'cold'>('standard');
  const [retentionPeriod, setRetentionPeriod] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const handleUpdate = () => {
    setIsUpdating(true);
    
    // Simulate API call delay
    setTimeout(() => {
      toast.success('Storage settings updated successfully');
      setIsUpdating(false);
    }, 1000);
  };

  return (
    <AppLayout title="Settings">
      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 mb-4">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="sharing">File Sharing</TabsTrigger>
          <TabsTrigger value="display">Display</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
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
        
        <TabsContent value="storage" className="mt-0">
          <AdvancedStorageSettings 
            encryptionEnabled={encryptionEnabled}
            setEncryptionEnabled={setEncryptionEnabled}
            deduplicationEnabled={deduplicationEnabled}
            setDeduplicationEnabled={setDeduplicationEnabled}
            compressionEnabled={compressionEnabled}
            setCompressionEnabled={setCompressionEnabled}
            autoOrganizeEnabled={autoOrganizeEnabled}
            setAutoOrganizeEnabled={setAutoOrganizeEnabled}
            versioningEnabled={versioningEnabled}
            setVersioningEnabled={setVersioningEnabled}
            maxVersions={maxVersions}
            setMaxVersions={setMaxVersions}
            storageTier={storageTier}
            setStorageTier={setStorageTier}
            retentionPeriod={retentionPeriod}
            setRetentionPeriod={setRetentionPeriod}
            isUpdating={isUpdating}
            handleUpdate={handleUpdate}
          />
        </TabsContent>
        
        <TabsContent value="upload" className="mt-0">
          <UploadPreferences />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default SettingsPage;
