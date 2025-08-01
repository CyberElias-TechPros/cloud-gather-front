
import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Users,
  UserPlus,
  Crown,
  Shield,
  User,
  Mail,
  MoreVertical,
  Search,
  Settings,
  FileText,
  Calendar,
  Activity,
  AlertCircle,
  Check,
  X,
  Loader2
} from 'lucide-react';

interface TeamMember {
  id: string;
  email: string;
  displayName?: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'pending' | 'inactive';
  joinedAt: string;
  lastActive?: string;
  avatarUrl?: string;
  permissions: string[];
}

interface TeamInvite {
  id: string;
  email: string;
  role: 'admin' | 'member';
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired';
}

const TeamPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<TeamInvite[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      window.location.href = '/auth';
      return;
    }
    
    loadTeamData();
  }, [user, authLoading]);

  const loadTeamData = async () => {
    setLoading(true);
    
    try {
      // In a real app, you'd have team_members and team_invites tables
      // For now, we'll create mock data based on the current user
      const mockTeamMembers: TeamMember[] = [
        {
          id: user?.id || '1',
          email: user?.email || 'user@example.com',
          displayName: user?.user_metadata?.name || 'You',
          role: 'owner',
          status: 'active',
          joinedAt: user?.created_at || new Date().toISOString(),
          lastActive: new Date().toISOString(),
          avatarUrl: user?.user_metadata?.avatar_url,
          permissions: ['read', 'write', 'admin', 'invite']
        }
      ];

      const mockInvites: TeamInvite[] = [];

      setTeamMembers(mockTeamMembers);
      setPendingInvites(mockInvites);
      
    } catch (error) {
      console.error('Error loading team data:', error);
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    if (!inviteEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSending(true);
    
    try {
      // In a real app, this would create a team invite record and send an email
      const newInvite: TeamInvite = {
        id: Date.now().toString(),
        email: inviteEmail.trim(),
        role: inviteRole,
        invitedBy: user?.email || 'Unknown',
        invitedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        status: 'pending'
      };

      setPendingInvites(prev => [...prev, newInvite]);
      setInviteEmail('');
      setInviteRole('member');
      setInviteDialogOpen(false);
      
      toast.success(`Invitation sent to ${inviteEmail}`);
    } catch (error) {
      console.error('Error sending invite:', error);
      toast.error('Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const removeTeamMember = async (memberId: string) => {
    const member = teamMembers.find(m => m.id === memberId);
    if (!member) return;

    if (member.role === 'owner') {
      toast.error('Cannot remove the team owner');
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to remove ${member.displayName || member.email} from the team?`);
    if (!confirmed) return;

    try {
      // In a real app, this would remove the team member from the database
      setTeamMembers(prev => prev.filter(m => m.id !== memberId));
      toast.success('Team member removed successfully');
    } catch (error) {
      console.error('Error removing team member:', error);
      toast.error('Failed to remove team member');
    }
  };

  const updateMemberRole = async (memberId: string, newRole: 'admin' | 'member') => {
    try {
      setTeamMembers(prev => prev.map(member => 
        member.id === memberId ? { ...member, role: newRole } : member
      ));
      toast.success('Member role updated successfully');
    } catch (error) {
      console.error('Error updating member role:', error);
      toast.error('Failed to update member role');
    }
  };

  const cancelInvite = async (inviteId: string) => {
    try {
      setPendingInvites(prev => prev.filter(invite => invite.id !== inviteId));
      toast.success('Invitation cancelled');
    } catch (error) {
      console.error('Error cancelling invite:', error);
      toast.error('Failed to cancel invitation');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return Crown;
      case 'admin': return Shield;
      case 'member': return User;
      default: return User;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'admin': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'member': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  const filteredMembers = teamMembers.filter(member =>
    member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <AppLayout title="Team">
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span>Loading team...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Team">
      <div className="space-y-6">
        {/* Team Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teamMembers.length}</div>
              <p className="text-xs text-muted-foreground">
                Active members
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Invites</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingInvites.length}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting response
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Plan</CardTitle>
              <Crown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Free</div>
              <p className="text-xs text-muted-foreground">
                Up to 5 members
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="members" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <TabsList>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="invites">Invites</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="inviteEmail">Email Address</Label>
                    <Input
                      id="inviteEmail"
                      type="email"
                      placeholder="Enter email address"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="inviteRole">Role</Label>
                    <Select value={inviteRole} onValueChange={(value: 'admin' | 'member') => setInviteRole(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {inviteRole === 'admin' 
                        ? 'Admins can manage team members and settings.'
                        : 'Members can access and manage files.'
                      }
                    </AlertDescription>
                  </Alert>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={sendInvite} disabled={sending}>
                      {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                      Send Invite
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <TabsContent value="members" className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search team members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid gap-4">
              {filteredMembers.map((member) => {
                const RoleIcon = getRoleIcon(member.role);
                
                return (
                  <Card key={member.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={member.avatarUrl} />
                          <AvatarFallback>
                            {member.displayName?.charAt(0) || member.email.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium truncate">
                              {member.displayName || member.email}
                            </h3>
                            <Badge variant="outline" className={getRoleColor(member.role)}>
                              <RoleIcon className="h-3 w-3 mr-1" />
                              {member.role}
                            </Badge>
                            <Badge variant="secondary" className={getStatusColor(member.status)}>
                              {member.status}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{member.email}</span>
                            <span>Joined {formatTimeAgo(member.joinedAt)}</span>
                            {member.lastActive && (
                              <span>Active {formatTimeAgo(member.lastActive)}</span>
                            )}
                          </div>
                        </div>

                        {member.role !== 'owner' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => updateMemberRole(member.id, member.role === 'admin' ? 'member' : 'admin')}>
                                <Shield className="h-4 w-4 mr-2" />
                                Make {member.role === 'admin' ? 'Member' : 'Admin'}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => removeTeamMember(member.id)}
                                className="text-destructive"
                              >
                                <X className="h-4 w-4 mr-2" />
                                Remove from team
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="invites" className="space-y-4">
            {pendingInvites.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No pending invites</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Invite team members to collaborate on your files and projects.
                  </p>
                  <Button onClick={() => setInviteDialogOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Send Invite
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingInvites.map((invite) => (
                  <Card key={invite.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <Mail className="h-5 w-5 text-primary" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium truncate">{invite.email}</h3>
                            <Badge variant="outline" className={getRoleColor(invite.role)}>
                              {invite.role}
                            </Badge>
                            <Badge variant="secondary" className={getStatusColor(invite.status)}>
                              {invite.status}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>Invited by {invite.invitedBy}</span>
                            <span>Sent {formatTimeAgo(invite.invitedAt)}</span>
                            <span>Expires {formatTimeAgo(invite.expiresAt)}</span>
                          </div>
                        </div>

                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => cancelInvite(invite.id)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Team Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Allow members to invite others</h4>
                      <p className="text-sm text-muted-foreground">
                        Let team members send invites to new members
                      </p>
                    </div>
                    <Badge variant="secondary">Coming Soon</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Require approval for new members</h4>
                      <p className="text-sm text-muted-foreground">
                        All new members must be approved by an admin
                      </p>
                    </div>
                    <Badge variant="secondary">Coming Soon</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Team file sharing</h4>
                      <p className="text-sm text-muted-foreground">
                        Allow members to share files with the entire team
                      </p>
                    </div>
                    <Badge variant="secondary">Coming Soon</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default TeamPage;
