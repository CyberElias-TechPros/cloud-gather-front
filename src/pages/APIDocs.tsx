
import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Copy, Key, Eye, EyeOff, Loader2, Plus, Calendar, RefreshCcw, Trash2, AlertCircle, Check, Code, FileText, Upload, Download, Server, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/apiClient';
import { ApiKey } from '@/types/file';

const APIDocs = () => {
  const { user, loading: authLoading } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [createKeyDialogOpen, setCreateKeyDialogOpen] = useState(false);
  const [activeEndpoint, setActiveEndpoint] = useState<string | null>(null);
  
  // Form state for new API key
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['read']);
  
  // Demo API key for example purposes
  const demoApiKey = 'sk_live_51M8JDKLovableDevZGIjQNsk8dvbL5j5puDPmVmcTzyC';
  
  useEffect(() => {
    if (!user) return;
    
    const loadApiKeys = async () => {
      setLoading(true);
      try {
        // In a real implementation, this would call the actual API
        // const keys = await apiClient.listApiKeys();
        
        // For demo purposes, we'll use mock data
        const mockKeys: ApiKey[] = [
          {
            id: '1',
            name: 'Main Application Key',
            key: 'sk_live_51M8JDKLovableDevZGIjQNsk8dvbL5j5puDPmVmcTzyC',
            user_id: user.id,
            permissions: ['read', 'write', 'delete'],
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(), // 30 days ago
            status: 'active',
          },
          {
            id: '2',
            name: 'Read-only Key',
            key: 'sk_live_51N9KDFLovableDevHKGjQShk3cvbT8g9qsIHkASbiMrI',
            user_id: user.id,
            permissions: ['read'],
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(), // 15 days ago
            status: 'active',
          },
          {
            id: '3',
            name: 'Expired Key',
            key: 'sk_live_51P7LMNLovableDevYTRjCBgh6fvbS3d8erGFdWExlPnD',
            user_id: user.id,
            permissions: ['read', 'write'],
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(), // 60 days ago
            expires_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), // 10 days ago
            status: 'expired',
          }
        ];
        
        setApiKeys(mockKeys);
      } catch (error: any) {
        console.error('Error loading API keys:', error);
        toast.error(`Failed to load API keys: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadApiKeys();
  }, [user]);
  
  const handleCreateKey = async () => {
    if (!newKeyName) {
      toast.error('Please enter a name for your API key');
      return;
    }
    
    if (selectedPermissions.length === 0) {
      toast.error('Please select at least one permission');
      return;
    }
    
    setLoading(true);
    try {
      // In a real implementation, this would call the actual API
      // const result = await apiClient.createApiKey(newKeyName, selectedPermissions);
      
      // For demo purposes, we'll create a mock key
      const mockNewKey: ApiKey = {
        id: `new-${Date.now()}`,
        name: newKeyName,
        key: `sk_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
        user_id: user!.id,
        permissions: selectedPermissions,
        created_at: new Date().toISOString(),
        status: 'active',
      };
      
      setApiKeys([...apiKeys, mockNewKey]);
      setNewKeyName('');
      setSelectedPermissions(['read']);
      setCreateKeyDialogOpen(false);
      toast.success('API key created successfully');
    } catch (error: any) {
      console.error('Error creating API key:', error);
      toast.error(`Failed to create API key: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    try {
      // In a real implementation, this would call the actual API
      // await apiClient.revokeApiKey(keyId);
      
      // For demo purposes, we'll just update our local state
      setApiKeys(apiKeys.map(key => 
        key.id === keyId ? { ...key, status: 'revoked' as const } : key
      ));
      
      toast.success('API key revoked successfully');
    } catch (error: any) {
      console.error('Error revoking API key:', error);
      toast.error(`Failed to revoke API key: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const toggleShowApiKey = (keyId: string) => {
    setShowApiKey(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };
  
  const copyToClipboard = (text: string, message: string = 'Copied to clipboard') => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success(message))
      .catch(err => {
        console.error('Failed to copy:', err);
        toast.error('Failed to copy to clipboard');
      });
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'expired': return 'bg-amber-500';
      case 'revoked': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };
  
  // Sample API endpoints for documentation
  const apiEndpoints = [
    {
      name: 'List files',
      method: 'GET',
      path: '/api/v1/files',
      description: 'Get a list of all files in your storage',
      params: [
        { name: 'folder', type: 'string', description: 'Filter by folder ID', required: false },
        { name: 'sort', type: 'string', description: 'Sort by name, date, or size', required: false },
        { name: 'direction', type: 'string', description: 'Sort direction (asc or desc)', required: false },
      ],
      response: `{
  "files": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "filename": "document.pdf",
      "path": "/documents/document.pdf",
      "size": 1024000,
      "mime_type": "application/pdf",
      "is_folder": false,
      "created_at": "2023-01-15T14:30:00Z",
      "updated_at": "2023-01-15T14:30:00Z"
    }
  ]
}`
    },
    {
      name: 'Get file',
      method: 'GET',
      path: '/api/v1/files/{fileId}',
      description: 'Get metadata for a specific file',
      params: [
        { name: 'fileId', type: 'string', description: 'ID of the file', required: true },
      ],
      response: `{
  "file": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "filename": "document.pdf",
    "path": "/documents/document.pdf",
    "size": 1024000,
    "mime_type": "application/pdf",
    "is_folder": false,
    "created_at": "2023-01-15T14:30:00Z",
    "updated_at": "2023-01-15T14:30:00Z"
  }
}`
    },
    {
      name: 'Download file',
      method: 'GET',
      path: '/api/v1/files/{fileId}/download',
      description: 'Download a specific file',
      params: [
        { name: 'fileId', type: 'string', description: 'ID of the file to download', required: true },
      ],
      response: 'Binary file content with appropriate Content-Type header'
    },
    {
      name: 'Create folder',
      method: 'POST',
      path: '/api/v1/files/folder',
      description: 'Create a new folder',
      params: [
        { name: 'folderName', type: 'string', description: 'Name of the new folder', required: true },
        { name: 'parentFolderId', type: 'string', description: 'ID of the parent folder', required: false },
      ],
      request: `{
  "folderName": "New Folder",
  "parentFolderId": "123e4567-e89b-12d3-a456-426614174000"
}`,
      response: `{
  "folder": {
    "id": "abcdef12-34cd-56ef-ab12-abcdef123456",
    "filename": "New Folder",
    "path": "/documents/New Folder",
    "size": 0,
    "is_folder": true,
    "created_at": "2023-01-15T14:30:00Z",
    "updated_at": "2023-01-15T14:30:00Z"
  }
}`
    },
    {
      name: 'Upload file',
      method: 'POST',
      path: '/api/v1/files/upload',
      description: 'Upload a new file',
      params: [
        { name: 'file', type: 'file', description: 'File to upload', required: true },
        { name: 'parentFolderId', type: 'string', description: 'ID of the parent folder', required: false },
      ],
      note: 'This endpoint expects multipart/form-data',
      response: `{
  "file": {
    "id": "fedcba98-7654-3210-fedc-ba9876543210",
    "filename": "document.pdf",
    "path": "/documents/document.pdf",
    "size": 1024000,
    "mime_type": "application/pdf",
    "is_folder": false,
    "created_at": "2023-01-15T14:30:00Z",
    "updated_at": "2023-01-15T14:30:00Z"
  }
}`
    },
    {
      name: 'Delete file',
      method: 'DELETE',
      path: '/api/v1/files/{fileId}',
      description: 'Delete a file or folder',
      params: [
        { name: 'fileId', type: 'string', description: 'ID of the file to delete', required: true },
      ],
      response: `{
  "success": true
}`
    },
    {
      name: 'Share file',
      method: 'POST',
      path: '/api/v1/files/{fileId}/share',
      description: 'Share a file with someone',
      params: [
        { name: 'fileId', type: 'string', description: 'ID of the file to share', required: true },
        { name: 'email', type: 'string', description: 'Email address to share with', required: true },
        { name: 'permissionLevel', type: 'string', description: 'Permission level (view, edit, admin)', required: true },
        { name: 'expiresAt', type: 'string', description: 'ISO date when the share expires', required: false },
      ],
      request: `{
  "email": "colleague@example.com",
  "permissionLevel": "view",
  "expiresAt": "2023-12-31T23:59:59Z"
}`,
      response: `{
  "share": {
    "id": "11aa22bb-33cc-44dd-55ee-66ff77gg88hh",
    "fileId": "123e4567-e89b-12d3-a456-426614174000",
    "sharedWithEmail": "colleague@example.com",
    "permissionLevel": "view",
    "expiresAt": "2023-12-31T23:59:59Z",
    "created_at": "2023-01-15T14:30:00Z"
  }
}`
    },
  ];
  
  // Generate code examples for an endpoint
  const generateCodeExample = (endpoint: any) => {
    // Example using cURL
    const curlExample = () => {
      let curl = `curl -X ${endpoint.method} \\\n`;
      curl += `  -H "Content-Type: application/json" \\\n`;
      curl += `  -H "x-api-key: ${demoApiKey.substring(0, 10)}..." \\\n`;
      
      if (endpoint.method === 'GET') {
        const hasParams = endpoint.params && endpoint.params.some((p: any) => !p.required);
        curl += `  "${apiClient.baseUrl}${endpoint.path}${hasParams ? '?' : ''}"`;
      } else {
        curl += `  "${apiClient.baseUrl}${endpoint.path}" \\\n`;
        if (endpoint.request) {
          curl += `  -d '${endpoint.request}'`;
        }
      }
      
      return curl;
    };
    
    // Example using JavaScript
    const jsExample = () => {
      let js = `// Using fetch API\n`;
      js += `const apiKey = "${demoApiKey.substring(0, 10)}...";\n`;
      js += `const baseUrl = "${apiClient.baseUrl}";\n\n`;
      
      let path = endpoint.path;
      // Replace path parameters with example values
      if (path.includes('{fileId}')) {
        path = path.replace('{fileId}', '123e4567-e89b-12d3-a456-426614174000');
      }
      
      js += `fetch(\`\${baseUrl}${path}\`, {\n`;
      js += `  method: "${endpoint.method}",\n`;
      js += `  headers: {\n`;
      js += `    "Content-Type": "application/json",\n`;
      js += `    "x-api-key": apiKey\n`;
      js += `  }`;
      
      if (endpoint.request && endpoint.method !== 'GET') {
        js += `,\n  body: ${endpoint.request}`;
      }
      
      js += `\n})\n`;
      js += `.then(response => response.json())\n`;
      js += `.then(data => console.log(data))\n`;
      js += `.catch(error => console.error("Error:", error));`;
      
      return js;
    };
    
    // Example using Python
    const pythonExample = () => {
      let python = `# Using requests library\n`;
      python += `import requests\n\n`;
      python += `api_key = "${demoApiKey.substring(0, 10)}..."\n`;
      python += `base_url = "${apiClient.baseUrl}"\n\n`;
      
      let path = endpoint.path;
      // Replace path parameters with example values
      if (path.includes('{fileId}')) {
        path = path.replace('{fileId}', '123e4567-e89b-12d3-a456-426614174000');
      }
      
      python += `headers = {\n`;
      python += `    "Content-Type": "application/json",\n`;
      python += `    "x-api-key": api_key\n`;
      python += `}\n\n`;
      
      if (endpoint.method === 'GET') {
        python += `response = requests.get(f"{base_url}${path}", headers=headers)\n`;
      } else if (endpoint.method === 'POST') {
        if (endpoint.request) {
          python += `data = ${endpoint.request.replace(/"/g, "'")}\n\n`;
          python += `response = requests.post(f"{base_url}${path}", headers=headers, json=data)\n`;
        } else {
          python += `response = requests.post(f"{base_url}${path}", headers=headers)\n`;
        }
      } else if (endpoint.method === 'DELETE') {
        python += `response = requests.delete(f"{base_url}${path}", headers=headers)\n`;
      }
      
      python += `\n# Print response\n`;
      python += `print(response.status_code)\n`;
      python += `print(response.json())`;
      
      return python;
    };
    
    return {
      curl: curlExample(),
      javascript: jsExample(),
      python: pythonExample()
    };
  };
  
  // Render the API endpoint documentation
  const renderEndpointDocs = (endpoint: any) => {
    const isActive = activeEndpoint === endpoint.name;
    const codeExamples = generateCodeExample(endpoint);
    
    return (
      <Card key={endpoint.name} className={`mb-6 ${isActive ? 'border-primary' : ''}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Badge className="mr-2" variant={
                  endpoint.method === 'GET' ? 'default' :
                  endpoint.method === 'POST' ? 'secondary' :
                  endpoint.method === 'DELETE' ? 'destructive' : 'outline'
                }>
                  {endpoint.method}
                </Badge>
                {endpoint.name}
              </CardTitle>
              <CardDescription className="mt-1">
                <code className="bg-muted p-1 rounded text-sm">{endpoint.path}</code>
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveEndpoint(isActive ? null : endpoint.name)}
            >
              {isActive ? 'Hide' : 'Details'}
            </Button>
          </div>
        </CardHeader>
        
        {isActive && (
          <>
            <CardContent className="pb-0">
              <div className="mb-4">
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">{endpoint.description}</p>
              </div>
              
              {endpoint.params && endpoint.params.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Parameters</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Required</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {endpoint.params.map((param: any) => (
                        <TableRow key={param.name}>
                          <TableCell className="font-medium">{param.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{param.type}</Badge>
                          </TableCell>
                          <TableCell>{param.description}</TableCell>
                          <TableCell>
                            {param.required ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <span className="text-muted-foreground">Optional</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              
              {endpoint.note && (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Note</AlertTitle>
                  <AlertDescription>{endpoint.note}</AlertDescription>
                </Alert>
              )}
              
              {endpoint.request && (
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Request Body</h4>
                  <pre className="bg-muted p-4 rounded-md overflow-x-auto">
                    <code>{endpoint.request}</code>
                  </pre>
                </div>
              )}
              
              <div className="mb-4">
                <h4 className="font-medium mb-2">Response</h4>
                <pre className="bg-muted p-4 rounded-md overflow-x-auto">
                  <code>{endpoint.response}</code>
                </pre>
              </div>
              
              <div className="mb-4">
                <h4 className="font-medium mb-2">Code Examples</h4>
                <Tabs defaultValue="curl">
                  <TabsList>
                    <TabsTrigger value="curl">cURL</TabsTrigger>
                    <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                    <TabsTrigger value="python">Python</TabsTrigger>
                  </TabsList>
                  <TabsContent value="curl">
                    <pre className="bg-muted p-4 rounded-md overflow-x-auto">
                      <div className="flex justify-end mb-2">
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(codeExamples.curl)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <code>{codeExamples.curl}</code>
                    </pre>
                  </TabsContent>
                  <TabsContent value="javascript">
                    <pre className="bg-muted p-4 rounded-md overflow-x-auto">
                      <div className="flex justify-end mb-2">
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(codeExamples.javascript)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <code>{codeExamples.javascript}</code>
                    </pre>
                  </TabsContent>
                  <TabsContent value="python">
                    <pre className="bg-muted p-4 rounded-md overflow-x-auto">
                      <div className="flex justify-end mb-2">
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(codeExamples.python)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <code>{codeExamples.python}</code>
                    </pre>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setActiveEndpoint(null)}>
                Close
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    );
  };
  
  // If user is not logged in
  if (!user && !authLoading) {
    return (
      <AppLayout title="API Documentation">
        <Card className="p-6">
          <CardContent className="flex flex-col items-center justify-center space-y-4 pt-6">
            <h2 className="text-xl font-semibold">Authentication Required</h2>
            <p className="text-center text-muted-foreground">
              You need to be logged in to access the API documentation and manage API keys.
            </p>
            <Button className="mt-4" onClick={() => window.location.href = '/login'}>
              Log In
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout title="API Documentation">
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>API Documentation</CardTitle>
            <CardDescription>
              Use our REST API to integrate Cloud Edifix with your applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <h2 className="text-2xl font-bold mb-2">Getting Started</h2>
              <p className="text-muted-foreground mb-4">
                Our REST API provides programmatic access to your Cloud Edifix data. You can use it to manage files,
                folders, sharing permissions, and more.
              </p>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-2">Authentication</h3>
                  <p className="text-muted-foreground">
                    All API requests require authentication using an API key. Include your API key in the 
                    <code className="bg-muted p-1 rounded mx-1">x-api-key</code> header with each request.
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2">Base URL</h3>
                  <div className="flex items-center">
                    <code className="bg-muted p-2 rounded flex-1">{apiClient.baseUrl}</code>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="ml-2"
                      onClick={() => copyToClipboard(apiClient.baseUrl)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2">Rate Limits</h3>
                  <p className="text-muted-foreground">
                    API requests are limited to 100 requests per minute per API key. If you exceed this limit,
                    you'll receive a <code className="bg-muted p-1 rounded">429 Too Many Requests</code> response.
                  </p>
                </div>
              </div>
            </div>
            
            <Separator className="my-6" />
            
            <div>
              <h2 className="text-2xl font-bold mb-4">API Keys</h2>
              
              <div className="mb-4 flex justify-between items-center">
                <p className="text-muted-foreground">
                  Create and manage API keys to access the Cloud Edifix API.
                </p>
                <Button onClick={() => setCreateKeyDialogOpen(true)}>
                  <Key className="h-4 w-4 mr-2" />
                  Create API Key
                </Button>
              </div>
              
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                  <span>Loading API keys...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>API Key</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map(key => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <code className="bg-muted p-1 rounded text-xs truncate max-w-[150px]">
                              {showApiKey[key.id] ? key.key : `${key.key.substring(0, 10)}...`}
                            </code>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => toggleShowApiKey(key.id)}
                            >
                              {showApiKey[key.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => copyToClipboard(key.key, 'API key copied to clipboard')}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {key.permissions.map(permission => (
                              <Badge key={permission} variant="outline">
                                {permission}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(key.created_at)}</TableCell>
                        <TableCell>{key.expires_at ? formatDate(key.expires_at) : 'Never'}</TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <span className={`h-2 w-2 rounded-full mr-2 ${getStatusColor(key.status)}`}></span>
                            <span className="capitalize">{key.status}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {key.status === 'active' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleRevokeKey(key.id)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                          {key.status === 'expired' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            
            <Separator className="my-6" />
            
            <div>
              <h2 className="text-2xl font-bold mb-4">Endpoints</h2>
              
              <div className="mb-4">
                <Input
                  placeholder="Search endpoints..."
                  className="max-w-md"
                />
              </div>
              
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Files</h3>
                <div className="space-y-6">
                  {apiEndpoints
                    .filter(endpoint => endpoint.path.includes('/files'))
                    .map(renderEndpointDocs)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Create API Key Dialog */}
      <Dialog open={createKeyDialogOpen} onOpenChange={setCreateKeyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Create a new API key with specific permissions
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">API Key Name</Label>
              <Input
                id="key-name"
                placeholder="e.g., Production App"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="read-permission"
                    checked={selectedPermissions.includes('read')}
                    onCheckedChange={(checked) => {
                      setSelectedPermissions(prev => 
                        checked 
                          ? [...prev, 'read']
                          : prev.filter(p => p !== 'read')
                      );
                    }}
                  />
                  <Label 
                    htmlFor="read-permission" 
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Read (view files and folders)
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="write-permission"
                    checked={selectedPermissions.includes('write')}
                    onCheckedChange={(checked) => {
                      setSelectedPermissions(prev => 
                        checked 
                          ? [...prev, 'write']
                          : prev.filter(p => p !== 'write')
                      );
                    }}
                  />
                  <Label 
                    htmlFor="write-permission" 
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Write (create and modify files and folders)
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="delete-permission"
                    checked={selectedPermissions.includes('delete')}
                    onCheckedChange={(checked) => {
                      setSelectedPermissions(prev => 
                        checked 
                          ? [...prev, 'delete']
                          : prev.filter(p => p !== 'delete')
                      );
                    }}
                  />
                  <Label 
                    htmlFor="delete-permission" 
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    Delete (remove files and folders)
                  </Label>
                </div>
              </div>
            </div>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Important</AlertTitle>
              <AlertDescription>
                API keys provide full access to your account within the selected permissions.
                Keep your API keys secure and do not share them publicly.
              </AlertDescription>
            </Alert>
          </div>
          
          <DialogFooter className="flex space-x-2 sm:justify-end">
            <Button variant="outline" onClick={() => setCreateKeyDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateKey} 
              disabled={!newKeyName || selectedPermissions.length === 0}
            >
              Create API Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default APIDocs;
