
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Share2, Link, Calendar, MessageSquare, History, Users } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const FileSharingSettings = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2 className="h-5 w-5" />
          File Sharing Settings
        </CardTitle>
        <CardDescription>
          Configure how your files are shared and collaborated on
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Collaboration Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Real-time Collaboration</Label>
                  <span className="text-sm text-muted-foreground">
                    Allow multiple users to edit files simultaneously
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Comments & Annotations</Label>
                  <span className="text-sm text-muted-foreground">
                    Allow users to comment on shared files
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Version History</Label>
                  <span className="text-sm text-muted-foreground">
                    Track changes to files over time
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Edit Notifications</Label>
                  <span className="text-sm text-muted-foreground">
                    Get notified when shared files are edited
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Comment Notifications</Label>
                  <span className="text-sm text-muted-foreground">
                    Get notified about new comments
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="space-y-2">
                <Label>Version History Retention</Label>
                <Select defaultValue="30">
                  <SelectTrigger>
                    <SelectValue placeholder="Select retention period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                    <SelectItem value="unlimited">Unlimited</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <h3 className="text-lg font-medium">Share Link Configuration</h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Link Security Level</Label>
              <ToggleGroup type="single" defaultValue="standard" className="justify-start">
                <ToggleGroupItem value="basic">
                  <Shield className="h-4 w-4 mr-2" />
                  Basic
                </ToggleGroupItem>
                <ToggleGroupItem value="standard">
                  <Shield className="h-4 w-4 mr-2" />
                  Standard
                </ToggleGroupItem>
                <ToggleGroupItem value="enhanced">
                  <Shield className="h-4 w-4 mr-2" />
                  Enhanced
                </ToggleGroupItem>
              </ToggleGroup>
              <p className="text-xs text-muted-foreground mt-1">
                Enhanced security adds additional verification steps for recipients
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Custom Link Domain</Label>
                <div className="flex space-x-2">
                  <div className="flex-1">
                    <Input placeholder="your-domain.com" />
                  </div>
                  <Button variant="outline" size="sm">
                    Verify
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use your own domain for shared links (Premium feature)
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Link Analytics</Label>
                <Select defaultValue="basic">
                  <SelectTrigger>
                    <SelectValue placeholder="Select analytics level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="basic">Basic (views only)</SelectItem>
                    <SelectItem value="advanced">Advanced (Premium)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <h3 className="text-lg font-medium">External Sharing</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Allow External Users</Label>
                  <span className="text-sm text-muted-foreground">
                    Share with people outside your organization
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="space-y-2">
                <Label>External User Permissions</Label>
                <Select defaultValue="view">
                  <SelectTrigger>
                    <SelectValue placeholder="Select default permission" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">View only</SelectItem>
                    <SelectItem value="comment">Can comment</SelectItem>
                    <SelectItem value="edit">Can edit (with approval)</SelectItem>
                    <SelectItem value="full">Full access (Team plan only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">External User Verification</Label>
                  <span className="text-sm text-muted-foreground">
                    Require email verification for external users
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Domain Restrictions</Label>
                  <span className="text-sm text-muted-foreground">
                    Limit sharing to specific email domains
                  </span>
                </div>
                <Switch defaultChecked={false} />
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button>Save Sharing Settings</Button>
        </div>
      </CardContent>
    </Card>
  );
};
