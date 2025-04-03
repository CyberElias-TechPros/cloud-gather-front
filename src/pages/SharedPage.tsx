
import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Calendar, 
  Clock, 
  Download, 
  FileText, 
  Link2, 
  MoreHorizontal, 
  Share, 
  Shield, 
  Trash2, 
  Users 
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { FileGrid } from '@/components/files/FileGrid';

const SharedPage = () => {
  const [tab, setTab] = React.useState('shared-with-me');
  const [loading, setLoading] = React.useState(false);
  const [shares, setShares] = React.useState<any[]>([]);
  const [sharedByMe, setSharedByMe] = React.useState<any[]>([]);

  return (
    <AppLayout title="Shared">
      <div className="space-y-4">
        <Tabs defaultValue="shared-with-me" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="shared-with-me" onClick={() => setTab('shared-with-me')}>
                Shared with me
              </TabsTrigger>
              <TabsTrigger value="shared-by-me" onClick={() => setTab('shared-by-me')}>
                Shared by me
              </TabsTrigger>
              <TabsTrigger value="links" onClick={() => setTab('links')}>
                Links
              </TabsTrigger>
            </TabsList>
            
            <div className="flex space-x-2">
              <Select defaultValue="all">
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All files</SelectItem>
                  <SelectItem value="recent">Recent</SelectItem>
                  <SelectItem value="images">Images</SelectItem>
                  <SelectItem value="documents">Documents</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <TabsContent value="shared-with-me" className="mt-0">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array(6).fill(0).map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-full" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-24 w-full" />
                    </CardContent>
                    <CardFooter>
                      <Skeleton className="h-3 w-full" />
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : shares.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-muted inline-flex rounded-full p-3 mb-4">
                  <Share className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No shared files yet</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  When someone shares files or folders with you, they will appear here.
                </p>
              </div>
            ) : (
              <FileGrid files={shares} view="grid" />
            )}
          </TabsContent>
          
          <TabsContent value="shared-by-me" className="mt-0">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array(6).fill(0).map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-full" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-24 w-full" />
                    </CardContent>
                    <CardFooter>
                      <Skeleton className="h-3 w-full" />
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : sharedByMe.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-muted inline-flex rounded-full p-3 mb-4">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">You haven't shared any files</h3>
                <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                  When you share your files or folders with others, they will appear here.
                </p>
                <Button>
                  <Share className="mr-2 h-4 w-4" />
                  Share a file
                </Button>
              </div>
            ) : (
              <FileGrid files={sharedByMe} view="grid" />
            )}
          </TabsContent>
          
          <TabsContent value="links" className="mt-0">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Sharing Links</CardTitle>
                  <CardDescription>
                    Create and manage public links to your files.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="rounded-lg border p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                          <div className="bg-muted rounded-md p-2 mr-3">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">Project Proposal.pdf</p>
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 mr-1" />
                              <span>Expires in 7 days</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Calendar className="mr-2 h-4 w-4" />
                                <span>Change expiration</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Shield className="mr-2 h-4 w-4" />
                                <span>Password protect</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Download className="mr-2 h-4 w-4" />
                                <span>Download</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete link</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <div className="flex items-center bg-muted rounded-md p-2">
                        <Input 
                          readOnly 
                          value="https://cloudunity.com/s/abc123xyz" 
                          className="border-0 bg-transparent focus-visible:ring-0"
                        />
                        <Button variant="ghost" size="sm">
                          <Link2 className="h-4 w-4 mr-1" />
                          Copy
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button>
                        <Link2 className="mr-2 h-4 w-4" />
                        Create new link
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Sharing Link</DialogTitle>
                        <DialogDescription>
                          Generate a public link to share your file with anyone.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="file">Select file</Label>
                          <Select>
                            <SelectTrigger id="file">
                              <SelectValue placeholder="Choose a file" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="file1">Project Proposal.pdf</SelectItem>
                              <SelectItem value="file2">Budget.xlsx</SelectItem>
                              <SelectItem value="file3">Presentation.pptx</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="expiration">Expiration</Label>
                          <Select defaultValue="7days">
                            <SelectTrigger id="expiration">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1day">1 day</SelectItem>
                              <SelectItem value="7days">7 days</SelectItem>
                              <SelectItem value="30days">30 days</SelectItem>
                              <SelectItem value="never">Never</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch id="password" />
                          <Label htmlFor="password">Protect with password</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch id="download" defaultChecked />
                          <Label htmlFor="download">Allow downloads</Label>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="submit">Create link</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default SharedPage;
