
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Toaster } from 'sonner';

// Public pages
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import AboutPage from './pages/AboutPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import ContactPage from './pages/ContactPage';
import SharePage from './pages/SharePage';
import BlogPage from './pages/BlogPage';
import BlogPostPage from './pages/BlogPostPage';
import FeaturesPage from './pages/FeaturesPage';
import PricingPage from './pages/PricingPage';
import ApiDocPage from './pages/ApiDocPage';
import DevelopersPage from './pages/DevelopersPage';

// Protected pages
import Dashboard from './pages/Index';
import FilesPage from './pages/FilesPage';
import ProvidersPage from './pages/ProvidersPage';
import SettingsPage from './pages/SettingsPage';
import ApiPage from './pages/ApiPage';
import ProfilePage from './pages/ProfilePage';
import StoragePage from './pages/StoragePage';
import SharedPage from './pages/SharedPage';
import StarredPage from './pages/StarredPage';
import RecentsPage from './pages/RecentsPage';
import TeamPage from './pages/TeamPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/share/:fileId" element={<SharePage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/api-docs" element={<ApiDocPage />} />
          <Route path="/developers" element={<DevelopersPage />} />
          
          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/files/:folderId" element={<FilesPage />} />
            <Route path="/providers" element={<ProvidersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/api" element={<ApiPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/storage" element={<StoragePage />} />
            <Route path="/shared" element={<SharedPage />} />
            <Route path="/starred" element={<StarredPage />} />
            <Route path="/recents" element={<RecentsPage />} />
            <Route path="/team" element={<TeamPage />} />
          </Route>
          
          {/* Fallback Route - Redirect to landing page if route not found */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
