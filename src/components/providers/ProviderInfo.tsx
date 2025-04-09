
import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StorageProviderInfo } from '@/types/file';

export const providersList: StorageProviderInfo[] = [
  {
    id: 'google-drive',
    name: 'Google Drive',
    type: 'google-drive',
    freeStorageSize: '15 GB',
    description: 'Google Drive offers 15 GB of free storage shared across Google services. It provides robust collaboration features and integrates well with Google Workspace.',
    icon: '/images/google-drive-logo.png'
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    type: 'dropbox',
    freeStorageSize: '2 GB',
    description: 'Dropbox Basic offers 2 GB of free storage with simple file sharing and synchronization across devices.',
    icon: '/images/dropbox-logo.png'
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    type: 'onedrive',
    freeStorageSize: '5 GB',
    description: 'Microsoft OneDrive provides 5 GB of free storage with seamless integration with Microsoft 365 applications.',
    icon: '/images/onedrive-logo.png'
  },
  {
    id: 'box',
    name: 'Box',
    type: 'box',
    freeStorageSize: '10 GB',
    description: 'Box offers 10 GB of free storage with strong security features and enterprise-grade collaboration tools.',
    icon: '/images/box-logo.png'
  },
  {
    id: 'mega',
    name: 'MEGA',
    type: 'mega',
    freeStorageSize: '20 GB',
    description: 'MEGA provides 20 GB of free storage with end-to-end encryption and focus on privacy.',
    icon: '/images/mega-logo.png'
  },
  {
    id: 'pcloud',
    name: 'pCloud',
    type: 'pcloud',
    freeStorageSize: '10 GB',
    description: 'pCloud offers 10 GB of free storage with lifetime subscription options and client-side encryption.',
    icon: '/images/pcloud-logo.png'
  },
  {
    id: 'yandex-disk',
    name: 'Yandex Disk',
    type: 'yandex-disk',
    freeStorageSize: '10 GB',
    description: 'Yandex Disk provides 10 GB of free storage with automatic photo uploads and public file sharing.',
    icon: '/images/yandex-disk-logo.png'
  },
  {
    id: 'icedrive',
    name: 'Icedrive',
    type: 'icedrive',
    freeStorageSize: '10 GB',
    description: 'Icedrive offers 10 GB of free cloud storage with a focus on security and a clean interface.',
    icon: '/images/icedrive-logo.png'
  },
  {
    id: 'amazon-s3',
    name: 'Amazon S3',
    type: 'amazon-s3',
    freeStorageSize: '5 GB (First year)',
    description: 'Amazon S3 provides 5 GB of storage free for the first 12 months with AWS Free Tier, offering enterprise-grade durability.',
    icon: '/images/amazon-s3-logo.png'
  },
  {
    id: 'backblaze',
    name: 'Backblaze B2',
    type: 'backblaze',
    freeStorageSize: '10 GB',
    description: 'Backblaze B2 offers 10 GB of free storage with no expiration and fair pricing for additional storage.',
    icon: '/images/backblaze-logo.png'
  },
  {
    id: 'sync',
    name: 'Sync.com',
    type: 'sync',
    freeStorageSize: '5 GB',
    description: 'Sync.com offers 5 GB of free storage with zero-knowledge encryption and emphasis on privacy.',
    icon: '/images/sync-logo.png'
  }
];

export const ProviderIntegrationGuide: React.FC = () => {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>How to Integrate Cloud Storage Providers</CardTitle>
        <CardDescription>
          Step-by-step guides for setting up OAuth credentials for each supported cloud provider
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="google-drive">
            <AccordionTrigger>Google Drive Setup Guide</AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-primary hover:underline">Google Cloud Console</a></li>
                <li>Create a new project or select an existing one</li>
                <li>Navigate to "APIs & Services" > "Library" and enable the Google Drive API</li>
                <li>Go to "APIs & Services" > "Credentials" and create an OAuth client ID</li>
                <li>Select "Web application" as the application type</li>
                <li>Add authorized JavaScript origins (your app's domain)</li>
                <li>Add authorized redirect URIs (your app's callback URL: https://your-domain.com/auth/callback/google-drive)</li>
                <li>Copy the Client ID and Client Secret</li>
                <li>Add these credentials to your Supabase Edge Function environment variables:
                  <ul className="list-disc pl-5 mt-2">
                    <li>GOOGLE_CLIENT_ID</li>
                    <li>GOOGLE_CLIENT_SECRET</li>
                    <li>GOOGLE_REDIRECT_URI</li>
                  </ul>
                </li>
              </ol>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="dropbox">
            <AccordionTrigger>Dropbox Setup Guide</AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Go to the <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noreferrer" className="text-primary hover:underline">Dropbox App Console</a></li>
                <li>Click "Create app"</li>
                <li>Select "Scoped access" API</li>
                <li>Choose "Full Dropbox" access type</li>
                <li>Name your app and click "Create app"</li>
                <li>Under "OAuth 2", add your redirect URI (https://your-domain.com/auth/callback/dropbox)</li>
                <li>Note your App key (client ID) and App secret (client secret)</li>
                <li>Add these credentials to your Supabase Edge Function environment variables:
                  <ul className="list-disc pl-5 mt-2">
                    <li>DROPBOX_CLIENT_ID</li>
                    <li>DROPBOX_CLIENT_SECRET</li>
                    <li>DROPBOX_REDIRECT_URI</li>
                  </ul>
                </li>
              </ol>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="onedrive">
            <AccordionTrigger>OneDrive Setup Guide</AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Go to the <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noreferrer" className="text-primary hover:underline">Microsoft Azure Portal</a></li>
                <li>Register a new application</li>
                <li>Add Web platform under Authentication and set redirect URI (https://your-domain.com/auth/callback/onedrive)</li>
                <li>Under API permissions, add Microsoft Graph permissions: Files.Read, Files.Read.All, User.Read</li>
                <li>Note your Application (client) ID and create a new client secret</li>
                <li>Add these credentials to your Supabase Edge Function environment variables:
                  <ul className="list-disc pl-5 mt-2">
                    <li>MICROSOFT_CLIENT_ID</li>
                    <li>MICROSOFT_CLIENT_SECRET</li>
                    <li>MICROSOFT_REDIRECT_URI</li>
                  </ul>
                </li>
              </ol>
            </AccordionContent>
          </AccordionItem>
          
          {/* Additional provider setup guides */}
          <AccordionItem value="box">
            <AccordionTrigger>Box Setup Guide</AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Go to the <a href="https://developer.box.com/console" target="_blank" rel="noreferrer" className="text-primary hover:underline">Box Developer Console</a></li>
                <li>Create a new Custom App</li>
                <li>Select "Standard OAuth 2.0 (User Authentication)"</li>
                <li>Configure the app with read access to content</li>
                <li>Add your redirect URI (https://your-domain.com/auth/callback/box)</li>
                <li>Note your Client ID and Client Secret</li>
                <li>Add these credentials to your Supabase Edge Function environment variables:
                  <ul className="list-disc pl-5 mt-2">
                    <li>BOX_CLIENT_ID</li>
                    <li>BOX_CLIENT_SECRET</li>
                    <li>BOX_REDIRECT_URI</li>
                  </ul>
                </li>
              </ol>
            </AccordionContent>
          </AccordionItem>
          
          {/* You can add more provider integration guides here */}
          <AccordionItem value="amazon-s3">
            <AccordionTrigger>Amazon S3 Setup Guide</AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal pl-5 space-y-2">
                <li>Sign in to the <a href="https://aws.amazon.com/console/" target="_blank" rel="noreferrer" className="text-primary hover:underline">AWS Management Console</a></li>
                <li>Navigate to IAM and create a new user with programmatic access</li>
                <li>Create a policy with S3 read/write access or use AmazonS3FullAccess</li>
                <li>Attach the policy to the user</li>
                <li>Note your Access Key ID and Secret Access Key</li>
                <li>Create an S3 bucket for your application</li>
                <li>Add these credentials to your Supabase Edge Function environment variables:
                  <ul className="list-disc pl-5 mt-2">
                    <li>AWS_ACCESS_KEY_ID</li>
                    <li>AWS_SECRET_ACCESS_KEY</li>
                    <li>AWS_S3_BUCKET</li>
                    <li>AWS_REGION</li>
                  </ul>
                </li>
              </ol>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};

export const ProviderComparison: React.FC = () => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full mt-6 border-collapse">
        <thead>
          <tr className="bg-muted">
            <th className="p-3 text-left">Provider</th>
            <th className="p-3 text-left">Free Storage</th>
            <th className="p-3 text-left">Key Features</th>
            <th className="p-3 text-left">Best For</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="p-3">Google Drive</td>
            <td className="p-3">15 GB</td>
            <td className="p-3">Google Workspace integration, real-time collaboration, AI search</td>
            <td className="p-3">Collaboration, Google ecosystem users</td>
          </tr>
          <tr className="border-b">
            <td className="p-3">Dropbox</td>
            <td className="p-3">2 GB</td>
            <td className="p-3">Simple interface, excellent sync, Paper documents</td>
            <td className="p-3">Teams, quick file sharing</td>
          </tr>
          <tr className="border-b">
            <td className="p-3">OneDrive</td>
            <td className="p-3">5 GB</td>
            <td className="p-3">Microsoft 365 integration, Windows integration</td>
            <td className="p-3">Microsoft users, Office documents</td>
          </tr>
          <tr className="border-b">
            <td className="p-3">MEGA</td>
            <td className="p-3">20 GB</td>
            <td className="p-3">End-to-end encryption, large free tier</td>
            <td className="p-3">Privacy-conscious users</td>
          </tr>
          <tr className="border-b">
            <td className="p-3">pCloud</td>
            <td className="p-3">10 GB</td>
            <td className="p-3">Lifetime plans, client-side encryption</td>
            <td className="p-3">Long-term storage, one-time payment</td>
          </tr>
          <tr className="border-b">
            <td className="p-3">Box</td>
            <td className="p-3">10 GB</td>
            <td className="p-3">Enterprise security, workflow automation</td>
            <td className="p-3">Business use cases, regulatory compliance</td>
          </tr>
          <tr className="border-b">
            <td className="p-3">Amazon S3</td>
            <td className="p-3">5 GB (1 year)</td>
            <td className="p-3">Scalability, durability, fine-grained access control</td>
            <td className="p-3">Developers, enterprise applications</td>
          </tr>
          <tr className="border-b">
            <td className="p-3">Backblaze</td>
            <td className="p-3">10 GB</td>
            <td className="p-3">Low cost, simple pricing</td>
            <td className="p-3">Backup, cost-effective storage</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
