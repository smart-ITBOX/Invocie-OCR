import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, Building2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [formData, setFormData] = useState({
    company_name: '',
    company_gst_no: '',
    company_logo: '',
    address: '',
    contact_person: '',
    contact_number: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/settings/company`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data && response.data.company_name) {
        setFormData(response.data);
        if (response.data.company_logo) {
          setLogoPreview(response.data.company_logo);
        }
      }
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load settings');
      setLoading(false);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo size must be less than 2MB');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      setLogoPreview(base64String);
      setFormData({ ...formData, company_logo: base64String });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!formData.company_name || !formData.company_gst_no) {
      toast.error('Company name and GST number are required');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/settings/company`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Settings saved successfully!');
    } catch (error) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Loading settings...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6" data-testid="settings-page">
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
          <h1 className="text-3xl font-manrope font-bold text-[#0B2B5C]" data-testid="settings-title">
            Company Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure your company details for GST verification
          </p>
        </div>

        {/* Info Alert */}
        <Alert className="border-[#FFD700]/50 bg-[#FFD700]/5">
          <Building2 className="h-4 w-4 text-[#0B2B5C]" />
          <AlertTitle className="text-[#0B2B5C] font-manrope font-bold">Important</AlertTitle>
          <AlertDescription className="text-sm">
            Your company GST number will be used to validate invoices:
            <ul className="list-disc ml-5 mt-2">
              <li><strong>Purchase Invoices:</strong> Bill To GST must match your company GST</li>
              <li><strong>Sales Invoices:</strong> Bill From GST (supplier) must match your company GST</li>
            </ul>
            Mismatches will be highlighted for your review.
          </AlertDescription>
        </Alert>

        {/* Settings Form */}
        <Card className="border-[#0B2B5C]/10 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-manrope text-[#0B2B5C]">Company Information</CardTitle>
            <CardDescription>Update your company details for invoice processing</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Company Logo Upload */}
                <div className="md:col-span-2">
                  <Label className="text-[#0B2B5C] font-medium mb-2 block">
                    Company Logo
                  </Label>
                  <div className="flex items-center gap-4">
                    {logoPreview && (
                      <div className="w-24 h-24 border-2 border-[#0B2B5C]/20 rounded-sm p-2 bg-white flex items-center justify-center">
                        <img 
                          src={logoPreview} 
                          alt="Company Logo" 
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="cursor-pointer"
                        data-testid="logo-upload-input"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Upload company logo (PNG, JPG - Max 2MB). Recommended: 200x200px
                      </p>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="company_name" className="text-[#0B2B5C] font-medium">
                    Company Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="company_name"
                    data-testid="company-name-input"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="SMART ITBOX Pvt Ltd"
                    className="mt-1"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="company_gst_no" className="text-[#0B2B5C] font-medium">
                    Company GST Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="company_gst_no"
                    data-testid="company-gst-input"
                    value={formData.company_gst_no}
                    onChange={(e) => setFormData({ ...formData, company_gst_no: e.target.value.toUpperCase() })}
                    placeholder="29ABCDE1234F1Z5"
                    className="mt-1 font-mono"
                    maxLength={15}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    15-character alphanumeric GST identification number
                  </p>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="address" className="text-[#0B2B5C] font-medium">
                    Registered Address
                  </Label>
                  <Textarea
                    id="address"
                    data-testid="address-input"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 MG Road, Bangalore, Karnataka - 560001"
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="contact_person" className="text-[#0B2B5C] font-medium">
                    Contact Person
                  </Label>
                  <Input
                    id="contact_person"
                    data-testid="contact-person-input"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="John Doe"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="contact_number" className="text-[#0B2B5C] font-medium">
                    Contact Number
                  </Label>
                  <Input
                    id="contact_number"
                    data-testid="contact-number-input"
                    value={formData.contact_number}
                    onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                    placeholder="+91 9876543210"
                    className="mt-1"
                  />
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
                  data-testid="save-settings-btn"
                  disabled={saving}
                  className="bg-[#FFD700] hover:bg-[#FFD700]/90 text-[#0B2B5C] font-manrope font-bold"
                >
                  <Save size={16} className="mr-2" />
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}