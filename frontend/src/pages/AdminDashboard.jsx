import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Users, FileText, CreditCard, Shield, Edit, Trash2, UserCheck, UserX, Calendar } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    role: '',
    subscription_months: 1
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [usersRes, statsRes] = await Promise.all([
        axios.get(`${API}/admin/users`, { headers }),
        axios.get(`${API}/admin/stats`, { headers })
      ]);
      
      setUsers(usersRes.data);
      setStats(statsRes.data);
      setLoading(false);
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('Admin access required');
        navigate('/');
      } else {
        toast.error('Failed to load admin data');
      }
      setLoading(false);
    }
  };

  const openEditDialog = (user) => {
    setSelectedUser(user);
    setEditForm({
      role: user.role || 'user',
      subscription_months: 1
    });
    setEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      // Calculate subscription end date
      const subscriptionDate = new Date();
      subscriptionDate.setMonth(subscriptionDate.getMonth() + editForm.subscription_months);
      
      await axios.put(
        `${API}/admin/users/${selectedUser.id}`,
        {
          role: editForm.role,
          subscription_valid_until: subscriptionDate.toISOString()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('User updated successfully');
      setEditDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (user) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/admin/users/${userToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('User deleted successfully');
      setDeleteDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const isSubscriptionActive = (dateStr) => {
    if (!dateStr) return false;
    try {
      return new Date(dateStr) > new Date();
    } catch {
      return false;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12" data-testid="loading-message">Loading admin panel...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="admin-dashboard">
        {/* Header */}
        <div>
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            data-testid="back-btn"
            className="mb-2 -ml-2 text-[#0B2B5C] hover:text-[#0B2B5C] hover:bg-[#0B2B5C]/5"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-manrope font-bold text-[#0B2B5C]" data-testid="admin-title">
            <Shield className="inline-block mr-3 text-[#FFD700]" size={32} />
            Super Admin Panel
          </h1>
          <p className="text-muted-foreground mt-1">Manage users and subscriptions</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-[#0B2B5C]/10 shadow-md">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Users className="text-[#0B2B5C]" size={18} />
                  Total Users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-mono font-bold text-[#0B2B5C]" data-testid="total-users">
                  {stats.total_users}
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#10B981]/20 shadow-md">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <CreditCard className="text-[#10B981]" size={18} />
                  Active Subscriptions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-mono font-bold text-[#10B981]" data-testid="active-subs">
                  {stats.active_subscriptions}
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#FFD700]/30 shadow-md">
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <FileText className="text-[#FFD700]" size={18} />
                  Total Invoices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-mono font-bold text-[#0B2B5C]" data-testid="total-invoices">
                  {stats.total_invoices}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Users Table */}
        <Card className="border-[#0B2B5C]/10 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-manrope text-[#0B2B5C]">User Management</CardTitle>
            <CardDescription>View and manage all registered users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#0B2B5C]/5">
                    <TableHead className="font-semibold">User</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                    <TableHead className="font-semibold">Role</TableHead>
                    <TableHead className="font-semibold">Subscription</TableHead>
                    <TableHead className="font-semibold">Registered</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={user.role === 'admin' ? 'default' : 'secondary'}
                          className={user.role === 'admin' ? 'bg-[#0B2B5C]' : ''}
                        >
                          {user.role === 'admin' ? (
                            <><Shield size={12} className="mr-1" /> Admin</>
                          ) : (
                            'User'
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.subscription_valid_until ? (
                          <div className="flex items-center gap-2">
                            {isSubscriptionActive(user.subscription_valid_until) ? (
                              <Badge variant="outline" className="text-[#10B981] border-[#10B981]">
                                <UserCheck size={12} className="mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[#EF4444] border-[#EF4444]">
                                <UserX size={12} className="mr-1" />
                                Expired
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDate(user.subscription_valid_until)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not set</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(user.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                            data-testid={`edit-user-${user.id}`}
                          >
                            <Edit size={14} className="mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteDialog(user)}
                            className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
                            data-testid={`delete-user-${user.id}`}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#0B2B5C] font-manrope">Edit User</DialogTitle>
              <DialogDescription>
                Update {selectedUser?.name}'s role and subscription
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select 
                  value={editForm.role} 
                  onValueChange={(value) => setEditForm({ ...editForm, role: value })}
                >
                  <SelectTrigger data-testid="role-select">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Extend Subscription By</Label>
                <Select 
                  value={String(editForm.subscription_months)} 
                  onValueChange={(value) => setEditForm({ ...editForm, subscription_months: parseInt(value) })}
                >
                  <SelectTrigger data-testid="subscription-select">
                    <SelectValue placeholder="Select months" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Month</SelectItem>
                    <SelectItem value="3">3 Months</SelectItem>
                    <SelectItem value="6">6 Months</SelectItem>
                    <SelectItem value="12">12 Months</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  <Calendar size={12} className="inline mr-1" />
                  New expiry: {new Date(Date.now() + editForm.subscription_months * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateUser}
                disabled={saving}
                className="bg-[#0B2B5C] hover:bg-[#0B2B5C]/90"
                data-testid="save-user-btn"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete <strong>{userToDelete?.name}</strong> ({userToDelete?.email}) 
                and all their invoices and settings. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteUser}
                className="bg-[#EF4444] hover:bg-[#EF4444]/90"
                data-testid="confirm-delete-btn"
              >
                Delete User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
