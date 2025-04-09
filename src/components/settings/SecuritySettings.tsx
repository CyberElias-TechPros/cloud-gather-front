
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from "@/integrations/supabase/client";
import { Fingerprint, Key, AlertTriangle, Loader2 } from 'lucide-react';

export const SecuritySettings = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Password mismatch',
        description: 'New password and confirmation do not match.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 8 characters long.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: 'Password updated',
        description: 'Your password has been changed successfully.',
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: 'Error updating password',
        description: error.message || 'There was an error changing your password.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTwoFactor = () => {
    setTwoFactorEnabled(!twoFactorEnabled);
    
    // In a real implementation, this would set up or disable 2FA
    toast({
      title: !twoFactorEnabled ? 'Two-factor authentication enabled' : 'Two-factor authentication disabled',
      description: !twoFactorEnabled 
        ? 'Your account is now more secure with 2FA.' 
        : 'Two-factor authentication has been disabled.',
    });
  };

  const handleEnableTwoFactor = () => {
    // Simulate setting up 2FA
    setIsLoading(true);
    
    setTimeout(() => {
      setIsLoading(false);
      setTwoFactorEnabled(true);
      toast({
        title: 'Two-factor authentication enabled',
        description: 'Your account is now more secure with 2FA.',
      });
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Key className="mr-2 h-5 w-5" />
            Password
          </CardTitle>
          <CardDescription>
            Change your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleChangePassword} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Change Password'
            )}
          </Button>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Fingerprint className="mr-2 h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Enable Two-Factor Authentication</h3>
              <p className="text-sm text-muted-foreground">
                Protect your account by requiring a verification code when you sign in.
              </p>
            </div>
            <Switch
              checked={twoFactorEnabled}
              onCheckedChange={toggleTwoFactor}
            />
          </div>
          
          {twoFactorEnabled && (
            <div className="mt-4 p-4 bg-muted rounded-md">
              <h4 className="font-medium mb-2">Recovery Codes</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Save these recovery codes in a secure location. They can be used to recover access to your account.
              </p>
              <div className="bg-background p-3 rounded-md font-mono text-sm grid grid-cols-2 gap-2">
                <div>ABCD-1234-EFGH</div>
                <div>IJKL-5678-MNOP</div>
                <div>QRST-9012-UVWX</div>
                <div>YZ12-3456-7890</div>
              </div>
              <Button variant="outline" size="sm" className="mt-3">
                Download Codes
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">Manage 2FA Settings</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Two-Factor Authentication</AlertDialogTitle>
                <AlertDialogDescription>
                  {twoFactorEnabled
                    ? "Disabling two-factor authentication will make your account less secure."
                    : "Enabling two-factor authentication adds an extra layer of security to your account."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              
              {!twoFactorEnabled && (
                <div className="py-4">
                  <h4 className="font-medium mb-2">Setup Instructions</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Download an authenticator app like Google Authenticator or Authy.</li>
                    <li>Scan the QR code below with your authenticator app.</li>
                    <li>Enter the 6-digit verification code from your app.</li>
                  </ol>
                  
                  <div className="flex justify-center my-4">
                    <div className="border border-border p-4 inline-block">
                      {/* QR code placeholder */}
                      <div className="w-40 h-40 bg-muted flex items-center justify-center">
                        QR Code
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mt-2">
                    <Label htmlFor="verification-code">Verification Code</Label>
                    <Input id="verification-code" placeholder="Enter 6-digit code" />
                  </div>
                </div>
              )}
              
              {twoFactorEnabled && (
                <div className="py-4 flex items-center space-x-2 text-amber-500">
                  <AlertTriangle className="h-5 w-5" />
                  <p>This will immediately disable two-factor authentication for your account.</p>
                </div>
              )}
              
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={twoFactorEnabled ? toggleTwoFactor : handleEnableTwoFactor}>
                  {twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>
            Manage devices where you're currently signed in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <h3 className="text-sm font-medium">Current Browser</h3>
                <p className="text-xs text-muted-foreground">
                  {navigator.userAgent.includes('Chrome') 
                    ? 'Chrome' 
                    : navigator.userAgent.includes('Firefox') 
                    ? 'Firefox' 
                    : 'Browser'} on {navigator.platform} · Active now
                </p>
              </div>
              <Button variant="ghost" size="sm" disabled>This Device</Button>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <h3 className="text-sm font-medium">Mobile App</h3>
                <p className="text-xs text-muted-foreground">
                  iPhone · Last active yesterday
                </p>
              </div>
              <Button variant="outline" size="sm">Sign Out</Button>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <h3 className="text-sm font-medium">Chrome on Mac</h3>
                <p className="text-xs text-muted-foreground">
                  MacOS · Last active 2 days ago
                </p>
              </div>
              <Button variant="outline" size="sm">Sign Out</Button>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="destructive">Sign Out All Other Devices</Button>
        </CardFooter>
      </Card>
    </div>
  );
};
