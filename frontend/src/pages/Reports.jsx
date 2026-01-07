import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Download, TrendingUp, TrendingDown, Calculator, FileText, Receipt, ShoppingCart, BarChart3, PieChart } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COLORS = ['#0B2B5C', '#10B981', '#FFD700', '#EF4444', '#8B5CF6', '#F97316'];

export default function Reports() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [report, setReport] = useState(null);
  const [financialData, setFinancialData] = useState(null);
  const [activeTab, setActiveTab] = useState('gst');

  useEffect(() => {
    loadAvailableMonths();
    loadFinancialData();
  }, []);

  useEffect(() => {
    if (selectedMonth) {
      loadMonthlyReport(selectedMonth);
    }
  }, [selectedMonth]);

  const loadAvailableMonths = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/reports/months`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.months.length > 0) {
        setMonths(response.data.months);
        setSelectedMonth(response.data.months[0]);
      }
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load months');
      setLoading(false);
    }
  };

  const loadMonthlyReport = async (month) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/reports/monthly?month=${month}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReport(response.data);
    } catch (error) {
      toast.error('Failed to load report');
    }
  };

  const loadFinancialData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/reports/financial-summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFinancialData(response.data);
    } catch (error) {
      console.error('Failed to load financial data:', error);
    }
  };

  const downloadReport = () => {
    if (!report) return;

    const csvContent = generateReportCSV(report);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GST_Report_${selectedMonth}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Report downloaded successfully');
  };

  const generateReportCSV = (data) => {
    let csv = `GST Reconciliation Report - ${selectedMonth}\n\n`;
    csv += `Category,Count,Taxable Amount,GST Amount\n`;
    csv += `Purchase Invoices,${data.purchase_invoices},${data.total_purchase_amount - data.total_purchase_gst},${data.total_purchase_gst}\n`;
    csv += `Sales Invoices,${data.sales_invoices},${data.total_sales_amount - data.total_sales_gst},${data.total_sales_gst}\n\n`;
    csv += `Net GST Payable/Receivable,,,${data.net_gst_payable}\n\n`;
    
    csv += `\nPurchase GST Breakdown by Rate\n`;
    csv += `Rate,Count,Taxable Amount,GST Amount\n`;
    Object.entries(data.gst_breakdown.purchase).forEach(([rate, values]) => {
      csv += `${rate}%,${values.count},${values.taxable_amount},${values.gst_amount}\n`;
    });
    
    csv += `\nSales GST Breakdown by Rate\n`;
    csv += `Rate,Count,Taxable Amount,GST Amount\n`;
    Object.entries(data.gst_breakdown.sales).forEach(([rate, values]) => {
      csv += `${rate}%,${values.count},${values.taxable_amount},${values.gst_amount}\n`;
    });
    
    return csv;
  };

  const formatMonth = (monthStr) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12" data-testid="loading-message">Loading reports...</div>
      </Layout>
    );
  }

  if (months.length === 0 && !financialData?.monthly_data?.length) {
    return (
      <Layout>
        <div className="space-y-6" data-testid="reports-page">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            data-testid="back-btn"
            className="mb-2 -ml-2 text-[#0B2B5C]"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Dashboard
          </Button>
          <Alert>
            <AlertTitle>No Reports Available</AlertTitle>
            <AlertDescription>
              Upload and verify invoices to generate GST reconciliation reports.
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  // Prepare chart data
  const chartData = financialData?.monthly_data?.map(m => ({
    month: formatMonth(m.month),
    Purchase: Math.round(m.purchase_amount),
    Sales: Math.round(m.sales_amount),
    'Purchase GST': Math.round(m.purchase_gst),
    'Sales GST': Math.round(m.sales_gst)
  })) || [];

  const pieDataAmounts = [
    { name: 'Purchases', value: financialData?.totals?.total_purchase || 0, color: '#EF4444' },
    { name: 'Sales', value: financialData?.totals?.total_sales || 0, color: '#10B981' }
  ];

  const pieDataGST = [
    { name: 'Purchase GST', value: financialData?.totals?.total_purchase_gst || 0, color: '#EF4444' },
    { name: 'Sales GST', value: financialData?.totals?.total_sales_gst || 0, color: '#10B981' }
  ];

  return (
    <Layout>
      <div className="space-y-6" data-testid="reports-page">
        {/* Header */}
        <div className="flex items-center justify-between">
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
            <h1 className="text-3xl font-manrope font-bold text-[#0B2B5C]" data-testid="reports-title">
              Financial Reports & Analytics
            </h1>
            <p className="text-muted-foreground mt-1">GST reconciliation and business insights</p>
          </div>
        </div>

        {/* Tabs for different report views */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="gst" className="flex items-center gap-2">
              <Calculator size={16} />
              GST Reports
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 size={16} />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* GST Reports Tab */}
          <TabsContent value="gst" className="space-y-6 mt-6">
            {/* Month Selector and Download */}
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-manrope font-semibold text-[#0B2B5C]">GST Reconciliation</h2>
              <div className="flex gap-2">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-48" data-testid="month-select">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => (
                      <SelectItem key={month} value={month}>
                        {formatMonth(month)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={downloadReport}
                  data-testid="download-report-btn"
                  disabled={!report}
                  className="bg-[#10B981] hover:bg-[#10B981]/90 text-white"
                >
                  <Download size={16} className="mr-2" />
                  Download CSV
                </Button>
              </div>
            </div>

        {report && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-[#EF4444]/20 shadow-md">
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <ShoppingCart className="text-[#EF4444]" size={18} />
                    Total Purchase
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-3xl font-mono font-bold text-[#EF4444]" data-testid="total-purchase-amount">
                    ₹{report.total_purchase_amount.toLocaleString('en-IN')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {report.purchase_invoices} invoices
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span>GST Amount:</span>
                    <span className="font-mono font-medium">₹{report.total_purchase_gst.toLocaleString('en-IN')}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[#10B981]/20 shadow-md">
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <Receipt className="text-[#10B981]" size={18} />
                    Total Sales
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-3xl font-mono font-bold text-[#10B981]" data-testid="total-sales-amount">
                    ₹{report.total_sales_amount.toLocaleString('en-IN')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {report.sales_invoices} invoices
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span>GST Amount:</span>
                    <span className="font-mono font-medium">₹{report.total_sales_gst.toLocaleString('en-IN')}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className={`border-2 shadow-lg ${
                report.net_gst_payable > 0 
                  ? 'border-[#EF4444]/30 bg-[#EF4444]/5' 
                  : 'border-[#10B981]/30 bg-[#10B981]/5'
              }`}>
                <CardHeader className="pb-3">
                  <CardDescription className="flex items-center gap-2">
                    <Calculator className={report.net_gst_payable > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'} size={18} />
                    Net GST {report.net_gst_payable > 0 ? 'Payable' : 'Receivable'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className={`text-3xl font-mono font-bold ${
                    report.net_gst_payable > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'
                  }`} data-testid="net-gst-payable">
                    {report.net_gst_payable > 0 ? '+' : ''}₹{Math.abs(report.net_gst_payable).toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Sales GST - Purchase GST
                  </div>
                  <Separator />
                  <div className="flex items-center gap-2 text-sm">
                    {report.net_gst_payable > 0 ? (
                      <>
                        <TrendingUp className="text-[#EF4444]" size={16} />
                        <span className="text-[#EF4444]">To be paid to government</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="text-[#10B981]" size={16} />
                        <span className="text-[#10B981]">Claimable from government</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* GST Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Purchase GST Breakdown */}
              <Card className="border-[#EF4444]/10 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-manrope text-[#0B2B5C] flex items-center gap-2">
                    <ShoppingCart size={20} className="text-[#EF4444]" />
                    Purchase GST Breakdown
                  </CardTitle>
                  <CardDescription>GST analysis by tax rate</CardDescription>
                </CardHeader>
                <CardContent>
                  {Object.keys(report.gst_breakdown.purchase).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No purchase invoices</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(report.gst_breakdown.purchase)
                        .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
                        .map(([rate, data]) => (
                        <div key={rate} className="p-3 bg-muted/30 rounded-sm" data-testid={`purchase-gst-${rate}`}>
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className="text-[#EF4444] border-[#EF4444]">
                              {rate}% GST
                            </Badge>
                            <span className="text-sm text-muted-foreground">{data.count} invoices</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Taxable:</span>
                              <div className="font-mono font-medium">₹{data.taxable_amount.toLocaleString('en-IN')}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">GST:</span>
                              <div className="font-mono font-medium text-[#EF4444]">₹{data.gst_amount.toLocaleString('en-IN')}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sales GST Breakdown */}
              <Card className="border-[#10B981]/10 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-manrope text-[#0B2B5C] flex items-center gap-2">
                    <Receipt size={20} className="text-[#10B981]" />
                    Sales GST Breakdown
                  </CardTitle>
                  <CardDescription>GST analysis by tax rate</CardDescription>
                </CardHeader>
                <CardContent>
                  {Object.keys(report.gst_breakdown.sales).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sales invoices</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(report.gst_breakdown.sales)
                        .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
                        .map(([rate, data]) => (
                        <div key={rate} className="p-3 bg-muted/30 rounded-sm" data-testid={`sales-gst-${rate}`}>
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className="text-[#10B981] border-[#10B981]">
                              {rate}% GST
                            </Badge>
                            <span className="text-sm text-muted-foreground">{data.count} invoices</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Taxable:</span>
                              <div className="font-mono font-medium">₹{data.taxable_amount.toLocaleString('en-IN')}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">GST:</span>
                              <div className="font-mono font-medium text-[#10B981]">₹{data.gst_amount.toLocaleString('en-IN')}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Reconciliation Formula */}
            <Card className="border-[#0B2B5C]/10 shadow-sm bg-gradient-to-br from-white to-[#0B2B5C]/5">
              <CardHeader>
                <CardTitle className="text-lg font-manrope text-[#0B2B5C]">GST Reconciliation Formula</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center justify-center gap-4 text-center py-4">
                  <div className="flex flex-col items-center">
                    <div className="text-sm text-muted-foreground mb-1">Sales GST</div>
                    <div className="text-2xl font-mono font-bold text-[#10B981]">
                      ₹{report.total_sales_gst.toLocaleString('en-IN')}
                    </div>
                  </div>
                  
                  <div className="text-3xl font-bold text-[#0B2B5C]">-</div>
                  
                  <div className="flex flex-col items-center">
                    <div className="text-sm text-muted-foreground mb-1">Purchase GST</div>
                    <div className="text-2xl font-mono font-bold text-[#EF4444]">
                      ₹{report.total_purchase_gst.toLocaleString('en-IN')}
                    </div>
                  </div>
                  
                  <div className="text-3xl font-bold text-[#0B2B5C]">=</div>
                  
                  <div className="flex flex-col items-center">
                    <div className="text-sm text-muted-foreground mb-1">
                      {report.net_gst_payable > 0 ? 'Net Payable' : 'Net Receivable'}
                    </div>
                    <div className={`text-2xl font-mono font-bold ${
                      report.net_gst_payable > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'
                    }`}>
                      {report.net_gst_payable > 0 ? '+' : ''}₹{Math.abs(report.net_gst_payable).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Note for CA Firms */}
            <Alert className="border-[#FFD700]/50 bg-[#FFD700]/5">
              <FileText className="h-4 w-4 text-[#0B2B5C]" />
              <AlertTitle className="text-[#0B2B5C] font-manrope font-bold">Note for CA Firms</AlertTitle>
              <AlertDescription className="text-sm">
                This report shows only verified invoices. Ensure all invoices are verified before filing GST returns. 
                Cross-check values with GSTR-2A/2B (purchases) and GSTR-1 (sales) before finalizing GSTR-3B.
              </AlertDescription>
            </Alert>
          </>
        )}
      </div>
    </Layout>
  );
}