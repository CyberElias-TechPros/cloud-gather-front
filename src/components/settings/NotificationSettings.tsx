
import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Bell } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export const NotificationSettings = () => {
  const [emailNotifications, setEmailNotifications] = useState({
    fileUpdates: true,
    shareActivity: true,
    comments: true,
    storageAlerts: true,
    accountActivity: true,
  });
  
  const [pushNotifications, setPushNotifications] = useState({
    fileUpdates: false,
    shareActivity: true,
    comments: false,
    storageAlerts: true,
    accountActivity: true,
  });
  
  const [emailFrequency, setEmailFrequency] = useState('immediate');
  
  const { toast } = useToast();
  
  const handleSaveChanges = () => {
    toast({
      title: 'Notification settings updated',
      description: 'Your notification preferences have been saved.',
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Bell className="mr-2 h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose how and when you want to be notified
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-4">Email Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>File Updates</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications when files are updated or modified.
                  </p>
                </div>
                <Switch
                  checked={emailNotifications.fileUpdates}
                  onCheckedChange={(checked) => setEmailNotifications({ ...emailNotifications, fileUpdates: checked })}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Share Activity</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications when files are shared with you or accessed by others.
                  </p>
                </div>
                <Switch
                  checked={emailNotifications.shareActivity}
                  onCheckedChange={(checked) => setEmailNotifications({ ...emailNotifications, shareActivity: checked })}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Comments</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications when someone comments on your files.
                  </p>
                </div>
                <Switch
                  checked={emailNotifications.comments}
                  onCheckedChange={(checked) => setEmailNotifications({ ...emailNotifications, comments: checked })}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Storage Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications about storage usage and limits.
                  </p>
                </div>
                <Switch
                  checked={emailNotifications.storageAlerts}
                  onCheckedChange={(checked) => setEmailNotifications({ ...emailNotifications, storageAlerts: checked })}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Account Activity</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications about your account security and status.
                  </p>
                </div>
                <Switch
                  checked={emailNotifications.accountActivity}
                  onCheckedChange={(checked) => setEmailNotifications({ ...emailNotifications, accountActivity: checked })}
                />
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-4">Push Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>File Updates</Label>
                </div>
                <Switch
                  checked={pushNotifications.fileUpdates}
                  onCheckedChange={(checked) => setPushNotifications({ ...pushNotifications, fileUpdates: checked })}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Share Activity</Label>
                </div>
                <Switch
                  checked={pushNotifications.shareActivity}
                  onCheckedChange={(checked) => setPushNotifications({ ...pushNotifications, shareActivity: checked })}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Comments</Label>
                </div>
                <Switch
                  checked={pushNotifications.comments}
                  onCheckedChange={(checked) => setPushNotifications({ ...pushNotifications, comments: checked })}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Storage Alerts</Label>
                </div>
                <Switch
                  checked={pushNotifications.storageAlerts}
                  onCheckedChange={(checked) => setPushNotifications({ ...pushNotifications, storageAlerts: checked })}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Account Activity</Label>
                </div>
                <Switch
                  checked={pushNotifications.accountActivity}
                  onCheckedChange={(checked) => setPushNotifications({ ...pushNotifications, accountActivity: checked })}
                />
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-4">Email Frequency</h3>
            <RadioGroup value={emailFrequency} onValueChange={setEmailFrequency}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="immediate" id="immediate" />
                <Label htmlFor="immediate">Immediate - Send emails as events happen</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="daily" id="daily" />
                <Label htmlFor="daily">Daily Digest - Summarize all activities once a day</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="weekly" id="weekly" />
                <Label htmlFor="weekly">Weekly Summary - Send a weekly overview of all activities</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveChanges}>Save Changes</Button>
        </CardFooter>
      </Card>
    </div>
  );
};
