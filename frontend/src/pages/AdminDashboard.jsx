import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Users, FileText, Building2, Shield, Eye, UserCheck, UserX, Calendar, Mail, Phone, MapPin } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [updatingUser, setUpdatingUser] = useState(null);

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

  const handleToggleAccess = async (user) => {
    setUpdatingUser(user.id);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/admin/users/${user.id}`,
        { is_active: !user.is_active },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`User ${!user.is_active ? 'enabled' : 'disabled'} successfully`);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update user');
    } finally {
      setUpdatingUser(null);
    }
  };

  const openViewDialog = (user) => {
    setSelectedUser(user);
    setViewDialogOpen(true);
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
          <p className="text-muted-foreground mt-1">Manage all registered users and their access</p>
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
                  <UserCheck className="text-[#10B981]" size={18} />
                  Active Users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-mono font-bold text-[#10B981]" data-testid="active-users">
                  {users.filter(u => u.is_active !== false).length}
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
            <CardTitle className="text-xl font-manrope text-[#0B2B5C]">All Registered Users</CardTitle>
            <CardDescription>View user details and manage their access</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#0B2B5C]/5">
                    <TableHead className="font-semibold">User</TableHead>
                    <TableHead className="font-semibold">Company</TableHead>
                    <TableHead className="font-semibold">GST No.</TableHead>
                    <TableHead className="font-semibold">Invoices</TableHead>
                    <TableHead className="font-semibold">Registered</TableHead>
                    <TableHead className="font-semibold text-center">Access</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow 
                      key={user.id} 
                      data-testid={`user-row-${user.id}`}
                      className={!user.is_active ? 'bg-red-50/50' : ''}
                    >
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.company_details?.company_name ? (
                          <div className="flex items-center gap-1">
                            <Building2 size={14} className="text-[#0B2B5C]" />
                            <span className="text-sm">{user.company_details.company_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.company_details?.company_gst_no ? (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {user.company_details.company_gst_no}
                          </code>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.invoice_count || 0}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(user.created_at)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={user.is_active !== false}
                            onCheckedChange={() => handleToggleAccess(user)}
                            disabled={updatingUser === user.id || user.role === 'admin'}
                            data-testid={`toggle-access-${user.id}`}
                          />
                          {user.is_active !== false ? (
                            <Badge variant="outline" className="text-[#10B981] border-[#10B981]">
                              Enabled
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[#EF4444] border-[#EF4444]">
                              Disabled
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openViewDialog(user)}
                          data-testid={`view-user-${user.id}`}
                        >
                          <Eye size={14} className="mr-1" />
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* View User Details Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-[#0B2B5C] font-manrope">User Details</DialogTitle>
              <DialogDescription>
                Complete information for {selectedUser?.name}
              </DialogDescription>
            </DialogHeader>
            
            {selectedUser && (
              <div className="space-y-4 py-4">
                {/* User Info Section */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-[#0B2B5C] flex items-center gap-2">
                    <Users size={16} />
                    User Information
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <div className="font-medium">{selectedUser.name}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <div className="font-medium">{selectedUser.email}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Registered:</span>
                      <div className="font-medium">{formatDate(selectedUser.created_at)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <div>
                        {selectedUser.is_active !== false ? (
                          <Badge variant="outline" className="text-[#10B981] border-[#10B981]">
                            <UserCheck size={12} className="mr-1" /> Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[#EF4444] border-[#EF4444]">
                            <UserX size={12} className="mr-1" /> Disabled
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Invoices:</span>
                      <div className="font-medium">{selectedUser.invoice_count || 0}</div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Company Details Section */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-[#0B2B5C] flex items-center gap-2">
                    <Building2 size={16} />
                    Company Details
                  </h4>
                  {selectedUser.company_details?.company_name ? (
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Company Name:</span>
                        <div className="font-medium">{selectedUser.company_details.company_name}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">GST Number:</span>
                        <div className="font-mono font-medium">
                          {selectedUser.company_details.company_gst_no || '-'}
                        </div>
                      </div>
                      {selectedUser.company_details.address && (
                        <div>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <MapPin size={12} /> Address:
                          </span>
                          <div className="font-medium">{selectedUser.company_details.address}</div>
                        </div>
                      )}
                      {selectedUser.company_details.contact_person && (
                        <div>
                          <span className="text-muted-foreground">Contact Person:</span>
                          <div className="font-medium">{selectedUser.company_details.contact_person}</div>
                        </div>
                      )}
                      {selectedUser.company_details.contact_number && (
                        <div>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Phone size={12} /> Contact:
                          </span>
                          <div className="font-medium">{selectedUser.company_details.contact_number}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No company details configured yet.
                    </p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
