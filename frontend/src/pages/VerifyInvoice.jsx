import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, AlertTriangle, Save, ArrowLeft, ZoomIn, ZoomOut } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function VerifyInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [formData, setFormData] = useState({
    invoice_no: '',
    invoice_date: '',
    supplier_name: '',
    address: '',
    gst_no: '',
    basic_amount: '',
    gst: '',
    total_amount: ''
  });

  useEffect(() => {
    loadInvoice();
  }, [id]);

  const loadInvoice = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/invoices/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvoice(response.data);
      setFormData(response.data.extracted_data);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load invoice');
      navigate('/invoices');
    }
  };

  const handleSave = async (markAsVerified = false) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API}/invoices/${id}`,
        {
          extracted_data: formData,
          status: markAsVerified ? 'verified' : invoice.status
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(markAsVerified ? 'Invoice verified successfully!' : 'Changes saved');
      if (markAsVerified) {
        navigate('/invoices');
      } else {
        loadInvoice();
      }
    } catch (error) {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const getConfidenceColor = (fieldName) => {
    if (!invoice) return '';
    const confidence = invoice.confidence_scores[fieldName];
    if (confidence >= 0.9) return 'border-[#10B981] bg-[#10B981]/5';
    if (confidence >= 0.7) return 'border-[#F59E0B] bg-[#F59E0B]/5';
    return 'border-[#EF4444] bg-[#EF4444]/5';
  };

  const getConfidenceBadge = (fieldName) => {
    if (!invoice) return null;
    const confidence = invoice.confidence_scores[fieldName];
    const percentage = Math.round(confidence * 100);
    
    if (confidence >= 0.9) {
      return <Badge className="bg-[#10B981] text-white ml-2">{percentage}%</Badge>;
    } else if (confidence >= 0.7) {
      return <Badge className="bg-[#F59E0B] text-white ml-2">{percentage}%</Badge>;
    } else {
      return <Badge className="bg-[#EF4444] text-white ml-2">{percentage}%</Badge>;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12" data-testid="loading-message">Loading invoice...</div>
      </Layout>
    );
  }

  const avgConfidence = Object.values(invoice.confidence_scores).reduce((a, b) => a + b, 0) / 8;

  return (
    <Layout>
      <div className="space-y-6" data-testid="verify-invoice-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button
              onClick={() => navigate('/invoices')}
              variant="ghost"
              data-testid="back-btn"
              className="mb-2 -ml-2 text-[#0B2B5C] hover:text-[#0B2B5C] hover:bg-[#0B2B5C]/5"
            >
              <ArrowLeft size={16} className="mr-2" />
              Back to Invoices
            </Button>
            <h1 className="text-3xl font-manrope font-bold text-[#0B2B5C]" data-testid="verify-invoice-title">
              Cross-Verify Invoice
            </h1>
            <p className="text-muted-foreground mt-1">
              Review and edit extracted data. Fields highlighted in color indicate confidence levels.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => handleSave(false)}
              variant="outline"
              data-testid="save-changes-btn"
              disabled={saving}
              className="border-[#0B2B5C] text-[#0B2B5C] hover:bg-[#0B2B5C] hover:text-white"
            >
              <Save size={16} className="mr-2" />
              Save Changes
            </Button>
            <Button
              onClick={() => handleSave(true)}
              data-testid="verify-submit-btn"
              disabled={saving}
              className="bg-[#10B981] hover:bg-[#10B981]/90 text-white"
            >
              <CheckCircle size={16} className="mr-2" />
              Verify & Approve
            </Button>
          </div>
        </div>

        {/* Confidence Alert */}
        {avgConfidence < 0.8 && (
          <Alert className="border-[#F59E0B] bg-[#F59E0B]/5" data-testid="low-confidence-alert">
            <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
            <AlertDescription className="text-[#F59E0B]">
              Average confidence: {Math.round(avgConfidence * 100)}%. Please carefully review all fields before approving.
            </AlertDescription>
          </Alert>
        )}

        {/* Split View */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Invoice Preview */}
          <Card className="border-[#0B2B5C]/10 shadow-lg lg:sticky lg:top-6 lg:h-fit">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-manrope text-[#0B2B5C]">Invoice Preview</CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                    data-testid="zoom-out-btn"
                  >
                    <ZoomOut size={16} />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                    data-testid="zoom-in-btn"
                  >
                    <ZoomIn size={16} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto max-h-[800px] bg-muted/30 rounded-sm p-4">
                {invoice.file_type === 'application/pdf' ? (
                  <embed
                    src={`data:application/pdf;base64,${invoice.file_data}`}
                    type="application/pdf"
                    data-testid="pdf-preview"
                    width="100%"
                    height="800px"
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                  />
                ) : (
                  <img
                    src={`data:${invoice.file_type};base64,${invoice.file_data}`}
                    alt="Invoice"
                    data-testid="image-preview"
                    className="max-w-full h-auto rounded-sm"
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                  />
                )}
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                <p data-testid="invoice-filename">File: {invoice.filename}</p>
                <p data-testid="invoice-uploaded-date">Uploaded: {new Date(invoice.created_at).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          {/* Right Panel - Edit Form */}
          <Card className="border-[#0B2B5C]/10 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg font-manrope text-[#0B2B5C]">Extracted Data</CardTitle>
              <p className="text-sm text-muted-foreground">Edit any field that needs correction</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Invoice Details */}
              <div className="space-y-4">
                <h3 className="font-manrope font-semibold text-[#0B2B5C]">Invoice Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="invoice_no" className="flex items-center">
                      Invoice Number
                      {getConfidenceBadge('invoice_no')}
                    </Label>
                    <Input
                      id="invoice_no"
                      data-testid="invoice-no-input"
                      value={formData.invoice_no || ''}
                      onChange={(e) => setFormData({ ...formData, invoice_no: e.target.value })}
                      className={`font-mono mt-1 ${getConfidenceColor('invoice_no')}`}
                    />
                  </div>
                  <div>
                    <Label htmlFor="invoice_date" className="flex items-center">
                      Invoice Date
                      {getConfidenceBadge('invoice_date')}
                    </Label>
                    <Input
                      id="invoice_date"
                      data-testid="invoice-date-input"
                      value={formData.invoice_date || ''}
                      onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                      className={`mt-1 ${getConfidenceColor('invoice_date')}`}
                      placeholder="DD/MM/YYYY"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Supplier Information */}
              <div className="space-y-4">
                <h3 className="font-manrope font-semibold text-[#0B2B5C]">Supplier Information</h3>
                <div>
                  <Label htmlFor="supplier_name" className="flex items-center">
                    Supplier Name
                    {getConfidenceBadge('supplier_name')}
                  </Label>
                  <Input
                    id="supplier_name"
                    data-testid="supplier-name-input"
                    value={formData.supplier_name || ''}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                    className={`mt-1 ${getConfidenceColor('supplier_name')}`}
                  />
                </div>
                <div>
                  <Label htmlFor="address" className="flex items-center">
                    Address
                    {getConfidenceBadge('address')}
                  </Label>
                  <Input
                    id="address"
                    data-testid="address-input"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className={`mt-1 ${getConfidenceColor('address')}`}
                  />
                </div>
                <div>
                  <Label htmlFor="gst_no" className="flex items-center">
                    GST Number
                    {getConfidenceBadge('gst_no')}
                  </Label>
                  <Input
                    id="gst_no"
                    data-testid="gst-no-input"
                    value={formData.gst_no || ''}
                    onChange={(e) => setFormData({ ...formData, gst_no: e.target.value })}
                    className={`font-mono mt-1 ${getConfidenceColor('gst_no')}`}
                  />
                </div>
              </div>

              <Separator />

              {/* Amount Details */}
              <div className="space-y-4">
                <h3 className="font-manrope font-semibold text-[#0B2B5C]">Amount Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="basic_amount" className="flex items-center">
                      Basic Amount
                      {getConfidenceBadge('basic_amount')}
                    </Label>
                    <Input
                      id="basic_amount"
                      type="number"
                      data-testid="basic-amount-input"
                      value={formData.basic_amount || ''}
                      onChange={(e) => setFormData({ ...formData, basic_amount: parseFloat(e.target.value) || 0 })}
                      className={`font-mono mt-1 ${getConfidenceColor('basic_amount')}`}
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label htmlFor="gst" className="flex items-center">
                      GST
                      {getConfidenceBadge('gst')}
                    </Label>
                    <Input
                      id="gst"
                      type="number"
                      data-testid="gst-input"
                      value={formData.gst || ''}
                      onChange={(e) => setFormData({ ...formData, gst: parseFloat(e.target.value) || 0 })}
                      className={`font-mono mt-1 ${getConfidenceColor('gst')}`}
                      step="0.01"
                    />
                  </div>
                  <div>
                    <Label htmlFor="total_amount" className="flex items-center">
                      Total Amount
                      {getConfidenceBadge('total_amount')}
                    </Label>
                    <Input
                      id="total_amount"
                      type="number"
                      data-testid="total-amount-input"
                      value={formData.total_amount || ''}
                      onChange={(e) => setFormData({ ...formData, total_amount: parseFloat(e.target.value) || 0 })}
                      className={`font-mono mt-1 ${getConfidenceColor('total_amount')}`}
                      step="0.01"
                    />
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="bg-muted/30 p-4 rounded-sm">
                <p className="text-sm font-medium text-[#0B2B5C] mb-2">Confidence Level Guide:</p>
                <div className="flex flex-wrap gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[#10B981] rounded"></div>
                    <span>≥ 90% High</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[#F59E0B] rounded"></div>
                    <span>70-89% Medium</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[#EF4444] rounded"></div>
                    <span>&lt; 70% Low</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}