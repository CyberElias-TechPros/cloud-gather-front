
import React, { useEffect } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";

const AuthPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already authenticated
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/');
      }
    };

    checkSession();
  }, [navigate]);

  return (
    <div className="flex min-h-screen bg-muted/40">
      <div className="flex-1 hidden lg:block bg-primary/10 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center p-12">
          <div className="max-w-lg">
            <h1 className="text-4xl font-bold mb-6">CloudUnity</h1>
            <p className="text-xl mb-8">
              All your cloud storage in one unified dashboard. Access, manage, and share files across multiple providers.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background/80 backdrop-blur-sm p-4 rounded-lg">
                <h3 className="font-medium mb-2">Unified Storage</h3>
                <p className="text-sm text-muted-foreground">
                  Connect all your cloud storage providers in one place
                </p>
              </div>
              <div className="bg-background/80 backdrop-blur-sm p-4 rounded-lg">
                <h3 className="font-medium mb-2">Smart Sync</h3>
                <p className="text-sm text-muted-foreground">
                  Keep your files in sync across multiple platforms
                </p>
              </div>
              <div className="bg-background/80 backdrop-blur-sm p-4 rounded-lg">
                <h3 className="font-medium mb-2">Secure Sharing</h3>
                <p className="text-sm text-muted-foreground">
                  Share files securely with fine-grained control
                </p>
              </div>
              <div className="bg-background/80 backdrop-blur-sm p-4 rounded-lg">
                <h3 className="font-medium mb-2">Intelligent Search</h3>
                <p className="text-sm text-muted-foreground">
                  Find files quickly across all your cloud storage
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <AuthForm />
      </div>
    </div>
  );
};

export default AuthPage;
