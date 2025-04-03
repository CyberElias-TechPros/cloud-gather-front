
import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { FileType, InfoIcon, Zap } from 'lucide-react';
import { FileItem } from '@/components/files/FileCard';
import { FileGrid } from '@/components/files/FileGrid';

const StoragePage = () => {
  const [activeTab, setActiveTab] = useState('overview');
  
  // Sample data for visualization
  const storageUsageData = [
    { name: 'Jan', usage: 3.2 },
    { name: 'Feb', usage: 5.7 },
    { name: 'Mar', usage: 8.1 },
    { name: 'Apr', usage: 10.5 },
    { name: 'May', usage: 12.8 },
    { name: 'Jun', usage: 13.2 },
    { name: 'Jul', usage: 15.5 },
    { name: 'Aug', usage: 18.3 },
    { name: 'Sep', usage: 20.0 },
  ];
  
  const storageProviderData = [
    { name: 'Google Drive', value: 12 },
    { name: 'Dropbox', value: 6 },
    { name: 'OneDrive', value: 2 },
  ];
  
  const fileTypeData = [
    { name: 'Documents', value: 4.5 },
    { name: 'Images', value: 8.3 },
    { name: 'Videos', value: 5.2 },
    { name: 'Audio', value: 1.2 },
    { name: 'Archives', value: 0.8 },
  ];
  
  const COLORS = ['#3B82F6', '#6366F1', '#10B981', '#EC4899', '#F97316'];
  
  const largeFiles: FileItem[] = [
    {
      id: '1',
      name: 'Product Demo Video.mp4',
      type: 'video/mp4',
      size: 512 * 1024 * 1024, // 512MB
      modified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      provider: 'Google Drive'
    },
    {
      id: '2',
      name: 'Company Event Photos.zip',
      type: 'application/zip',
      size: 256 * 1024 * 1024, // 256MB
      modified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
      provider: 'Dropbox'
    },
    {
      id: '3',
      name: 'Quarterly Financial Report.pptx',
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      size: 128 * 1024 * 1024, // 128MB
      modified: new Date(Date.now() - 1000 * 60 * 60 * 12),
      provider: 'OneDrive'
    },
    {
      id: '4',
      name: 'Product Catalog 2023.pdf',
      type: 'application/pdf',
      size: 85 * 1024 * 1024, // 85MB
      modified: new Date(Date.now() - 1000 * 60 * 60 * 36),
      provider: 'Google Drive'
    }
  ];
  
  // Helper function to format bytes to human-readable format
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Calculate total storage used
  const totalStorageUsed = storageProviderData.reduce((total, provider) => total + provider.value, 0);
  const totalStorageAllocated = 30; // 30GB
  const storagePercentage = Math.round((totalStorageUsed / totalStorageAllocated) * 100);

  return (
    <AppLayout title="Storage Manager">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="optimization">Optimization</TabsTrigger>
          </TabsList>
          
          <Button>
            <Zap className="h-4 w-4 mr-2" />
            Optimize Storage
          </Button>
        </div>
        
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle>Storage Usage</CardTitle>
                <CardDescription>
                  {formatSize(totalStorageUsed * 1024 * 1024 * 1024)} of {formatSize(totalStorageAllocated * 1024 * 1024 * 1024)} used
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Progress value={storagePercentage} className="h-2" />
                  
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{storagePercentage}% used</span>
                    <span>{formatSize((totalStorageAllocated - totalStorageUsed) * 1024 * 1024 * 1024)} available</span>
                  </div>
                </div>
                
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {storageProviderData.map((provider, index) => (
                    <div key={provider.name} className="flex items-center justify-between p-3 bg-muted/40 rounded-md">
                      <div>
                        <div className="text-sm font-medium">{provider.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatSize(provider.value * 1024 * 1024 * 1024)}
                        </div>
                      </div>
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      ></div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6">
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart
                      data={storageUsageData}
                      margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip formatter={(value) => [`${value} GB`, 'Storage Used']} />
                      <Area 
                        type="monotone" 
                        dataKey="usage" 
                        stroke="#3B82F6" 
                        fillOpacity={1} 
                        fill="url(#colorUsage)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Storage by Provider</CardTitle>
                <CardDescription>
                  How your data is distributed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={storageProviderData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {storageProviderData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} GB`, 'Storage Used']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Storage by File Type</CardTitle>
                <CardDescription>
                  How your storage is used by file type
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={fileTypeData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                      <XAxis type="number" tickFormatter={(value) => `${value} GB`} />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} />
                      <Tooltip formatter={(value) => [`${value} GB`, 'Storage Used']} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {fileTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card className="md:col-span-3">
              <CardHeader className="pb-2">
                <CardTitle>Largest Files</CardTitle>
                <CardDescription>
                  Files using the most storage space
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileGrid files={largeFiles} view="list" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Storage Growth</CardTitle>
                <CardDescription>
                  How your storage usage has increased over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={storageUsageData}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorUsage2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#6366F1" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`${value} GB`, 'Storage Used']} />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="usage" 
                        name="Storage Used" 
                        stroke="#6366F1" 
                        fillOpacity={1} 
                        fill="url(#colorUsage2)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>File Distribution</CardTitle>
                <CardDescription>
                  Storage distribution across providers and file types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={fileTypeData}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        nameKey="name"
                        label
                      >
                        {fileTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} GB`, 'Storage Used']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Activity Insights</CardTitle>
                <CardDescription>
                  How your storage is being accessed and used
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-muted/40 p-4 rounded-md">
                    <div className="text-2xl font-bold">127</div>
                    <div className="text-sm text-muted-foreground">Files uploaded this month</div>
                  </div>
                  
                  <div className="bg-muted/40 p-4 rounded-md">
                    <div className="text-2xl font-bold">43</div>
                    <div className="text-sm text-muted-foreground">Files downloaded this month</div>
                  </div>
                  
                  <div className="bg-muted/40 p-4 rounded-md">
                    <div className="text-2xl font-bold">18</div>
                    <div className="text-sm text-muted-foreground">Files shared with others</div>
                  </div>
                </div>
                
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'Mon', uploads: 12, downloads: 5 },
                        { name: 'Tue', uploads: 19, downloads: 8 },
                        { name: 'Wed', uploads: 15, downloads: 10 },
                        { name: 'Thu', uploads: 21, downloads: 7 },
                        { name: 'Fri', uploads: 25, downloads: 12 },
                        { name: 'Sat', uploads: 10, downloads: 6 },
                        { name: 'Sun', uploads: 5, downloads: 3 }
                      ]}
                      margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="uploads" name="Uploads" fill="#3B82F6" />
                      <Bar dataKey="downloads" name="Downloads" fill="#10B981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="optimization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Storage Optimization</CardTitle>
              <CardDescription>
                Recommendations to improve your storage efficiency
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-start p-4 border border-yellow-200 bg-yellow-50 rounded-md">
                  <div className="mr-4 mt-1">
                    <InfoIcon className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div>
                    <h4 className="font-medium">Storage Almost Full</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      You're using {storagePercentage}% of your total storage. Consider optimizing or upgrading your plan.
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">Clean Up</Button>
                      <Button size="sm">Upgrade Plan</Button>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Optimization Opportunities</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">Duplicate Files</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              7 duplicate files found, totaling 850 MB
                            </p>
                          </div>
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">Medium</Badge>
                        </div>
                        <Button size="sm" className="mt-4" variant="outline">Remove Duplicates</Button>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">Large Files</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              4 files over 100 MB can be compressed
                            </p>
                          </div>
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-200">High</Badge>
                        </div>
                        <Button size="sm" className="mt-4" variant="outline">Compress Files</Button>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">Old Files</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              23 files haven't been accessed in 6+ months
                            </p>
                          </div>
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Low</Badge>
                        </div>
                        <Button size="sm" className="mt-4" variant="outline">Archive Old Files</Button>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">Provider Rebalancing</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              Google Drive (80% full), OneDrive (40% full)
                            </p>
                          </div>
                          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200">Medium</Badge>
                        </div>
                        <Button size="sm" className="mt-4" variant="outline">Rebalance Storage</Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Configuration Settings</h3>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                      <div>
                        <h4 className="font-medium">Auto-compression</h4>
                        <p className="text-sm text-muted-foreground">
                          Compress files larger than 50 MB
                        </p>
                      </div>
                      <Button variant="outline" size="sm">Configure</Button>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                      <div>
                        <h4 className="font-medium">Deduplication</h4>
                        <p className="text-sm text-muted-foreground">
                          Prevent storing identical files
                        </p>
                      </div>
                      <Button variant="outline" size="sm">Configure</Button>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                      <div>
                        <h4 className="font-medium">Smart Allocation</h4>
                        <p className="text-sm text-muted-foreground">
                          Optimize file placement across providers
                        </p>
                      </div>
                      <Button variant="outline" size="sm">Configure</Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default StoragePage;
