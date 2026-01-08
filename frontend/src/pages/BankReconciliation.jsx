import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ArrowLeft, Upload, FileSpreadsheet, CreditCard, AlertCircle, 
  TrendingUp, TrendingDown, Users, Search, Eye, Trash2, 
  CheckCircle, XCircle, HelpCircle, IndianRupee, Link, List, ExternalLink, ShoppingCart
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function BankReconciliation() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [statements, setStatements] = useState([]);
  const [outstandingReport, setOutstandingReport] = useState(null);
  const [payablesReport, setPayablesReport] = useState(null);
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('receivables');
  
  // For transactions view
  const [selectedStatement, setSelectedStatement] = useState(null);
  const [statementTransactions, setStatementTransactions] = useState(null);
  const [transactionsDialogOpen, setTransactionsDialogOpen] = useState(false);
  const [transactionType, setTransactionType] = useState('credit'); // 'credit' or 'debit'
  const [savingMapping, setSavingMapping] = useState(null);
  const [transactionSearch, setTransactionSearch] = useState('');
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [bulkMappingBuyer, setBulkMappingBuyer] = useState('');
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [statementsRes, reportRes, payablesRes] = await Promise.all([
        axios.get(`${API}/bank-statement/list`, { headers }),
        axios.get(`${API}/bank-reconciliation/outstanding`, { headers }),
        axios.get(`${API}/bank-reconciliation/payables`, { headers })
      ]);
      
      setStatements(statementsRes.data);
      setOutstandingReport(reportRes.data);
      setPayablesReport(payablesRes.data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load data');
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const validTypes = ['.pdf', '.xlsx', '.xls', '.csv'];
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!validTypes.includes(fileExt)) {
      toast.error('Please upload a PDF, Excel (.xlsx, .xls) or CSV file');
      return;
    }
    
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API}/bank-statement/upload`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      toast.success(`Bank statement processed! Found ${response.data.transactions_count} transactions`);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload bank statement');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteStatement = async (statementId) => {
    if (!window.confirm('Are you sure you want to delete this bank statement?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API}/bank-statement/${statementId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Bank statement deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete statement');
    }
  };

  const openTransactionsDialog = async (statement, type = 'credit') => {
    setSelectedStatement(statement);
    setTransactionType(type);
    setTransactionsDialogOpen(true);
    setTransactionSearch('');
    setSelectedTransactions([]);
    
    try {
      const token = localStorage.getItem('token');
      const endpoint = type === 'credit' 
        ? `${API}/bank-statement/${statement.id}/transactions`
        : `${API}/bank-statement/${statement.id}/debit-transactions`;
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatementTransactions(response.data);
    } catch (error) {
      toast.error('Failed to load transactions');
    }
  };

  const handleMapTransaction = async (transactionIndex, partyName) => {
    if (!selectedStatement) return;
    
    setSavingMapping(transactionIndex);
    try {
      const token = localStorage.getItem('token');
      const endpoint = transactionType === 'credit' 
        ? `${API}/bank-statement/map-transaction`
        : `${API}/bank-statement/map-payable`;
      
      const payload = transactionType === 'credit'
        ? { statement_id: selectedStatement.id, transaction_index: transactionIndex, buyer_name: partyName || null }
        : { statement_id: selectedStatement.id, transaction_index: transactionIndex, supplier_name: partyName || null };
      
      await axios.post(endpoint, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Update local state
      const mappingKey = transactionType === 'credit' ? 'mapped_buyer' : 'mapped_supplier';
      setStatementTransactions(prev => ({
        ...prev,
        transactions: prev.transactions.map(t => 
          t.index === transactionIndex ? { ...t, [mappingKey]: partyName || null } : t
        )
      }));
      
      toast.success(partyName ? `Mapped to ${partyName}` : 'Mapping removed');
      loadData();
    } catch (error) {
      toast.error('Failed to save mapping');
    } finally {
      setSavingMapping(null);
    }
  };

  const handleBulkMap = async () => {
    if (!selectedStatement || selectedTransactions.length === 0 || !bulkMappingBuyer) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API}/bank-statement/bulk-map`, {
        statement_id: selectedStatement.id,
        transaction_indices: selectedTransactions,
        party_name: bulkMappingBuyer,
        mapping_type: transactionType === 'credit' ? 'receivable' : 'payable'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success(`Mapped ${selectedTransactions.length} transactions to ${bulkMappingBuyer}`);
      setBulkDialogOpen(false);
      setSelectedTransactions([]);
      setBulkMappingBuyer('');
      
      // Reload transactions
      openTransactionsDialog(selectedStatement, transactionType);
      loadData();
    } catch (error) {
      toast.error('Failed to bulk map transactions');
    }
  };

  const toggleTransactionSelection = (index) => {
    setSelectedTransactions(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const selectAllFiltered = () => {
    if (!statementTransactions) return;
    const filtered = getFilteredTransactions();
    const allIndices = filtered.map(t => t.index);
    setSelectedTransactions(allIndices);
  };

  const clearSelection = () => {
    setSelectedTransactions([]);
  };

  const getFilteredTransactions = () => {
    if (!statementTransactions) return [];
    return statementTransactions.transactions.filter(t => {
      if (!transactionSearch) return true;
      const search = transactionSearch.toLowerCase();
      return (
        (t.description || '').toLowerCase().includes(search) ||
        (t.party_name || '').toLowerCase().includes(search)
      );
    });
  };

  const openBuyerDetails = (buyer) => {
    setSelectedBuyer(buyer);
    setDetailsDialogOpen(true);
  };

  const openSupplierDetails = (supplier) => {
    setSelectedSupplier(supplier);
    setSupplierDialogOpen(true);
  };

  const formatAmount = (amount) => {
    if (amount === null || amount === undefined) return '-';
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
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

  const filteredBuyers = outstandingReport?.buyers?.filter(buyer => {
    if (!searchTerm) return true;
    return buyer.buyer_name.toLowerCase().includes(searchTerm.toLowerCase());
  }) || [];

  const filteredSuppliers = payablesReport?.suppliers?.filter(supplier => {
    if (!searchTerm) return true;
    return supplier.supplier_name.toLowerCase().includes(searchTerm.toLowerCase());
  }) || [];

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">Loading bank reconciliation data...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6" data-testid="bank-reconciliation-page">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Button
              onClick={() => navigate('/')}
              variant="ghost"
              className="mb-2 -ml-2 text-[#0B2B5C] hover:text-[#0B2B5C] hover:bg-[#0B2B5C]/5"
            >
              <ArrowLeft size={16} className="mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-manrope font-bold text-[#0B2B5C]">
              <CreditCard className="inline-block mr-3 text-[#FFD700]" size={32} />
              Bank Reconciliation
            </h1>
            <p className="text-muted-foreground mt-1">
              Track receivables (from buyers) and payables (to suppliers)
            </p>
          </div>
          
          {/* Upload Button */}
          <div>
            <input
              type="file"
              id="bank-statement-upload"
              accept=".pdf,.xlsx,.xls,.csv"
              onChange={handleUpload}
              className="hidden"
            />
            <Button
              onClick={() => document.getElementById('bank-statement-upload')?.click()}
              disabled={uploading}
              className="bg-[#0B2B5C] hover:bg-[#0B2B5C]/90"
            >
              {uploading ? 'Processing...' : <><Upload size={16} className="mr-2" />Upload Bank Statement</>}
            </Button>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="receivables" className="flex items-center gap-2">
              <TrendingUp size={16} />
              Receivables
            </TabsTrigger>
            <TabsTrigger value="payables" className="flex items-center gap-2">
              <ShoppingCart size={16} />
              Payables
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-2">
              <List size={16} />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="statements" className="flex items-center gap-2">
              <FileSpreadsheet size={16} />
              Statements
            </TabsTrigger>
          </TabsList>

          {/* Receivables Tab (Sales) */}
          <TabsContent value="receivables" className="space-y-4 mt-6">
            {outstandingReport?.summary && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-[#10B981]/20 shadow-md">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="text-[#10B981]" size={20} />
                      <span className="text-sm text-muted-foreground">Total Sales</span>
                    </div>
                    <div className="text-2xl font-mono font-bold text-[#10B981]">
                      {formatAmount(outstandingReport.summary.total_sales)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-[#0B2B5C]/20 shadow-md">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <IndianRupee className="text-[#0B2B5C]" size={20} />
                      <span className="text-sm text-muted-foreground">Received</span>
                    </div>
                    <div className="text-2xl font-mono font-bold text-[#0B2B5C]">
                      {formatAmount(outstandingReport.summary.total_received)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-[#EF4444]/20 shadow-md">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="text-[#EF4444]" size={20} />
                      <span className="text-sm text-muted-foreground">Outstanding</span>
                    </div>
                    <div className="text-2xl font-mono font-bold text-[#EF4444]">
                      {formatAmount(outstandingReport.summary.total_outstanding)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-[#FFD700]/30 shadow-md">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="text-[#0B2B5C]" size={20} />
                      <span className="text-sm text-muted-foreground">Buyers</span>
                    </div>
                    <div className="text-2xl font-mono font-bold text-[#0B2B5C]">
                      {outstandingReport.summary.buyer_count}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Search by buyer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {filteredBuyers.length === 0 ? (
              <Alert>
                <HelpCircle className="h-4 w-4" />
                <AlertTitle>No Data</AlertTitle>
                <AlertDescription>Upload sales invoices and bank statements to see receivables.</AlertDescription>
              </Alert>
            ) : (
              <Card className="border-[#0B2B5C]/10 shadow-lg">
                <CardContent className="p-0">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#0B2B5C]/5">
                          <TableHead className="font-semibold">Buyer Name</TableHead>
                          <TableHead className="font-semibold">GST No.</TableHead>
                          <TableHead className="font-semibold text-right">Total Sales</TableHead>
                          <TableHead className="font-semibold text-right">Received</TableHead>
                          <TableHead className="font-semibold text-right">Outstanding</TableHead>
                          <TableHead className="font-semibold text-center">Status</TableHead>
                          <TableHead className="font-semibold text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBuyers.map((buyer, index) => (
                          <TableRow key={index} className={buyer.outstanding > 0 ? 'bg-red-50/30' : 'bg-green-50/30'}>
                            <TableCell className="font-medium">{buyer.buyer_name}</TableCell>
                            <TableCell>
                              {buyer.buyer_gst ? <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{buyer.buyer_gst}</code> : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[#10B981]">{formatAmount(buyer.total_sales)}</TableCell>
                            <TableCell className="text-right font-mono text-[#0B2B5C]">{formatAmount(buyer.total_received)}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-[#EF4444]">{formatAmount(buyer.outstanding)}</TableCell>
                            <TableCell className="text-center">
                              {buyer.outstanding <= 0 ? (
                                <Badge variant="outline" className="text-[#10B981] border-[#10B981]"><CheckCircle size={12} className="mr-1" />Cleared</Badge>
                              ) : buyer.total_received > 0 ? (
                                <Badge variant="outline" className="text-[#F59E0B] border-[#F59E0B]">Partial</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[#EF4444] border-[#EF4444]"><XCircle size={12} className="mr-1" />Pending</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => openBuyerDetails(buyer)}>
                                <Eye size={14} className="mr-1" />Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Payables Tab (Purchases) */}
          <TabsContent value="payables" className="space-y-4 mt-6">
            {payablesReport?.summary && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-[#EF4444]/20 shadow-md">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <ShoppingCart className="text-[#EF4444]" size={20} />
                      <span className="text-sm text-muted-foreground">Total Purchases</span>
                    </div>
                    <div className="text-2xl font-mono font-bold text-[#EF4444]">
                      {formatAmount(payablesReport.summary.total_purchases)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-[#0B2B5C]/20 shadow-md">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <IndianRupee className="text-[#0B2B5C]" size={20} />
                      <span className="text-sm text-muted-foreground">Paid</span>
                    </div>
                    <div className="text-2xl font-mono font-bold text-[#0B2B5C]">
                      {formatAmount(payablesReport.summary.total_paid)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-[#F59E0B]/20 shadow-md">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="text-[#F59E0B]" size={20} />
                      <span className="text-sm text-muted-foreground">Balance Due</span>
                    </div>
                    <div className="text-2xl font-mono font-bold text-[#F59E0B]">
                      {formatAmount(payablesReport.summary.total_balance_due)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-[#FFD700]/30 shadow-md">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="text-[#0B2B5C]" size={20} />
                      <span className="text-sm text-muted-foreground">Suppliers</span>
                    </div>
                    <div className="text-2xl font-mono font-bold text-[#0B2B5C]">
                      {payablesReport.summary.supplier_count}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Search by supplier name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {filteredSuppliers.length === 0 ? (
              <Alert>
                <HelpCircle className="h-4 w-4" />
                <AlertTitle>No Data</AlertTitle>
                <AlertDescription>Upload purchase invoices and bank statements to see payables.</AlertDescription>
              </Alert>
            ) : (
              <Card className="border-[#0B2B5C]/10 shadow-lg">
                <CardContent className="p-0">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#0B2B5C]/5">
                          <TableHead className="font-semibold">Supplier Name</TableHead>
                          <TableHead className="font-semibold">GST No.</TableHead>
                          <TableHead className="font-semibold text-right">Total Purchases</TableHead>
                          <TableHead className="font-semibold text-right">Paid</TableHead>
                          <TableHead className="font-semibold text-right">Balance Due</TableHead>
                          <TableHead className="font-semibold text-center">Status</TableHead>
                          <TableHead className="font-semibold text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSuppliers.map((supplier, index) => (
                          <TableRow key={index} className={supplier.balance_due > 0 ? 'bg-orange-50/30' : 'bg-green-50/30'}>
                            <TableCell className="font-medium">{supplier.supplier_name}</TableCell>
                            <TableCell>
                              {supplier.supplier_gst ? <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{supplier.supplier_gst}</code> : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[#EF4444]">{formatAmount(supplier.total_purchases)}</TableCell>
                            <TableCell className="text-right font-mono text-[#0B2B5C]">{formatAmount(supplier.total_paid)}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-[#F59E0B]">{formatAmount(supplier.balance_due)}</TableCell>
                            <TableCell className="text-center">
                              {supplier.balance_due <= 0 ? (
                                <Badge variant="outline" className="text-[#10B981] border-[#10B981]"><CheckCircle size={12} className="mr-1" />Paid</Badge>
                              ) : supplier.total_paid > 0 ? (
                                <Badge variant="outline" className="text-[#F59E0B] border-[#F59E0B]">Partial</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[#EF4444] border-[#EF4444]"><XCircle size={12} className="mr-1" />Unpaid</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => openSupplierDetails(supplier)}>
                                <Eye size={14} className="mr-1" />Details
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-4 mt-6">
            {statements.length === 0 ? (
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertTitle>No Bank Statements</AlertTitle>
                <AlertDescription>Upload a bank statement to view and map transactions.</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Select a bank statement to view and map transactions to buyers (credits) or suppliers (debits).
                </p>
                
                {statements.map((statement) => (
                  <Card key={statement.id} className="border-[#0B2B5C]/10">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#0B2B5C]/10 rounded-lg flex items-center justify-center">
                            <FileSpreadsheet className="text-[#0B2B5C]" size={20} />
                          </div>
                          <div>
                            <div className="font-medium">{statement.filename}</div>
                            <div className="text-sm text-muted-foreground">Uploaded: {formatDate(statement.upload_date)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="default" size="sm" onClick={() => openTransactionsDialog(statement, 'credit')} className="bg-[#10B981] hover:bg-[#10B981]/90">
                            <TrendingUp size={14} className="mr-1" />Credits (Receivables)
                          </Button>
                          <Button variant="default" size="sm" onClick={() => openTransactionsDialog(statement, 'debit')} className="bg-[#EF4444] hover:bg-[#EF4444]/90">
                            <TrendingDown size={14} className="mr-1" />Debits (Payables)
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Statements Tab */}
          <TabsContent value="statements" className="space-y-4 mt-6">
            {statements.length === 0 ? (
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertTitle>No Bank Statements</AlertTitle>
                <AlertDescription>Upload your bank statement (PDF or Excel) to extract transactions.</AlertDescription>
              </Alert>
            ) : (
              <div className="grid gap-4">
                {statements.map((statement) => (
                  <Card key={statement.id} className="border-[#0B2B5C]/10">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#0B2B5C]/10 rounded-lg flex items-center justify-center">
                            <FileSpreadsheet className="text-[#0B2B5C]" size={20} />
                          </div>
                          <div>
                            <div className="font-medium">{statement.filename}</div>
                            <div className="text-sm text-muted-foreground">Uploaded: {formatDate(statement.upload_date)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Credits</div>
                            <div className="font-mono text-[#10B981] font-medium">{formatAmount(statement.total_credits)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Debits</div>
                            <div className="font-mono text-[#EF4444] font-medium">{formatAmount(statement.total_debits)}</div>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => handleDeleteStatement(statement.id)} className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10">
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Buyer Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-[#0B2B5C] font-manrope">{selectedBuyer?.buyer_name}</DialogTitle>
              <DialogDescription>{selectedBuyer?.buyer_gst && `GST: ${selectedBuyer.buyer_gst}`}</DialogDescription>
            </DialogHeader>
            
            {selectedBuyer && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-[#10B981]/10 rounded-lg">
                    <div className="text-sm text-muted-foreground">Total Sales</div>
                    <div className="text-xl font-mono font-bold text-[#10B981]">{formatAmount(selectedBuyer.total_sales)}</div>
                  </div>
                  <div className="text-center p-3 bg-[#0B2B5C]/10 rounded-lg">
                    <div className="text-sm text-muted-foreground">Received</div>
                    <div className="text-xl font-mono font-bold text-[#0B2B5C]">{formatAmount(selectedBuyer.total_received)}</div>
                  </div>
                  <div className="text-center p-3 bg-[#EF4444]/10 rounded-lg">
                    <div className="text-sm text-muted-foreground">Outstanding</div>
                    <div className="text-xl font-mono font-bold text-[#EF4444]">{formatAmount(selectedBuyer.outstanding)}</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-[#0B2B5C] mb-2">Invoices ({selectedBuyer.invoices?.length || 0})</h4>
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Invoice No.</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedBuyer.invoices?.map((inv, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-sm">{inv.invoice_no || '-'}</TableCell>
                            <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                            <TableCell className="text-right font-mono">{formatAmount(inv.amount)}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => navigate(`/verify/${inv.invoice_id}`)}>
                                <ExternalLink size={14} className="mr-1" />View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-[#0B2B5C] mb-2">Payments Received ({selectedBuyer.payments?.length || 0})</h4>
                  {selectedBuyer.payments?.length > 0 ? (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Match</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedBuyer.payments?.map((pmt, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{formatDate(pmt.date)}</TableCell>
                              <TableCell className="text-sm max-w-[200px] truncate">{pmt.description}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={pmt.match_type === 'manual' ? 'text-blue-600 border-blue-600' : 'text-gray-600'}>
                                  {pmt.match_type === 'manual' ? 'Manual' : `Auto ${pmt.match_score}%`}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono text-[#10B981]">{formatAmount(pmt.credit)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No payments matched yet</p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Supplier Details Dialog */}
        <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-[#0B2B5C] font-manrope">{selectedSupplier?.supplier_name}</DialogTitle>
              <DialogDescription>{selectedSupplier?.supplier_gst && `GST: ${selectedSupplier.supplier_gst}`}</DialogDescription>
            </DialogHeader>
            
            {selectedSupplier && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-[#EF4444]/10 rounded-lg">
                    <div className="text-sm text-muted-foreground">Total Purchases</div>
                    <div className="text-xl font-mono font-bold text-[#EF4444]">{formatAmount(selectedSupplier.total_purchases)}</div>
                  </div>
                  <div className="text-center p-3 bg-[#0B2B5C]/10 rounded-lg">
                    <div className="text-sm text-muted-foreground">Paid</div>
                    <div className="text-xl font-mono font-bold text-[#0B2B5C]">{formatAmount(selectedSupplier.total_paid)}</div>
                  </div>
                  <div className="text-center p-3 bg-[#F59E0B]/10 rounded-lg">
                    <div className="text-sm text-muted-foreground">Balance Due</div>
                    <div className="text-xl font-mono font-bold text-[#F59E0B]">{formatAmount(selectedSupplier.balance_due)}</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-[#0B2B5C] mb-2">Purchase Invoices ({selectedSupplier.invoices?.length || 0})</h4>
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Invoice No.</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSupplier.invoices?.map((inv, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-sm">{inv.invoice_no || '-'}</TableCell>
                            <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                            <TableCell className="text-right font-mono">{formatAmount(inv.amount)}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => navigate(`/verify/${inv.invoice_id}`)}>
                                <ExternalLink size={14} className="mr-1" />View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-[#0B2B5C] mb-2">Payments Made ({selectedSupplier.payments?.length || 0})</h4>
                  {selectedSupplier.payments?.length > 0 ? (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Match</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedSupplier.payments?.map((pmt, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{formatDate(pmt.date)}</TableCell>
                              <TableCell className="text-sm max-w-[200px] truncate">{pmt.description}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={pmt.match_type === 'manual' ? 'text-blue-600 border-blue-600' : 'text-gray-600'}>
                                  {pmt.match_type === 'manual' ? 'Manual' : `Auto ${pmt.match_score}%`}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono text-[#EF4444]">{formatAmount(pmt.debit)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No payments matched yet</p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Transactions Mapping Dialog */}
        <Dialog open={transactionsDialogOpen} onOpenChange={setTransactionsDialogOpen}>
          <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-[#0B2B5C] font-manrope flex items-center gap-2">
                <FileSpreadsheet size={20} />
                {selectedStatement?.filename} - {transactionType === 'credit' ? 'Credits (Receivables)' : 'Debits (Payables)'}
              </DialogTitle>
              <DialogDescription>
                Map transactions to {transactionType === 'credit' ? 'buyers' : 'suppliers'}. Use search and bulk mapping for efficiency.
              </DialogDescription>
            </DialogHeader>
            
            {statementTransactions ? (
              <div className="space-y-4">
                {/* Search and Bulk Actions */}
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input
                      placeholder="Search by description or party name..."
                      value={transactionSearch}
                      onChange={(e) => setTransactionSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={selectAllFiltered}>Select All</Button>
                  <Button variant="outline" size="sm" onClick={clearSelection}>Clear</Button>
                  {selectedTransactions.length > 0 && (
                    <Button size="sm" onClick={() => setBulkDialogOpen(true)} className="bg-[#0B2B5C]">
                      Bulk Map ({selectedTransactions.length})
                    </Button>
                  )}
                </div>

                <div className="border rounded-md max-h-[50vh] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white">
                      <TableRow className="bg-[#0B2B5C]/5">
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="font-semibold w-24">Date</TableHead>
                        <TableHead className="font-semibold">Description</TableHead>
                        <TableHead className="font-semibold text-right w-28">Amount</TableHead>
                        <TableHead className="font-semibold w-56">Map to {transactionType === 'credit' ? 'Buyer' : 'Supplier'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getFilteredTransactions().map((txn) => (
                        <TableRow key={txn.index}>
                          <TableCell>
                            <Checkbox
                              checked={selectedTransactions.includes(txn.index)}
                              onCheckedChange={() => toggleTransactionSelection(txn.index)}
                            />
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(txn.date)}</TableCell>
                          <TableCell>
                            <div className="text-sm">{txn.description}</div>
                            {txn.party_name && <div className="text-xs text-muted-foreground">Party: {txn.party_name}</div>}
                          </TableCell>
                          <TableCell className={`text-right font-mono font-medium ${transactionType === 'credit' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                            {formatAmount(transactionType === 'credit' ? txn.credit : txn.debit)}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={transactionType === 'credit' ? (txn.mapped_buyer || "unmapped") : (txn.mapped_supplier || "unmapped")}
                              onValueChange={(value) => handleMapTransaction(txn.index, value === "unmapped" ? null : value)}
                              disabled={savingMapping === txn.index}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder={`Select ${transactionType === 'credit' ? 'buyer' : 'supplier'}...`} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unmapped">-- Not Mapped --</SelectItem>
                                {(transactionType === 'credit' ? statementTransactions.buyers : statementTransactions.suppliers)?.map((party) => (
                                  <SelectItem key={party.name} value={party.name}>
                                    {party.name} {party.gst && `(${party.gst.slice(0,10)}...)`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {getFilteredTransactions().length === 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Transactions</AlertTitle>
                    <AlertDescription>No {transactionType === 'credit' ? 'credit' : 'debit'} transactions found matching your search.</AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="text-center py-8">Loading transactions...</div>
            )}
          </DialogContent>
        </Dialog>

        {/* Bulk Mapping Dialog */}
        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Bulk Map {selectedTransactions.length} Transactions</DialogTitle>
              <DialogDescription>
                Select a {transactionType === 'credit' ? 'buyer' : 'supplier'} to map all selected transactions.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select value={bulkMappingBuyer} onValueChange={setBulkMappingBuyer}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${transactionType === 'credit' ? 'buyer' : 'supplier'}...`} />
                </SelectTrigger>
                <SelectContent>
                  {(transactionType === 'credit' ? statementTransactions?.buyers : statementTransactions?.suppliers)?.map((party) => (
                    <SelectItem key={party.name} value={party.name}>
                      {party.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleBulkMap} disabled={!bulkMappingBuyer} className="bg-[#0B2B5C]">
                Map {selectedTransactions.length} Transactions
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
