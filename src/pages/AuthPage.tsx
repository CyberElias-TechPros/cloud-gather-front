
import React, { useState } from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { Link } from 'react-router-dom';

const AuthPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Check if the URL has a signup parameter
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signup') === 'true') {
      setIsSignUp(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="container mx-auto p-6">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
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
          </Link>
          
          <Link to={isSignUp ? "/auth" : "/auth?signup=true"}>
            <button className="text-sm font-medium hover:underline">
              {isSignUp ? 'Login' : 'Sign Up'}
            </button>
          </Link>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tighter">
              {isSignUp ? 'Create an Account' : 'Welcome Back'}
            </h1>
            <p className="text-muted-foreground mt-2">
              {isSignUp 
                ? 'Enter your details to create an account and get started' 
                : 'Enter your credentials to access your account'}
            </p>
          </div>
          
          <AuthForm isSignUp={isSignUp} />
          
          <div className="text-center text-sm">
            <p>
              {isSignUp 
                ? 'Already have an account? ' 
                : 'Don\'t have an account? '}
              <Link 
                to={isSignUp ? "/auth" : "/auth?signup=true"} 
                className="text-primary hover:underline"
              >
                {isSignUp ? 'Login' : 'Sign Up'}
              </Link>
            </p>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <div className="text-muted-foreground text-sm">
              &copy; {new Date().getFullYear()} Cloud Edifix. All rights reserved.
            </div>
            <div className="flex space-x-4 text-sm">
              <Link to="/privacy" className="text-muted-foreground hover:text-foreground">
                Privacy
              </Link>
              <Link to="/terms" className="text-muted-foreground hover:text-foreground">
                Terms
              </Link>
              <Link to="/contact" className="text-muted-foreground hover:text-foreground">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AuthPage;
