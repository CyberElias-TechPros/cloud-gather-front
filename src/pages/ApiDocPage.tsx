
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Code, FileJson, ExternalLink, AlertCircle } from 'lucide-react';

const ApiDocPage = () => {
  const endpoints = [
    {
      method: 'GET',
      path: '/api/v1/files',
      description: 'List all files',
      parameters: [
        { name: 'folder_id', type: 'string', required: false, description: 'Filter by parent folder ID' },
        { name: 'sort', type: 'string', required: false, description: 'Sort by field (name, date, size)' },
        { name: 'order', type: 'string', required: false, description: 'Sort order (asc, desc)' },
        { name: 'limit', type: 'number', required: false, description: 'Limit the number of results' },
        { name: 'offset', type: 'number', required: false, description: 'Offset for pagination' }
      ],
      responses: [
        { code: '200', description: 'List of files' },
        { code: '400', description: 'Bad request' },
        { code: '401', description: 'Unauthorized' }
      ],
      example: `curl -X GET "https://api.cloudedifix.com/v1/files?limit=10" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
      response: `{
  "total": 150,
  "files": [
    {
      "id": "f1d2e3a4-5b6c-7d8e-9f0a-1b2c3d4e5f6a",
      "filename": "document.pdf",
      "size": 1024000,
      "mime_type": "application/pdf",
      "path": "/documents/document.pdf",
      "is_folder": false,
      "created_at": "2023-04-01T12:00:00Z",
      "updated_at": "2023-04-01T12:00:00Z"
    },
    ...
  ]
}`
    },
    {
      method: 'POST',
      path: '/api/v1/files/upload',
      description: 'Upload a file',
      parameters: [
        { name: 'file', type: 'binary', required: true, description: 'The file to upload' },
        { name: 'folder_id', type: 'string', required: false, description: 'Parent folder ID' },
        { name: 'provider_id', type: 'string', required: false, description: 'Storage provider ID' }
      ],
      responses: [
        { code: '200', description: 'File uploaded successfully' },
        { code: '400', description: 'Bad request' },
        { code: '401', description: 'Unauthorized' },
        { code: '413', description: 'File too large' }
      ],
      example: `curl -X POST "https://api.cloudedifix.com/v1/files/upload" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@/path/to/local/file.pdf" \\
  -F "folder_id=f1d2e3a4-5b6c"`,
      response: `{
  "id": "a1b2c3d4-e5f6-7g8h-9i0j-1k2l3m4n5o6p",
  "filename": "file.pdf",
  "size": 1024000,
  "mime_type": "application/pdf",
  "path": "/documents/file.pdf",
  "is_folder": false,
  "created_at": "2023-04-01T12:00:00Z",
  "updated_at": "2023-04-01T12:00:00Z"
}`
    },
    {
      method: 'GET',
      path: '/api/v1/files/{id}',
      description: 'Get file details',
      parameters: [
        { name: 'id', type: 'string', required: true, description: 'File ID' }
      ],
      responses: [
        { code: '200', description: 'File details' },
        { code: '404', description: 'File not found' },
        { code: '401', description: 'Unauthorized' }
      ],
      example: `curl -X GET "https://api.cloudedifix.com/v1/files/a1b2c3d4-e5f6-7g8h-9i0j-1k2l3m4n5o6p" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
      response: `{
  "id": "a1b2c3d4-e5f6-7g8h-9i0j-1k2l3m4n5o6p",
  "filename": "file.pdf",
  "size": 1024000,
  "mime_type": "application/pdf",
  "path": "/documents/file.pdf",
  "is_folder": false,
  "created_at": "2023-04-01T12:00:00Z",
  "updated_at": "2023-04-01T12:00:00Z",
  "provider_id": "p1q2r3s4-t5u6-v7w8-x9y0-z1a2b3c4d5e6",
  "is_shared": false,
  "is_starred": false
}`
    },
    {
      method: 'DELETE',
      path: '/api/v1/files/{id}',
      description: 'Delete a file',
      parameters: [
        { name: 'id', type: 'string', required: true, description: 'File ID' }
      ],
      responses: [
        { code: '200', description: 'File deleted successfully' },
        { code: '404', description: 'File not found' },
        { code: '401', description: 'Unauthorized' }
      ],
      example: `curl -X DELETE "https://api.cloudedifix.com/v1/files/a1b2c3d4-e5f6-7g8h-9i0j-1k2l3m4n5o6p" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
      response: `{
  "success": true,
  "message": "File deleted successfully"
}`
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header/Navigation */}
      <header className="container mx-auto py-6">
        <nav className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="h-6 w-6 text-primary"
            >
              <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
            </svg>
            <Link to="/" className="text-xl font-bold">Cloud Edifix</Link>
          </div>
          
          <div className="hidden md:flex space-x-8">
            <Link to="/" className="text-muted-foreground hover:text-foreground">Home</Link>
            <Link to="/features" className="text-muted-foreground hover:text-foreground">Features</Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link>
            <Link to="/about" className="text-muted-foreground hover:text-foreground">About</Link>
            <Link to="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link>
            <Link to="/blog" className="text-muted-foreground hover:text-foreground">Blog</Link>
            <Link to="/api-docs" className="text-foreground font-medium">API</Link>
          </div>
          
          <div className="flex space-x-4">
            <Link to="/auth">
              <Button variant="outline">Login</Button>
            </Link>
            <Link to="/auth?signup=true">
              <Button>Sign Up</Button>
            </Link>
          </div>
        </nav>
      </header>
      
      {/* Main Content */}
      <div className="container mx-auto py-12">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <aside className="w-full md:w-64 shrink-0">
            <div className="sticky top-8">
              <div className="space-y-6">
                <div>
                  <h3 className="mb-2 text-lg font-semibold">API Documentation</h3>
                  <ul className="space-y-2">
                    <li><a href="#introduction" className="text-primary hover:underline">Introduction</a></li>
                    <li><a href="#authentication" className="text-primary hover:underline">Authentication</a></li>
                    <li><a href="#rate-limits" className="text-primary hover:underline">Rate Limits</a></li>
                    <li><a href="#endpoints" className="text-primary hover:underline">Endpoints</a></li>
                    <li><a href="#errors" className="text-primary hover:underline">Error Handling</a></li>
                    <li><a href="#webhooks" className="text-primary hover:underline">Webhooks</a></li>
                    <li><a href="#sdks" className="text-primary hover:underline">SDKs & Libraries</a></li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="mb-2 text-lg font-semibold">Resources</h3>
                  <ul className="space-y-2">
                    <li>
                      <a 
                        href="#" 
                        className="text-primary hover:underline flex items-center"
                      >
                        <FileJson className="h-4 w-4 mr-2" />
                        API Reference
                      </a>
                    </li>
                    <li>
                      <a 
                        href="#" 
                        className="text-primary hover:underline flex items-center"
                      >
                        <Code className="h-4 w-4 mr-2" />
                        Code Examples
                      </a>
                    </li>
                  </ul>
                </div>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Need help?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Can't find what you're looking for?
                    </p>
                    <Link to="/contact">
                      <Button variant="outline" className="w-full">
                        Contact Support
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </div>
          </aside>
          
          {/* Main Content */}
          <main className="flex-1 max-w-4xl">
            <div className="prose dark:prose-invert max-w-none">
              <h1 id="introduction" className="scroll-m-20">API Documentation</h1>
              <p className="lead">
                The Cloud Edifix API allows you to programmatically manage files, access cloud storage providers, 
                and integrate our platform's capabilities into your own applications.
              </p>
              
              <Alert className="my-8">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Note</AlertTitle>
                <AlertDescription>
                  API access requires a Pro or Business subscription plan. The Free plan does not include API access.
                </AlertDescription>
              </Alert>
              
              <h2 id="authentication" className="scroll-m-20 mt-12">Authentication</h2>
              <p>
                All API requests must be authenticated using an API key. You can generate API keys in the 
                <Link to="/settings" className="text-primary"> API section of your account settings</Link>.
              </p>
              
              <div className="bg-muted p-4 rounded-md my-4">
                <p className="font-mono text-sm mb-2">Example:</p>
                <pre className="font-mono text-sm">
                  <code>
                    curl -H "Authorization: Bearer YOUR_API_KEY" https://api.cloudedifix.com/v1/files
                  </code>
                </pre>
              </div>
              
              <h2 id="rate-limits" className="scroll-m-20 mt-12">Rate Limits</h2>
              <p>
                API requests are subject to rate limiting based on your subscription plan:
              </p>
              
              <ul className="list-disc pl-6 space-y-2 mt-4">
                <li>Pro: 1,000 requests per day</li>
                <li>Business: Unlimited requests</li>
              </ul>
              
              <p className="mt-4">
                Rate limits are reset daily at midnight UTC. If you exceed your rate limit, 
                requests will be rejected with a 429 Too Many Requests status code.
              </p>
              
              <h2 id="endpoints" className="scroll-m-20 mt-12">Endpoints</h2>
              <p>
                The base URL for all API requests is <code>https://api.cloudedifix.com/v1</code>.
              </p>
              
              <Tabs defaultValue="files" className="mt-6">
                <TabsList>
                  <TabsTrigger value="files">Files</TabsTrigger>
                  <TabsTrigger value="providers">Providers</TabsTrigger>
                  <TabsTrigger value="sharing">Sharing</TabsTrigger>
                </TabsList>
                
                <TabsContent value="files">
                  <div className="space-y-8 mt-6">
                    {endpoints.map((endpoint, index) => (
                      <Card key={index}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <Badge variant={endpoint.method === 'GET' ? 'outline' : endpoint.method === 'POST' ? 'default' : 'destructive'} className="mr-2">
                                {endpoint.method}
                              </Badge>
                              <span className="font-mono">{endpoint.path}</span>
                            </div>
                          </div>
                          <CardDescription className="mt-2">{endpoint.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Accordion type="single" collapsible>
                            <AccordionItem value="parameters">
                              <AccordionTrigger>Parameters</AccordionTrigger>
                              <AccordionContent>
                                <div className="border rounded-md">
                                  <table className="w-full">
                                    <thead>
                                      <tr className="border-b">
                                        <th className="p-2 text-left font-medium">Name</th>
                                        <th className="p-2 text-left font-medium">Type</th>
                                        <th className="p-2 text-left font-medium">Required</th>
                                        <th className="p-2 text-left font-medium">Description</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {endpoint.parameters.map((param, i) => (
                                        <tr key={i} className="border-b">
                                          <td className="p-2 font-mono text-sm">{param.name}</td>
                                          <td className="p-2 text-sm">{param.type}</td>
                                          <td className="p-2 text-sm">{param.required ? 'Yes' : 'No'}</td>
                                          <td className="p-2 text-sm">{param.description}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                            
                            <AccordionItem value="responses">
                              <AccordionTrigger>Responses</AccordionTrigger>
                              <AccordionContent>
                                <div className="border rounded-md">
                                  <table className="w-full">
                                    <thead>
                                      <tr className="border-b">
                                        <th className="p-2 text-left font-medium">Code</th>
                                        <th className="p-2 text-left font-medium">Description</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {endpoint.responses.map((response, i) => (
                                        <tr key={i} className="border-b">
                                          <td className="p-2 font-mono text-sm">{response.code}</td>
                                          <td className="p-2 text-sm">{response.description}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                            
                            <AccordionItem value="example">
                              <AccordionTrigger>Example Request</AccordionTrigger>
                              <AccordionContent>
                                <div className="bg-muted p-4 rounded-md">
                                  <pre className="font-mono text-sm whitespace-pre-wrap">
                                    {endpoint.example}
                                  </pre>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                            
                            <AccordionItem value="response-example">
                              <AccordionTrigger>Example Response</AccordionTrigger>
                              <AccordionContent>
                                <div className="bg-muted p-4 rounded-md">
                                  <pre className="font-mono text-sm whitespace-pre-wrap">
                                    {endpoint.response}
                                  </pre>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
                
                <TabsContent value="providers">
                  <div className="pt-6">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Provider API documentation is being updated. Check back soon for complete documentation.
                      </AlertDescription>
                    </Alert>
                  </div>
                </TabsContent>
                
                <TabsContent value="sharing">
                  <div className="pt-6">
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Sharing API documentation is being updated. Check back soon for complete documentation.
                      </AlertDescription>
                    </Alert>
                  </div>
                </TabsContent>
              </Tabs>
              
              <h2 id="errors" className="scroll-m-20 mt-12">Error Handling</h2>
              <p>
                The API uses conventional HTTP response codes to indicate success or failure of a request.
                In general, codes in the 2xx range indicate success, codes in the 4xx range indicate an error
                with the provided information, and codes in the 5xx range indicate an error with our servers.
              </p>
              
              <div className="border rounded-md mt-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left font-medium">Error Code</th>
                      <th className="p-2 text-left font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-2 font-mono text-sm">400</td>
                      <td className="p-2 text-sm">Bad Request - The request was malformed</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 font-mono text-sm">401</td>
                      <td className="p-2 text-sm">Unauthorized - Invalid API key</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 font-mono text-sm">403</td>
                      <td className="p-2 text-sm">Forbidden - You don't have permission to access this resource</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 font-mono text-sm">404</td>
                      <td className="p-2 text-sm">Not Found - The requested resource does not exist</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 font-mono text-sm">429</td>
                      <td className="p-2 text-sm">Too Many Requests - You've exceeded your rate limit</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono text-sm">500</td>
                      <td className="p-2 text-sm">Internal Server Error - Something went wrong on our end</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div className="bg-muted p-4 rounded-md mt-4">
                <p className="font-mono text-sm mb-2">Example Error Response:</p>
                <pre className="font-mono text-sm">
                  <code>
{`{
  "error": {
    "code": "unauthorized",
    "message": "Invalid API key provided",
    "status": 401
  }
}`}
                  </code>
                </pre>
              </div>
              
              <h2 id="webhooks" className="scroll-m-20 mt-12">Webhooks</h2>
              <p>
                Webhooks allow you to receive real-time notifications when events happen in your Cloud Edifix account.
                You can configure webhooks in the <Link to="/settings" className="text-primary">API section of your account settings</Link>.
              </p>
              
              <div className="border rounded-md mt-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left font-medium">Event Type</th>
                      <th className="p-2 text-left font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-2 font-mono text-sm">file.created</td>
                      <td className="p-2 text-sm">A file was created</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 font-mono text-sm">file.updated</td>
                      <td className="p-2 text-sm">A file was updated</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 font-mono text-sm">file.deleted</td>
                      <td className="p-2 text-sm">A file was deleted</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono text-sm">file.shared</td>
                      <td className="p-2 text-sm">A file was shared</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <h2 id="sdks" className="scroll-m-20 mt-12">SDKs & Libraries</h2>
              <p>
                We provide official client libraries for several programming languages to 
                make integrating with the Cloud Edifix API even easier.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">JavaScript</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <a href="#" className="text-primary flex items-center hover:underline">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      GitHub Repository
                    </a>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Python</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <a href="#" className="text-primary flex items-center hover:underline">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      GitHub Repository
                    </a>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Ruby</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <a href="#" className="text-primary flex items-center hover:underline">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      GitHub Repository
                    </a>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">PHP</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <a href="#" className="text-primary flex items-center hover:underline">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      GitHub Repository
                    </a>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Go</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <a href="#" className="text-primary flex items-center hover:underline">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      GitHub Repository
                    </a>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Java</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <a href="#" className="text-primary flex items-center hover:underline">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      GitHub Repository
                    </a>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="bg-background border-t py-12 mt-12">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="h-6 w-6 text-primary"
                >
                  <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
                </svg>
                <span className="text-xl font-bold">Cloud Edifix</span>
              </div>
              <p className="text-muted-foreground">
                Unify your cloud storage experience across all providers.
              </p>
            </div>
            
            <div>
              <h3 className="font-bold mb-4">Product</h3>
              <ul className="space-y-2">
                <li><Link to="/features" className="text-muted-foreground hover:text-foreground">Features</Link></li>
                <li><Link to="/providers" className="text-muted-foreground hover:text-foreground">Providers</Link></li>
                <li><Link to="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link></li>
                <li><Link to="/api-docs" className="text-muted-foreground hover:text-foreground">API</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><Link to="/about" className="text-muted-foreground hover:text-foreground">About</Link></li>
                <li><Link to="/blog" className="text-muted-foreground hover:text-foreground">Blog</Link></li>
                <li><Link to="/developers" className="text-muted-foreground hover:text-foreground">Developers</Link></li>
                <li><Link to="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li><Link to="/privacy" className="text-muted-foreground hover:text-foreground">Privacy</Link></li>
                <li><Link to="/terms" className="text-muted-foreground hover:text-foreground">Terms</Link></li>
                <li><Link to="/security" className="text-muted-foreground hover:text-foreground">Security</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-muted-foreground">© 2023 Cloud Edifix. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ApiDocPage;
