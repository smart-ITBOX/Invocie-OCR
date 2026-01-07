import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard() {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [stats, setStats] = useState({ pending: 0, verified: 0, total: 0, totalAmount: 0 });

  React.useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/invoices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const invoices = response.data;
      setRecentInvoices(invoices.slice(0, 5));
      
      const pending = invoices.filter(inv => inv.status === 'pending').length;
      const verified = invoices.filter(inv => inv.status === 'verified').length;
      const total = invoices.length;
      const totalAmount = invoices.reduce((sum, inv) => sum + (inv.extracted_data?.total_amount || 0), 0);
      
      setStats({ pending, verified, total, totalAmount });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/invoices/upload`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.success('Invoice uploaded and processed successfully!');
      navigate(`/verify/${response.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [navigate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    disabled: uploading
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'verified': return 'text-[#10B981] bg-[#10B981]/10';
      case 'pending': return 'text-[#F59E0B] bg-[#F59E0B]/10';
      case 'exported': return 'text-[#0B2B5C] bg-[#0B2B5C]/10';
      default: return 'text-gray-500 bg-gray-100';
    }
  };

  return (
    <Layout>
      <div className="space-y-8" data-testid="dashboard-page">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-manrope font-bold text-[#0B2B5C] mb-2" data-testid="dashboard-title">
            Invoice Processing Dashboard
          </h1>
          <p className="text-muted-foreground">Upload, extract, and verify invoice data with AI</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border-[#0B2B5C]/10 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <FileText className="text-[#0B2B5C]" size={16} />
                Total Invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-bold text-[#0B2B5C]" data-testid="total-invoices-count">{stats.total}</div>
            </CardContent>
          </Card>

          <Card className="border-[#F59E0B]/10 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Clock className="text-[#F59E0B]" size={16} />
                Pending Review
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-bold text-[#F59E0B]" data-testid="pending-invoices-count">{stats.pending}</div>
            </CardContent>
          </Card>

          <Card className="border-[#10B981]/10 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <CheckCircle className="text-[#10B981]" size={16} />
                Verified
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-bold text-[#10B981]" data-testid="verified-invoices-count">{stats.verified}</div>
            </CardContent>
          </Card>

          <Card className="border-[#0B2B5C]/10 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="text-[#0B2B5C]" size={16} />
                Total Amount
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-mono font-bold text-[#0B2B5C]" data-testid="total-amount-display">
                ₹{stats.totalAmount.toLocaleString('en-IN')}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upload Section */}
        <Card className="border-[#FFD700]/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-manrope text-[#0B2B5C]">Upload Invoice</CardTitle>
            <CardDescription>Drag and drop or click to upload invoice (PDF, JPG, PNG)</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              data-testid="invoice-upload-dropzone"
              className={`
                border-2 border-dashed rounded-sm p-12 text-center cursor-pointer
                transition-all duration-200
                ${isDragActive 
                  ? 'border-[#FFD700] bg-[#FFD700]/5' 
                  : 'border-[#0B2B5C]/20 hover:border-[#FFD700] hover:bg-[#FFD700]/5'
                }
                ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto mb-4 text-[#0B2B5C]" size={48} />
              {uploading ? (
                <p className="text-[#0B2B5C] font-medium">Processing invoice...</p>
              ) : isDragActive ? (
                <p className="text-[#FFD700] font-medium">Drop the invoice here</p>
              ) : (
                <>
                  <p className="text-[#0B2B5C] font-medium mb-2">Drop invoice here or click to browse</p>
                  <p className="text-sm text-muted-foreground">Supports PDF, JPEG, PNG (Max 10MB)</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card className="border-[#0B2B5C]/10 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-manrope text-[#0B2B5C]">Recent Invoices</CardTitle>
            <CardDescription>Latest processed invoices</CardDescription>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <Alert data-testid="no-invoices-message">
                <AlertDescription>
                  No invoices yet. Upload your first invoice to get started!
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {recentInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    data-testid={`recent-invoice-${invoice.id}`}
                    className="flex items-center justify-between p-4 border border-border rounded-sm hover:bg-muted/50 transition-colors duration-200 cursor-pointer"
                    onClick={() => navigate(`/verify/${invoice.id}`)}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-[#0B2B5C]">
                        {invoice.extracted_data?.supplier_name || 'Unknown Supplier'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Invoice #{invoice.extracted_data?.invoice_no || 'N/A'} • {invoice.filename}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-mono font-medium text-[#0B2B5C]">
                          ₹{(invoice.extracted_data?.total_amount || 0).toLocaleString('en-IN')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(invoice.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-sm text-xs font-medium ${getStatusColor(invoice.status)}`}>
                        {invoice.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {recentInvoices.length > 0 && (
              <Button
                onClick={() => navigate('/invoices')}
                variant="outline"
                data-testid="view-all-invoices-btn"
                className="w-full mt-4 border-[#0B2B5C] text-[#0B2B5C] hover:bg-[#0B2B5C] hover:text-white"
              >
                View All Invoices
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}