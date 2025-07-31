
import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useMonitoring } from '@/hooks/useMonitoring';
import { useErrorHandler } from '@/hooks/useErrorHandler';
// Note: File operations are handled directly with Supabase queries for now
import { toast } from 'sonner';
import {
  Files,
  HardDrive,
  Upload,
  Download,
  Star,
  Share2,
  Clock,
  Users,
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Plus,
} from 'lucide-react';

interface DashboardStats {
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  recentFiles: any[];
  starredFiles: any[];
  sharedFiles: any[];
  storageUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  activitySummary: {
    uploadsToday: number;
    downloadsToday: number;
    sharesThisWeek: number;
  };
}

const DashboardPage = () => {
  const { user, profile } = useAuth();
  const { recordActivity } = useMonitoring();
  const { handleAsyncError } = useErrorHandler();
  const [refreshing, setRefreshing] = useState(false);

  // Load dashboard data
  const { 
    data: dashboardData, 
    isLoading, 
    refetch,
    error 
  } = useQuery({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: async (): Promise<DashboardStats> => {
      if (!user) throw new Error('User not authenticated');

      // Get file statistics
      const { data: files, error: filesError } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', user.id);

      if (filesError) throw new Error(`Failed to fetch files: ${filesError.message}`);

      const totalFiles = files?.filter(f => !f.is_folder).length || 0;
      const totalFolders = files?.filter(f => f.is_folder).length || 0;
      const totalSize = files?.reduce((sum, f) => sum + (f.size || 0), 0) || 0;

      // Get recent files (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const recentFiles = files?.filter(f => 
        new Date(f.created_at) > new Date(sevenDaysAgo)
      ).slice(0, 5) || [];

      // Get starred files
      const starredFiles = files?.filter(f => f.is_starred).slice(0, 5) || [];

      // Get shared files
      const sharedFiles = files?.filter(f => f.is_shared).slice(0, 5) || [];

      // Calculate storage usage (placeholder - in real app, you'd have quotas)
      const storageQuota = 5 * 1024 * 1024 * 1024; // 5GB default
      const storagePercentage = Math.round((totalSize / storageQuota) * 100);

      return {
        totalFiles,
        totalFolders,
        totalSize,
        recentFiles,
        starredFiles,
        sharedFiles,
        storageUsage: {
          used: totalSize,
          total: storageQuota,
          percentage: storagePercentage,
        },
        activitySummary: {
          uploadsToday: recentFiles.filter(f => 
            new Date(f.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
          ).length,
          downloadsToday: 0, // Would need activity tracking
          sharesThisWeek: sharedFiles.length,
        },
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      recordActivity('dashboard_refresh', 'dashboard');
      toast.success('Dashboard refreshed');
    } catch (error) {
      toast.error('Failed to refresh dashboard');
    } finally {
      setRefreshing(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (isLoading) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" text="Loading dashboard..." />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">Failed to load dashboard</p>
            <p className="text-muted-foreground mb-4">Please try refreshing the page</p>
            <Button onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? <LoadingSpinner size="sm" className="mr-2" /> : null}
              Retry
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard" showSearch>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground">
              {getGreeting()}, {profile?.display_name || user?.email?.split('@')[0]}!
            </h2>
            <p className="text-muted-foreground mt-1">
              Here's what's happening with your files today.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="flex items-center space-x-1">
              <CheckCircle className="h-3 w-3" />
              <span>All systems operational</span>
            </Badge>
            <Button 
              variant="outline" 
              onClick={handleRefresh} 
              disabled={refreshing}
              size="sm"
            >
              {refreshing ? <LoadingSpinner size="sm" className="mr-2" /> : <Activity className="h-4 w-4 mr-2" />}
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Files</CardTitle>
              <Files className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData?.totalFiles.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                +{dashboardData?.activitySummary.uploadsToday || 0} uploaded today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Folders</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData?.totalFolders.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Organized structure
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatFileSize(dashboardData?.totalSize || 0)}
              </div>
              <Progress 
                value={dashboardData?.storageUsage.percentage || 0} 
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {dashboardData?.storageUsage.percentage || 0}% of {formatFileSize(dashboardData?.storageUsage.total || 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Shared Files</CardTitle>
              <Share2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboardData?.sharedFiles.length}</div>
              <p className="text-xs text-muted-foreground">
                +{dashboardData?.activitySummary.sharesThisWeek || 0} this week
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Content Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Recent Files */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Recent Files</CardTitle>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {dashboardData?.recentFiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Files className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recent files</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboardData?.recentFiles.map((file) => (
                    <div key={file.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-shrink-0">
                        {file.is_folder ? (
                          <HardDrive className="h-8 w-8 text-blue-500" />
                        ) : (
                          <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">
                              {file.filename.split('.').pop()?.toUpperCase() || 'FILE'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {file.filename}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(file.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Starred Files */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Starred Files</CardTitle>
              <Star className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {dashboardData?.starredFiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No starred files</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dashboardData?.starredFiles.map((file) => (
                    <div key={file.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-shrink-0">
                        {file.is_folder ? (
                          <HardDrive className="h-8 w-8 text-blue-500" />
                        ) : (
                          <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">
                              {file.filename.split('.').pop()?.toUpperCase() || 'FILE'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {file.filename}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size || 0)}
                        </p>
                      </div>
                      <Star className="h-4 w-4 text-yellow-500 fill-current" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <Button className="w-full justify-start" asChild>
                  <a href="/files">
                    <Upload className="h-4 w-4 mr-3" />
                    Upload Files
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="/files">
                    <Plus className="h-4 w-4 mr-3" />
                    Create Folder
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="/providers">
                    <HardDrive className="h-4 w-4 mr-3" />
                    Connect Storage
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="/team">
                    <Users className="h-4 w-4 mr-3" />
                    Invite Team
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default DashboardPage;
