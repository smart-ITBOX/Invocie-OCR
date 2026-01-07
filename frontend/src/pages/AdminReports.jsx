import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Search, Building2, FileText, Filter, Eye } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminReports() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [invoicesRes, companiesRes] = await Promise.all([
        axios.get(`${API}/admin/invoices`, { headers }),
        axios.get(`${API}/admin/companies`, { headers })
      ]);
      
      setInvoices(invoicesRes.data);
      setCompanies(companiesRes.data);
      setLoading(false);
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error('Admin access required');
        navigate('/admin');
      } else {
        toast.error('Failed to load data');
      }
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    // Company filter
    if (selectedCompany !== 'all' && invoice.company_name !== selectedCompany) {
      return false;
    }
    
    // Type filter
    if (selectedType !== 'all' && invoice.invoice_type !== selectedType) {
      return false;
    }
    
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const searchable = `${invoice.company_name || ''} ${invoice.extracted_data?.invoice_no || ''} ${invoice.extracted_data?.supplier_name || ''} ${invoice.user_name || ''}`.toLowerCase();
      if (!searchable.includes(search)) {
        return false;
      }
    }
    
    return true;
  });

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

  const formatAmount = (amount) => {
    if (!amount) return '-';
    return `₹${Number(amount).toLocaleString('en-IN')}`;
  };

  // Group invoices by company for summary
  const companySummary = {};
  invoices.forEach(inv => {
    const company = inv.company_name || 'Unknown';
    if (!companySummary[company]) {
      companySummary[company] = { count: 0, purchase: 0, sales: 0 };
    }
    companySummary[company].count++;
    if (inv.invoice_type === 'purchase') {
      companySummary[company].purchase += inv.extracted_data?.total_amount || 0;
    } else {
      companySummary[company].sales += inv.extracted_data?.total_amount || 0;
    }
  });

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Loading invoices...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="admin-reports">
        {/* Header */}
        <div>
          <Button
            onClick={() => navigate('/admin')}
            variant="ghost"
            data-testid="back-btn"
            className="mb-2 -ml-2 text-[#0B2B5C] hover:text-[#0B2B5C] hover:bg-[#0B2B5C]/5"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to User Management
          </Button>
          <h1 className="text-3xl font-manrope font-bold text-[#0B2B5C]" data-testid="admin-reports-title">
            <FileText className="inline-block mr-3 text-[#FFD700]" size={32} />
            All Company Invoices
          </h1>
          <p className="text-muted-foreground mt-1">View all invoices from all registered companies</p>
        </div>

        {/* Company Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(companySummary).slice(0, 4).map(([company, data]) => (
            <Card key={company} className="border-[#0B2B5C]/10">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 size={16} className="text-[#0B2B5C]" />
                  <span className="font-medium text-sm truncate">{company}</span>
                </div>
                <div className="text-2xl font-mono font-bold text-[#0B2B5C]">{data.count}</div>
                <div className="text-xs text-muted-foreground">invoices</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="border-[#0B2B5C]/10">
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="Search by invoice no, company, supplier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="search-input"
                />
              </div>
              
              {/* Company Filter */}
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-full md:w-48" data-testid="company-filter">
                  <Building2 size={16} className="mr-2" />
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.map(company => (
                    <SelectItem key={company.user_id} value={company.company_name}>
                      {company.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Type Filter */}
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-full md:w-40" data-testid="type-filter">
                  <Filter size={16} className="mr-2" />
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing <strong>{filteredInvoices.length}</strong> of <strong>{invoices.length}</strong> invoices
          </p>
        </div>

        {/* Invoices Table */}
        <Card className="border-[#0B2B5C]/10 shadow-lg">
          <CardContent className="p-0">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#0B2B5C]/5">
                    <TableHead className="font-semibold">Company</TableHead>
                    <TableHead className="font-semibold">Invoice No.</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold">Supplier/Customer</TableHead>
                    <TableHead className="font-semibold">Date</TableHead>
                    <TableHead className="font-semibold text-right">Amount</TableHead>
                    <TableHead className="font-semibold text-right">GST</TableHead>
                    <TableHead className="font-semibold text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No invoices found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvoices.map((invoice) => (
                      <TableRow key={invoice.id} data-testid={`invoice-row-${invoice.id}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium flex items-center gap-1">
                              <Building2 size={14} className="text-[#0B2B5C]" />
                              {invoice.company_name || 'N/A'}
                            </div>
                            <div className="text-xs text-muted-foreground">{invoice.user_email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {invoice.extracted_data?.invoice_no || '-'}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={invoice.invoice_type === 'purchase' 
                              ? 'text-[#EF4444] border-[#EF4444]' 
                              : 'text-[#10B981] border-[#10B981]'
                            }
                          >
                            {invoice.invoice_type === 'purchase' ? 'Purchase' : 'Sales'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {invoice.extracted_data?.supplier_name || invoice.extracted_data?.buyer_name || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(invoice.extracted_data?.invoice_date)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatAmount(invoice.extracted_data?.basic_amount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatAmount(invoice.extracted_data?.gst)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatAmount(invoice.extracted_data?.total_amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
