
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileType, Settings, Database, HardDrive, Wrench } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";

interface AdvancedStorageSettingsProps {
  encryptionEnabled: boolean;
  setEncryptionEnabled: (value: boolean) => void;
  deduplicationEnabled: boolean;
  setDeduplicationEnabled: (value: boolean) => void;
  compressionLevel: number;
  setCompressionLevel: (value: number) => void;
  cacheSize: number;
  setCacheSize: (value: number) => void;
  splittingEnabled: boolean;
  setSplittingEnabled: (value: boolean) => void;
  maxChunkSize: number;
  setMaxChunkSize: (value: number) => void;
  encryptionAlgorithm: string;
  setEncryptionAlgorithm: (value: string) => void;
}

export const AdvancedStorageSettings = ({
  encryptionEnabled,
  setEncryptionEnabled,
  deduplicationEnabled,
  setDeduplicationEnabled,
  compressionLevel,
  setCompressionLevel,
  cacheSize,
  setCacheSize,
  splittingEnabled,
  setSplittingEnabled,
  maxChunkSize,
  setMaxChunkSize,
  encryptionAlgorithm,
  setEncryptionAlgorithm
}: AdvancedStorageSettingsProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Advanced Storage Settings
        </CardTitle>
        <CardDescription>
          Configure how your files are stored and optimized across providers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* File Encryption */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1 text-base font-medium">File Encryption</Label>
                  <span className="text-sm text-muted-foreground">
                    End-to-end encryption before files reach cloud providers
                  </span>
                </div>
                <Switch 
                  checked={encryptionEnabled} 
                  onCheckedChange={setEncryptionEnabled} 
                />
              </div>
              
              {encryptionEnabled && (
                <div className="space-y-2 ml-2 mt-2 p-3 border border-border rounded-md">
                  <Label>Encryption Algorithm</Label>
                  <RadioGroup 
                    value={encryptionAlgorithm} 
                    onValueChange={setEncryptionAlgorithm}
                    className="flex flex-col space-y-1 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="aes256" id="aes256" />
                      <Label htmlFor="aes256" className="font-normal cursor-pointer">AES-256 (Recommended)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="aes128" id="aes128" />
                      <Label htmlFor="aes128" className="font-normal cursor-pointer">AES-128 (Faster)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="twofish" id="twofish" />
                      <Label htmlFor="twofish" className="font-normal cursor-pointer">Twofish (High Security)</Label>
                    </div>
                  </RadioGroup>
                  
                  <div className="mt-3">
                    <Label htmlFor="encryption-key" className="text-sm">Encryption Key</Label>
                    <div className="flex gap-2 mt-1">
                      <Input 
                        id="encryption-key" 
                        type="password" 
                        placeholder="••••••••••••••••"
                        className="font-mono"
                      />
                      <Button variant="outline" size="sm">
                        Generate
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Store this key safely. Files cannot be recovered without it.
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {/* File Deduplication */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1 text-base font-medium">File Deduplication</Label>
                  <span className="text-sm text-muted-foreground">
                    Prevent storing identical files twice across providers
                  </span>
                </div>
                <Switch 
                  checked={deduplicationEnabled} 
                  onCheckedChange={setDeduplicationEnabled} 
                />
              </div>
              
              {deduplicationEnabled && (
                <div className="space-y-2 ml-2 mt-2 p-3 border border-border rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Deduplication Scope</Label>
                    <Select defaultValue="all">
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select scope" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Files</SelectItem>
                        <SelectItem value="media">Media Files Only</SelectItem>
                        <SelectItem value="documents">Documents Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch id="byte-level" />
                    <Label htmlFor="byte-level" className="text-sm font-normal cursor-pointer">
                      Enable byte-level deduplication (more efficient but slower)
                    </Label>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <Separator />
          
          {/* File Compression */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">File Compression</Label>
              <span className="text-sm text-muted-foreground">
                {compressionLevel}%
              </span>
            </div>
            <Slider
              value={[compressionLevel]}
              onValueChange={(values) => setCompressionLevel(values[0])}
              max={100}
              step={10}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>None</span>
              <span>Medium</span>
              <span>Maximum</span>
            </div>
          </div>
          
          {/* File Splitting */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="block mb-1 text-base font-medium">File Splitting</Label>
                <span className="text-sm text-muted-foreground">
                  Split large files across multiple providers
                </span>
              </div>
              <Switch 
                checked={splittingEnabled} 
                onCheckedChange={setSplittingEnabled} 
              />
            </div>
            
            {splittingEnabled && (
              <div className="space-y-2 ml-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="chunk-size">Maximum Chunk Size</Label>
                  <span className="text-sm text-muted-foreground">
                    {maxChunkSize} MB
                  </span>
                </div>
                <Slider
                  id="chunk-size"
                  value={[maxChunkSize]}
                  onValueChange={(values) => setMaxChunkSize(values[0])}
                  min={5}
                  max={100}
                  step={5}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>5 MB</span>
                  <span>100 MB</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Caching Settings */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-base font-medium">Offline Cache Size</Label>
              <span className="text-sm text-muted-foreground">
                {cacheSize} MB
              </span>
            </div>
            <Slider
              value={[cacheSize]}
              onValueChange={(values) => setCacheSize(values[0])}
              min={100}
              max={2000}
              step={100}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>100 MB</span>
              <span>1 GB</span>
              <span>2 GB</span>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button>Save Storage Settings</Button>
        </div>
      </CardContent>
    </Card>
  );
};
