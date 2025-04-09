
import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export interface AdvancedStorageSettingsProps {
  encryptionEnabled: boolean;
  setEncryptionEnabled: (value: boolean) => void;
  deduplicationEnabled: boolean;
  setDeduplicationEnabled: (value: boolean) => void;
  compressionEnabled: boolean;
  setCompressionEnabled: (value: boolean) => void;
  autoOrganizeEnabled: boolean;
  setAutoOrganizeEnabled: (value: boolean) => void;
  versioningEnabled: boolean;
  setVersioningEnabled: (value: boolean) => void;
  maxVersions: number;
  setMaxVersions: (value: number) => void;
  storageTier: 'standard' | 'archive' | 'cold';
  setStorageTier: (value: 'standard' | 'archive' | 'cold') => void;
  retentionPeriod: number;
  setRetentionPeriod: (value: number) => void;
  isUpdating: boolean;
  handleUpdate: () => void;
}

export const AdvancedStorageSettings: React.FC<AdvancedStorageSettingsProps> = ({
  encryptionEnabled,
  setEncryptionEnabled,
  deduplicationEnabled,
  setDeduplicationEnabled,
  compressionEnabled,
  setCompressionEnabled,
  autoOrganizeEnabled,
  setAutoOrganizeEnabled,
  versioningEnabled,
  setVersioningEnabled,
  maxVersions,
  setMaxVersions,
  storageTier,
  setStorageTier,
  retentionPeriod,
  setRetentionPeriod,
  isUpdating,
  handleUpdate
}) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Storage Settings</CardTitle>
          <CardDescription>
            Configure advanced storage options for optimizing your file storage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Security Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Security</h3>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="encryption" className="font-medium">End-to-end encryption</Label>
                  <p className="text-sm text-muted-foreground">
                    Encrypt files before they leave your device
                  </p>
                </div>
                <Switch
                  id="encryption"
                  checked={encryptionEnabled}
                  onCheckedChange={setEncryptionEnabled}
                />
              </div>
            </div>
            
            {/* Optimization Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Optimization</h3>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="deduplication" className="font-medium">Deduplication</Label>
                  <p className="text-sm text-muted-foreground">
                    Avoid storing duplicate files
                  </p>
                </div>
                <Switch
                  id="deduplication"
                  checked={deduplicationEnabled}
                  onCheckedChange={setDeduplicationEnabled}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="compression" className="font-medium">Compression</Label>
                  <p className="text-sm text-muted-foreground">
                    Reduce file size to save space
                  </p>
                </div>
                <Switch
                  id="compression"
                  checked={compressionEnabled}
                  onCheckedChange={setCompressionEnabled}
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-6 pt-6 md:grid-cols-2">
            {/* Organization Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Organization</h3>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-organize" className="font-medium">Auto-organize files</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically categorize and sort files
                  </p>
                </div>
                <Switch
                  id="auto-organize"
                  checked={autoOrganizeEnabled}
                  onCheckedChange={setAutoOrganizeEnabled}
                />
              </div>
            </div>
            
            {/* Versioning Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Versioning</h3>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="versioning" className="font-medium">File versioning</Label>
                  <p className="text-sm text-muted-foreground">
                    Keep previous versions of your files
                  </p>
                </div>
                <Switch
                  id="versioning"
                  checked={versioningEnabled}
                  onCheckedChange={setVersioningEnabled}
                />
              </div>
              
              {versioningEnabled && (
                <div className="pt-2">
                  <Label htmlFor="max-versions" className="mb-1 block font-medium">
                    Max versions per file: {maxVersions}
                  </Label>
                  <Slider
                    id="max-versions"
                    min={1}
                    max={20}
                    step={1}
                    value={[maxVersions]}
                    onValueChange={(value) => setMaxVersions(value[0])}
                    className="py-2"
                  />
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-6 pt-6 md:grid-cols-2">
            {/* Storage Tier */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Storage Tier</h3>
              <div className="grid grid-cols-3 gap-4">
                <Button
                  variant={storageTier === 'standard' ? 'default' : 'outline'}
                  onClick={() => setStorageTier('standard')}
                >
                  Standard
                </Button>
                <Button
                  variant={storageTier === 'archive' ? 'default' : 'outline'}
                  onClick={() => setStorageTier('archive')}
                >
                  Archive
                </Button>
                <Button
                  variant={storageTier === 'cold' ? 'default' : 'outline'}
                  onClick={() => setStorageTier('cold')}
                >
                  Cold
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {storageTier === 'standard' && 'Fast access, higher cost'}
                {storageTier === 'archive' && 'Slower access, lower cost'}
                {storageTier === 'cold' && 'Slowest access, lowest cost'}
              </p>
            </div>
            
            {/* Retention Period */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Retention Period</h3>
              <div className="space-y-2">
                <Label htmlFor="retention-period" className="mb-1 block font-medium">
                  Delete files after {retentionPeriod} days of inactivity
                </Label>
                <Slider
                  id="retention-period"
                  min={0}
                  max={365}
                  step={30}
                  value={[retentionPeriod]}
                  onValueChange={(value) => setRetentionPeriod(value[0])}
                  className="py-2"
                />
                <p className="text-sm text-muted-foreground">
                  {retentionPeriod === 0 
                    ? 'Files will never be automatically deleted' 
                    : `Files unused for ${retentionPeriod} days will be automatically deleted`}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-end">
        <Button onClick={handleUpdate} disabled={isUpdating}>
          {isUpdating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving changes...
            </>
          ) : (
            'Save changes'
          )}
        </Button>
      </div>
    </div>
  );
};
