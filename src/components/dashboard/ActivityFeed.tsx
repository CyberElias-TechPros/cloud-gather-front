
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FileIcon,
  UploadCloud,
  DownloadCloud,
  Trash2,
  Share2,
  FileEdit,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ActivityItem {
  id: string;
  type: 'upload' | 'download' | 'delete' | 'share' | 'edit' | 'access';
  fileName: string;
  timestamp: Date;
  user?: {
    name: string;
    initials: string;
  };
  userId?: string;
}

interface ActivityFeedProps {
  activities?: ActivityItem[];
  showUserActivities?: boolean;
}

export const ActivityFeed = ({ activities: providedActivities, showUserActivities = false }: ActivityFeedProps) => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (providedActivities) {
      setActivities(providedActivities);
      setLoading(false);
    } else {
      loadRecentActivities();
    }
  }, [providedActivities, user, showUserActivities]);

  const loadRecentActivities = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Get recent file activities for the current user or all users (if admin)
      let query = supabase
        .from('files')
        .select(`
          id,
          filename,
          created_at,
          updated_at,
          last_accessed_at,
          user_id,
          profiles!files_user_id_fkey(display_name)
        `)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (!showUserActivities) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const activityItems: ActivityItem[] = [];

      data?.forEach(file => {
        const profile = Array.isArray(file.profiles) ? file.profiles[0] : file.profiles;
        const userName = profile?.display_name || 'Unknown User';
        const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        // Create activity for file creation
        if (file.created_at) {
          activityItems.push({
            id: `${file.id}-upload`,
            type: 'upload',
            fileName: file.filename,
            timestamp: new Date(file.created_at),
            user: {
              name: userName,
              initials: userInitials
            },
            userId: file.user_id
          });
        }

        // Create activity for file access (if different from creation)
        if (file.last_accessed_at && file.last_accessed_at !== file.created_at) {
          activityItems.push({
            id: `${file.id}-access`,
            type: 'access',
            fileName: file.filename,
            timestamp: new Date(file.last_accessed_at),
            user: {
              name: userName,
              initials: userInitials
            },
            userId: file.user_id
          });
        }

        // Create activity for file update (if different from creation)
        if (file.updated_at && file.updated_at !== file.created_at) {
          activityItems.push({
            id: `${file.id}-edit`,
            type: 'edit',
            fileName: file.filename,
            timestamp: new Date(file.updated_at),
            user: {
              name: userName,
              initials: userInitials
            },
            userId: file.user_id
          });
        }
      });

      // Sort by timestamp and limit to 8 most recent
      const sortedActivities = activityItems
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 8);

      setActivities(sortedActivities);
    } catch (error) {
      console.error('Error loading recent activities:', error);
      // Fallback to empty activities array
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'upload':
        return <UploadCloud className="h-4 w-4 text-green-500" />;
      case 'download':
        return <DownloadCloud className="h-4 w-4 text-blue-500" />;
      case 'delete':
        return <Trash2 className="h-4 w-4 text-red-500" />;
      case 'share':
        return <Share2 className="h-4 w-4 text-purple-500" />;
      case 'edit':
        return <FileEdit className="h-4 w-4 text-amber-500" />;
      case 'access':
        return <FileIcon className="h-4 w-4 text-blue-400" />;
      default:
        return <FileIcon className="h-4 w-4 text-gray-500" />;
    }
  };
  
  const getActivityText = (activity: ActivityItem) => {
    const userName = activity.user?.name || 'Someone';
    const isCurrentUser = activity.userId === user?.id;
    const displayName = isCurrentUser ? 'You' : userName;
    
    switch (activity.type) {
      case 'upload':
        return `${displayName} uploaded ${activity.fileName}`;
      case 'download':
        return `${displayName} downloaded ${activity.fileName}`;
      case 'delete':
        return `${displayName} deleted ${activity.fileName}`;
      case 'share':
        return `${displayName} shared ${activity.fileName}`;
      case 'edit':
        return `${displayName} edited ${activity.fileName}`;
      case 'access':
        return `${displayName} accessed ${activity.fileName}`;
      default:
        return `${displayName} performed an action on ${activity.fileName}`;
    }
  };
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <span className="text-sm text-muted-foreground">Loading activities...</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <FileIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm">No recent activity to display</p>
            <p className="text-xs">Upload or access files to see activity here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start">
                {activity.user && showUserActivities ? (
                  <Avatar className="h-8 w-8 mr-3">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {activity.user.initials}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center mr-3">
                    {getActivityIcon(activity.type)}
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {getActivityText(activity)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
