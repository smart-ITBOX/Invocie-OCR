import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, Download, Eye, Trash2, MoreVertical, Filter } from 'lucide-react';
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
  const [selectedInvoices, setSelectedInvoices] = useState([]);

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    filterInvoices();
  }, [invoices, searchTerm, statusFilter]);

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

    if (statusFilter !== 'all') {
      filtered = filtered.filter(inv => inv.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(inv =>
        inv.extracted_data?.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.extracted_data?.invoice_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.filename?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredInvoices(filtered);
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
            </p>
          </div>
          <Button
            onClick={() => navigate('/')}
            data-testid="back-to-dashboard-btn"
            variant="outline"
            className="border-[#0B2B5C] text-[#0B2B5C] hover:bg-[#0B2B5C] hover:text-white"
          >
            Back to Dashboard
          </Button>
        </div>

        {/* Filters and Actions */}
        <Card className="border-[#0B2B5C]/10">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  placeholder="Search by supplier, invoice number, or filename..."
                  data-testid="search-invoices-input"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
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