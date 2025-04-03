
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell, FileUp, Share2, Database, Clock, Activity, Mail, Smartphone } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface NotificationSettingsProps {
  notifyOnUploads: boolean;
  setNotifyOnUploads: (value: boolean) => void;
  notifyOnShares: boolean;
  setNotifyOnShares: (value: boolean) => void;
}

export const NotificationSettings = ({
  notifyOnUploads,
  setNotifyOnUploads,
  notifyOnShares,
  setNotifyOnShares
}: NotificationSettingsProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Settings
        </CardTitle>
        <CardDescription>
          Control when and how you receive notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">File Activity Notifications</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">File Upload Notifications</Label>
                  <span className="text-sm text-muted-foreground">
                    Get notified when files are uploaded
                  </span>
                </div>
                <Switch 
                  checked={notifyOnUploads} 
                  onCheckedChange={setNotifyOnUploads} 
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">File Sharing Notifications</Label>
                  <span className="text-sm text-muted-foreground">
                    Get notified when files are shared with you
                  </span>
                </div>
                <Switch 
                  checked={notifyOnShares} 
                  onCheckedChange={setNotifyOnShares} 
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Comment Notifications</Label>
                  <span className="text-sm text-muted-foreground">
                    Get notified of comments on your files
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">File Edit Notifications</Label>
                  <span className="text-sm text-muted-foreground">
                    Get notified when your files are edited
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Download Notifications</Label>
                  <span className="text-sm text-muted-foreground">
                    Get notified when your files are downloaded
                  </span>
                </div>
                <Switch defaultChecked={false} />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Version History Notifications</Label>
                  <span className="text-sm text-muted-foreground">
                    Get notified of new file versions
                  </span>
                </div>
                <Switch defaultChecked={false} />
              </div>
            </div>
          </div>
          
          <Separator />
          
          <h3 className="text-lg font-medium">System Notifications</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Storage Limit Alerts</Label>
                  <span className="text-sm text-muted-foreground">
                    Get notified when providers are almost full
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Provider Connection Issues</Label>
                  <span className="text-sm text-muted-foreground">
                    Get notified about storage provider connectivity
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Security Alerts</Label>
                  <span className="text-sm text-muted-foreground">
                    Get notified about suspicious activities
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Feature Updates</Label>
                  <span className="text-sm text-muted-foreground">
                    Get notified about new features and updates
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>
          
          <Separator />
          
          <h3 className="text-lg font-medium">Notification Delivery</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center">
                <Bell className="h-4 w-4 mr-2" />
                In-App
              </Label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Show notifications in the app
                </span>
                <Switch defaultChecked />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center">
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Send notifications via email
                </span>
                <Switch defaultChecked />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center">
                <Smartphone className="h-4 w-4 mr-2" />
                Mobile Push
              </Label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Send notifications to mobile devices
                </span>
                <Switch defaultChecked />
              </div>
            </div>
          </div>
          
          <div className="space-y-2 mt-4">
            <Label>Email Notification Frequency</Label>
            <Select defaultValue="immediate">
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediately</SelectItem>
                <SelectItem value="hourly">Hourly Digest</SelectItem>
                <SelectItem value="daily">Daily Digest</SelectItem>
                <SelectItem value="weekly">Weekly Summary</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button>Save Notification Settings</Button>
        </div>
      </CardContent>
    </Card>
  );
};
