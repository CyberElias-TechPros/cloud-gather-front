
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Upload, FolderPlus, FileUp, Clock, Settings } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const UploadPreferences = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Preferences
        </CardTitle>
        <CardDescription>
          Configure how files are uploaded and processed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Default Upload Location</Label>
                <Select defaultValue="smart">
                  <SelectTrigger>
                    <SelectValue placeholder="Select default location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smart">Smart Allocation (Recommended)</SelectItem>
                    <SelectItem value="provider_order">Provider Order</SelectItem>
                    <SelectItem value="most_free">Most Free Space First</SelectItem>
                    <SelectItem value="balanced">Balanced Distribution</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  How files are distributed across providers
                </span>
              </div>
              
              <div className="space-y-2">
                <Label>Default Folder Structure</Label>
                <RadioGroup defaultValue="preserve" className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="preserve" id="preserve" />
                    <Label htmlFor="preserve" className="font-normal cursor-pointer">
                      Preserve original folder structure
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="flatten" id="flatten" />
                    <Label htmlFor="flatten" className="font-normal cursor-pointer">
                      Flatten folders (files only)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="date" id="date" />
                    <Label htmlFor="date" className="font-normal cursor-pointer">
                      Organize by date
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Automatic File Processing</Label>
                  <span className="text-sm text-muted-foreground">
                    Auto-organize uploaded files by type
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Background Uploading</Label>
                  <span className="text-sm text-muted-foreground">
                    Continue uploads when app is minimized
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Conflict Resolution</Label>
                  <span className="text-sm text-muted-foreground">
                    How to handle duplicate file names
                  </span>
                </div>
                <Select defaultValue="rename">
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Select strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rename">Rename New File</SelectItem>
                    <SelectItem value="replace">Replace Existing</SelectItem>
                    <SelectItem value="skip">Skip Upload</SelectItem>
                    <SelectItem value="ask">Always Ask</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <h3 className="text-lg font-medium">Upload Bandwidth</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="block mb-1">Bandwidth Limiting</Label>
                <span className="text-sm text-muted-foreground">
                  Restrict upload speed to preserve bandwidth
                </span>
              </div>
              <Switch defaultChecked={false} />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Maximum Upload Speed</Label>
                <span className="text-sm text-muted-foreground">
                  5 Mbps
                </span>
              </div>
              <Slider
                defaultValue={[5]}
                min={1}
                max={20}
                step={1}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 Mbps</span>
                <span>Unlimited</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label className="block mb-1">Smart Bandwidth Management</Label>
                <span className="text-sm text-muted-foreground">
                  Automatically adjust based on network conditions
                </span>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
          
          <Separator />
          
          <h3 className="text-lg font-medium">File Processing</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Image Optimization</Label>
                  <span className="text-sm text-muted-foreground">
                    Optimize images before uploading
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="space-y-2">
                <Label>Image Quality</Label>
                <Select defaultValue="high">
                  <SelectTrigger>
                    <SelectValue placeholder="Select quality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">Original (No optimization)</SelectItem>
                    <SelectItem value="high">High (90%)</SelectItem>
                    <SelectItem value="medium">Medium (75%)</SelectItem>
                    <SelectItem value="low">Low (50%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Extract Metadata</Label>
                  <span className="text-sm text-muted-foreground">
                    Extract and index file metadata for search
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="block mb-1">Auto Categorization</Label>
                  <span className="text-sm text-muted-foreground">
                    Automatically tag and categorize files
                  </span>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button>Save Upload Preferences</Button>
        </div>
      </CardContent>
    </Card>
  );
};
