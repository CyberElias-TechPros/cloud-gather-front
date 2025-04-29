
import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Clock, 
  Shield, 
  Settings, 
  Key, 
  Loader2, 
  Search, 
  ArrowUpDown, 
  CheckCircle, 
  PlusCircle,
  UserX,
  UserCheck,
  BadgeCheck,
  CalendarDays
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// Define team member interface
interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  avatarUrl: string;
  status: 'active' | 'invited' | 'disabled';
  lastActive?: string;
}

// Define invitation interface
interface Invitation {
  id: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  expires_at?: string;
}

const TeamPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state for new invitation
  const [newInvite, setNewInvite] = useState({
    email: '',
    role: 'member' as 'admin' | 'member' | 'viewer'
  });

  // Effect to load team data
  useEffect(() => {
    if (!user) return;

    const loadTeamData = async () => {
      setLoading(true);
      try {
        // Simulate fetching team members from database
        // In a real app, this would be a supabase query
        const mockTeamMembers: TeamMember[] = [
          {
            id: user.id,
            email: user.email || 'owner@example.com',
            name: user.user_metadata?.name || 'Team Owner',
            role: 'owner',
            avatarUrl: user.user_metadata?.avatar_url || '',
            status: 'active',
            lastActive: new Date().toISOString()
          },
          {
            id: '2',
            email: 'admin@example.com',
            name: 'John Admin',
            role: 'admin',
            avatarUrl: '',
            status: 'active',
            lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() // 1 day ago
          },
          {
            id: '3',
            email: 'member@example.com',
            name: 'Jane Member',
            role: 'member',
            avatarUrl: '',
            status: 'active',
            lastActive: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() // 2 hours ago
          }
        ];

        // Simulate fetching invitations
        const mockInvitations: Invitation[] = [
          {
            id: '1',
            email: 'invited@example.com',
            role: 'member',
            status: 'pending',
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() // 2 days ago
          }
        ];

        setTeamMembers(mockTeamMembers);
        setInvitations(mockInvitations);
      } catch (error: any) {
        console.error('Error loading team data:', error);
        toast.error(`Failed to load team data: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    loadTeamData();
  }, [user]);

  // Handle inviting new team member
  const handleInviteMember = async () => {
    if (!newInvite.email) {
      toast.error('Please enter an email address');
      return;
    }

    try {
      // Simulate sending invitation
      // In a real app, this would be a supabase function call or API request
      
      const newInvitation: Invitation = {
        id: `invite-${Date.now()}`,
        email: newInvite.email,
        role: newInvite.role,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      setInvitations([...invitations, newInvitation]);
      setInviteDialogOpen(false);
      setNewInvite({ email: '', role: 'member' });
      toast.success(`Invitation sent to ${newInvite.email}`);
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      toast.error(`Failed to send invitation: ${error.message}`);
    }
  };

  // Handle revoking invitation
  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      // Simulate revoking invitation
      // In a real app, this would be a supabase function call or API request
      setInvitations(invitations.filter(invite => invite.id !== invitationId));
      toast.success('Invitation revoked successfully');
    } catch (error: any) {
      console.error('Error revoking invitation:', error);
      toast.error(`Failed to revoke invitation: ${error.message}`);
    }
  };

  // Handle role change
  const handleChangeRole = async (memberId: string, newRole: 'owner' | 'admin' | 'member' | 'viewer') => {
    try {
      // Simulate changing role
      // In a real app, this would be a supabase function call or API request
      setTeamMembers(members => members.map(member => 
        member.id === memberId ? { ...member, role: newRole } : member
      ));
      toast.success('Role updated successfully');
    } catch (error: any) {
      console.error('Error changing role:', error);
      toast.error(`Failed to update role: ${error.message}`);
    }
  };

  // Handle removal of team member
  const handleRemoveMember = async (memberId: string) => {
    try {
      // Don't allow removing the owner
      const memberToRemove = teamMembers.find(m => m.id === memberId);
      if (memberToRemove?.role === 'owner') {
        toast.error('Cannot remove the team owner');
        return;
      }

      // Simulate removing member
      // In a real app, this would be a supabase function call or API request
      setTeamMembers(members => members.filter(member => member.id !== memberId));
      toast.success('Team member removed successfully');
    } catch (error: any) {
      console.error('Error removing team member:', error);
      toast.error(`Failed to remove team member: ${error.message}`);
    }
  };

  // Filter team members based on search query
  const filteredMembers = teamMembers.filter(member => 
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get user initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase();
  };

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    }
    
    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    }
    
    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 30) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
    
    return date.toLocaleDateString();
  };

  // Loading state
  if (authLoading) {
    return (
      <AppLayout title="Team Management">
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span>Loading team information...</span>
        </div>
      </AppLayout>
    );
  }

  // Not logged in state
  if (!user) {
    return (
      <AppLayout title="Team Management">
        <Card className="p-6">
          <CardContent className="flex flex-col items-center justify-center space-y-4 pt-6">
            <h2 className="text-xl font-semibold">Authentication Required</h2>
            <p className="text-center text-muted-foreground">
              You need to be logged in to manage your team.
            </p>
            <Button className="mt-4" onClick={() => window.location.href = '/login'}>
              Log In
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Team Management">
      <div className="mb-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Your Team</CardTitle>
                <CardDescription>
                  Manage your team members and their access permissions
                </CardDescription>
              </div>
              <Button onClick={() => setInviteDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <Tabs defaultValue="members">
              <TabsList className="mb-4">
                <TabsTrigger value="members">
                  <Users className="h-4 w-4 mr-2" />
                  Members ({teamMembers.length})
                </TabsTrigger>
                <TabsTrigger value="invitations">
                  <Mail className="h-4 w-4 mr-2" />
                  Invitations ({invitations.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="members">
                {loading ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                    <span>Loading team members...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredMembers.length > 0 ? (
                      filteredMembers.map(member => (
                        <Card key={member.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <Avatar className="h-10 w-10 mr-4">
                                  {member.avatarUrl ? (
                                    <AvatarImage src={member.avatarUrl} alt={member.name} />
                                  ) : (
                                    <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                                  )}
                                </Avatar>
                                <div>
                                  <div className="font-medium">{member.name}</div>
                                  <div className="text-sm text-muted-foreground">{member.email}</div>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <div className="flex flex-col items-end mr-4">
                                  <div className="flex items-center">
                                    <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      {formatDate(member.lastActive)}
                                    </span>
                                  </div>
                                  <Badge 
                                    variant={member.role === 'owner' ? 'default' : 
                                            member.role === 'admin' ? 'secondary' : 
                                            'outline'}
                                    className="mt-1"
                                  >
                                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                                  </Badge>
                                </div>
                                
                                {member.id !== user.id && (
                                  <div className="flex space-x-2">
                                    <Select 
                                      defaultValue={member.role}
                                      onValueChange={(value) => handleChangeRole(member.id, value as any)}
                                    >
                                      <SelectTrigger className="w-[110px]">
                                        <SelectValue placeholder="Role" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="admin">Admin</SelectItem>
                                        <SelectItem value="member">Member</SelectItem>
                                        <SelectItem value="viewer">Viewer</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    
                                    <Button 
                                      variant="destructive" 
                                      size="sm"
                                      onClick={() => handleRemoveMember(member.id)}
                                    >
                                      <UserX className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        No team members found matching your search
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="invitations">
                {loading ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
                    <span>Loading invitations...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {invitations.length > 0 ? (
                      invitations.map(invitation => (
                        <Card key={invitation.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <Avatar className="h-10 w-10 mr-4">
                                  <AvatarFallback>
                                    <Mail className="h-5 w-5" />
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">{invitation.email}</div>
                                  <div className="text-sm text-muted-foreground">
                                    Invited {formatDate(invitation.created_at)}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-4">
                                <Badge 
                                  variant={invitation.role === 'admin' ? 'secondary' : 'outline'}
                                >
                                  {invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)}
                                </Badge>
                                
                                <Badge 
                                  variant={invitation.status === 'pending' ? 'outline' : 
                                          invitation.status === 'accepted' ? 'default' : 'destructive'}
                                >
                                  {invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1)}
                                </Badge>
                                
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  onClick={() => handleRevokeInvitation(invitation.id)}
                                >
                                  Revoke
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        No pending invitations
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Team Settings</CardTitle>
            <CardDescription>
              Configure settings for your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Team Name</h3>
                <div className="flex items-center space-x-2">
                  <Input defaultValue="Your Team" />
                  <Button>Save</Button>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-2">Default Role for New Members</h3>
                <Select defaultValue="member">
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Default Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="text-lg font-medium mb-2">Permissions</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Allow members to invite others</div>
                      <div className="text-sm text-muted-foreground">
                        When enabled, all team members can invite new users
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline">Disable</Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <div className="font-medium">Allow viewers to download files</div>
                      <div className="text-sm text-muted-foreground">
                        When enabled, users with viewer role can download files
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline">Disable</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Invite Member Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to collaborate on your cloud storage
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@example.com"
                value={newInvite.email}
                onChange={(e) => setNewInvite({ ...newInvite, email: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={newInvite.role}
                onValueChange={(value) => setNewInvite({ ...newInvite, role: value as any })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center">
                      <Shield className="h-4 w-4 mr-2" />
                      <div>
                        <div>Admin</div>
                        <div className="text-xs text-muted-foreground">
                          Can manage team and all resources
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="member">
                    <div className="flex items-center">
                      <UserCheck className="h-4 w-4 mr-2" />
                      <div>
                        <div>Member</div>
                        <div className="text-xs text-muted-foreground">
                          Can upload and manage files
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex items-center">
                      <BadgeCheck className="h-4 w-4 mr-2" />
                      <div>
                        <div>Viewer</div>
                        <div className="text-xs text-muted-foreground">
                          Can only view files
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter className="flex space-x-2 sm:justify-end">
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleInviteMember} 
              disabled={!newInvite.email}
            >
              <Mail className="h-4 w-4 mr-2" />
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default TeamPage;
