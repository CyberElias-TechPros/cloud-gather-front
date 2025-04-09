
import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Monitor, Moon, Sun, Layout, CircleUserRound } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

export const DisplaySettings = () => {
  const [theme, setTheme] = useState('system');
  const [defaultView, setDefaultView] = useState('grid');
  const [sortBy, setSortBy] = useState('name');
  const [compactMode, setCompactMode] = useState(false);
  const [showFileExtensions, setShowFileExtensions] = useState(true);
  const [showHiddenFiles, setShowHiddenFiles] = useState(false);
  
  const { toast } = useToast();
  
  const handleSaveChanges = () => {
    toast({
      title: 'Display settings updated',
      description: 'Your display preferences have been saved.',
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Monitor className="mr-2 h-5 w-5" />
            Display Settings
          </CardTitle>
          <CardDescription>
            Customize your visual preferences and file display options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <CircleUserRound className="h-5 w-5 mr-2" />
              Theme
            </h3>
            <RadioGroup value={theme} onValueChange={setTheme} className="flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="light" id="light" />
                <Label htmlFor="light" className="flex items-center">
                  <Sun className="h-4 w-4 mr-2" />
                  Light Mode
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dark" id="dark" />
                <Label htmlFor="dark" className="flex items-center">
                  <Moon className="h-4 w-4 mr-2" />
                  Dark Mode
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="system" id="system" />
                <Label htmlFor="system" className="flex items-center">
                  <Monitor className="h-4 w-4 mr-2" />
                  System Default
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          <Separator />
          
          <div>
            <h3 className="text-lg font-medium mb-4 flex items-center">
              <Layout className="h-5 w-5 mr-2" />
              File Browser
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="default-view">Default File View</Label>
                <RadioGroup id="default-view" value={defaultView} onValueChange={setDefaultView} className="flex flex-col space-y-1">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="grid" id="grid" />
                    <Label htmlFor="grid">Grid View</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="list" id="list" />
                    <Label htmlFor="list">List View</Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="sort-by">Default Sort</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger id="sort-by">
                    <SelectValue placeholder="Select default sorting" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="date">Modified Date</SelectItem>
                    <SelectItem value="size">Size</SelectItem>
                    <SelectItem value="type">Type</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="compact-mode">Compact Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Show more files by using a denser layout
                  </p>
                </div>
                <Switch
                  id="compact-mode"
                  checked={compactMode}
                  onCheckedChange={setCompactMode}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show-extensions">Show File Extensions</Label>
                  <p className="text-sm text-muted-foreground">
                    Display file extensions in file names
                  </p>
                </div>
                <Switch
                  id="show-extensions"
                  checked={showFileExtensions}
                  onCheckedChange={setShowFileExtensions}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show-hidden">Show Hidden Files</Label>
                  <p className="text-sm text-muted-foreground">
                    Display files that start with a dot
                  </p>
                </div>
                <Switch
                  id="show-hidden"
                  checked={showHiddenFiles}
                  onCheckedChange={setShowHiddenFiles}
                />
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div>
            <h3 className="text-lg font-medium mb-4">Language & Region</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select defaultValue="en">
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="ja">Japanese</SelectItem>
                    <SelectItem value="zh">Chinese (Simplified)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="date-format">Date Format</Label>
                <Select defaultValue="mdy">
                  <SelectTrigger id="date-format">
                    <SelectValue placeholder="Select date format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mdy">MM/DD/YYYY</SelectItem>
                    <SelectItem value="dmy">DD/MM/YYYY</SelectItem>
                    <SelectItem value="ymd">YYYY/MM/DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveChanges}>Save Changes</Button>
        </CardFooter>
      </Card>
    </div>
  );
};
