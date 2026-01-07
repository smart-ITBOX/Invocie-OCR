import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, CheckCircle, Clock, TrendingUp, ShoppingCart, Receipt } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard() {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [stats, setStats] = useState({ 
    pending: 0, verified: 0, total: 0, totalAmount: 0,
    purchaseInvoices: 0, salesInvoices: 0
  });
  const [invoiceType, setInvoiceType] = useState('purchase');

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
      const purchaseInvoices = invoices.filter(inv => inv.invoice_type === 'purchase').length;
      const salesInvoices = invoices.filter(inv => inv.invoice_type === 'sales').length;
      
      setStats({ pending, verified, total, totalAmount, purchaseInvoices, salesInvoices });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      
      if (acceptedFiles.length === 1) {
        // Single file upload
        formData.append('file', acceptedFiles[0]);
        const token = localStorage.getItem('token');
        const response = await axios.post(
          `${API}/invoices/upload?invoice_type=${invoiceType}`,
          formData,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
        toast.success('Invoice uploaded and processed successfully!');
        navigate(`/verify/${response.data.id}`);
      } else {
        // Batch upload
        acceptedFiles.forEach(file => {
          formData.append('files', file);
        });

        const token = localStorage.getItem('token');
        const response = await axios.post(
          `${API}/invoices/batch-upload?invoice_type=${invoiceType}`,
          formData,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(percentCompleted);
            }
          }
        );

        toast.success(
          `Batch upload complete! ${response.data.successful}/${response.data.total_files} invoices processed successfully`
        );
        loadDashboardData();
        navigate('/invoices');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [navigate, invoiceType]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 20,
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

  const getTypeIcon = (type) => {
    return type === 'sales' ? <Receipt size={14} /> : <ShoppingCart size={14} />;
  };

  return (
    <Layout>
      <div className="space-y-8" data-testid="dashboard-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-manrope font-bold text-[#0B2B5C] mb-2" data-testid="dashboard-title">
              Invoice Processing Dashboard
            </h1>
            <p className="text-muted-foreground">Upload, extract, and verify invoice data with AI</p>
          </div>
          <Button
            onClick={() => navigate('/reports')}
            data-testid="view-reports-btn"
            className="bg-[#FFD700] hover:bg-[#FFD700]/90 text-[#0B2B5C] font-manrope font-bold"
          >
            GST Reports
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="border-[#0B2B5C]/10 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <FileText className="text-[#0B2B5C]" size={16} />
                Total
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-mono font-bold text-[#0B2B5C]" data-testid="total-invoices-count">{stats.total}</div>
            </CardContent>
          </Card>

          <Card className="border-[#EF4444]/10 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <ShoppingCart className="text-[#EF4444]" size={16} />
                Purchase
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-mono font-bold text-[#EF4444]" data-testid="purchase-invoices-count">{stats.purchaseInvoices}</div>
            </CardContent>
          </Card>

          <Card className="border-[#10B981]/10 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Receipt className="text-[#10B981]" size={16} />
                Sales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-mono font-bold text-[#10B981]" data-testid="sales-invoices-count">{stats.salesInvoices}</div>
            </CardContent>
          </Card>

          <Card className="border-[#F59E0B]/10 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Clock className="text-[#F59E0B]" size={16} />
                Pending
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-mono font-bold text-[#F59E0B]" data-testid="pending-invoices-count">{stats.pending}</div>
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
              <div className="text-2xl font-mono font-bold text-[#10B981]" data-testid="verified-invoices-count">{stats.verified}</div>
            </CardContent>
          </Card>

          <Card className="border-[#0B2B5C]/10 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="text-[#0B2B5C]" size={16} />
                Total Value
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-mono font-bold text-[#0B2B5C]" data-testid="total-amount-display">
                ₹{stats.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upload Section */}
        <Card className="border-[#FFD700]/20 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-manrope text-[#0B2B5C]">Upload Invoices</CardTitle>
                <CardDescription>Single or batch upload (max 20 files) - PDF, JPG, PNG</CardDescription>
              </div>
              <Tabs value={invoiceType} onValueChange={setInvoiceType} className="w-auto">
                <TabsList data-testid="invoice-type-tabs">
                  <TabsTrigger value="purchase" data-testid="purchase-tab">
                    <ShoppingCart size={16} className="mr-2" />
                    Purchase
                  </TabsTrigger>
                  <TabsTrigger value="sales" data-testid="sales-tab">
                    <Receipt size={16} className="mr-2" />
                    Sales
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
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
                <div className="space-y-3">
                  <p className="text-[#0B2B5C] font-medium">Processing invoices...</p>
                  {uploadProgress > 0 && (
                    <Progress value={uploadProgress} className="w-full max-w-md mx-auto" />
                  )}
                </div>
              ) : isDragActive ? (
                <p className="text-[#FFD700] font-medium">Drop invoices here</p>
              ) : (
                <>
                  <p className="text-[#0B2B5C] font-medium mb-2">
                    Drop {invoiceType === 'purchase' ? 'purchase' : 'sales'} invoices here or click to browse
                  </p>
                  <p className="text-sm text-muted-foreground">Upload 1-20 invoices at once (Max 10MB each)</p>
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
                    <div className="flex items-center gap-3 flex-1">
                      {getTypeIcon(invoice.invoice_type)}
                      <div>
                        <div className="font-medium text-[#0B2B5C]">
                          {invoice.extracted_data?.supplier_name || 'Unknown Party'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {invoice.invoice_type === 'sales' ? 'Sales' : 'Purchase'} #{invoice.extracted_data?.invoice_no || 'N/A'} • {invoice.filename}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-mono font-medium text-[#0B2B5C]">
                          ₹{(invoice.extracted_data?.total_amount || 0).toLocaleString('en-IN')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {invoice.extracted_data?.invoice_date || new Date(invoice.created_at).toLocaleDateString()}
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