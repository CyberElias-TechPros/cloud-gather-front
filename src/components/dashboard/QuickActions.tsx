import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Upload, 
  FolderPlus, 
  Share2, 
  Link as LinkIcon,
  Star,
  FileText,
  Download,
  Settings
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const QuickActions = () => {
  const actions = [
    {
      icon: <Upload className="h-5 w-5" />,
      label: "Upload Files",
      description: "Upload files to your cloud storage",
      action: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.click();
      }
    },
    {
      icon: <FolderPlus className="h-5 w-5" />,
      label: "Create Folder",
      description: "Organize your files in folders",
      action: () => {
        // This would typically open a create folder dialog
        const name = prompt('Enter folder name:');
        if (name) {
          console.log('Creating folder:', name);
        }
      }
    },
    {
      icon: <Share2 className="h-5 w-5" />,
      label: "Share Files",
      description: "Share files with team members",
      href: "/files"
    },
    {
      icon: <LinkIcon className="h-5 w-5" />,
      label: "Connect Provider",
      description: "Add a new cloud storage provider",
      href: "/providers"
    }
  ];

  const quickLinks = [
    {
      icon: <Star className="h-4 w-4" />,
      label: "Starred Files",
      href: "/starred"
    },
    {
      icon: <FileText className="h-4 w-4" />,
      label: "Recent Files",
      href: "/recents"
    },
    {
      icon: <Download className="h-4 w-4" />,
      label: "Downloads",
      href: "/files"
    },
    {
      icon: <Settings className="h-4 w-4" />,
      label: "Settings",
      href: "/settings"
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {actions.map((action, index) => (
              <div key={index} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className="bg-primary/10 p-2 rounded-lg text-primary">
                    {action.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm">{action.label}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                    <div className="mt-2">
                      {action.href ? (
                        <Link to={action.href}>
                          <Button variant="outline" size="sm">
                            Open
                          </Button>
                        </Link>
                      ) : (
                        <Button variant="outline" size="sm" onClick={action.action}>
                          Start
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickLinks.map((link, index) => (
              <Link key={index} to={link.href}>
                <Button variant="ghost" className="h-auto p-3 flex flex-col items-center space-y-2 w-full">
                  {link.icon}
                  <span className="text-xs">{link.label}</span>
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};