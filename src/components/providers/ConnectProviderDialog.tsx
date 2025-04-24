
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { StorageProviderInfo } from '@/types/file';

type Provider = StorageProviderInfo['type'];

interface ConnectProviderDialogProps {
  open: boolean;
  onClose: () => void;
  provider: Provider;
  onSuccess: () => void;
}

interface ProviderConfig {
  name: string;
  credentialFields: {
    key: string;
    label: string;
    type: 'text' | 'password';
    helpText: string;
    required: boolean;
  }[];
  setupInstructions: string;
  docsUrl: string;
}

const providerConfigs: Record<Provider, ProviderConfig> = {
  'google-drive': {
    name: 'Google Drive',
    credentialFields: [],
    setupInstructions: 'Click connect to authenticate with your Google account.',
    docsUrl: 'https://console.cloud.google.com/apis/credentials'
  },
  'dropbox': {
    name: 'Dropbox',
    credentialFields: [],
    setupInstructions: 'Click connect to authenticate with your Dropbox account.',
    docsUrl: 'https://www.dropbox.com/developers/apps'
  },
  'onedrive': {
    name: 'OneDrive',
    credentialFields: [],
    setupInstructions: 'Click connect to authenticate with your Microsoft account.',
    docsUrl: 'https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps'
  },
  'box': {
    name: 'Box',
    credentialFields: [],
    setupInstructions: 'Click connect to authenticate with your Box account.',
    docsUrl: 'https://app.box.com/developers/console'
  },
  'amazon-s3': {
    name: 'Amazon S3',
    credentialFields: [
      {
        key: 'accessKeyId',
        label: 'Access Key ID',
        type: 'text',
        helpText: 'Your AWS Access Key ID',
        required: true
      },
      {
        key: 'secretAccessKey',
        label: 'Secret Access Key',
        type: 'password',
        helpText: 'Your AWS Secret Access Key',
        required: true
      },
      {
        key: 'region',
        label: 'Region',
        type: 'text',
        helpText: 'AWS Region (e.g., us-east-1)',
        required: true
      },
      {
        key: 'bucket',
        label: 'Bucket Name',
        type: 'text',
        helpText: 'Name of your S3 bucket',
        required: true
      }
    ],
    setupInstructions: 'Create an IAM user with S3 access and enter the credentials below.',
    docsUrl: 'https://aws.amazon.com/iam/'
  },
  'backblaze': {
    name: 'Backblaze B2',
    credentialFields: [
      {
        key: 'keyId',
        label: 'Application Key ID',
        type: 'text',
        helpText: 'Your Backblaze Application Key ID',
        required: true
      },
      {
        key: 'applicationKey',
        label: 'Application Key',
        type: 'password',
        helpText: 'Your Backblaze Application Key',
        required: true
      },
      {
        key: 'bucket',
        label: 'Bucket Name',
        type: 'text',
        helpText: 'Name of your B2 bucket',
        required: true
      }
    ],
    setupInstructions: 'Create an application key in your Backblaze B2 account and enter the credentials.',
    docsUrl: 'https://secure.backblaze.com/app_keys.htm'
  },
  'mega': {
    name: 'MEGA',
    credentialFields: [
      {
        key: 'email',
        label: 'Email',
        type: 'text',
        helpText: 'Your MEGA account email',
        required: true
      },
      {
        key: 'password',
        label: 'Password',
        type: 'password',
        helpText: 'Your MEGA account password',
        required: true
      }
    ],
    setupInstructions: 'Enter your MEGA account credentials below.',
    docsUrl: 'https://mega.io/pro'
  },
  'pcloud': {
    name: 'pCloud',
    credentialFields: [],
    setupInstructions: 'Click connect to authenticate with your pCloud account.',
    docsUrl: 'https://www.pcloud.com/oauth2/login'
  },
  'yandex-disk': {
    name: 'Yandex Disk',
    credentialFields: [],
    setupInstructions: 'Click connect to authenticate with your Yandex account.',
    docsUrl: 'https://oauth.yandex.com/'
  },
  'icedrive': {
    name: 'Icedrive',
    credentialFields: [
      {
        key: 'apiToken',
        label: 'API Token',
        type: 'password',
        helpText: 'Your Icedrive API token',
        required: true
      }
    ],
    setupInstructions: 'Generate an API token in your Icedrive account settings and enter it below.',
    docsUrl: 'https://icedrive.net/account/api'
  },
  'sync': {
    name: 'Sync.com',
    credentialFields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        helpText: 'Your Sync.com API key',
        required: true
      },
      {
        key: 'teamId',
        label: 'Team ID',
        type: 'text',
        helpText: 'Your Sync.com Team ID (if applicable)',
        required: false
      }
    ],
    setupInstructions: 'Generate an API key in your Sync.com account settings and enter it below.',
    docsUrl: 'https://www.sync.com/help/sync-com-business-api/'
  },
  'add': {
    name: 'Add Provider',
    credentialFields: [],
    setupInstructions: '',
    docsUrl: ''
  }
};

export const ConnectProviderDialog = ({
  open,
  onClose,
  provider,
  onSuccess
}: ConnectProviderDialogProps) => {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [isConnecting, setIsConnecting] = useState(false);
  
  const config = providerConfigs[provider];

  const handleConnect = async () => {
    setIsConnecting(true);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error('Authentication required: Please sign in to connect a storage provider');
        return;
      }

      // For OAuth providers, initiate the OAuth flow
      if (['google-drive', 'dropbox', 'onedrive', 'box', 'pcloud', 'yandex-disk'].includes(provider)) {
        const { data, error } = await supabase.functions.invoke(`${provider}-auth`, {
          body: {},
        });
        
        if (error) throw error;
        
        // Open the OAuth window
        window.open(data.url, '_blank', 'width=800,height=600');
      } else {
        // For API key based providers, send credentials directly
        const { error } = await supabase.functions.invoke(`${provider}-auth`, {
          body: { credentials },
        });
        
        if (error) throw error;
        
        toast.success(`Connected to ${config.name}`);
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error connecting provider:', error);
      toast.error(`Connection failed: ${error.message || 'Could not complete the connection'}`);
    } finally {
      setIsConnecting(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect {config.name}</DialogTitle>
          <DialogDescription>
            {config.setupInstructions}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col space-y-4 py-4">
          {config.credentialFields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                type={field.type}
                placeholder={field.label}
                value={credentials[field.key] || ''}
                onChange={(e) => setCredentials(prev => ({
                  ...prev,
                  [field.key]: e.target.value
                }))}
                required={field.required}
              />
              <p className="text-sm text-muted-foreground">{field.helpText}</p>
            </div>
          ))}
          
          {config.docsUrl && (
            <>
              <Separator />
              <p className="text-sm text-muted-foreground">
                Need help? Check out the{' '}
                <a 
                  href={config.docsUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {config.name} documentation
                </a>
                {' '}for setup instructions.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleConnect}
            disabled={isConnecting || (
              config.credentialFields.some(field => 
                field.required && !credentials[field.key]
              )
            )}
          >
            {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect to {config.name}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
