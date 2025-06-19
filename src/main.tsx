
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from './components/ui/toaster';
import { Toaster as SonnerToaster } from 'sonner';
import { TooltipProvider } from './components/ui/tooltip';

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <TooltipProvider>
      <App />
      <Toaster />
      <SonnerToaster position="top-right" closeButton richColors />
    </TooltipProvider>
  </AuthProvider>
);
