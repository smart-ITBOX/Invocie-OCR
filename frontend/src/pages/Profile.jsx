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
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, User, Mail, Calendar, Shield, Key, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setProfile(response.data);
      setFormData(prev => ({
        ...prev,
        name: response.data.name || ''
      }));
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load profile');
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    
    // Validate password if changing
    if (formData.new_password) {
      if (!formData.current_password) {
        toast.error('Please enter your current password');
        return;
      }
      if (formData.new_password !== formData.confirm_password) {
        toast.error('New passwords do not match');
        return;
      }
      if (formData.new_password.length < 6) {
        toast.error('New password must be at least 6 characters');
        return;
      }
    }
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const updateData = {
        name: formData.name
      };
      
      if (formData.new_password) {
        updateData.current_password = formData.current_password;
        updateData.new_password = formData.new_password;
      }
      
      await axios.put(`${API}/users/me`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update localStorage
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      user.name = formData.name;
      localStorage.setItem('user', JSON.stringify(user));
      
      toast.success('Profile updated successfully!');
      
      // Clear password fields
      setFormData(prev => ({
        ...prev,
        current_password: '',
        new_password: '',
        confirm_password: ''
      }));
      
      // Reload to refresh header
      window.location.reload();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const isSubscriptionActive = () => {
    if (!profile?.subscription_valid_until) return false;
    try {
      return new Date(profile.subscription_valid_until) > new Date();
    } catch {
      return false;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Loading profile...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6" data-testid="profile-page">
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
          <h1 className="text-3xl font-manrope font-bold text-[#0B2B5C]" data-testid="profile-title">
            My Profile
          </h1>
          <p className="text-muted-foreground mt-1">
            View and update your account information
          </p>
        </div>

        {/* Account Info Card */}
        <Card className="border-[#0B2B5C]/10 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-manrope text-[#0B2B5C] flex items-center gap-2">
              <User size={20} />
              Account Information
            </CardTitle>
            <CardDescription>Your account details and subscription status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <Label className="text-muted-foreground text-sm">Email Address</Label>
                <div className="flex items-center gap-2">
                  <Mail size={16} className="text-[#0B2B5C]" />
                  <span className="font-medium">{profile?.email}</span>
                </div>
              </div>
              
              <div className="space-y-1">
                <Label className="text-muted-foreground text-sm">Account Role</Label>
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-[#0B2B5C]" />
                  <Badge 
                    variant={profile?.role === 'admin' ? 'default' : 'secondary'}
                    className={profile?.role === 'admin' ? 'bg-[#0B2B5C]' : ''}
                  >
                    {profile?.role === 'admin' ? 'Admin' : 'User'}
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-1">
                <Label className="text-muted-foreground text-sm">Member Since</Label>
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-[#0B2B5C]" />
                  <span className="font-medium">{formatDate(profile?.created_at)}</span>
                </div>
              </div>
              
              <div className="space-y-1">
                <Label className="text-muted-foreground text-sm">Subscription Status</Label>
                <div className="flex items-center gap-2">
                  {profile?.subscription_valid_until ? (
                    <>
                      {isSubscriptionActive() ? (
                        <Badge variant="outline" className="text-[#10B981] border-[#10B981]">
                          Active until {formatDate(profile.subscription_valid_until)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[#EF4444] border-[#EF4444]">
                          Expired on {formatDate(profile.subscription_valid_until)}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">No subscription</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Profile Form */}
        <Card className="border-[#0B2B5C]/10 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-manrope text-[#0B2B5C]">Update Profile</CardTitle>
            <CardDescription>Change your name or password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[#0B2B5C] font-medium">
                  Display Name
                </Label>
                <Input
                  id="name"
                  data-testid="name-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Your name"
                />
              </div>

              <Separator />

              {/* Password Change Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Key size={18} className="text-[#0B2B5C]" />
                  <Label className="text-[#0B2B5C] font-medium text-lg">Change Password</Label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Leave blank if you don't want to change your password
                </p>

                <div className="space-y-2">
                  <Label htmlFor="current_password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current_password"
                      data-testid="current-password-input"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={formData.current_password}
                      onChange={(e) => setFormData({ ...formData, current_password: e.target.value })}
                      placeholder="Enter current password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="new_password">New Password</Label>
                    <div className="relative">
                      <Input
                        id="new_password"
                        data-testid="new-password-input"
                        type={showNewPassword ? 'text' : 'password'}
                        value={formData.new_password}
                        onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
                        placeholder="Enter new password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm_password">Confirm New Password</Label>
                    <Input
                      id="confirm_password"
                      data-testid="confirm-password-input"
                      type="password"
                      value={formData.confirm_password}
                      onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/')}
                  className="border-[#0B2B5C] text-[#0B2B5C]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  data-testid="save-profile-btn"
                  disabled={saving}
                  className="bg-[#FFD700] hover:bg-[#FFD700]/90 text-[#0B2B5C] font-manrope font-bold"
                >
                  <Save size={16} className="mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Admin Notice */}
        {profile?.role === 'admin' && (
          <Alert className="border-[#0B2B5C]/30 bg-[#0B2B5C]/5">
            <Shield className="h-4 w-4 text-[#0B2B5C]" />
            <AlertTitle className="text-[#0B2B5C] font-manrope font-bold">Admin Access</AlertTitle>
            <AlertDescription className="text-sm">
              You have admin privileges. Access the{' '}
              <Button 
                variant="link" 
                className="p-0 h-auto text-[#0B2B5C] underline"
                onClick={() => navigate('/admin')}
              >
                Super Admin Panel
              </Button>
              {' '}to manage users and subscriptions.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </Layout>
  );
}
