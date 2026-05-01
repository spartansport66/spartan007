"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { format } from 'date-fns';
import { Loader2, ShieldCheck, Truck, Download, Save, Zap, RefreshCcw } from 'lucide-react';

interface EwayBillDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EwayBillSettings {
  id?: string;
  sender_company_id?: string | null;
  api_key: string;
  api_url: string;
  sender_gstin: string;
  sender_legal_name: string;
  sender_address: string;
  sender_place: string;
  sender_pincode: string;
  sender_state_code: string;
  recipient_gstin: string;
  recipient_legal_name: string;
  recipient_address: string;
  recipient_place: string;
  recipient_pincode: string;
  recipient_state_code: string;
  supply_type: string;
  transport_mode: string;
  transport_distance: string;
  vehicle_number: string;
  vehicle_type: string;
  transporter_id: string;
  transporter_name: string;
  transport_document_number: string;
  transport_document_date: string;
  transaction_type: string;
  sub_supply_type: number;
}

interface BillOption {
  id: string;
  source_table: 'spartan' | 'fightor';
  bill_number: string;
  bill_date: string;
  company_name: string;
  dealer_name: string;
  order_id?: string;
  grand_total: number;
  gr_no?: string;
}

interface BillDetail {
  id: string;
  bill_number: string;
  bill_date: string;
  grand_total: number;
  payment_status: string;
  status: string;
  dealer_name: string;
  dealer_gst: string;
  dealer_address: string;
  dealer_city: string;
  dealer_state: string;
  company_name: string;
  company_gst: string;
  company_address: string;
  company_city: string;
  company_state: string;
  company_country: string;
  company_postal_code: string;
  source_table: 'spartan' | 'fightor';
  order_id?: string;
  gr_no?: string;
  invoice_value: number;
  items: Array<{
    product_name: string;
    product_code: string;
    product_size?: string;
    hsn_code?: string;
    quantity: number;
    unit?: string;
    unit_price: number;
    discount_percent: number;
    gst_percent: number;
    total_price: number;
  }>;
}

interface EwayBillPayloadItem {
  product_name: string;
  product_desc: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  gst_percent: number;
  total_price: number;
  taxable_value: number;
}

interface EwayBillPayload {
  docType: string;
  docNo: string;
  docDate: string;
  supplyType: string;
  fromGstin: string;
  fromTrdName: string;
  fromAddr1: string;
  fromPlace: string;
  fromPincode: string;
  fromStateCode: string;
  toGstin: string;
  toTrdName: string;
  toAddr1: string;
  toPlace: string;
  toPincode: string;
  toStateCode: string;
  transactionType: string;
  subSupplyType: number;
  docValue: number;
  cgstValue: number;
  sgstValue: number;
  igstValue: number;
  totalValue: number;
  totalInvoiceValue: number;
  transportMode: string;
  transportDistance: string;
  vehicleNo: string;
  vehicleType: string;
  transporterId: string;
  transporterName: string;
  transportDocNo: string;
  transportDocDate: string;
  itemList: EwayBillPayloadItem[];
}

const defaultSettings: EwayBillSettings = {
  sender_company_id: null,
  api_key: '',
  api_url: 'https://api.ewaybill.gov.in/v1/ewaybill',
  sender_gstin: '',
  sender_legal_name: '',
  sender_address: '',
  sender_place: '',
  sender_pincode: '',
  sender_state_code: '',
  recipient_gstin: '',
  recipient_legal_name: '',
  recipient_address: '',
  recipient_place: '',
  recipient_pincode: '',
  recipient_state_code: '',
  supply_type: 'Outward',
  transport_mode: 'Road',
  transport_distance: '',
  vehicle_number: '',
  vehicle_type: 'Regular',
  transporter_id: '',
  transporter_name: '',
  transport_document_number: '',
  transport_document_date: format(new Date(), 'yyyy-MM-dd'),
  transaction_type: 'Outward',
  sub_supply_type: 1,
};

const EwayBillDialog: React.FC<EwayBillDialogProps> = ({ isOpen, onOpenChange }) => {
  const [settings, setSettings] = useState<EwayBillSettings>(defaultSettings);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [companyOptions, setCompanyOptions] = useState<Array<{ id: string; name: string; address: string; city: string; state: string; country: string; postal_code: string | null; gst_number: string | null; eway_api_key?: string | null }>>([]);
  const [billOptions, setBillOptions] = useState<BillOption[]>([]);
  const [selectedBillId, setSelectedBillId] = useState<string>('');
  const [selectedBillDetails, setSelectedBillDetails] = useState<BillDetail | null>(null);
  const [isLoadingBills, setIsLoadingBills] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [ewayBillData, setEwayBillData] = useState<{ eway_bill_no?: string; eway_bill_date?: string; valid_upto?: string } | null>(null);
  const [generatedEwayBills, setGeneratedEwayBills] = useState<any[]>([]);
  const [isLoadingGeneratedBills, setIsLoadingGeneratedBills] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCompanies();
      loadEwaySettings();
      loadBillOptions();
      loadGeneratedEwayBills();
      setUploadStatus('');
      setSelectedBillDetails(null);
      setSelectedBillId('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!settings.sender_company_id || !companyOptions.length) {
      return;
    }

    const selectedCompany = companyOptions.find((company) => company.id === settings.sender_company_id);
    if (selectedCompany?.eway_api_key && settings.api_key !== selectedCompany.eway_api_key) {
      setSettings((prev) => ({ ...prev, api_key: selectedCompany.eway_api_key }));
    }
  }, [settings.sender_company_id, companyOptions]);

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, address, city, state, country, postal_code, gst_number, eway_api_key')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) {
        if (error.message?.includes('eway_api_key')) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('companies')
            .select('id, name, address, city, state, country, postal_code, gst_number')
            .eq('is_active', true)
            .order('name', { ascending: true });

          if (fallbackError) {
            console.error('Failed to load companies without eway_api_key:', fallbackError);
            return;
          }

          setCompanyOptions((fallbackData || []).map((company: any) => ({ ...company, eway_api_key: null })));
          return;
        }

        console.error('Failed to load companies:', error);
        return;
      }

      setCompanyOptions(data || []);
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const handleSenderCompanyChange = (companyId: string) => {
    const selectedCompany = companyOptions.find((company) => company.id === companyId);
    if (!selectedCompany) {
      setSettings((prev) => ({ ...prev, sender_company_id: null }));
      return;
    }

    setSettings((prev) => ({
      ...prev,
      sender_company_id: companyId,
      api_key: selectedCompany.eway_api_key || prev.api_key,
      sender_gstin: selectedCompany.gst_number || prev.sender_gstin,
      sender_legal_name: selectedCompany.name || prev.sender_legal_name,
      sender_address: selectedCompany.address || prev.sender_address,
      sender_place: selectedCompany.city || prev.sender_place,
      sender_state_code: prev.sender_state_code || selectedCompany.state || '',
    }));
  };

  const loadEwaySettings = async () => {
    try {
      const { data, error } = await supabase
        .from('eway_bill_settings')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Failed to load e-way settings:', error);
        showError('Unable to load e-way settings');
        return;
      }

      if (data) {
        setSettings({
          sender_company_id: data.sender_company_id || null,
          api_key: data.api_key || '',
          api_url: data.api_url || defaultSettings.api_url,
          sender_gstin: data.sender_gstin || '',
          sender_legal_name: data.sender_legal_name || '',
          sender_address: data.sender_address || '',
          sender_place: data.sender_place || '',
          sender_state_code: data.sender_state_code || '',
          recipient_gstin: data.recipient_gstin || '',
          recipient_legal_name: data.recipient_legal_name || '',
          recipient_address: data.recipient_address || '',
          recipient_place: data.recipient_place || '',
          recipient_state_code: data.recipient_state_code || '',
          transport_mode: data.transport_mode || defaultSettings.transport_mode,
          vehicle_number: data.vehicle_number || '',
          transporter_id: data.transporter_id || '',
          transporter_name: data.transporter_name || '',
          transport_document_number: data.transport_document_number || '',
          transport_document_date: data.transport_document_date || defaultSettings.transport_document_date,
          transaction_type: data.transaction_type || defaultSettings.transaction_type,
          sub_supply_type: data.sub_supply_type || defaultSettings.sub_supply_type,
        });
        setSettingsId(data.id || null);
      } else {
        setSettings(defaultSettings);
        setSettingsId(null);
      }
    } catch (error) {
      console.error('Error loading e-way settings:', error);
      showError('Failed to load e-way settings');
    }
  };

  const loadBillOptions = async () => {
    setIsLoadingBills(true);
    try {
      const [spartanRes, fightorRes] = await Promise.all([
        supabase
          .from('spartan')
          .select('id,bill_number,bill_date,grand_total,order_id,dealers(name),companies(name)')
          .not('bill_number', 'is', null)
          .order('bill_date', { ascending: false }),
        supabase
          .from('fightor')
          .select('id,bill_number,bill_date,grand_total,order_id,dealers(name),companies(name)')
          .not('bill_number', 'is', null)
          .order('bill_date', { ascending: false }),
      ]);

      const options: BillOption[] = [];
      if (!spartanRes.error && spartanRes.data) {
        options.push(
          ...spartanRes.data.map((bill: any) => ({
            id: bill.id,
            source_table: 'spartan' as const,
            bill_number: bill.bill_number,
            bill_date: bill.bill_date,
            company_name: bill.companies?.name || 'Spartan',
            dealer_name: bill.dealers?.name || 'Unknown',
            order_id: bill.order_id,
            grand_total: bill.grand_total,
          }))
        );
      }
      if (!fightorRes.error && fightorRes.data) {
        options.push(
          ...fightorRes.data.map((bill: any) => ({
            id: bill.id,
            source_table: 'fightor' as const,
            bill_number: bill.bill_number,
            bill_date: bill.bill_date,
            company_name: bill.companies?.name || 'Fighter',
            dealer_name: bill.dealers?.name || 'Unknown',
            order_id: bill.order_id,
            grand_total: bill.grand_total,
          }))
        );
      }
      options.sort((a, b) => new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime());
      setBillOptions(options);
    } catch (error) {
      console.error('Error loading bill options:', error);
      showError('Failed to load bills for E-way selection');
    } finally {
      setIsLoadingBills(false);
    }
  };

  const loadBillDetails = async (billId: string) => {
    if (!billId) {
      setSelectedBillDetails(null);
      return;
    }

    setIsLoadingDetails(true);
    try {
      const billOption = billOptions.find((bill) => bill.id === billId);
      if (!billOption) {
        setSelectedBillDetails(null);
        return;
      }

      const { data: billDetails, error } = await supabase
        .from(billOption.source_table)
        .select(`
          id,
          bill_number,
          bill_date,
          grand_total,
          payment_status,
          status,
          freight_charges,
          round_off,
          order_id,
          dealers(name, gst_number, address, city, state),
          companies(name, gst_number, address, city, state, country, postal_code)
        `)
        .eq('id', billOption.id)
        .maybeSingle();

      if (error || !billDetails) {
        console.error('Failed to load bill details:', error);
        showError('Unable to load selected bill details');
        setSelectedBillDetails(null);
        return;
      }

      let items: any[] = [];
      if (billDetails.order_id) {
        const { data: salesItems, error: salesError } = await supabase
          .from('sales')
          .select(`
            quantity,
            unit_price,
            discount_percent,
            gst_percent,
            total_price,
            products(name, code, size, hsn)
          `)
          .eq('order_id', billDetails.order_id);

        if (salesError) {
          console.error('Failed to load sales items:', salesError);
        } else {
          items = salesItems || [];
        }
      }

      const dealerName = billDetails.dealers?.name || 'Unknown';
      const dealerGst = billDetails.dealers?.gst_number || '';
      const dealerAddress = billDetails.dealers?.address || '';
      const dealerCity = billDetails.dealers?.city || '';
      const dealerState = billDetails.dealers?.state || '';

      setSelectedBillDetails({
        id: billDetails.id,
        bill_number: billDetails.bill_number,
        bill_date: billDetails.bill_date,
        grand_total: billDetails.grand_total,
        payment_status: billDetails.payment_status,
        status: billDetails.status,
        dealer_name: dealerName,
        dealer_gst: dealerGst,
        dealer_address: dealerAddress,
        dealer_city: dealerCity,
        dealer_state: dealerState,
        company_name: billDetails.companies?.name || billOption.company_name || '',
        company_gst: billDetails.companies?.gst_number || '',
        company_address: billDetails.companies?.address || '',
        company_city: billDetails.companies?.city || '',
        company_state: billDetails.companies?.state || '',
        company_country: billDetails.companies?.country || '',
        company_postal_code: billDetails.companies?.postal_code || '',
        source_table: billOption.source_table,
        order_id: billDetails.order_id,
        gr_no: billDetails.gr_no || billOption.gr_no || 'N/A',
        invoice_value: items.reduce((sum, item) => sum + (item.total_price || 0), 0),
        items: items.map((item: any) => ({
          product_name: item.products?.name || 'Unknown',
          product_code: item.products?.code || 'N/A',
          product_size: item.products?.size || 'N/A',
          hsn_code: item.products?.hsn || 'N/A',
          quantity: item.quantity || 0,
          unit: item.products?.size || 'NOS',
          unit_price: item.unit_price || 0,
          discount_percent: item.discount_percent || 0,
          gst_percent: item.gst_percent || 0,
          total_price: item.total_price || 0,
        })),
      });

      setSettings((prev) => ({
        ...prev,
        recipient_gstin: prev.recipient_gstin || dealerGst,
        recipient_legal_name: prev.recipient_legal_name || dealerName,
        recipient_address: prev.recipient_address || dealerAddress,
        recipient_place: prev.recipient_place || dealerCity,
        recipient_state_code: prev.recipient_state_code || dealerState,
      }));
    } catch (error) {
      console.error('Error loading bill details:', error);
      showError('Failed to load bill details');
      setSelectedBillDetails(null);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const getAuthorizationHeader = () => {
    if (!settings.api_key) return {};
    return { Authorization: settings.api_key.startsWith('Bearer ') ? settings.api_key : `Bearer ${settings.api_key}` };
  };

  const loadGeneratedEwayBills = async () => {
    setIsLoadingGeneratedBills(true);
    try {
      const { data, error } = await supabase
        .from('eway_bills')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Failed to load generated E-way bills:', error);
        return;
      }

      setGeneratedEwayBills(data || []);
    } catch (error) {
      console.error('Error loading generated E-way bills:', error);
    } finally {
      setIsLoadingGeneratedBills(false);
    }
  };

  const buildPayload = (): EwayBillPayload | null => {
    if (!selectedBillDetails) {
      return null;
    }

    const items = selectedBillDetails.items.map((item) => {
      const taxableValue = item.unit_price * item.quantity * (1 - item.discount_percent / 100);
      return {
        product_name: item.product_name,
        product_desc: item.product_name,
        hsn_code: item.hsn_code || '',
        quantity: item.quantity,
        unit: item.unit || 'NOS',
        unit_price: item.unit_price,
        discount_percent: item.discount_percent,
        gst_percent: item.gst_percent,
        total_price: item.total_price,
        taxable_value: parseFloat(taxableValue.toFixed(2)),
      };
    });

    const totalTaxable = items.reduce((sum, item) => sum + item.taxable_value, 0);
    const totalGst = parseFloat((items.reduce((sum, item) => sum + (item.taxable_value * item.gst_percent) / 100, 0)).toFixed(2));
    const cgst = parseFloat((totalGst / 2).toFixed(2));
    const sgst = parseFloat((totalGst / 2).toFixed(2));

    return {
      docType: 'INV',
      docNo: selectedBillDetails.bill_number,
      docDate: format(new Date(selectedBillDetails.bill_date), 'yyyy-MM-dd'),
      supplyType: settings.supply_type,
      fromGstin: settings.sender_gstin || selectedBillDetails.company_gst || '',
      fromTrdName: settings.sender_legal_name || selectedBillDetails.company_name || '',
      fromAddr1: settings.sender_address || selectedBillDetails.company_address || '',
      fromPlace: settings.sender_place || selectedBillDetails.company_city || '',
      fromPincode: settings.sender_pincode || selectedBillDetails.company_postal_code || '',
      fromStateCode: settings.sender_state_code || selectedBillDetails.company_state || '',
      toGstin: settings.recipient_gstin || selectedBillDetails.dealer_gst || '',
      toTrdName: settings.recipient_legal_name || selectedBillDetails.dealer_name || '',
      toAddr1: settings.recipient_address || selectedBillDetails.dealer_address || '',
      toPlace: settings.recipient_place || selectedBillDetails.dealer_city || '',
      toPincode: settings.recipient_pincode || '',
      toStateCode: settings.recipient_state_code || selectedBillDetails.dealer_state || '',
      transactionType: settings.transaction_type,
      subSupplyType: settings.sub_supply_type,
      docValue: selectedBillDetails.grand_total,
      cgstValue: cgst,
      sgstValue: sgst,
      igstValue: 0,
      totalValue: selectedBillDetails.grand_total,
      totalInvoiceValue: selectedBillDetails.invoice_value,
      transportMode: settings.transport_mode,
      transportDistance: settings.transport_distance,
      vehicleNo: settings.vehicle_number,
      vehicleType: settings.vehicle_type,
      transporterId: settings.transporter_id,
      transporterName: settings.transporter_name,
      transportDocNo: settings.transport_document_number,
      transportDocDate: settings.transport_document_date,
      itemList: items,
    };
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      if (settingsId) {
        const { error } = await supabase.from('eway_bill_settings').update(settings).eq('id', settingsId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('eway_bill_settings').insert(settings).select('id').single();
        if (error) throw error;
        setSettingsId(data.id);
      }
      showSuccess('E-way bill configuration saved');
    } catch (error) {
      console.error('Failed to save e-way settings:', error);
      showError('Unable to save E-way bill configuration');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleUploadEwayBill = async () => {
    if (!selectedBillDetails) {
      showError('Select a bill before creating the e-way bill');
      return;
    }

    if (!settings.api_key || !settings.api_url) {
      showError('Please save the API key and API URL first');
      return;
    }

    const payload = buildPayload();
    if (!payload) {
      showError('Unable to build E-way bill payload');
      return;
    }

    setIsUploading(true);
    setUploadStatus('Uploading e-way bill...');

    try {
      const response = await fetch(settings.api_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthorizationHeader(),
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      const ewayNumber = result.ewayBillNo || result.docNo || '';
      const ewayDate = result.ewayBillDate || result.docDate || '';
      const validUpto = result.validUpto || result.expiryDate || '';
      const statusText = response.ok ? 'uploaded' : 'failed';

      // Calculate total items from bill
      const totalItems = selectedBillDetails.items?.length || 0;

      // Get next sequential S.No
      const { data: maxSnoData } = await supabase
        .from('eway_bills')
        .select('sno')
        .order('sno', { ascending: false })
        .limit(1);

      const nextSno = (maxSnoData?.[0]?.sno || 0) + 1;

      // Store E-way bill data
      if (response.ok) {
        setEwayBillData({
          eway_bill_no: ewayNumber,
          eway_bill_date: ewayDate,
          valid_upto: validUpto,
        });
      }

      // Save complete E-way bill information to database
      await supabase.from('eway_bills').insert({
        order_id: selectedBillDetails.order_id || null,
        bill_number: selectedBillDetails.bill_number,
        source_table: selectedBillDetails.source_table,
        eway_bill_no: ewayNumber,
        eway_bill_date: ewayDate ? new Date(ewayDate).toISOString().split('T')[0] : null,
        valid_upto: validUpto ? new Date(validUpto).toISOString().split('T')[0] : null,
        grand_total: selectedBillDetails.grand_total,
        dealer_name: selectedBillDetails.dealer_name,
        dealer_gst: selectedBillDetails.dealer_gst,
        company_name: selectedBillDetails.company_name,
        company_gst: selectedBillDetails.company_gst,
        sno: nextSno,
        total_items: totalItems,
        status: statusText,
        request_payload: payload,
        response_payload: result,
      });

      // Reload the generated E-way bills list
      await loadGeneratedEwayBills();

      if (!response.ok) {
        showError(result.message || 'E-way upload failed');
        setUploadStatus(`Upload failed${ewayNumber ? ` — E-way No: ${ewayNumber}` : ''}`);
        return;
      }

      showSuccess(`E-way bill uploaded successfully${ewayNumber ? ` — E-way No: ${ewayNumber}` : ''}`);
      setUploadStatus(`Upload successful${ewayNumber ? ` — E-way No: ${ewayNumber}` : ''}`);
    } catch (error: any) {
      console.error('E-way upload error:', error);
      showError(error?.message || 'Failed to upload e-way bill');
      setUploadStatus('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadJson = async () => {
    if (!selectedBillDetails) {
      showError('Select a bill first');
      return;
    }

    const payload = buildPayload();
    if (!payload) {
      showError('Unable to build payload');
      return;
    }

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `EwayBill_${selectedBillDetails.bill_number || 'export'}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    showSuccess('E-way bill JSON downloaded');
  };

  const billSelectionLabel = useMemo(() => {
    if (!selectedBillId) return 'Choose a bill';
    const selected = billOptions.find((bill) => bill.id === selectedBillId);
    return selected ? `${selected.bill_number} • ${selected.company_name}` : 'Choose a bill';
  }, [selectedBillId, billOptions]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            <DialogTitle>Create E-way Bill</DialogTitle>
          </div>
          <DialogDescription>
            Save API key and transport settings, select a bill, then generate or upload the e-way bill payload.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 px-6 pb-6">
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle>E-way Bill Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="senderCompany">Sender Company</Label>
                  <Select
                    value={settings.sender_company_id || ''}
                    onValueChange={(value) => handleSenderCompanyChange(value)}
                  >
                    <SelectTrigger id="senderCompany" className="w-full">
                      <SelectValue placeholder="Choose sender company" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {companyOptions.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="apiUrl">API URL</Label>
                  <Input
                    id="apiUrl"
                    value={settings.api_url}
                    onChange={(e) => setSettings({ ...settings, api_url: e.target.value })}
                    placeholder="https://api.ewaybill.gov.in/v1/ewaybill"
                  />
                </div>
                <div>
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={settings.api_key}
                    onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
                    placeholder="Enter your E-way API key"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="senderGstin">Sender GSTIN</Label>
                  <Input
                    id="senderGstin"
                    value={settings.sender_gstin}
                    onChange={(e) => setSettings({ ...settings, sender_gstin: e.target.value })}
                    placeholder="22AAAAA0000A1Z5"
                  />
                </div>
                <div>
                  <Label htmlFor="recipientGstin">Recipient GSTIN</Label>
                  <Input
                    id="recipientGstin"
                    value={settings.recipient_gstin}
                    onChange={(e) => setSettings({ ...settings, recipient_gstin: e.target.value })}
                    placeholder="27BBBBB1111B2Z6"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="senderName">Sender Legal Name</Label>
                  <Input
                    id="senderName"
                    value={settings.sender_legal_name}
                    onChange={(e) => setSettings({ ...settings, sender_legal_name: e.target.value })}
                    placeholder="Business Legal Name"
                  />
                </div>
                <div>
                  <Label htmlFor="recipientName">Recipient Legal Name</Label>
                  <Input
                    id="recipientName"
                    value={settings.recipient_legal_name}
                    onChange={(e) => setSettings({ ...settings, recipient_legal_name: e.target.value })}
                    placeholder="Customer Name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="senderAddress">Sender Address</Label>
                  <Textarea
                    id="senderAddress"
                    value={settings.sender_address}
                    onChange={(e) => setSettings({ ...settings, sender_address: e.target.value })}
                    className="min-h-[80px]"
                    placeholder="Sender address"
                  />
                </div>
                <div>
                  <Label htmlFor="recipientAddress">Recipient Address</Label>
                  <Textarea
                    id="recipientAddress"
                    value={settings.recipient_address}
                    onChange={(e) => setSettings({ ...settings, recipient_address: e.target.value })}
                    className="min-h-[80px]"
                    placeholder="Recipient address"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="senderPlace">Sender Place</Label>
                  <Input
                    id="senderPlace"
                    value={settings.sender_place}
                    onChange={(e) => setSettings({ ...settings, sender_place: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="senderPincode">Sender Pincode</Label>
                  <Input
                    id="senderPincode"
                    value={settings.sender_pincode}
                    onChange={(e) => setSettings({ ...settings, sender_pincode: e.target.value })}
                    placeholder="000000"
                  />
                </div>
                <div>
                  <Label htmlFor="senderState">Sender State Code</Label>
                  <Input
                    id="senderState"
                    value={settings.sender_state_code}
                    onChange={(e) => setSettings({ ...settings, sender_state_code: e.target.value })}
                    placeholder="03"
                  />
                </div>
                <div>
                  <Label htmlFor="supplyType">Supply Type</Label>
                  <Input
                    id="supplyType"
                    value={settings.supply_type}
                    onChange={(e) => setSettings({ ...settings, supply_type: e.target.value })}
                    placeholder="Outward"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="recipientPlace">Recipient Place</Label>
                  <Input
                    id="recipientPlace"
                    value={settings.recipient_place}
                    onChange={(e) => setSettings({ ...settings, recipient_place: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="recipientPincode">Recipient Pincode</Label>
                  <Input
                    id="recipientPincode"
                    value={settings.recipient_pincode}
                    onChange={(e) => setSettings({ ...settings, recipient_pincode: e.target.value })}
                    placeholder="000000"
                  />
                </div>
                <div>
                  <Label htmlFor="recipientState">Recipient State Code</Label>
                  <Input
                    id="recipientState"
                    value={settings.recipient_state_code}
                    onChange={(e) => setSettings({ ...settings, recipient_state_code: e.target.value })}
                    placeholder="09"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="transportMode">Transport Mode</Label>
                  <Select value={settings.transport_mode} onValueChange={(value) => setSettings({ ...settings, transport_mode: value })}>
                    <SelectTrigger id="transportMode" className="w-full">
                      <SelectValue placeholder="Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Road">Road</SelectItem>
                      <SelectItem value="Rail">Rail</SelectItem>
                      <SelectItem value="Air">Air</SelectItem>
                      <SelectItem value="Ship">Ship</SelectItem>
                      <SelectItem value="Courier">Courier</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="vehicleNumber">Vehicle Number</Label>
                  <Input
                    id="vehicleNumber"
                    value={settings.vehicle_number}
                    onChange={(e) => setSettings({ ...settings, vehicle_number: e.target.value })}
                    placeholder="TN01AA1234"
                  />
                </div>
                <div>
                  <Label htmlFor="vehicleType">Vehicle Type</Label>
                  <Input
                    id="vehicleType"
                    value={settings.vehicle_type}
                    onChange={(e) => setSettings({ ...settings, vehicle_type: e.target.value })}
                    placeholder="Regular"
                  />
                </div>
                <div>
                  <Label htmlFor="transportDistance">Transport Distance (km)</Label>
                  <Input
                    id="transportDistance"
                    type="number"
                    value={settings.transport_distance}
                    onChange={(e) => setSettings({ ...settings, transport_distance: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="transporterId">Transporter ID</Label>
                  <Input
                    id="transporterId"
                    value={settings.transporter_id}
                    onChange={(e) => setSettings({ ...settings, transporter_id: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="transporterName">Transporter Name</Label>
                  <Input
                    id="transporterName"
                    value={settings.transporter_name}
                    onChange={(e) => setSettings({ ...settings, transporter_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="transportDocNo">Document No.</Label>
                  <Input
                    id="transportDocNo"
                    value={settings.transport_document_number}
                    onChange={(e) => setSettings({ ...settings, transport_document_number: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="transportDocDate">Document Date</Label>
                  <Input
                    id="transportDocDate"
                    type="date"
                    value={settings.transport_document_date}
                    onChange={(e) => setSettings({ ...settings, transport_document_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="transactionType">Transaction Type</Label>
                  <Select value={settings.transaction_type} onValueChange={(value) => setSettings({ ...settings, transaction_type: value })}>
                    <SelectTrigger id="transactionType" className="w-full">
                      <SelectValue placeholder="Select transaction type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Outward">Outward</SelectItem>
                      <SelectItem value="Inward">Inward</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="subSupplyType">Sub Supply Type</Label>
                  <Input
                    id="subSupplyType"
                    type="number"
                    value={settings.sub_supply_type}
                    onChange={(e) => setSettings({ ...settings, sub_supply_type: Number(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={handleSaveSettings} disabled={isSavingSettings} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {isSavingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save Settings
                </Button>
                <Button variant="outline" onClick={loadEwaySettings} disabled={isLoadingBills || isSavingSettings}>
                  <RefreshCcw className="h-4 w-4 mr-2" /> Reload Stored Settings
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Select Bill</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="selectBill">Select a bill for E-way bill creation</Label>
                <Select value={selectedBillId} onValueChange={(value) => { setSelectedBillId(value); setEwayBillData(null); loadBillDetails(value); }}>
                  <SelectTrigger id="selectBill" className="w-full">
                    <SelectValue placeholder={billSelectionLabel} />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingBills ? (
                      <SelectItem value="loading">Loading bills...</SelectItem>
                    ) : billOptions.length === 0 ? (
                      <SelectItem value="empty">No bills available</SelectItem>
                    ) : (
                      billOptions.map((bill) => (
                        <SelectItem key={`${bill.source_table}-${bill.id}`} value={bill.id}>
                          {bill.bill_number} — {bill.company_name} / {bill.dealer_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedBillDetails && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Bill Number</Label>
                      <div className="mt-1 text-sm text-slate-700">{selectedBillDetails.bill_number}</div>
                    </div>
                    <div>
                      <Label>GR No.</Label>
                      <div className="mt-1 text-sm text-slate-700">{selectedBillDetails.gr_no || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Bill Date</Label>
                      <div className="mt-1 text-sm text-slate-700">{format(new Date(selectedBillDetails.bill_date), 'dd/MM/yyyy')}</div>
                    </div>
                    <div>
                      <Label>Invoice Value</Label>
                      <div className="mt-1 text-sm text-slate-700">₹{selectedBillDetails.invoice_value ? selectedBillDetails.invoice_value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Company</Label>
                      <div className="mt-1 text-sm text-slate-700">{selectedBillDetails.company_name}</div>
                    </div>
                    <div>
                      <Label>Party</Label>
                      <div className="mt-1 text-sm text-slate-700">{selectedBillDetails.dealer_name}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <Label>Recipient GSTIN</Label>
                      <div className="mt-1 text-sm text-slate-700">{selectedBillDetails.dealer_gst || 'N/A'}</div>
                    </div>
                    <div>
                      <Label>Recipient State</Label>
                      <div className="mt-1 text-sm text-slate-700">{selectedBillDetails.dealer_state || 'N/A'}</div>
                    </div>
                  </div>
                  <div>
                    <Label>Recipient Address</Label>
                    <div className="mt-1 text-sm text-slate-700">{selectedBillDetails.dealer_address || 'N/A'}{selectedBillDetails.dealer_city ? `, ${selectedBillDetails.dealer_city}` : ''}{selectedBillDetails.dealer_state ? `, ${selectedBillDetails.dealer_state}` : ''}</div>
                  </div>
                  <div>
                    <Label>Total Amount</Label>
                    <div className="mt-1 text-sm text-slate-700">₹{selectedBillDetails.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>

                  {ewayBillData && (
                    <>
                      <div className="pt-3 border-t border-slate-200">
                        <h4 className="font-semibold text-slate-800 mb-3">E-way Bill Information</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>E-way Bill No</Label>
                            <div className="mt-1 text-sm text-slate-700 font-semibold text-blue-600">{ewayBillData.eway_bill_no || 'N/A'}</div>
                          </div>
                          <div>
                            <Label>E-way Bill Date</Label>
                            <div className="mt-1 text-sm text-slate-700">{ewayBillData.eway_bill_date ? format(new Date(ewayBillData.eway_bill_date), 'dd/MM/yyyy') : 'N/A'}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 mt-3">
                          <div>
                            <Label>Valid Upto</Label>
                            <div className="mt-1 text-sm text-slate-700">{ewayBillData.valid_upto ? format(new Date(ewayBillData.valid_upto), 'dd/MM/yyyy') : 'N/A'}</div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                </div>
              )}

              <div className="space-y-2">
                <Button onClick={handleUploadEwayBill} disabled={isUploading || !selectedBillDetails} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />} Upload E-way Bill
                </Button>
                <Button onClick={handleDownloadJson} disabled={!selectedBillDetails} variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" /> Download E-way JSON
                </Button>
              </div>

              {uploadStatus && (
                <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
                  {uploadStatus}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {selectedBillDetails && (
          <div className="px-6 pb-6">
            <Card>
              <CardHeader>
                <CardTitle>Bill Items Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[260px] border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>HSN</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>GST%</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedBillDetails.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.product_name}</TableCell>
                          <TableCell>{item.hsn_code}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>₹{item.unit_price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell>{item.gst_percent}%</TableCell>
                          <TableCell>₹{item.total_price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Generated E-way Bills List */}
        <Card className="mx-6 mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Generated E-way Bills</CardTitle>
              <Button variant="outline" size="sm" onClick={loadGeneratedEwayBills} disabled={isLoadingGeneratedBills}>
                <RefreshCcw className="h-4 w-4 mr-2" /> Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingGeneratedBills ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : generatedEwayBills.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No E-way bills generated yet</p>
              </div>
            ) : (
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>S.No</TableHead>
                      <TableHead>E-way Bill No</TableHead>
                      <TableHead>Bill #</TableHead>
                      <TableHead>Total Items</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Dealer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>E-way Date</TableHead>
                      <TableHead>Valid Upto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generatedEwayBills.map((bill) => (
                      <TableRow key={bill.id}>
                        <TableCell className="font-bold text-gray-700">{bill.sno || '-'}</TableCell>
                        <TableCell className="font-semibold text-blue-600">{bill.eway_bill_no || 'N/A'}</TableCell>
                        <TableCell>{bill.bill_number}</TableCell>
                        <TableCell className="font-medium text-center">{bill.total_items || 0}</TableCell>
                        <TableCell>{bill.company_name || 'N/A'}</TableCell>
                        <TableCell>{bill.dealer_name || 'N/A'}</TableCell>
                        <TableCell>₹{bill.grand_total ? bill.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}</TableCell>
                        <TableCell>{bill.eway_bill_date ? format(new Date(bill.eway_bill_date), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                        <TableCell>{bill.valid_upto ? format(new Date(bill.valid_upto), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${bill.status === 'uploaded' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {bill.status || 'Unknown'}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">{bill.created_at ? format(new Date(bill.created_at), 'dd/MM/yyyy HH:mm') : 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <DialogFooter className="px-6 pb-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EwayBillDialog;
