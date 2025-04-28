
import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Copy, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const APIDocs = () => {
  const { toast } = useToast();
  const [copiedEndpoint, setCopiedEndpoint] = React.useState<string | null>(null);

  const copyCode = (code: string, endpoint: string) => {
    navigator.clipboard.writeText(code);
    setCopiedEndpoint(endpoint);
    toast({
      title: "Copied to clipboard",
      description: "You can now paste the code in your application"
    });
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  const endpoints = [
    {
      id: "list-files",
      name: "List Files",
      description: "Get a list of files in the root directory or a specific folder",
      method: "GET",
      endpoint: "/api/v1/files",
      params: [
        { name: "folder", type: "string", description: "Optional folder ID to list files from" },
        { name: "sort", type: "string", description: "Sort by: name, date, size" },
        { name: "direction", type: "string", description: "Sort direction: asc, desc" }
      ],
      response: {
        files: [
          {
            id: "uuid",
            filename: "example.pdf",
            path: "/example.pdf",
            size: 123456,
            mime_type: "application/pdf",
            is_folder: false,
            created_at: "2023-01-01T00:00:00Z",
            updated_at: "2023-01-01T00:00:00Z"
          }
        ]
      },
      code: `const response = await fetch('https://api.cloudunity.com/api/v1/files', {
  headers: {
    'x-api-key': 'YOUR_API_KEY'
  }
});
const data = await response.json();
console.log(data.files);`
    },
    {
      id: "get-file",
      name: "Get File Metadata",
      description: "Get metadata for a specific file or folder",
      method: "GET",
      endpoint: "/api/v1/files/:id",
      response: {
        file: {
          id: "uuid",
          filename: "example.pdf",
          path: "/example.pdf",
          size: 123456,
          mime_type: "application/pdf",
          is_folder: false,
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-01-01T00:00:00Z"
        }
      },
      code: `const fileId = "file-uuid";
const response = await fetch(\`https://api.cloudunity.com/api/v1/files/\${fileId}\`, {
  headers: {
    'x-api-key': 'YOUR_API_KEY'
  }
});
const data = await response.json();
console.log(data.file);`
    },
    {
      id: "download-file",
      name: "Download File",
      description: "Download a file's contents",
      method: "GET",
      endpoint: "/api/v1/files/:id/download",
      response: "Binary file content with appropriate content-type header",
      code: `const fileId = "file-uuid";
const response = await fetch(\`https://api.cloudunity.com/api/v1/files/\${fileId}/download\`, {
  headers: {
    'x-api-key': 'YOUR_API_KEY'
  }
});

// For binary files
const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'filename'; // Get from Content-Disposition or metadata
a.click();`
    },
    {
      id: "create-folder",
      name: "Create Folder",
      description: "Create a new folder",
      method: "POST",
      endpoint: "/api/v1/files/folder",
      body: {
        folderName: "New Folder",
        parentFolderId: "optional-parent-folder-id"
      },
      response: {
        folder: {
          id: "uuid",
          filename: "New Folder",
          path: "/New Folder",
          size: 0,
          is_folder: true,
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-01-01T00:00:00Z"
        }
      },
      code: `const response = await fetch('https://api.cloudunity.com/api/v1/files/folder', {
  method: 'POST',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    folderName: 'My New Folder',
    parentFolderId: 'optional-parent-uuid' // Optional
  })
});
const data = await response.json();
console.log(data.folder);`
    },
    {
      id: "upload-file",
      name: "Upload File",
      description: "Upload a new file",
      method: "POST",
      endpoint: "/api/v1/files/upload",
      body: "FormData with file and optional parentFolderId",
      response: {
        file: {
          id: "uuid",
          filename: "uploaded.pdf",
          path: "/uploaded.pdf",
          size: 123456,
          mime_type: "application/pdf",
          is_folder: false,
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-01-01T00:00:00Z"
        }
      },
      code: `const formData = new FormData();
formData.append('file', fileObject);
formData.append('parentFolderId', 'optional-parent-uuid'); // Optional

const response = await fetch('https://api.cloudunity.com/api/v1/files/upload', {
  method: 'POST',
  headers: {
    'x-api-key': 'YOUR_API_KEY'
    // Do not set Content-Type here, it will be set automatically with boundary
  },
  body: formData
});
const data = await response.json();
console.log(data.file);`
    },
    {
      id: "delete-file",
      name: "Delete File or Folder",
      description: "Delete a file or folder (recursive deletion for folders)",
      method: "DELETE",
      endpoint: "/api/v1/files/:id",
      response: {
        success: true
      },
      code: `const fileId = "file-or-folder-uuid";
const response = await fetch(\`https://api.cloudunity.com/api/v1/files/\${fileId}\`, {
  method: 'DELETE',
  headers: {
    'x-api-key': 'YOUR_API_KEY'
  }
});
const data = await response.json();
console.log(data.success);`
    },
    {
      id: "share-file",
      name: "Share File",
      description: "Share a file with another user by email",
      method: "POST",
      endpoint: "/api/v1/files/:id/share",
      body: {
        email: "recipient@example.com",
        permissionLevel: "view", // view, edit, admin
        expiresAt: "optional-iso-date"
      },
      response: {
        share: {
          id: "uuid",
          file_id: "uuid",
          owner_id: "uuid",
          shared_with_email: "recipient@example.com",
          permission_level: "view",
          created_at: "2023-01-01T00:00:00Z",
          expires_at: null
        }
      },
      code: `const fileId = "file-uuid";
const response = await fetch(\`https://api.cloudunity.com/api/v1/files/\${fileId}/share\`, {
  method: 'POST',
  headers: {
    'x-api-key': 'YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'recipient@example.com',
    permissionLevel: 'view', // 'view', 'edit', or 'admin'
    expiresAt: '2023-12-31T23:59:59Z' // Optional
  })
});
const data = await response.json();
console.log(data.share);`
    }
  ];

  return (
    <AppLayout title="API Documentation">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>API Reference</CardTitle>
            <CardDescription>
              Integrate CloudUnity into your applications with our RESTful API
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Authentication</h3>
              <p>
                All API requests require an API key passed via the <code>x-api-key</code> header.
                You can create and manage API keys in the API Settings section.
              </p>
              
              <div className="bg-muted rounded-md p-4">
                <h4 className="text-sm font-medium mb-2">Example Request</h4>
                <pre className="text-sm overflow-auto p-2 bg-background rounded border">
                  {`curl -X GET "https://api.cloudunity.com/api/v1/files" \\
  -H "x-api-key: YOUR_API_KEY"`}
                </pre>
              </div>
              
              <Separator />
              
              <h3 className="text-lg font-medium">Base URL</h3>
              <p><code>https://api.cloudunity.com</code></p>
              
              <Separator />
              
              <h3 className="text-lg font-medium">Response Format</h3>
              <p>
                All responses are returned as JSON objects, except for file downloads which return binary data.
              </p>
              
              <Separator />
              
              <h3 className="text-lg font-medium">Error Handling</h3>
              <p>
                Error responses include a JSON object with an <code>error</code> field containing a message.
              </p>
              
              <div className="bg-muted rounded-md p-4">
                <pre className="text-sm overflow-auto p-2 bg-background rounded border">
                  {`{
  "error": "Insufficient permissions"
}`}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="list-files" className="w-full">
          <TabsList className="grid grid-cols-2 lg:grid-cols-4 mb-4">
            <TabsTrigger value="list-files">List Files</TabsTrigger>
            <TabsTrigger value="get-file">Get File</TabsTrigger>
            <TabsTrigger value="download-file">Download</TabsTrigger>
            <TabsTrigger value="create-folder">Create Folder</TabsTrigger>
            <TabsTrigger value="upload-file">Upload</TabsTrigger>
            <TabsTrigger value="delete-file">Delete</TabsTrigger>
            <TabsTrigger value="share-file">Share</TabsTrigger>
          </TabsList>

          {endpoints.map((endpoint) => (
            <TabsContent key={endpoint.id} value={endpoint.id} className="mt-0">
              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle>{endpoint.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {endpoint.description}
                      </CardDescription>
                    </div>
                    <Badge 
                      className={`
                        md:ml-4 mt-2 md:mt-0 w-fit
                        ${endpoint.method === 'GET' ? 'bg-green-500' : 
                          endpoint.method === 'POST' ? 'bg-blue-500' : 
                          endpoint.method === 'DELETE' ? 'bg-red-500' : 'bg-amber-500'}
                      `}
                    >
                      {endpoint.method}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Endpoint</h4>
                      <code className="bg-muted px-2 py-1 rounded text-sm">
                        {endpoint.endpoint}
                      </code>
                    </div>
                    
                    {endpoint.params && endpoint.params.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Query Parameters</h4>
                        <div className="overflow-auto">
                          <table className="min-w-full divide-y divide-border">
                            <thead>
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {endpoint.params.map((param, i) => (
                                <tr key={i}>
                                  <td className="px-4 py-2 text-sm">{param.name}</td>
                                  <td className="px-4 py-2 text-sm"><code>{param.type}</code></td>
                                  <td className="px-4 py-2 text-sm">{param.description}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    
                    {endpoint.body && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Request Body</h4>
                        {typeof endpoint.body === 'string' ? (
                          <p className="text-sm">{endpoint.body}</p>
                        ) : (
                          <pre className="bg-muted p-4 rounded-md text-sm overflow-auto">
                            {JSON.stringify(endpoint.body, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                    
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Response</h4>
                      {typeof endpoint.response === 'string' ? (
                        <p className="text-sm">{endpoint.response}</p>
                      ) : (
                        <pre className="bg-muted p-4 rounded-md text-sm overflow-auto">
                          {JSON.stringify(endpoint.response, null, 2)}
                        </pre>
                      )}
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Code Example</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyCode(endpoint.code, endpoint.id)}
                          className="h-8"
                        >
                          {copiedEndpoint === endpoint.id ? (
                            <CheckCheck className="h-4 w-4 mr-1" />
                          ) : (
                            <Copy className="h-4 w-4 mr-1" />
                          )}
                          {copiedEndpoint === endpoint.id ? 'Copied!' : 'Copy'}
                        </Button>
                      </div>
                      <pre className="bg-muted p-4 rounded-md text-sm overflow-auto">
                        {endpoint.code}
                      </pre>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col items-start border-t px-6 py-4">
                  <h4 className="text-sm font-semibold mb-2">Required Permissions</h4>
                  <div className="flex gap-2">
                    {endpoint.method === 'GET' && (
                      <Badge variant="outline">read</Badge>
                    )}
                    {['POST', 'PUT', 'PATCH'].includes(endpoint.method) && (
                      <Badge variant="outline">write</Badge>
                    )}
                    {endpoint.method === 'DELETE' && (
                      <Badge variant="outline">delete</Badge>
                    )}
                  </div>
                </CardFooter>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
        
        <Card>
          <CardHeader>
            <CardTitle>Rate Limiting</CardTitle>
            <CardDescription>
              Understanding API usage limits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              API requests are limited to help ensure high availability for all users.
              Current limits:
            </p>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-1">Standard API Key</h3>
                  <p className="text-2xl font-bold mb-1">100</p>
                  <p className="text-sm text-muted-foreground">requests per minute</p>
                </div>
                
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-1">Enhanced API Key</h3>
                  <p className="text-2xl font-bold mb-1">1,000</p>
                  <p className="text-sm text-muted-foreground">requests per minute</p>
                </div>
                
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-1">Upload Limit</h3>
                  <p className="text-2xl font-bold mb-1">100 MB</p>
                  <p className="text-sm text-muted-foreground">per file upload</p>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Rate limits are applied per API key. Exceeding these limits will result in
                HTTP 429 (Too Many Requests) responses.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default APIDocs;
