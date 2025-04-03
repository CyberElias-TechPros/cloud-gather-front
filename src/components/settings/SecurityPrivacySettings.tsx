
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Shield, Key, Lock, Eye, Users, FileKey } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface SecurityPrivacySettingsProps {
  twoFactorEnabled: boolean;
  setTwoFactorEnabled: (value: boolean) => void;
  biometricEnabled: boolean;
  setBiometricEnabled: (value: boolean) => void;
  sessionTimeout: string;
  setSessionTimeout: (value: string) => void;
  defaultSharePermission: string;
  setDefaultSharePermission: (value: string) => void;
  linkExpirationDays: number;
  setLinkExpirationDays: (value: number) => void;
}

export const SecurityPrivacySettings = ({
  twoFactorEnabled,
  setTwoFactorEnabled,
  biometricEnabled,
  setBiometricEnabled,
  sessionTimeout,
  setSessionTimeout,
  defaultSharePermission,
  setDefaultSharePermission,
  linkExpirationDays,
  setLinkExpirationDays
}: SecurityPrivacySettingsProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security & Privacy Settings
        </CardTitle>
        <CardDescription>
          Manage your account security and file sharing permissions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Account Security</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Two-Factor Authentication</Label>
                  <span className="text-sm text-muted-foreground">
                    Add an extra layer of security to your account
                  </span>
                </div>
                <Switch 
                  checked={twoFactorEnabled} 
                  onCheckedChange={setTwoFactorEnabled} 
                />
              </div>
              
              {twoFactorEnabled && (
                <div className="ml-2 mt-2 p-3 border border-border rounded-md">
                  <RadioGroup defaultValue="app" className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="app" id="app" />
                      <Label htmlFor="app" className="font-normal cursor-pointer">
                        Authenticator App
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sms" id="sms" />
                      <Label htmlFor="sms" className="font-normal cursor-pointer">
                        SMS
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="email" id="email" />
                      <Label htmlFor="email" className="font-normal cursor-pointer">
                        Email
                      </Label>
                    </div>
                  </RadioGroup>
                  
                  <Button size="sm" className="mt-3">
                    Configure 2FA
                  </Button>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Biometric Authentication</Label>
                  <span className="text-sm text-muted-foreground">
                    Use fingerprint or face recognition to login
                  </span>
                </div>
                <Switch 
                  checked={biometricEnabled} 
                  onCheckedChange={setBiometricEnabled} 
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="session-timeout">Session Timeout</Label>
                <Select 
                  value={sessionTimeout}
                  onValueChange={setSessionTimeout}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select session timeout" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="1440">24 hours</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  Your session will expire after this period of inactivity
                </span>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="login-history">Login History</Label>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Eye className="h-4 w-4 mr-2" />
                  View Recent Login Activity
                </Button>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="api-keys">API Access</Label>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Key className="h-4 w-4 mr-2" />
                  Manage API Keys
                </Button>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <h3 className="text-lg font-medium">Sharing & Permissions</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Default Share Permission</Label>
                <Select 
                  value={defaultSharePermission}
                  onValueChange={setDefaultSharePermission}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select default permission" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">View only</SelectItem>
                    <SelectItem value="comment">Can comment</SelectItem>
                    <SelectItem value="edit">Can edit</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  Default permission level when sharing files
                </span>
              </div>
              
              <div className="space-y-2">
                <Label>Default Link Expiration</Label>
                <Select 
                  value={linkExpirationDays.toString()}
                  onValueChange={(val) => setLinkExpirationDays(parseInt(val))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select link expiration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Never</SelectItem>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  How long shared links remain active
                </span>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Password Protected Sharing</Label>
                  <span className="text-sm text-muted-foreground">
                    Require password to access shared files
                  </span>
                </div>
                <Switch defaultChecked={false} />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Allow Public Sharing</Label>
                  <span className="text-sm text-muted-foreground">
                    Allow files to be shared with anyone
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Download Watermarking</Label>
                  <span className="text-sm text-muted-foreground">
                    Add watermark to shared documents
                  </span>
                </div>
                <Switch defaultChecked={false} />
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Data Privacy</h3>
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="block mb-1">Usage Analytics</Label>
                <span className="text-sm text-muted-foreground">
                  Share anonymous usage data to improve the service
                </span>
              </div>
              <Switch defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="block mb-1">Activity Logging</Label>
                <span className="text-sm text-muted-foreground">
                  Keep detailed logs of file operations
                </span>
              </div>
              <Switch defaultChecked />
            </div>
            
            <div className="mt-4">
              <Button variant="outline" className="mr-2">
                <FileKey className="h-4 w-4 mr-2" />
                Export My Data
              </Button>
              <Button variant="outline" className="text-destructive hover:text-destructive">
                <Users className="h-4 w-4 mr-2" />
                Manage Authorized Apps
              </Button>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button>Save Security Settings</Button>
        </div>
      </CardContent>
    </Card>
  );
};
