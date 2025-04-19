
import React from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const AuthPage = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  // If user is already logged in, redirect to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-full max-w-md px-4">
        <AuthForm />
      </div>
    </div>
  );
};

export default AuthPage;
