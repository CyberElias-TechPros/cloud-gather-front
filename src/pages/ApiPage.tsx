
import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Copy, Info, AlertTriangle, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const ApiPage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<{id: string, name: string, key: string, created: string}[]>([]);
  const [keyName, setKeyName] = useState('');
  const [loading, setLoading] = useState(false);

  const generateApiKey = async () => {
    if (!keyName.trim()) {
      toast({
        title: 'Validation error',
        description: 'Please provide a name for your API key',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // In a real implementation, you would call an edge function here
      // to create an API key in a secure way
      const mockApiKey = `cu_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
      
      // For demo purposes, we're just adding it to the state
      const newKey = {
        id: Date.now().toString(),
        name: keyName,
        key: mockApiKey,
        created: new Date().toISOString()
      };
      
      setApiKeys([...apiKeys, newKey]);
      setKeyName('');
      
      toast({
        title: 'API key created',
        description: 'Your API key has been created successfully',
      });
    } catch (error: any) {
      console.error('Error generating API key:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate API key',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard',
      description: 'API key has been copied to your clipboard',
    });
  };

  const revokeKey = (id: string) => {
    setApiKeys(apiKeys.filter(key => key.id !== id));
    toast({
      title: 'API key revoked',
      description: 'The API key has been revoked successfully',
    });
  };

  return (
    <AppLayout title="API Access">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>API Integration</CardTitle>
            <CardDescription>
              Connect your applications to CloudUnity's API for programmatic file access and management.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-6">
              <Info className="h-4 w-4" />
              <AlertTitle>Getting Started</AlertTitle>
              <AlertDescription>
                Use our API to integrate cloud storage into your applications. Access files from all connected providers with a single API.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">Your API Keys</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Create and manage API keys to authenticate your applications.
                </p>
                
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="Key name (e.g. My App)"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    className="max-w-xs"
                  />
                  <Button onClick={generateApiKey} disabled={loading}>
                    {loading ? 'Generating...' : 'Generate Key'}
                  </Button>
                </div>
                
                {apiKeys.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left p-3">Name</th>
                          <th className="text-left p-3">Key</th>
                          <th className="text-left p-3">Created</th>
                          <th className="text-left p-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {apiKeys.map((key) => (
                          <tr key={key.id}>
                            <td className="p-3">{key.name}</td>
                            <td className="p-3 font-mono text-sm">
                              {`${key.key.substring(0, 8)}...`}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 ml-2"
                                onClick={() => copyToClipboard(key.key)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </td>
                            <td className="p-3 text-sm text-muted-foreground">
                              {new Date(key.created).toLocaleDateString()}
                            </td>
                            <td className="p-3">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => revokeKey(key.id)}
                              >
                                Revoke
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 border rounded-lg">
                    <p className="text-muted-foreground">No API keys generated yet</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Tabs defaultValue="rest-api">
          <TabsList>
            <TabsTrigger value="rest-api">REST API</TabsTrigger>
            <TabsTrigger value="sdk">SDK</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          </TabsList>
          
          <TabsContent value="rest-api" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>REST API Documentation</CardTitle>
                <CardDescription>
                  Integrate CloudUnity with your applications using our RESTful API.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Authentication</AlertTitle>
                  <AlertDescription>
                    All API requests require authentication using an API key in the Authorization header.
                  </AlertDescription>
                </Alert>
                
                <div className="mt-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Base URL</h3>
                    <div className="bg-muted p-3 rounded-md font-mono text-sm">
                      https://api.cloudunity.io/v1
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2">Authentication</h3>
                    <div className="bg-muted p-3 rounded-md font-mono text-sm">
                      Authorization: Bearer YOUR_API_KEY
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2">Example Request</h3>
                    <div className="bg-muted p-3 rounded-md font-mono text-sm whitespace-pre overflow-x-auto">
{`curl -X GET https://api.cloudunity.io/v1/files \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2">Endpoints</h3>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium">Files</h4>
                        <ul className="list-disc pl-6 space-y-1 mt-1">
                          <li><code className="font-mono bg-muted px-1">GET /files</code> - List files</li>
                          <li><code className="font-mono bg-muted px-1">GET /files/:id</code> - Get file details</li>
                          <li><code className="font-mono bg-muted px-1">POST /files</code> - Upload a file</li>
                          <li><code className="font-mono bg-muted px-1">DELETE /files/:id</code> - Delete a file</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-medium">Folders</h4>
                        <ul className="list-disc pl-6 space-y-1 mt-1">
                          <li><code className="font-mono bg-muted px-1">GET /folders/:id/files</code> - List files in a folder</li>
                          <li><code className="font-mono bg-muted px-1">POST /folders</code> - Create a folder</li>
                          <li><code className="font-mono bg-muted px-1">DELETE /folders/:id</code> - Delete a folder</li>
                        </ul>
                      </div>
                      
                      <div>
                        <h4 className="font-medium">Sharing</h4>
                        <ul className="list-disc pl-6 space-y-1 mt-1">
                          <li><code className="font-mono bg-muted px-1">POST /files/:id/share</code> - Share a file</li>
                          <li><code className="font-mono bg-muted px-1">GET /files/:id/shares</code> - List shares for a file</li>
                          <li><code className="font-mono bg-muted px-1">DELETE /shares/:id</code> - Remove a share</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline">View Full Documentation</Button>
                <Button variant="default">Get Started</Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="sdk" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>SDK Integration</CardTitle>
                <CardDescription>
                  Use our client SDKs to integrate CloudUnity into your applications.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-2">JavaScript SDK</h3>
                    <div className="bg-muted p-3 rounded-md font-mono text-sm whitespace-pre overflow-x-auto">
{`// Install
npm install cloudunity-sdk

// Initialize
import { CloudUnity } from 'cloudunity-sdk';

const cloudunity = new CloudUnity({
  apiKey: 'YOUR_API_KEY'
});

// Example: List files
const files = await cloudunity.files.list();
console.log(files);`}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2">Python SDK</h3>
                    <div className="bg-muted p-3 rounded-md font-mono text-sm whitespace-pre overflow-x-auto">
{`# Install
pip install cloudunity-sdk

# Initialize
from cloudunity import CloudUnity

client = CloudUnity(api_key='YOUR_API_KEY')

# Example: List files
files = client.files.list()
print(files)`}
                    </div>
                  </div>
                  
                  <Alert variant="default" className="bg-primary/10">
                    <Check className="h-4 w-4" />
                    <AlertTitle>Available SDKs</AlertTitle>
                    <AlertDescription>
                      CloudUnity offers SDKs for JavaScript, Python, Ruby, PHP, Go, and Java.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline">View SDK Docs</Button>
                <Button variant="default">Download SDKs</Button>
              </CardFooter>
            </Card>
          </TabsContent>
          
          <TabsContent value="webhooks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Webhooks</CardTitle>
                <CardDescription>
                  Configure webhooks to receive notifications about events in your CloudUnity account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>How Webhooks Work</AlertTitle>
                    <AlertDescription>
                      Webhooks allow your application to receive HTTP notifications when events happen in your CloudUnity account.
                    </AlertDescription>
                  </Alert>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2">Available Events</h3>
                    <ul className="list-disc pl-6 space-y-1">
                      <li><code className="font-mono bg-muted px-1">file.created</code> - A new file is uploaded</li>
                      <li><code className="font-mono bg-muted px-1">file.updated</code> - A file is updated</li>
                      <li><code className="font-mono bg-muted px-1">file.deleted</code> - A file is deleted</li>
                      <li><code className="font-mono bg-muted px-1">folder.created</code> - A new folder is created</li>
                      <li><code className="font-mono bg-muted px-1">share.created</code> - A file is shared</li>
                      <li><code className="font-mono bg-muted px-1">share.accessed</code> - A shared file is accessed</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2">Add Webhook Endpoint</h3>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://your-app.com/webhooks/cloudunity"
                        className="max-w-md"
                      />
                      <Button>Add Endpoint</Button>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2">Example Payload</h3>
                    <div className="bg-muted p-3 rounded-md font-mono text-sm whitespace-pre overflow-x-auto">
{`{
  "event": "file.created",
  "created_at": "2023-06-01T12:00:00Z",
  "data": {
    "file_id": "f_123456",
    "name": "document.pdf",
    "size": 1048576,
    "mime_type": "application/pdf",
    "path": "/Documents/document.pdf",
    "provider_id": "google-drive"
  }
}`}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline">Webhook Logs</Button>
                <Button>Save Changes</Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ApiPage;
