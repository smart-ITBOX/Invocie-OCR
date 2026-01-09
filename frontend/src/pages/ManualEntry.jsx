import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, FileText, ShoppingCart, TrendingUp, Plus, Trash2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ManualEntry() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('sales');
  
  const [salesForm, setSalesForm] = useState({
    invoice_no: '',
    invoice_date: '',
    buyer_name: '',
    buyer_gst: '',
    buyer_address: '',
    basic_amount: '',
    gst: '',
    total_amount: ''
  });

  const [purchaseForm, setPurchaseForm] = useState({
    invoice_no: '',
    invoice_date: '',
    supplier_name: '',
    supplier_gst: '',
    supplier_address: '',
    basic_amount: '',
    gst: '',
    total_amount: ''
  });

  const calculateTotal = (form, setForm) => {
    const basic = parseFloat(form.basic_amount) || 0;
    const gst = parseFloat(form.gst) || 0;
    setForm({ ...form, total_amount: (basic + gst).toFixed(2) });
  };

  const handleSalesSubmit = async (e) => {
    e.preventDefault();
    
    if (!salesForm.invoice_no || !salesForm.buyer_name || !salesForm.total_amount) {
      toast.error('Please fill Invoice No, Buyer Name and Total Amount');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      const invoiceData = {
        invoice_type: 'sales',
        original_filename: `Manual Entry - ${salesForm.invoice_no}`,
        extracted_data: {
          invoice_no: salesForm.invoice_no,
          invoice_date: salesForm.invoice_date,
          bill_to_name: salesForm.buyer_name,
          bill_to_gst: salesForm.buyer_gst,
          bill_to_address: salesForm.buyer_address,
          basic_amount: parseFloat(salesForm.basic_amount) || 0,
          gst: parseFloat(salesForm.gst) || 0,
          total_amount: parseFloat(salesForm.total_amount) || 0,
          supplier_name: '', // For sales, this is our company
          supplier_gst: ''
        },
        confidence_scores: {},
        status: 'verified',
        is_manual_entry: true
      };

      await axios.post(`${API}/invoices/manual`, invoiceData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Sales invoice added successfully!');
      setSalesForm({
        invoice_no: '',
        invoice_date: '',
        buyer_name: '',
        buyer_gst: '',
        buyer_address: '',
        basic_amount: '',
        gst: '',
        total_amount: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    
    if (!purchaseForm.invoice_no || !purchaseForm.supplier_name || !purchaseForm.total_amount) {
      toast.error('Please fill Invoice No, Supplier Name and Total Amount');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      const invoiceData = {
        invoice_type: 'purchase',
        original_filename: `Manual Entry - ${purchaseForm.invoice_no}`,
        extracted_data: {
          invoice_no: purchaseForm.invoice_no,
          invoice_date: purchaseForm.invoice_date,
          supplier_name: purchaseForm.supplier_name,
          supplier_gst: purchaseForm.supplier_gst,
          supplier_address: purchaseForm.supplier_address,
          basic_amount: parseFloat(purchaseForm.basic_amount) || 0,
          gst: parseFloat(purchaseForm.gst) || 0,
          total_amount: parseFloat(purchaseForm.total_amount) || 0,
          bill_to_name: '', // For purchase, bill_to is our company
          bill_to_gst: ''
        },
        confidence_scores: {},
        status: 'verified',
        is_manual_entry: true
      };

      await axios.post(`${API}/invoices/manual`, invoiceData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Purchase invoice added successfully!');
      setPurchaseForm({
        invoice_no: '',
        invoice_date: '',
        supplier_name: '',
        supplier_gst: '',
        supplier_address: '',
        basic_amount: '',
        gst: '',
        total_amount: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
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
            <Plus className="inline-block mr-3 text-[#FFD700]" size={32} />
            Manual Invoice Entry
          </h1>
          <p className="text-muted-foreground mt-1">
            Add sales or purchase invoices manually for handwritten or unreadable invoices
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="sales" className="flex items-center gap-2">
              <TrendingUp size={16} />
              Sales Invoice
            </TabsTrigger>
            <TabsTrigger value="purchase" className="flex items-center gap-2">
              <ShoppingCart size={16} />
              Purchase Invoice
            </TabsTrigger>
          </TabsList>

          {/* Sales Invoice Form */}
          <TabsContent value="sales" className="mt-6">
            <Card className="border-[#10B981]/20 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-[#10B981]/10 to-transparent">
                <CardTitle className="text-xl font-manrope text-[#0B2B5C] flex items-center gap-2">
                  <TrendingUp className="text-[#10B981]" size={24} />
                  New Sales Invoice
                </CardTitle>
                <CardDescription>Enter details of the sales invoice you want to add</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleSalesSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sales_invoice_no" className="text-[#0B2B5C] font-medium">
                        Invoice No. <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="sales_invoice_no"
                        value={salesForm.invoice_no}
                        onChange={(e) => setSalesForm({ ...salesForm, invoice_no: e.target.value })}
                        placeholder="INV-001"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sales_invoice_date" className="text-[#0B2B5C] font-medium">
                        Invoice Date
                      </Label>
                      <Input
                        id="sales_invoice_date"
                        type="date"
                        value={salesForm.invoice_date}
                        onChange={(e) => setSalesForm({ ...salesForm, invoice_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-[#10B981]/5 rounded-lg space-y-4">
                    <h3 className="font-semibold text-[#0B2B5C]">Buyer Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="buyer_name" className="text-[#0B2B5C] font-medium">
                          Buyer Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="buyer_name"
                          value={salesForm.buyer_name}
                          onChange={(e) => setSalesForm({ ...salesForm, buyer_name: e.target.value })}
                          placeholder="Customer Name"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="buyer_gst" className="text-[#0B2B5C] font-medium">
                          Buyer GST No.
                        </Label>
                        <Input
                          id="buyer_gst"
                          value={salesForm.buyer_gst}
                          onChange={(e) => setSalesForm({ ...salesForm, buyer_gst: e.target.value.toUpperCase() })}
                          placeholder="22AAAAA0000A1Z5"
                          maxLength={15}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="buyer_address" className="text-[#0B2B5C] font-medium">
                        Buyer Address
                      </Label>
                      <Input
                        id="buyer_address"
                        value={salesForm.buyer_address}
                        onChange={(e) => setSalesForm({ ...salesForm, buyer_address: e.target.value })}
                        placeholder="Full address"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-[#FFD700]/10 rounded-lg space-y-4">
                    <h3 className="font-semibold text-[#0B2B5C]">Amount Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="sales_basic" className="text-[#0B2B5C] font-medium">
                          Basic Amount (₹)
                        </Label>
                        <Input
                          id="sales_basic"
                          type="number"
                          step="0.01"
                          value={salesForm.basic_amount}
                          onChange={(e) => {
                            const newForm = { ...salesForm, basic_amount: e.target.value };
                            setSalesForm(newForm);
                            setTimeout(() => calculateTotal(newForm, setSalesForm), 100);
                          }}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sales_gst" className="text-[#0B2B5C] font-medium">
                          GST Amount (₹)
                        </Label>
                        <Input
                          id="sales_gst"
                          type="number"
                          step="0.01"
                          value={salesForm.gst}
                          onChange={(e) => {
                            const newForm = { ...salesForm, gst: e.target.value };
                            setSalesForm(newForm);
                            setTimeout(() => calculateTotal(newForm, setSalesForm), 100);
                          }}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sales_total" className="text-[#0B2B5C] font-medium">
                          Total Amount (₹) <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="sales_total"
                          type="number"
                          step="0.01"
                          value={salesForm.total_amount}
                          onChange={(e) => setSalesForm({ ...salesForm, total_amount: e.target.value })}
                          placeholder="0.00"
                          className="font-bold text-[#10B981]"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => navigate('/invoices')}>
                      View All Invoices
                    </Button>
                    <Button
                      type="submit"
                      disabled={saving}
                      className="bg-[#10B981] hover:bg-[#10B981]/90"
                    >
                      <Save size={16} className="mr-2" />
                      {saving ? 'Saving...' : 'Save Sales Invoice'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Purchase Invoice Form */}
          <TabsContent value="purchase" className="mt-6">
            <Card className="border-[#EF4444]/20 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-[#EF4444]/10 to-transparent">
                <CardTitle className="text-xl font-manrope text-[#0B2B5C] flex items-center gap-2">
                  <ShoppingCart className="text-[#EF4444]" size={24} />
                  New Purchase Invoice
                </CardTitle>
                <CardDescription>Enter details of the purchase invoice you want to add</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handlePurchaseSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="purchase_invoice_no" className="text-[#0B2B5C] font-medium">
                        Invoice No. <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="purchase_invoice_no"
                        value={purchaseForm.invoice_no}
                        onChange={(e) => setPurchaseForm({ ...purchaseForm, invoice_no: e.target.value })}
                        placeholder="PINV-001"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="purchase_invoice_date" className="text-[#0B2B5C] font-medium">
                        Invoice Date
                      </Label>
                      <Input
                        id="purchase_invoice_date"
                        type="date"
                        value={purchaseForm.invoice_date}
                        onChange={(e) => setPurchaseForm({ ...purchaseForm, invoice_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-[#EF4444]/5 rounded-lg space-y-4">
                    <h3 className="font-semibold text-[#0B2B5C]">Supplier Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="supplier_name" className="text-[#0B2B5C] font-medium">
                          Supplier Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="supplier_name"
                          value={purchaseForm.supplier_name}
                          onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier_name: e.target.value })}
                          placeholder="Vendor Name"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="supplier_gst" className="text-[#0B2B5C] font-medium">
                          Supplier GST No.
                        </Label>
                        <Input
                          id="supplier_gst"
                          value={purchaseForm.supplier_gst}
                          onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier_gst: e.target.value.toUpperCase() })}
                          placeholder="22AAAAA0000A1Z5"
                          maxLength={15}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="supplier_address" className="text-[#0B2B5C] font-medium">
                        Supplier Address
                      </Label>
                      <Input
                        id="supplier_address"
                        value={purchaseForm.supplier_address}
                        onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier_address: e.target.value })}
                        placeholder="Full address"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-[#FFD700]/10 rounded-lg space-y-4">
                    <h3 className="font-semibold text-[#0B2B5C]">Amount Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="purchase_basic" className="text-[#0B2B5C] font-medium">
                          Basic Amount (₹)
                        </Label>
                        <Input
                          id="purchase_basic"
                          type="number"
                          step="0.01"
                          value={purchaseForm.basic_amount}
                          onChange={(e) => {
                            const newForm = { ...purchaseForm, basic_amount: e.target.value };
                            setPurchaseForm(newForm);
                            setTimeout(() => calculateTotal(newForm, setPurchaseForm), 100);
                          }}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="purchase_gst" className="text-[#0B2B5C] font-medium">
                          GST Amount (₹)
                        </Label>
                        <Input
                          id="purchase_gst"
                          type="number"
                          step="0.01"
                          value={purchaseForm.gst}
                          onChange={(e) => {
                            const newForm = { ...purchaseForm, gst: e.target.value };
                            setPurchaseForm(newForm);
                            setTimeout(() => calculateTotal(newForm, setPurchaseForm), 100);
                          }}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="purchase_total" className="text-[#0B2B5C] font-medium">
                          Total Amount (₹) <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="purchase_total"
                          type="number"
                          step="0.01"
                          value={purchaseForm.total_amount}
                          onChange={(e) => setPurchaseForm({ ...purchaseForm, total_amount: e.target.value })}
                          placeholder="0.00"
                          className="font-bold text-[#EF4444]"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => navigate('/invoices')}>
                      View All Invoices
                    </Button>
                    <Button
                      type="submit"
                      disabled={saving}
                      className="bg-[#EF4444] hover:bg-[#EF4444]/90"
                    >
                      <Save size={16} className="mr-2" />
                      {saving ? 'Saving...' : 'Save Purchase Invoice'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
