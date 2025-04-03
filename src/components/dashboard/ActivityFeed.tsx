
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FileIcon,
  UploadCloud,
  DownloadCloud,
  Trash2,
  Share2,
  FileEdit
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export interface ActivityItem {
  id: string;
  type: 'upload' | 'download' | 'delete' | 'share' | 'edit';
  fileName: string;
  timestamp: Date;
  user?: {
    name: string;
    initials: string;
  };
}

interface ActivityFeedProps {
  activities: ActivityItem[];
}

export const ActivityFeed = ({ activities }: ActivityFeedProps) => {
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
      default:
        return <FileIcon className="h-4 w-4 text-gray-500" />;
    }
  };
  
  const getActivityText = (activity: ActivityItem) => {
    const userName = activity.user?.name || 'You';
    
    switch (activity.type) {
      case 'upload':
        return `${userName} uploaded ${activity.fileName}`;
      case 'download':
        return `${userName} downloaded ${activity.fileName}`;
      case 'delete':
        return `${userName} deleted ${activity.fileName}`;
      case 'share':
        return `${userName} shared ${activity.fileName}`;
      case 'edit':
        return `${userName} edited ${activity.fileName}`;
      default:
        return `${userName} performed an action on ${activity.fileName}`;
    }
  };
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            No recent activity to display
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start">
                {activity.user ? (
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
                  <p className="text-sm font-medium">
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
