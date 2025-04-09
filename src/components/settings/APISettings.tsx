
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
import { useToast } from '@/hooks/use-toast';
import { Copy, Key, Plus, ArrowRight, Trash2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface APIKey {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string | null;
  permissions: string[];
}

export const APISettings = () => {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([
    {
      id: '1',
      name: 'Web App Integration',
      key: 'cu_BhJ8nKpLmQrStU',
      created: '2023-05-15T10:30:00Z',
      lastUsed: '2023-06-01T08:45:33Z',
      permissions: ['read', 'write', 'delete']
    },
    {
      id: '2',
      name: 'Mobile App',
      key: 'cu_VwXyZa1B2C3D4E',
      created: '2023-05-20T14:22:00Z',
      lastUsed: '2023-05-31T19:12:05Z',
      permissions: ['read', 'write']
    }
  ]);
  
  const [newApiKey, setNewApiKey] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allowExternalAccess, setAllowExternalAccess] = useState(true);
  const [webhook, setWebhook] = useState('');
  const { toast } = useToast();
  
  const generateApiKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for your API key',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const generatedKey = `cu_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      
      const newKey = {
        id: Date.now().toString(),
        name: newKeyName,
        key: generatedKey,
        created: new Date().toISOString(),
        lastUsed: null,
        permissions: ['read', 'write']
      };
      
      setApiKeys([...apiKeys, newKey]);
      setNewApiKey(generatedKey);
      
      toast({
        title: 'API key created',
        description: `API key "${newKeyName}" has been created successfully.`,
      });
      
      setNewKeyName('');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create API key.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const revokeApiKey = async (id: string) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setApiKeys(apiKeys.filter(key => key.id !== id));
      
      toast({
        title: 'API key revoked',
        description: 'The API key has been revoked successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to revoke API key.',
        variant: 'destructive',
      });
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard',
      description: 'API key has been copied to your clipboard.',
    });
  };
  
  const saveSettings = () => {
    toast({
      title: 'API settings saved',
      description: 'Your API settings have been updated successfully.',
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Key className="mr-2 h-5 w-5" />
            API Keys
          </CardTitle>
          <CardDescription>
            Manage API keys for programmatic access to your CloudUnity account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col space-y-4">
            {apiKeys.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apiKeys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <span className="font-mono">•••••••••••{key.key.slice(-4)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(key.key)}
                            className="h-7 w-7"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(key.created).toLocaleDateString()}</TableCell>
                      <TableCell>{key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : 'Never'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {key.permissions.map((permission) => (
                            <Badge key={permission} variant="outline">
                              {permission}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeApiKey(key.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 border rounded-lg">
                <p className="text-muted-foreground">No API keys found</p>
                <p className="text-sm text-muted-foreground mt-1">Create an API key to integrate with CloudUnity</p>
              </div>
            )}
          </div>
          
          <Dialog open={isCreatingKey} onOpenChange={setIsCreatingKey}>
            <DialogTrigger asChild>
              <Button className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New API Key</DialogTitle>
                <DialogDescription>
                  Generate a new API key for accessing CloudUnity programmatically.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="key-name">API Key Name</Label>
                  <Input
                    id="key-name"
                    placeholder="e.g. Web App Integration"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Give your API key a meaningful name related to its use.
                  </p>
                </div>
                
                {newApiKey && (
                  <div className="space-y-2 mt-4">
                    <Label>Your New API Key</Label>
                    <div className="bg-muted p-3 rounded-md flex items-center justify-between">
                      <code className="font-mono text-sm break-all">{newApiKey}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(newApiKey)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-amber-500 font-medium">
                      Save this key now! You won't be able to see it again.
                    </p>
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreatingKey(false)}>
                  {newApiKey ? 'Close' : 'Cancel'}
                </Button>
                {!newApiKey && (
                  <Button onClick={generateApiKey} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      'Generate Key'
                    )}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>API Settings</CardTitle>
          <CardDescription>
            Configure API behavior and security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-4">Security</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="rate-limiting">Rate Limiting</Label>
                  <p className="text-sm text-muted-foreground">
                    Limit API requests to 100 per minute
                  </p>
                </div>
                <Switch
                  id="rate-limiting"
                  defaultChecked
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="external-access">Allow External Access</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow API requests from external domains
                  </p>
                </div>
                <Switch
                  id="external-access"
                  checked={allowExternalAccess}
                  onCheckedChange={setAllowExternalAccess}
                />
              </div>
              
              {allowExternalAccess && (
                <div className="ml-6 border-l-2 border-l-muted pl-4 pb-2">
                  <div className="space-y-2">
                    <Label htmlFor="allowed-origins">Allowed Origins (CORS)</Label>
                    <Input
                      id="allowed-origins"
                      placeholder="*.example.com, https://myapp.com"
                      defaultValue="*"
                    />
                    <p className="text-xs text-muted-foreground">
                      Comma-separated list of domains allowed to make API requests. Use * for all domains.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <Separator />
          
          <div>
            <h3 className="text-lg font-medium mb-4">Webhooks</h3>
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                placeholder="https://your-application.com/webhooks/cloudunity"
                value={webhook}
                onChange={(e) => setWebhook(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                URL that will receive webhook events from CloudUnity
              </p>
              
              <div className="flex items-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center"
                  disabled={!webhook}
                >
                  Test Webhook
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={saveSettings}>Save Settings</Button>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>API Documentation</CardTitle>
          <CardDescription>
            Resources for using the CloudUnity API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p>
              Explore our comprehensive API documentation to learn how to integrate CloudUnity into your applications.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <Button variant="outline" className="flex justify-between w-full">
                <span className="flex items-center">
                  Getting Started Guide
                </span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              
              <Button variant="outline" className="flex justify-between w-full">
                <span className="flex items-center">
                  API Reference
                </span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              
              <Button variant="outline" className="flex justify-between w-full">
                <span className="flex items-center">
                  SDK Libraries
                </span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              
              <Button variant="outline" className="flex justify-between w-full">
                <span className="flex items-center">
                  Code Examples
                </span>
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
