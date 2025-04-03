
import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { 
  Lock, 
  Shield, 
  Key, 
  Bell, 
  UserCircle, 
  CreditCard, 
  HelpCircle, 
  Settings, 
  Upload, 
  Share2 
} from 'lucide-react';
import { AdvancedStorageSettings } from '@/components/settings/AdvancedStorageSettings';
import { SecurityPrivacySettings } from '@/components/settings/SecurityPrivacySettings';
import { FileSharingSettings } from '@/components/settings/FileSharingSettings';
import { UploadPreferences } from '@/components/settings/UploadPreferences';
import { NotificationSettings } from '@/components/settings/NotificationSettings';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState("account");

  // General settings
  const [notifyOnUploads, setNotifyOnUploads] = useState(true);
  const [notifyOnShares, setNotifyOnShares] = useState(true);
  const [compressionLevel, setCompressionLevel] = useState(50);
  const [defaultProvider, setDefaultProvider] = useState("auto");
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);
  const [deduplicationEnabled, setDeduplicationEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [cacheSize, setCacheSize] = useState(500);

  // Account settings
  const [email, setEmail] = useState("user@example.com");
  const [name, setName] = useState("John Doe");
  const [currentPlan, setCurrentPlan] = useState("free");

  // Security settings
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("30");
  const [defaultSharePermission, setDefaultSharePermission] = useState("view");
  const [linkExpirationDays, setLinkExpirationDays] = useState(7);
  
  // Advanced storage settings
  const [splittingEnabled, setSplittingEnabled] = useState(true);
  const [maxChunkSize, setMaxChunkSize] = useState(25);
  const [encryptionAlgorithm, setEncryptionAlgorithm] = useState("aes256");

  // Format date for display
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  return (
    <AppLayout title="Settings">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-1">
          <Tabs
            orientation="vertical"
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="flex flex-col h-auto p-0 bg-transparent space-y-1">
              <TabsTrigger 
                value="account" 
                className="justify-start px-4 py-2 data-[state=active]:bg-muted"
              >
                <UserCircle className="h-4 w-4 mr-2" />
                Account
              </TabsTrigger>
              <TabsTrigger 
                value="security" 
                className="justify-start px-4 py-2 data-[state=active]:bg-muted"
              >
                <Shield className="h-4 w-4 mr-2" />
                Security & Privacy
              </TabsTrigger>
              <TabsTrigger 
                value="storage" 
                className="justify-start px-4 py-2 data-[state=active]:bg-muted"
              >
                <Lock className="h-4 w-4 mr-2" />
                Storage & Optimization
              </TabsTrigger>
              <TabsTrigger 
                value="uploads" 
                className="justify-start px-4 py-2 data-[state=active]:bg-muted"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Preferences
              </TabsTrigger>
              <TabsTrigger 
                value="sharing" 
                className="justify-start px-4 py-2 data-[state=active]:bg-muted"
              >
                <Share2 className="h-4 w-4 mr-2" />
                File Sharing
              </TabsTrigger>
              <TabsTrigger 
                value="notifications" 
                className="justify-start px-4 py-2 data-[state=active]:bg-muted"
              >
                <Bell className="h-4 w-4 mr-2" />
                Notifications
              </TabsTrigger>
              <TabsTrigger 
                value="billing" 
                className="justify-start px-4 py-2 data-[state=active]:bg-muted"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Billing
              </TabsTrigger>
              <TabsTrigger 
                value="support" 
                className="justify-start px-4 py-2 data-[state=active]:bg-muted"
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Support
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <div className="lg:col-span-4 space-y-6">
          <TabsContent value="account" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>
                  Manage your account details and preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input 
                        id="name" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Current Plan</Label>
                    <div className="flex items-center">
                      <Badge variant="outline" className="mr-2">
                        {currentPlan === 'free' ? 'Free' : 
                         currentPlan === 'premium' ? 'Premium' : 'Business'}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {currentPlan === 'free' ? 'Up to 3 providers and 30GB storage' : 
                         currentPlan === 'premium' ? 'Unlimited providers and 100GB storage' : 
                         'Team features and 250GB storage'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Preferences</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="block mb-1">Dark Mode</Label>
                        <span className="text-sm text-muted-foreground">
                          Switch between light and dark theme
                        </span>
                      </div>
                      <Switch 
                        checked={darkMode} 
                        onCheckedChange={setDarkMode} 
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Default Storage Provider</Label>
                      <Select 
                        value={defaultProvider}
                        onValueChange={setDefaultProvider}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select default provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto (Smart Allocation)</SelectItem>
                          <SelectItem value="google-drive">Google Drive</SelectItem>
                          <SelectItem value="dropbox">Dropbox</SelectItem>
                          <SelectItem value="onedrive">OneDrive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="security" className="m-0">
            <SecurityPrivacySettings 
              twoFactorEnabled={twoFactorEnabled}
              setTwoFactorEnabled={setTwoFactorEnabled}
              biometricEnabled={biometricEnabled}
              setBiometricEnabled={setBiometricEnabled}
              sessionTimeout={sessionTimeout}
              setSessionTimeout={setSessionTimeout}
              defaultSharePermission={defaultSharePermission}
              setDefaultSharePermission={setDefaultSharePermission}
              linkExpirationDays={linkExpirationDays}
              setLinkExpirationDays={setLinkExpirationDays}
            />
          </TabsContent>
          
          <TabsContent value="storage" className="m-0">
            <AdvancedStorageSettings 
              encryptionEnabled={encryptionEnabled}
              setEncryptionEnabled={setEncryptionEnabled}
              deduplicationEnabled={deduplicationEnabled}
              setDeduplicationEnabled={setDeduplicationEnabled}
              compressionLevel={compressionLevel}
              setCompressionLevel={setCompressionLevel}
              cacheSize={cacheSize}
              setCacheSize={setCacheSize}
              splittingEnabled={splittingEnabled}
              setSplittingEnabled={setSplittingEnabled}
              maxChunkSize={maxChunkSize}
              setMaxChunkSize={setMaxChunkSize}
              encryptionAlgorithm={encryptionAlgorithm}
              setEncryptionAlgorithm={setEncryptionAlgorithm}
            />
          </TabsContent>
          
          <TabsContent value="uploads" className="m-0">
            <UploadPreferences />
          </TabsContent>
          
          <TabsContent value="sharing" className="m-0">
            <FileSharingSettings />
          </TabsContent>
          
          <TabsContent value="notifications" className="m-0">
            <NotificationSettings
              notifyOnUploads={notifyOnUploads}
              setNotifyOnUploads={setNotifyOnUploads}
              notifyOnShares={notifyOnShares}
              setNotifyOnShares={setNotifyOnShares}
            />
          </TabsContent>
          
          <TabsContent value="billing" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Billing Information</CardTitle>
                <CardDescription>
                  Manage your subscription and payment information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="bg-muted/50 p-4 rounded-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">Current Plan</h3>
                        <div className="text-sm text-muted-foreground mt-1">
                          Free - 30 GB storage
                        </div>
                        
                        <div className="mt-3 text-sm">
                          <div className="font-medium">Features:</div>
                          <ul className="list-disc list-inside mt-1 text-muted-foreground">
                            <li>3 storage providers</li>
                            <li>Basic encryption</li>
                            <li>2 GB max file size</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div>
                        <Badge variant="outline" className="mb-2">
                          Free Plan
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
                      <Button variant="outline" size="sm">View Invoice History</Button>
                      <Button size="sm">Upgrade Plan</Button>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Available Plans</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <Card className="border-primary/50">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-center">Free</CardTitle>
                          <CardDescription className="text-center">
                            <span className="text-2xl font-bold">$0</span>/month
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            <li>3 storage providers</li>
                            <li>30 GB total storage</li>
                            <li>Basic encryption</li>
                            <li>2 GB max file size</li>
                          </ul>
                          
                          <Button className="w-full mt-4" variant="outline">
                            Current Plan
                          </Button>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-center">Premium</CardTitle>
                          <CardDescription className="text-center">
                            <span className="text-2xl font-bold">$5</span>/month
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            <li>Unlimited providers</li>
                            <li>100 GB total storage</li>
                            <li>Advanced encryption</li>
                            <li>10 GB max file size</li>
                            <li>Priority support</li>
                          </ul>
                          
                          <Button className="w-full mt-4">
                            Upgrade
                          </Button>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-center">Business</CardTitle>
                          <CardDescription className="text-center">
                            <span className="text-2xl font-bold">$15</span>/month
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            <li>Unlimited providers</li>
                            <li>250 GB total storage</li>
                            <li>Advanced encryption</li>
                            <li>Unlimited file size</li>
                            <li>Team collaboration</li>
                            <li>Admin controls</li>
                            <li>Priority support</li>
                          </ul>
                          
                          <Button className="w-full mt-4">
                            Upgrade
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="support" className="m-0">
            <Card>
              <CardHeader>
                <CardTitle>Support</CardTitle>
                <CardDescription>
                  Get help with your CloudUnity account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Documentation</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                          Find answers to common questions in our comprehensive documentation.
                        </p>
                        <Button variant="outline" size="sm">
                          View Documentation
                        </Button>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Contact Support</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                          Can't find what you need? Our support team is here to help.
                        </p>
                        <Button variant="outline" size="sm">
                          Contact Support
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Send Feedback</CardTitle>
                      <CardDescription>
                        Help us improve CloudUnity by sharing your thoughts
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="feedback-type">Feedback Type</Label>
                          <Select defaultValue="general">
                            <SelectTrigger>
                              <SelectValue placeholder="Select feedback type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="general">General Feedback</SelectItem>
                              <SelectItem value="bug">Bug Report</SelectItem>
                              <SelectItem value="feature">Feature Request</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="feedback">Your Feedback</Label>
                          <textarea 
                            id="feedback"
                            className="w-full min-h-[100px] p-2 rounded-md border border-input bg-background"
                            placeholder="Tell us what you think..."
                          />
                        </div>
                        
                        <div className="flex justify-end">
                          <Button>Submit Feedback</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
