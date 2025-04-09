
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Code, FileJson, Layers, ExternalLink, Database, Globe, Shield } from 'lucide-react';

const DevelopersPage = () => {
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
            <Link to="/api-docs" className="text-muted-foreground hover:text-foreground">API</Link>
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
      
      {/* Hero Section */}
      <section className="container mx-auto py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Developer Hub</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Everything you need to build powerful applications with Cloud Edifix's platform.
            Access tools, documentation, and resources to integrate cloud storage into your apps.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link to="/api-docs">
              <Button size="lg" className="gap-2">
                <FileJson className="h-5 w-5" />
                API Documentation
              </Button>
            </Link>
            <a href="https://github.com/cloud-edifix" target="_blank" rel="noreferrer">
              <Button variant="outline" size="lg" className="gap-2">
                <Code className="h-5 w-5" />
                GitHub
              </Button>
            </a>
          </div>
        </div>
      </section>
      
      {/* Features Grid */}
      <section className="container mx-auto py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>RESTful API</CardTitle>
              <CardDescription>
                Access all Cloud Edifix features through our comprehensive REST API.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Our well-documented RESTful API allows you to integrate Cloud Edifix's powerful 
                cloud storage management capabilities into your own applications.
              </p>
            </CardContent>
            <CardFooter>
              <Link to="/api-docs">
                <Button variant="outline" className="w-full">Explore API Docs</Button>
              </Link>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Code className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>SDK Libraries</CardTitle>
              <CardDescription>
                Official client libraries for popular programming languages.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                We provide SDKs for JavaScript, Python, Ruby, PHP, Go, and Java to make 
                integration with Cloud Edifix even easier for developers.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">View SDKs</Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Layers className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Webhooks</CardTitle>
              <CardDescription>
                Real-time notifications for events in your Cloud Edifix account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Stay in sync with changes to your files and folders with webhooks that notify 
                your application whenever events occur in your Cloud Edifix account.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">Learn About Webhooks</Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Storage API</CardTitle>
              <CardDescription>
                Unified API for accessing and managing files across cloud providers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                A single, consistent API for interacting with files stored across multiple cloud 
                storage providers, eliminating the need to integrate with each provider separately.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">Explore Storage API</Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <ExternalLink className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Embed SDK</CardTitle>
              <CardDescription>
                Embed Cloud Edifix file picker and browser into your applications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Allow your users to select files from their connected cloud storage providers 
                without leaving your application using our embeddable file picker.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">View Embed SDK</Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <div className="bg-primary/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>OAuth Integration</CardTitle>
              <CardDescription>
                Secure authentication for your users with OAuth 2.0.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Implement secure, standards-based authentication for your users with our 
                OAuth 2.0 integration, allowing them to access their Cloud Edifix accounts.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">Learn About OAuth</Button>
            </CardFooter>
          </Card>
        </div>
      </section>
      
      {/* Code Examples */}
      <section className="container mx-auto py-16 bg-muted/30 rounded-lg">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore our code examples to quickly integrate Cloud Edifix into your applications.
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="javascript">
            <TabsList className="grid grid-cols-3 md:grid-cols-5 mb-4">
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
              <TabsTrigger value="ruby">Ruby</TabsTrigger>
              <TabsTrigger value="php">PHP</TabsTrigger>
              <TabsTrigger value="go">Go</TabsTrigger>
            </TabsList>
            
            <div className="bg-black rounded-lg overflow-hidden">
              <TabsContent value="javascript" className="p-0 m-0">
                <pre className="text-green-400 p-4 overflow-x-auto text-sm">
                  <code>{`// Install the package
npm install @cloud-edifix/sdk

// Initialize the client
const CloudEdifix = require('@cloud-edifix/sdk');
const client = new CloudEdifix.Client('YOUR_API_KEY');

// List files
async function listFiles() {
  try {
    const files = await client.files.list({
      limit: 10,
      sort: 'updated_at',
      order: 'desc'
    });
    
    console.log('Files:', files);
  } catch (error) {
    console.error('Error listing files:', error);
  }
}

// Upload a file
async function uploadFile(filePath, folderId = null) {
  try {
    const file = await client.files.upload({
      file: filePath,
      folder_id: folderId
    });
    
    console.log('Uploaded file:', file);
  } catch (error) {
    console.error('Error uploading file:', error);
  }
}

listFiles();`}</code>
                </pre>
              </TabsContent>
              
              <TabsContent value="python" className="p-0 m-0">
                <pre className="text-green-400 p-4 overflow-x-auto text-sm">
                  <code>{`# Install the package
# pip install cloud-edifix

import cloud_edifix

# Initialize the client
client = cloud_edifix.Client('YOUR_API_KEY')

# List files
def list_files():
    try:
        files = client.files.list(
            limit=10,
            sort='updated_at',
            order='desc'
        )
        
        print(f"Files: {files}")
    except Exception as e:
        print(f"Error listing files: {str(e)}")

# Upload a file
def upload_file(file_path, folder_id=None):
    try:
        file = client.files.upload(
            file=file_path,
            folder_id=folder_id
        )
        
        print(f"Uploaded file: {file}")
    except Exception as e:
        print(f"Error uploading file: {str(e)}")

list_files()
`}</code>
                </pre>
              </TabsContent>
              
              <TabsContent value="ruby" className="p-0 m-0">
                <pre className="text-green-400 p-4 overflow-x-auto text-sm">
                  <code>{`# Install the gem
# gem install cloud_edifix

require 'cloud_edifix'

# Initialize the client
client = CloudEdifix::Client.new('YOUR_API_KEY')

# List files
def list_files(client)
  begin
    files = client.files.list(
      limit: 10,
      sort: 'updated_at',
      order: 'desc'
    )
    
    puts "Files: #{files}"
  rescue => e
    puts "Error listing files: #{e.message}"
  end
end

# Upload a file
def upload_file(client, file_path, folder_id = nil)
  begin
    file = client.files.upload(
      file: file_path,
      folder_id: folder_id
    )
    
    puts "Uploaded file: #{file}"
  rescue => e
    puts "Error uploading file: #{e.message}"
  end
end

list_files(client)
`}</code>
                </pre>
              </TabsContent>
              
              <TabsContent value="php" className="p-0 m-0">
                <pre className="text-green-400 p-4 overflow-x-auto text-sm">
                  <code>{`<?php
// Install the package
// composer require cloud-edifix/sdk

require 'vendor/autoload.php';

use CloudEdifix\Client;

// Initialize the client
$client = new Client('YOUR_API_KEY');

// List files
function listFiles($client) {
    try {
        $files = $client->files->list([
            'limit' => 10,
            'sort' => 'updated_at',
            'order' => 'desc'
        ]);
        
        echo "Files: " . json_encode($files) . "\\n";
    } catch (Exception $e) {
        echo "Error listing files: " . $e->getMessage() . "\\n";
    }
}

// Upload a file
function uploadFile($client, $filePath, $folderId = null) {
    try {
        $file = $client->files->upload([
            'file' => $filePath,
            'folder_id' => $folderId
        ]);
        
        echo "Uploaded file: " . json_encode($file) . "\\n";
    } catch (Exception $e) {
        echo "Error uploading file: " . $e->getMessage() . "\\n";
    }
}

listFiles($client);
?>`}</code>
                </pre>
              </TabsContent>
              
              <TabsContent value="go" className="p-0 m-0">
                <pre className="text-green-400 p-4 overflow-x-auto text-sm">
                  <code>{`// Install the package
// go get github.com/cloud-edifix/sdk-go

package main

import (
	"fmt"
	"log"

	cloudedifix "github.com/cloud-edifix/sdk-go"
)

func main() {
	// Initialize the client
	client := cloudedifix.NewClient("YOUR_API_KEY")

	// List files
	listFiles(client)
}

// List files
func listFiles(client *cloudedifix.Client) {
	params := &cloudedifix.ListFilesParams{
		Limit: 10,
		Sort:  "updated_at",
		Order: "desc",
	}

	files, err := client.Files.List(params)
	if err != nil {
		log.Fatalf("Error listing files: %v", err)
	}

	fmt.Printf("Files: %+v\\n", files)
}

// Upload a file
func uploadFile(client *cloudedifix.Client, filePath string, folderId *string) {
	params := &cloudedifix.UploadFileParams{
		File:     filePath,
		FolderID: folderId,
	}

	file, err := client.Files.Upload(params)
	if err != nil {
		log.Fatalf("Error uploading file: %v", err)
	}

	fmt.Printf("Uploaded file: %+v\\n", file)
}`}</code>
                </pre>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </section>
      
      {/* Resources */}
      <section className="container mx-auto py-16">
        <h2 className="text-3xl font-bold mb-12 text-center">Developer Resources</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileJson className="h-5 w-5 mr-2" />
                API Reference
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Comprehensive documentation of our API endpoints, parameters, and responses.
              </p>
            </CardContent>
            <CardFooter>
              <Link to="/api-docs" className="w-full">
                <Button variant="outline" className="w-full">View Reference</Button>
              </Link>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Code className="h-5 w-5 mr-2" />
                Sample Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Example applications demonstrating integration with Cloud Edifix.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">Browse Examples</Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Layers className="h-5 w-5 mr-2" />
                API Changelog
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Stay updated with the latest API changes, features, and improvements.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">View Changelog</Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ExternalLink className="h-5 w-5 mr-2" />
                Community Forum
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Connect with other developers integrating with Cloud Edifix.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">Join Forum</Button>
            </CardFooter>
          </Card>
        </div>
      </section>
      
      {/* CTA */}
      <section className="container mx-auto py-16 text-center bg-muted/30 rounded-lg mb-16">
        <h2 className="text-3xl font-bold mb-4">Ready to Build with Cloud Edifix?</h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Create a free account to get started, or contact our team for enterprise solutions.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link to="/auth?signup=true">
            <Button size="lg">Sign Up for Free</Button>
          </Link>
          <Link to="/contact">
            <Button variant="outline" size="lg">Contact Sales</Button>
          </Link>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="bg-background border-t py-12">
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

export default DevelopersPage;
