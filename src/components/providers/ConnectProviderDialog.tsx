
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
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type Provider = 'google-drive' | 'dropbox' | 'onedrive' | 'box' | 'amazon-s3' | 'backblaze' | 'mega' | 'pcloud' | 'yandex-disk' | 'icedrive' | 'sync';

interface ConnectProviderDialogProps {
  open: boolean;
  onClose: () => void;
  provider: Provider;
  onSuccess: () => void;
}

// Define the oauth callback handler on the window object
declare global {
  interface Window {
    handleOAuthCallback: (code: string) => Promise<void>;
  }
}

export const ConnectProviderDialog = ({
  open,
  onClose,
  provider,
  onSuccess,
}: ConnectProviderDialogProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Set up the global callback function
    window.handleOAuthCallback = async (code: string) => {
      if (!code) {
        toast({
          title: 'Authentication failed',
          description: 'Could not connect to the provider',
          variant: 'destructive',
        });
        return;
      }
      
      try {
        const { data: session } = await supabase.auth.getSession();
        
        if (!session.session) {
          toast({
            title: 'Authentication required',
            description: 'Please sign in to connect a storage provider',
            variant: 'destructive',
          });
          return;
        }
        
        // Exchange code for tokens and save the provider
        const { data, error } = await supabase.functions.invoke(`${provider}-auth`, {
          body: { 
            code,
            session: session.session.access_token
          },
        });
        
        if (error) throw error;
        
        toast({
          title: 'Connection successful',
          description: `Connected to ${formatProviderName(provider)}`,
        });
        
        onSuccess();
      } catch (error: any) {
        console.error('Error connecting provider:', error);
        toast({
          title: 'Connection failed',
          description: error.message || 'Could not complete the connection',
          variant: 'destructive',
        });
      }
    };
    
    return () => {
      // Clean up the global function when the component unmounts
      delete window.handleOAuthCallback;
    };
  }, [provider, toast, onSuccess]);

  const handleConnect = async () => {
    setIsConnecting(true);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast({
          title: 'Authentication required',
          description: 'Please sign in to connect a storage provider',
          variant: 'destructive',
        });
        return;
      }
      
      // Call the appropriate edge function based on provider
      const { data, error } = await supabase.functions.invoke(`${provider}-auth`, {
        body: {},
      });
      
      if (error) throw error;
      
      // Open the provider's OAuth page
      const authWindow = window.open(data.url, '_blank', 'width=800,height=600');
      
      // The callback is handled by the useEffect above
      
    } catch (error: any) {
      console.error('Error initiating OAuth flow:', error);
      toast({
        title: 'Connection failed',
        description: error.message || 'Could not start the connection process',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
      onClose();
    }
  };
  
  const formatProviderName = (provider: Provider): string => {
    switch (provider) {
      case 'google-drive':
        return 'Google Drive';
      case 'dropbox':
        return 'Dropbox';
      case 'onedrive':
        return 'OneDrive';
      case 'box':
        return 'Box';
      case 'amazon-s3':
        return 'Amazon S3';
      case 'backblaze':
        return 'Backblaze';
      case 'mega':
        return 'MEGA';
      case 'pcloud':
        return 'pCloud';
      case 'yandex-disk':
        return 'Yandex Disk';
      case 'icedrive':
        return 'Icedrive';
      case 'sync':
        return 'Sync.com';
      default:
        return 'Provider';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect {formatProviderName(provider)}</DialogTitle>
          <DialogDescription>
            Connect your {formatProviderName(provider)} account to access and manage your files.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center py-8">
          <img 
            src={`/images/${provider}-logo.png`} 
            alt={`${formatProviderName(provider)} logo`} 
            className="h-16 w-16 mb-4" 
            onError={(e) => {
              // Fallback to a generic logo if the image doesn't exist
              e.currentTarget.src = '/images/cloud-logo.png';
            }}
          />
          <p className="text-center mb-4">
            You'll be redirected to {formatProviderName(provider)} to authorize access to your files.
          </p>
          <p className="text-sm text-muted-foreground text-center">
            CloudUnity needs access to list and download your files, but will never modify or delete anything without your permission.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              `Connect to ${formatProviderName(provider)}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
