
import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  AlertCircle,
  Calendar,
  Camera,
  Check,
  Crown,
  HardDrive,
  Key,
  LogOut,
  Mail,
  Shield,
  Trash2,
  Upload,
  User,
  X
} from 'lucide-react';
import { toast } from 'sonner';

const ProfilePage = () => {
  return (
    <AppLayout title="Profile">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src="" alt="User" />
              <AvatarFallback className="text-xl">JD</AvatarFallback>
            </Avatar>
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  variant="secondary" 
                  size="icon" 
                  className="absolute bottom-0 right-0 rounded-full h-8 w-8 p-0"
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Update Profile Picture</DialogTitle>
                  <DialogDescription>
                    Upload a new profile picture or choose from our avatars.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                    <div className="mb-4">
                      <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Drag and drop an image here, or click to browse
                    </p>
                    <Button size="sm">Choose File</Button>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-3">Or choose an avatar</h4>
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                        <Avatar key={i} className="h-12 w-12 cursor-pointer hover:ring-2 hover:ring-primary">
                          <AvatarFallback>{i}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Save Changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          <div>
            <h1 className="text-2xl font-bold">John Doe</h1>
            <p className="text-muted-foreground">john@example.com</p>
            <div className="flex items-center mt-2">
              <Badge variant="outline" className="mr-2 bg-primary/10 text-primary">
                <Crown className="h-3 w-3 mr-1" />
                Free Plan
              </Badge>
              <Badge variant="outline">
                <Calendar className="h-3 w-3 mr-1" />
                Joined April 2025
              </Badge>
            </div>
          </div>
          
          <div className="ml-auto space-x-2">
            <Button variant="outline">
              <Key className="h-4 w-4 mr-2" />
              Change Password
            </Button>
            <Button>
              <Crown className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="account">
          <TabsList className="mb-4">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>
          
          <TabsContent value="account">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                  <CardDescription>
                    Manage your personal account details.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" defaultValue="John Doe" />
                  </div>
                  <div className="grid gap-3">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" defaultValue="john@example.com" />
                  </div>
                  <div className="grid gap-3">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" defaultValue="johndoe" />
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline">Cancel</Button>
                  <Button onClick={() => toast.success("Profile updated successfully")}>
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Account Storage</CardTitle>
                  <CardDescription>
                    View your storage usage across all cloud providers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <HardDrive className="h-5 w-5 text-blue-500" />
                        <span className="font-medium">Total Storage</span>
                      </div>
                      <div className="text-2xl font-bold">20 GB</div>
                      <p className="text-xs text-muted-foreground">Free plan limit</p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Upload className="h-5 w-5 text-green-500" />
                        <span className="font-medium">Used Storage</span>
                      </div>
                      <div className="text-2xl font-bold">14.5 GB</div>
                      <p className="text-xs text-muted-foreground">72% of total</p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-5 w-5 text-purple-500" />
                        <span className="font-medium">Providers</span>
                      </div>
                      <div className="text-2xl font-bold">3</div>
                      <p className="text-xs text-muted-foreground">Maximum for free plan</p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full">
                    <Crown className="mr-2 h-4 w-4" />
                    Upgrade for More Storage
                  </Button>
                </CardFooter>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Danger Zone</CardTitle>
                  <CardDescription>
                    Actions that can't be undone.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete your
                          account and remove your data from our servers.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction>Delete Account</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Track your account activity and recent actions.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Activity</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <Check className="mr-2 h-4 w-4 text-green-500" />
                          <span>Login successful</span>
                        </div>
                      </TableCell>
                      <TableCell>192.168.1.1</TableCell>
                      <TableCell>New York, USA</TableCell>
                      <TableCell>Apr 3, 2025 11:42 AM</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <Upload className="mr-2 h-4 w-4 text-blue-500" />
                          <span>File uploaded</span>
                        </div>
                      </TableCell>
                      <TableCell>192.168.1.1</TableCell>
                      <TableCell>New York, USA</TableCell>
                      <TableCell>Apr 2, 2025 3:27 PM</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex items-center">
                          <X className="mr-2 h-4 w-4 text-red-500" />
                          <span>Login failed</span>
                        </div>
                      </TableCell>
                      <TableCell>102.45.32.67</TableCell>
                      <TableCell>Unknown</TableCell>
                      <TableCell>Apr 1, 2025 7:14 PM</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">View Full Activity Log</Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="security">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>
                    Manage your account security preferences.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input id="current-password" type="password" />
                  </div>
                  <div className="grid gap-3">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input id="new-password" type="password" />
                  </div>
                  <div className="grid gap-3">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input id="confirm-password" type="password" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full">Update Password</Button>
                </CardFooter>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Two-Factor Authentication</CardTitle>
                  <CardDescription>
                    Add an extra layer of security to your account.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 p-4 border rounded-lg">
                    <Shield className="h-8 w-8 text-muted-foreground" />
                    <div className="flex-1">
                      <h3 className="font-medium mb-1">Protect your account</h3>
                      <p className="text-sm text-muted-foreground">
                        Two-factor authentication adds an additional layer of security to your account
                        by requiring more than just a password to sign in.
                      </p>
                    </div>
                    <Button variant="outline">Enable</Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Account Sessions</CardTitle>
                  <CardDescription>
                    Manage your active sessions and devices.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 border rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="bg-muted rounded-md p-2">
                          <HardDrive className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-medium">MacBook Pro</h3>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Chrome on macOS</p>
                            <p>New York, USA • 192.168.1.1</p>
                            <div className="flex items-center mt-1">
                              <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50 border-green-200">
                                <Check className="h-3 w-3 mr-1" />
                                Current Session
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-muted-foreground">
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                      </Button>
                    </div>
                    
                    <div className="flex justify-between items-center p-4 border rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="bg-muted rounded-md p-2">
                          <HardDrive className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-medium">iPhone 13</h3>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>Safari on iOS</p>
                            <p>San Francisco, USA • 198.51.100.42</p>
                            <p className="text-xs">Last active: 2 hours ago</p>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-muted-foreground">
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                      </Button>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full text-red-600">
                    Sign Out From All Other Devices
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="billing">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Current Plan</CardTitle>
                  <CardDescription>
                    You are currently on the Free plan.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-xl font-bold mb-1">Free Plan</h3>
                        <p className="text-muted-foreground">Basic cloud storage features</p>
                      </div>
                      <Badge className="text-lg py-1.5 px-3">$0</Badge>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Check className="h-4 w-4 text-green-500 mr-2" />
                        <span>Up to 3 cloud storage providers</span>
                      </div>
                      <div className="flex items-center">
                        <Check className="h-4 w-4 text-green-500 mr-2" />
                        <span>20 GB total storage</span>
                      </div>
                      <div className="flex items-center">
                        <Check className="h-4 w-4 text-green-500 mr-2" />
                        <span>Basic file management</span>
                      </div>
                      <div className="flex items-center">
                        <Check className="h-4 w-4 text-green-500 mr-2" />
                        <span>Email support</span>
                      </div>
                      <div className="flex items-center text-muted-foreground">
                        <X className="h-4 w-4 mr-2" />
                        <span>Advanced security features</span>
                      </div>
                      <div className="flex items-center text-muted-foreground">
                        <X className="h-4 w-4 mr-2" />
                        <span>Unlimited providers</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full">
                    <Crown className="mr-2 h-4 w-4" />
                    Upgrade Now
                  </Button>
                </CardFooter>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Available Plans</CardTitle>
                  <CardDescription>
                    Choose the plan that's right for you.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border p-6 space-y-4 hover:border-primary hover:shadow-md transition-all">
                      <div>
                        <h3 className="text-xl font-bold mb-1">Premium</h3>
                        <div className="flex items-center mb-2">
                          <span className="text-2xl font-bold">$5</span>
                          <span className="text-muted-foreground ml-1">/month</span>
                        </div>
                        <p className="text-muted-foreground">For individuals who need more storage</p>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span>Unlimited cloud storage providers</span>
                        </div>
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span>100 GB total storage</span>
                        </div>
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span>File encryption</span>
                        </div>
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span>Priority support</span>
                        </div>
                      </div>
                      
                      <Button className="w-full">Choose Premium</Button>
                    </div>
                    
                    <div className="rounded-xl border p-6 space-y-4 hover:border-primary hover:shadow-md transition-all">
                      <div>
                        <h3 className="text-xl font-bold mb-1">Business</h3>
                        <div className="flex items-center mb-2">
                          <span className="text-2xl font-bold">$15</span>
                          <span className="text-muted-foreground ml-1">/month</span>
                        </div>
                        <p className="text-muted-foreground">For teams who need to collaborate</p>
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span>Everything in Premium</span>
                        </div>
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span>500 GB total storage</span>
                        </div>
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span>Advanced team management</span>
                        </div>
                        <div className="flex items-center">
                          <Check className="h-4 w-4 text-green-500 mr-2" />
                          <span>Admin controls</span>
                        </div>
                      </div>
                      
                      <Button className="w-full">Choose Business</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Payment Method</CardTitle>
                  <CardDescription>
                    Add a payment method to upgrade your plan.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 p-6 border rounded-lg text-center">
                    <div className="mx-auto">
                      <Mail className="h-12 w-12 text-muted-foreground mb-4 mx-auto" />
                      <h3 className="font-medium mb-1">No payment methods added yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Add a payment method to upgrade to a premium plan.
                      </p>
                      <Button>Add Payment Method</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ProfilePage;
