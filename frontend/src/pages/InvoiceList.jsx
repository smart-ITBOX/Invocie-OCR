import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, Download, Eye, Trash2, MoreVertical, Filter, Calendar, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function InvoiceList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [filteredInvoices, setFilteredInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedInvoices, setSelectedInvoices] = useState([]);

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    filterInvoices();
  }, [invoices, searchTerm, statusFilter, typeFilter, startDate, endDate]);

  const loadInvoices = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/invoices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvoices(response.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load invoices');
      setLoading(false);
    }
  };

  const filterInvoices = () => {
    let filtered = invoices;

    // Filter by invoice type
    if (typeFilter !== 'all') {
      filtered = filtered.filter(inv => inv.invoice_type === typeFilter);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(inv => inv.status === statusFilter);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(inv =>
        inv.extracted_data?.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.extracted_data?.buyer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.extracted_data?.invoice_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.filename?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by date range
    if (startDate || endDate) {
      filtered = filtered.filter(inv => {
        const invDate = inv.extracted_data?.invoice_date;
        if (!invDate) return false;
        
        // Parse DD/MM/YYYY to YYYY-MM-DD for comparison
        const [day, month, year] = invDate.split('/');
        if (!day || !month || !year) return false;
        
        const invDateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        
        if (startDate && invDateStr < startDate) return false;
        if (endDate && invDateStr > endDate) return false;
        return true;
      });
    }

    setFilteredInvoices(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
    setStartDate('');
    setEndDate('');
  };

  const handleDelete = async (invoiceId) => {
    if (!window.confirm('Are you sure you want to delete this invoice?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Invoice deleted successfully');
      loadInvoices();
    } catch (error) {
      toast.error('Failed to delete invoice');
    }
  };

  const handleDeleteAll = async () => {
    // First confirmation
    const firstConfirm = window.confirm(
      `⚠️ WARNING: You are about to delete ALL ${invoices.length} invoice(s)!\n\nThis action cannot be undone.\n\nAre you sure you want to continue?`
    );
    
    if (!firstConfirm) return;

    // Second confirmation - require user to type DELETE
    const confirmText = window.prompt(
      `To confirm deletion of ALL invoices, please type: DELETE\n\n(Type DELETE in capital letters)`
    );

    if (confirmText !== 'DELETE') {
      toast.error('Deletion cancelled. Confirmation text did not match.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`${API}/invoices`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Successfully deleted ${response.data.deleted_count} invoice(s)`);
      loadInvoices();
      setSelectedInvoices([]);
    } catch (error) {
      toast.error('Failed to delete invoices');
    }
  };

  const handleExport = async (format) => {
    if (selectedInvoices.length === 0) {
      toast.error('Please select invoices to export');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API}/invoices/export`,
        { invoice_ids: selectedInvoices, format },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = response.data.data;
      const blob = new Blob([data], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoices_export.${format === 'tally' ? 'xml' : format}`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success(`Exported ${selectedInvoices.length} invoices as ${format.toUpperCase()}`);
      setSelectedInvoices([]);
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const toggleSelectInvoice = (invoiceId) => {
    setSelectedInvoices(prev =>
      prev.includes(invoiceId)
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(filteredInvoices.map(inv => inv.id));
    }
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'text-[#10B981]';
    if (confidence >= 0.7) return 'text-[#F59E0B]';
    return 'text-[#EF4444]';
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'verified': return 'default';
      case 'pending': return 'secondary';
      case 'exported': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <Layout>
      <div className="space-y-6" data-testid="invoice-list-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-manrope font-bold text-[#0B2B5C]" data-testid="invoice-list-title">
              All Invoices
            </h1>
            <p className="text-muted-foreground mt-1">
              {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''} found
              {invoices.length > 0 && ` • Total: ${invoices.length}`}
            </p>
          </div>
          <div className="flex gap-2">
            {invoices.length > 0 && (
              <Button
                onClick={handleDeleteAll}
                data-testid="delete-all-btn"
                variant="destructive"
                className="bg-[#EF4444] hover:bg-[#DC2626] text-white"
              >
                <Trash2 size={16} className="mr-2" />
                Delete All Records
              </Button>
            )}
            <Button
              onClick={() => navigate('/')}
              data-testid="back-to-dashboard-btn"
              variant="outline"
              className="border-[#0B2B5C] text-[#0B2B5C] hover:bg-[#0B2B5C] hover:text-white"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Filters and Actions */}
        <Card className="border-[#0B2B5C]/10">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              {/* Row 1: Search, Type, Status */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input
                    placeholder="Search by supplier, buyer, invoice number, or filename..."
                    data-testid="search-invoices-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full md:w-48" data-testid="type-filter-select">
                    <Filter size={16} className="mr-2" />
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="purchase">Purchase Only</SelectItem>
                    <SelectItem value="sales">Sales Only</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-48" data-testid="status-filter-select">
                    <Filter size={16} className="mr-2" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="exported">Exported</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Row 2: Date Range Filters */}
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1">
                  <Label htmlFor="start-date" className="text-sm font-medium text-[#0B2B5C] mb-1 flex items-center gap-2">
                    <Calendar size={16} />
                    From Date
                  </Label>
                  <Input
                    id="start-date"
                    type="date"
                    data-testid="start-date-filter"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="end-date" className="text-sm font-medium text-[#0B2B5C] mb-1 flex items-center gap-2">
                    <Calendar size={16} />
                    To Date
                  </Label>
                  <Input
                    id="end-date"
                    type="date"
                    data-testid="end-date-filter"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                {(searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || startDate || endDate) && (
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    data-testid="clear-filters-btn"
                    className="border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444] hover:text-white"
                  >
                    <X size={16} className="mr-2" />
                    Clear All Filters
                  </Button>
                )}
                {selectedInvoices.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        data-testid="export-menu-btn"
                        className="bg-[#FFD700] hover:bg-[#FFD700]/90 text-[#0B2B5C] font-medium"
                      >
                        <Download size={16} className="mr-2" />
                        Export ({selectedInvoices.length})
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleExport('tally')} data-testid="export-tally-btn">
                        Tally XML
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('csv')} data-testid="export-csv-btn">
                        CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('json')} data-testid="export-json-btn">
                        JSON
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoices Table */}
        <Card className="border-[#0B2B5C]/10">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 text-center text-muted-foreground" data-testid="loading-message">Loading invoices...</div>
            ) : filteredInvoices.length === 0 ? (
              <div className="p-12">
                <Alert data-testid="no-invoices-found-message">
                  <AlertDescription>
                    No invoices found. Try adjusting your filters or upload a new invoice.
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          data-testid="select-all-checkbox"
                          checked={selectedInvoices.length === filteredInvoices.length}
                          onChange={toggleSelectAll}
                          className="rounded"
                        />
                      </TableHead>
                      <TableHead className="font-bold text-[#0B2B5C]">Type</TableHead>
                      <TableHead className="font-bold text-[#0B2B5C]">Invoice No</TableHead>
                      <TableHead className="font-bold text-[#0B2B5C]">Date</TableHead>
                      <TableHead className="font-bold text-[#0B2B5C]">Supplier</TableHead>
                      <TableHead className="font-bold text-[#0B2B5C]">GST No</TableHead>
                      <TableHead className="font-bold text-[#0B2B5C] text-right">Amount</TableHead>
                      <TableHead className="font-bold text-[#0B2B5C] text-center">Confidence</TableHead>
                      <TableHead className="font-bold text-[#0B2B5C] text-center">Status</TableHead>
                      <TableHead className="font-bold text-[#0B2B5C] text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => {
                      const avgConfidence = Object.values(invoice.confidence_scores).reduce((a, b) => a + b, 0) / 8;
                      return (
                        <TableRow
                          key={invoice.id}
                          data-testid={`invoice-row-${invoice.id}`}
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() => navigate(`/verify/${invoice.id}`)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              data-testid={`select-invoice-${invoice.id}`}
                              checked={selectedInvoices.includes(invoice.id)}
                              onChange={() => toggleSelectInvoice(invoice.id)}
                              className="rounded"
                            />
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={invoice.invoice_type === 'sales' ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981] font-semibold' : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444] font-semibold'}
                              data-testid={`type-badge-${invoice.id}`}
                            >
                              {invoice.invoice_type === 'sales' ? 'SALES' : 'PURCHASE'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {invoice.extracted_data?.invoice_no || 'N/A'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {invoice.extracted_data?.invoice_date || 'N/A'}
                          </TableCell>
                          <TableCell className="font-medium">
                            {invoice.extracted_data?.supplier_name || 'Unknown'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {invoice.extracted_data?.gst_no || 'N/A'}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium text-[#0B2B5C]">
                            ₹{(invoice.extracted_data?.total_amount || 0).toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-mono font-medium ${getConfidenceColor(avgConfidence)}`}>
                              {Math.round(avgConfidence * 100)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={getStatusVariant(invoice.status)} data-testid={`status-badge-${invoice.id}`}>
                              {invoice.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" data-testid={`actions-menu-${invoice.id}`}>
                                  <MoreVertical size={16} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem
                                  onClick={() => navigate(`/verify/${invoice.id}`)}
                                  data-testid={`view-invoice-${invoice.id}`}
                                >
                                  <Eye size={16} className="mr-2" />
                                  View/Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDelete(invoice.id)}
                                  data-testid={`delete-invoice-${invoice.id}`}
                                  className="text-[#EF4444]"
                                >
                                  <Trash2 size={16} className="mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}