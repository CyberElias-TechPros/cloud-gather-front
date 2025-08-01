
import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  HardDrive,
  Files,
  Users,
  Cloud,
  Activity,
  TrendingUp,
  Clock,
  Share2,
  Upload,
  Download,
  Plus,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';

interface DashboardStats {
  totalFiles: number;
  totalStorage: number;
  usedStorage: number;
  connectedProviders: number;
  sharedFiles: number;
  recentActivity: ActivityItem[];
}

interface ActivityItem {
  id: string;
  type: 'upload' | 'download' | 'share' | 'delete' | 'create_folder';
  filename: string;
  timestamp: string;
  size?: number;
}

const DashboardPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalFiles: 0,
    totalStorage: 0,
    usedStorage: 0,
    connectedProviders: 0,
    sharedFiles: 0,
    recentActivity: []
  });

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      window.location.href = '/auth';
      return;
    }
    
    loadDashboardData();
  }, [user, authLoading]);

  const loadDashboardData = async () => {
    setLoading(true);
    
    try {
      // Load files stats
      const { data: files, error: filesError } = await supabase
        .from('files')
        .select('id, size, is_shared, filename, created_at')
        .order('created_at', { ascending: false });

      if (filesError) throw filesError;

      // Load providers stats
      const { data: providers, error: providersError } = await supabase
        .from('storage_providers')
        .select('id, status, used_space, total_space')
        .eq('status', 'connected');

      if (providersError) throw providersError;

      // Load shared files count
      const { data: shares, error: sharesError } = await supabase
        .from('file_shares')
        .select('id');

      if (sharesError) throw sharesError;

      // Calculate stats
      const totalFiles = files?.length || 0;
      const usedStorage = files?.reduce((acc, file) => acc + (file.size || 0), 0) || 0;
      const totalStorage = providers?.reduce((acc, provider) => acc + (provider.total_space || 0), 0) || 0;
      const sharedFiles = files?.filter(file => file.is_shared)?.length || 0;
      
      // Create recent activity from files
      const recentActivity: ActivityItem[] = files?.slice(0, 10).map(file => ({
        id: file.id,
        type: 'upload',
        filename: file.filename,
        timestamp: file.created_at,
        size: file.size
      })) || [];

      setStats({
        totalFiles,
        totalStorage,
        usedStorage,
        connectedProviders: providers?.length || 0,
        sharedFiles,
        recentActivity
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'upload': return Upload;
      case 'download': return Download;
      case 'share': return Share2;
      case 'delete': return AlertCircle;
      case 'create_folder': return Plus;
      default: return Activity;
    }
  };

  const storagePercentage = stats.totalStorage > 0 ? (stats.usedStorage / stats.totalStorage) * 100 : 0;

  if (authLoading || loading) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span>Loading dashboard...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Files</CardTitle>
              <Files className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalFiles}</div>
              <p className="text-xs text-muted-foreground">
                Across all providers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(stats.usedStorage)}</div>
              <p className="text-xs text-muted-foreground">
                of {formatBytes(stats.totalStorage)} total
              </p>
              <Progress value={storagePercentage} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Providers</CardTitle>
              <Cloud className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.connectedProviders}</div>
              <p className="text-xs text-muted-foreground">
                Connected services
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Shared Files</CardTitle>
              <Share2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.sharedFiles}</div>
              <p className="text-xs text-muted-foreground">
                Files shared with others
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.recentActivity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recent activity</p>
                  <p className="text-sm">Start uploading files to see activity</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.recentActivity.map((activity) => {
                    const Icon = getActivityIcon(activity.type);
                    return (
                      <div key={activity.id} className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {activity.filename}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {activity.type} • {new Date(activity.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                        {activity.size && (
                          <Badge variant="secondary" className="text-xs">
                            {formatBytes(activity.size)}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start" onClick={() => window.location.href = '/files'}>
                <Files className="h-4 w-4 mr-2" />
                Browse Files
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => window.location.href = '/providers'}>
                <Cloud className="h-4 w-4 mr-2" />
                Connect Provider
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => window.location.href = '/settings'}>
                <Users className="h-4 w-4 mr-2" />
                Manage Team
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">File Operations</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Operational
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Cloud Sync</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Operational
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">API Services</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Operational
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default DashboardPage;
