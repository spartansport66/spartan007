"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Loader2, Printer } from 'lucide-react';
import { format } from 'date-fns';

interface OrderDetail {
  id: string;
  order_number: number;
  order_date: string;
  bill_no: string | null;
  total_amount: number;
  discount_amount: number;
  round_off: number;
  freight_charges: number;
  delivery_location: string | null;
  transport_name: string | null;
  booking_destination: string | null;
  date_of_dispatch: string | null;
  sales_person_name: string | null;
  user_id: string;
  profiles: {
    first_name: string;
  } | null;
  dealers: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    country: string;
    gst_number: string | null;
    id: string;
    credit_limit?: number;
  };
  sales: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    gst_percent: number;
    total_price: number;
    products: {
      name: string;
      code: string;
      hsn: string | null;
    };
  }>;
}

interface DealerBalance {
  net_ledger_balance: number;
}

interface CompanyInfo {
  id?: string;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  gst_number?: string | null;
  contact_number?: string | null;
  email?: string | null;
  website?: string | null;
  logo_url: string | null;
}

// Utility function to convert number to words
function numberToWords(num: number): string {
  const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
  const teens = ['TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  const thousands = ['', 'THOUSAND', 'LAKH', 'CRORE'];

  if (num === 0) return 'ZERO';

  let result = '';
  let groupIndex = 0;

  while (num > 0) {
    let groupValue = num % (groupIndex === 0 ? 1000 : 100);
    
    if (groupValue > 0) {
      if (groupIndex === 0) {
        if (groupValue >= 100) {
          result = ones[Math.floor(groupValue / 100)] + ' HUNDRED ' + result;
          groupValue %= 100;
        }
        if (groupValue >= 20) {
          result = tens[Math.floor(groupValue / 10)] + (groupValue % 10 ? ' ' + ones[groupValue % 10] : '') + ' ' + result;
        } else if (groupValue >= 10) {
          result = teens[groupValue - 10] + ' ' + result;
        } else if (groupValue > 0) {
          result = ones[groupValue] + ' ' + result;
        }
      } else {
        if (groupValue >= 20) {
          result = tens[Math.floor(groupValue / 10)] + (groupValue % 10 ? ' ' + ones[groupValue % 10] : '') + ' ' + thousands[groupIndex] + ' ' + result;
        } else if (groupValue >= 10) {
          result = teens[groupValue - 10] + ' ' + thousands[groupIndex] + ' ' + result;
        } else {
          result = ones[groupValue] + ' ' + thousands[groupIndex] + ' ' + result;
        }
      }
    }

    num = Math.floor(num / (groupIndex === 0 ? 1000 : 100));
    groupIndex++;
  }

  return result.trim();
}

interface PrintBillDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | { id: string; sourceTable?: string };
}

const PrintBillDialog: React.FC<PrintBillDialogProps> = ({
  isOpen,
  onOpenChange,
  orderId,
}) => {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [dealerBalance, setDealerBalance] = useState<DealerBalance | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Extract ID and source table from orderId parameter
  const id = typeof orderId === 'string' ? orderId : orderId.id;
  const sourceTable = typeof orderId === 'string' ? undefined : orderId.sourceTable;

  useEffect(() => {
    if (isOpen && orderId) {
      fetchOrderDetails();
    }
  }, [isOpen, orderId]);

  const fetchOrderDetails = async () => {
    setLoading(true);
    try {
      // Validate ID is not empty
      if (!id || id.trim() === '') {
        throw new Error('Invalid ID: Order ID is empty or missing');
      }

      console.log('📋 Fetching order details with ID:', id, 'Source Table:', sourceTable);
      
      // If we know the source table (it's a bill, not an order), prioritize that table
      let tablesToTry: string[] = [];
      
      if (sourceTable && (sourceTable === 'spartan' || sourceTable === 'fightor')) {
        console.log(`🎯 Prioritizing ${sourceTable} table based on source...`);
        tablesToTry = [sourceTable, sourceTable === 'spartan' ? 'fightor' : 'spartan'];
      } else {
        console.log(`⚠️ No source table provided, will try both tables...`);
        tablesToTry = ['spartan', 'fightor'];
      }
      
      // Try each table in order
      for (const tableName of tablesToTry) {
        console.log(`  🔍 Searching for bill in ${tableName} table...`);
        
        let billData = await supabase
          .from(tableName)
          .select(`
            id,
            bill_number,
            bill_date,
            grand_total,
            discount_amount,
            round_off,
            freight_charges,
            order_id,
            dealers(
              id,
              name,
              email,
              phone,
              address,
              city,
              state,
              country,
              gst_number,
              credit_limit
            ),
            companies(
              id,
              name,
              address,
              city,
              state,
              country,
              gst_number,
              contact_number,
              email,
              website,
              logo_url
            )
          `)
          .eq('id', id)
          .maybeSingle();

        if (billData.data && billData.data.order_id) {
          console.log(`✅ Found bill in ${tableName} table, fetching complete order data...`);
          
          const fullOrderData = await supabase
            .from('orders')
            .select(`
              id,
              order_number,
              order_date,
              bill_no,
              total_amount,
              discount_amount,
              round_off,
              freight_charges,
              delivery_location,
              transport_name,
              booking_destination,
              date_of_dispatch,
              sales_person_name,
              user_id,
              dealers(
                id,
                name,
                email,
                phone,
                address,
                city,
                state,
                country,
                gst_number,
                credit_limit
              ),
              sales(
                id,
                quantity,
                unit_price,
                discount_percent,
                gst_percent,
                total_price,
                products(name, code, hsn)
              )
            `)
            .eq('id', billData.data.order_id)
            .maybeSingle();

          if (fullOrderData.data) {
            const orderDataResult = fullOrderData;
            
            // Rest of the function uses orderDataResult
            let userProfile = null;
            if (orderDataResult.data?.user_id) {
              const profileResult = await supabase
                .from('profiles')
                .select('first_name')
                .eq('id', orderDataResult.data.user_id)
                .maybeSingle();
              
              if (profileResult.data) {
                userProfile = profileResult.data;
              }
            }

            let dealerBalanceInfo = null;
            if (orderDataResult.data?.dealers?.id) {
              const dealerId = orderDataResult.data.dealers.id;
              
              try {
                const { data, error } = await supabase.rpc('get_net_ledger_balance', {
                  dealer_id_param: dealerId
                });
                
                if (error) {
                  console.error('Error fetching net ledger balance:', error);
                  dealerBalanceInfo = { net_ledger_balance: 0 };
                } else if (data && data.length > 0) {
                  dealerBalanceInfo = {
                    net_ledger_balance: data[0].net_ledger_balance || 0
                  };
                } else if (data) {
                  dealerBalanceInfo = {
                    net_ledger_balance: data.net_ledger_balance || 0
                  };
                }
              } catch (err) {
                console.error('Exception fetching net ledger balance:', err);
                dealerBalanceInfo = { net_ledger_balance: 0 };
              }
            }

            const orderDataWithProfile = {
              ...orderDataResult.data,
              profiles: userProfile
            };

            const billCompany = billData.data?.companies;
            let companyDataResult;
            if (billCompany?.id) {
              companyDataResult = await supabase
                .from('companies')
                .select('id, name, address, city, state, country, gst_number, contact_number, email, website, logo_url')
                .eq('id', billCompany.id)
                .limit(1)
                .maybeSingle();
            } else {
              companyDataResult = await supabase
                .from('companies')
                .select('id, name, address, city, state, country, gst_number, contact_number, email, website, logo_url')
                .eq('name', 'Spartan Sports Corporation')
                .limit(1)
                .maybeSingle();
            }

            if (companyDataResult.error) {
              throw companyDataResult.error;
            }

            setOrder(orderDataWithProfile as any);
            if (companyDataResult.data) {
              setCompanyInfo(companyDataResult.data as any);
            } else if (billCompany) {
              setCompanyInfo(billCompany as any);
            }
            setDealerBalance(dealerBalanceInfo);
            return; // Successfully found and processed the bill
          } else {
            console.log(`⚠️ Bill found in ${tableName} but no order_id linked`);
            throw new Error(`Bill found in ${tableName} but cannot fetch linked order`);
          }
        } else if (billData.error) {
          console.log(`❌ Error querying ${tableName} table:`, billData.error.message);
          continue; // Try next table
        }
        // If no data and no error, bill not found in this table, try next
      }
      
      // If we get here, bill wasn't found in spartan or fightor
      // Fall back to original logic - try orders table
      console.log('📋 Bill not found in bill tables, trying orders table...');
      let orderDataResult = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          order_date,
          bill_no,
          total_amount,
          discount_amount,
          round_off,
          freight_charges,
          delivery_location,
          transport_name,
          booking_destination,
          date_of_dispatch,
          sales_person_name,
          user_id,
          dealers(
            id,
            name,
            email,
            phone,
            address,
            city,
            state,
            country,
            gst_number,
            credit_limit
          ),
          companies(
            id,
            name,
            address,
            city,
            state,
            country,
            gst_number,
            contact_number,
            email,
            website,
            logo_url
          ),
          sales(
            id,
            quantity,
            unit_price,
            discount_percent,
            gst_percent,
            total_price,
            products(name, code, hsn)
          )
        `)
        .eq('id', id)
        .maybeSingle();

      // If not found in orders table, try spartan/fightor tables (bill ID passed instead of order_id)
      if (!orderDataResult.data) {
        console.log('⚠️ Not found in orders table, trying spartan/fightor tables...');
        
        // Try spartan first
        let billData = await supabase
          .from('spartan')
          .select(`
            id,
            bill_number,
            bill_date,
            grand_total,
            discount_amount,
            round_off,
            freight_charges,
            order_id,
            dealers(
              id,
              name,
              email,
              phone,
              address,
              city,
              state,
              country,
              gst_number,
              credit_limit
            ),
            companies(
              id,
              name,
              address,
              city,
              state,
              country,
              gst_number,
              contact_number,
              email,
              website,
              logo_url
            )
          `)
          .eq('id', orderId)
          .maybeSingle();

        // If not in spartan, try fightor
        if (!billData.data) {
          billData = await supabase
            .from('fightor')
            .select(`
              id,
              bill_number,
              bill_date,
              grand_total,
              discount_amount,
              round_off,
              freight_charges,
              order_id,
              dealers(
                id,
                name,
                email,
                phone,
                address,
                city,
                state,
                country,
                gst_number,
                credit_limit
              ),
              companies(
                id,
                name,
                address,
                city,
                state,
                country,
                gst_number,
                contact_number,
                email,
                website,
                logo_url
              )
            `)
            .eq('id', id)
            .maybeSingle();
        }

        if (billData.data) {
          console.log('✅ Found bill in spartan/fightor table');
          // If bill has order_id, fetch full order details from orders table
          if (billData.data.order_id) {
            const fullOrderData = await supabase
              .from('orders')
              .select(`
                id,
                order_number,
                order_date,
                bill_no,
                total_amount,
                discount_amount,
                round_off,
                freight_charges,
                delivery_location,
                transport_name,
                booking_destination,
                date_of_dispatch,
                sales_person_name,
                user_id,
                dealers(
                  id,
                  name,
                  email,
                  phone,
                  address,
                  city,
                  state,
                  country,
                  gst_number,
                  credit_limit
                ),
                sales(
                  id,
                  quantity,
                  unit_price,
                  discount_percent,
                  gst_percent,
                  total_price,
                  products(name, code, hsn)
                )
              `)
              .eq('id', billData.data.order_id)
              .maybeSingle();

            if (fullOrderData.data) {
              orderDataResult.data = fullOrderData.data;
            } else {
              throw new Error('Cannot find complete order details');
            }
          } else {
            throw new Error('Bill found but no order_id linked');
          }
        }
      }

      if (!orderDataResult.data) {
        throw new Error('Order not found with ID: ' + id);
      }

      if (orderDataResult.error) throw orderDataResult.error;

      // Fetch user profile separately
      let userProfile = null;
      if (orderDataResult.data?.user_id) {
        const profileResult = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', orderDataResult.data.user_id)
          .single();
        
        if (profileResult.data) {
          userProfile = profileResult.data;
        }
      }

      // Fetch dealer ledger balance - using proven working calculation
      // Query: Opening Balance + Approved Invoices - Completed Payments
      let dealerBalanceInfo = null;
      if (orderDataResult.data?.dealers?.id) {
        const dealerId = orderDataResult.data.dealers.id;
        
        try {
          // Call the get_net_ledger_balance function to get correct balance
          // Balance = Opening Balance + Approved Invoices - Completed Payments
          const { data, error } = await supabase.rpc('get_net_ledger_balance', {
            dealer_id_param: dealerId
          });
          
          if (error) {
            console.error('Error fetching net ledger balance:', error);
            dealerBalanceInfo = { net_ledger_balance: 0 };
          } else if (data && data.length > 0) {
            // RPC returns an array, get the first row
            const balanceData = data[0];
            dealerBalanceInfo = {
              net_ledger_balance: balanceData.net_ledger_balance || 0
            };
            console.log('Net Ledger Balance from RPC:', balanceData.net_ledger_balance);
          } else if (data) {
            // Handle case where data is a single object
            dealerBalanceInfo = {
              net_ledger_balance: data.net_ledger_balance || 0
            };
            console.log('Net Ledger Balance from RPC:', data.net_ledger_balance);
          }
        } catch (err) {
          console.error('Exception fetching net ledger balance:', err);
          dealerBalanceInfo = { net_ledger_balance: 0 };
        }
      }

      // Attach profile to order data
      const orderDataWithProfile = {
        ...orderDataResult.data,
        profiles: userProfile
      };

      // Fetch company info
      let companyDataResult;
      if (orderDataResult.data?.companies?.id) {
        companyDataResult = await supabase
          .from('companies')
          .select('id, name, address, city, state, country, gst_number, contact_number, email, website, logo_url')
          .eq('id', orderDataResult.data.companies.id)
          .limit(1)
          .maybeSingle();
      } else {
        companyDataResult = await supabase
          .from('companies')
          .select('id, name, address, city, state, country, gst_number, contact_number, email, website, logo_url')
          .eq('name', 'Spartan Sports Corporation')
          .limit(1)
          .maybeSingle();
      }

      if (companyDataResult.error) {
        throw companyDataResult.error;
      }

      setOrder(orderDataWithProfile as any);
      if (companyDataResult.data) {
        setCompanyInfo(companyDataResult.data as any);
      } else if (orderDataResult.data?.companies) {
        setCompanyInfo(orderDataResult.data.companies as any);
      }
      setDealerBalance(dealerBalanceInfo);
    } catch (err) {
      console.error('Error fetching order/company details:', err);
      showError('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=1000,height=1200');
    if (!printWindow || !order) return;

    const totalTaxableValue = order.sales.reduce((sum, item) => {
      const taxable = item.total_price / (1 + item.gst_percent / 100);
      return sum + taxable;
    }, 0);

    const totalGST = order.sales.reduce((sum, item) => {
      const taxable = item.total_price / (1 + item.gst_percent / 100);
      return sum + (taxable * item.gst_percent / 100);
    }, 0);

    // Pagination: 5 items per A4 page
    const ITEMS_PER_PAGE = 5;
    const pages = [];
    for (let i = 0; i < order.sales.length; i += ITEMS_PER_PAGE) {
      pages.push(order.sales.slice(i, i + ITEMS_PER_PAGE));
    }
    const totalPages = pages.length;

    // Generate invoice header HTML
    const getInvoiceHeader = (pageNum, copyType) => `
      <!-- Header -->
      <div class="header">
        <div class="company-info">
          <p style="margin: 0 0 3px 0; font-size: 10px;"><strong>GSTIN: ${companyInfo?.gst_number || 'N/A'}</strong></p>
          <p style="margin: 0 0 5px 0; font-size: 10px;"><strong>Web: ${companyInfo?.website || 'N/A'}</strong></p>
          <h1>${companyInfo?.name || 'SPARTAN SPORTS CORPORATION'}</h1>
          <p>${companyInfo?.address || '403-404, LEATHER COMPLEX, KAPURTHALA'}</p>
          <p>${companyInfo?.city || 'JALANDHAR'}${companyInfo?.state ? ', ' + companyInfo.state : ''}${companyInfo?.country ? ' (' + companyInfo.country + ')' : ' (PUNJAB)'}</p>
          <p>Ph: ${companyInfo?.contact_number || '+91-181-6676555'}</p>
          <p>Email: ${companyInfo?.email || 'corporate@spartan.com'}</p>
        </div>
        <div class="qr-code">
          ${companyInfo?.logo_url ? `<img src="${companyInfo.logo_url}" alt="Company Logo" style="max-width: 100%; max-height: 100%; object-fit: contain;">` : `<div>QR Code</div>`}
        </div>
      </div>
      
      <!-- Title -->
      <div class="tax-invoice-title">TAX INVOICE</div>
      
      <!-- Copy Type Label -->
      <div style="text-align: center; font-size: 10px; font-style: italic; color: #666; margin-top: 2px; margin-bottom: 10px;">${copyType}</div>
      
      <!-- Bill Info -->
      <div class="bill-info-row">
        <div class="bill-info-item">
          <strong>Invoice No.:</strong>
          ${order.bill_no || 'N/A'}
        </div>
        <div class="bill-info-item">
          <strong>Date:</strong>
          ${format(new Date(order.order_date), 'dd-MMM-yyyy')}
        </div>
        <div class="bill-info-item">
          <strong>Order Ref.:</strong>
          ORD-${order.order_number}
        </div>
      </div>
      
      ${pageNum === 1 ? `
      <!-- Addresses (Only on first page) -->
      <div class="addresses">
        <div class="address-box">
          <h3>BILL TO</h3>
          <p><strong>${order.dealers.name}</strong></p>
          <p>${order.dealers.address || ''}</p>
          <p>${order.dealers.city}, ${order.dealers.state} ${order.dealers.country}</p>
          <p>Phone: ${order.dealers.phone || 'N/A'}</p>
          <p>Email: ${order.dealers.email || 'N/A'}</p>
          <p style="margin-top: 5px; padding-top: 5px; border-top: 1px solid #ddd;"><strong>GSTIN:</strong> ${order.dealers.gst_number || 'N/A'}</p>
          <p style="margin-top: 3px;"><strong>Sales Person:</strong> ${order.profiles?.first_name || order.sales_person_name || '___________________'}</p>
        </div>
        <div class="address-box">
          <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #ddd;">
            <h3>SHIP TO</h3>
            <p><strong>${order.dealers.name}</strong></p>
            <p>${order.dealers.address || ''}</p>
            <p>${order.dealers.city}, ${order.dealers.state} ${order.dealers.country}</p>
            <p>Phone: ${order.dealers.phone || 'N/A'}</p>
          </div>
          <div>
            <h3>DELIVERY & TRANSPORT DETAILS</h3>
            <p><strong>Delivery Location:</strong> ${order.delivery_location || 'N/A'}</p>
            <p><strong>Transport Name:</strong> ${order.transport_name || 'N/A'}</p>
            <p><strong>Booking Destination:</strong> ${order.booking_destination || 'N/A'}</p>
            <p><strong>Date of Dispatch:</strong> ${order.date_of_dispatch ? format(new Date(order.date_of_dispatch), 'dd-MMM-yyyy') : 'N/A'}</p>
          </div>
        </div>
      </div>
      ` : ''}
    `;

    // Generate items table HTML
    const getItemsTable = (pageItems, startIndex) => `
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 5%">S.No</th>
            <th style="width: 35%">Description of Goods</th>
            <th style="width: 10%">HSN/SAC</th>
            <th style="width: 8%">Quantity</th>
            <th style="width: 8%">Unit</th>
            <th style="width: 10%">Rate</th>
            <th style="width: 8%">Discount %</th>
            <th style="width: 8%">GST %</th>
            <th style="width: 12%">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${pageItems.map((item, idx) => {
            return `
              <tr>
                <td class="text-center">${startIndex + idx + 1}</td>
                <td class="text-left">${item.products.name} (${item.products.code})</td>
                <td class="text-center">${item.products.hsn || '-'}</td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-center">PCS</td>
                <td class="text-right">₹${item.unit_price.toFixed(2)}</td>
                <td class="text-right">${item.discount_percent.toFixed(1)}%</td>
                <td class="text-right">${item.gst_percent.toFixed(1)}%</td>
                <td class="text-right">₹${item.total_price.toFixed(2)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    // Generate page content
    const getPageContent = (pageNum, pageItems, startIndex, copyType) => {
      // Calculate page-wise totals
      const pageTaxableValue = pageItems.reduce((sum, item) => {
        const taxable = item.total_price / (1 + item.gst_percent / 100);
        return sum + taxable;
      }, 0);
      
      const pageGST = pageItems.reduce((sum, item) => {
        const taxable = item.total_price / (1 + item.gst_percent / 100);
        return sum + (taxable * item.gst_percent / 100);
      }, 0);

      // Check if this is last page and items > 5
      const isLastPage = pageNum === totalPages;
      const hasMultiplePages = totalPages > 1;

      return `
        ${getInvoiceHeader(pageNum, copyType)}
        
        <!-- Items Table -->
        ${getItemsTable(pageItems, startIndex)}
        
        ${isLastPage && hasMultiplePages ? `
        <!-- LAST PAGE: Full HSN Summary & Full Amount Summary -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0;">
          <!-- HSN Summary - Left 50% -->
          <div style="border: 2px solid #000; padding: 10px; font-size: 10px;">
            <div style="font-weight: bold; margin-bottom: 8px;">HSN Summary</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; font-weight: bold; border-bottom: 1px solid #999; padding-bottom: 5px; margin-bottom: 5px;">
              <div>HSN</div>
              <div style="text-align: right;">Taxable</div>
              <div style="text-align: center;">IGST</div>
              <div style="text-align: right;">IGST Amt.</div>
            </div>
            ${(() => {
              const hsnMap = new Map();
              order.sales.forEach(item => {
                const hsn = item.products.hsn || 'N/A';
                if (!hsnMap.has(hsn)) {
                  hsnMap.set(hsn, {
                    taxableValue: 0,
                    gstPercent: item.gst_percent,
                    gstAmount: 0
                  });
                }
                const data = hsnMap.get(hsn);
                const taxable = item.total_price / (1 + item.gst_percent / 100);
                data.taxableValue += taxable;
                data.gstAmount += (taxable * item.gst_percent / 100);
              });
              
              return Array.from(hsnMap.entries()).map(([hsn, data]) => `
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; padding: 3px 0;">
                  <div>${hsn}</div>
                  <div style="text-align: right;">${data.taxableValue.toFixed(2)}</div>
                  <div style="text-align: center;">${data.gstPercent.toFixed(0)}%</div>
                  <div style="text-align: right;">${data.gstAmount.toFixed(2)}</div>
                </div>
              `).join('');
            })()}
          </div>

          <!-- Amount Summary - Right 50% (GRAND TOTAL) -->
          <div style="border: 2px solid #000; padding: 10px; font-size: 10px;">
            <div style="font-weight: bold; margin-bottom: 8px;">Amount Summary</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div style="font-weight: normal;">Taxable Value:</div>
              <div style="text-align: right;">₹${totalTaxableValue.toFixed(2)}</div>
              
              <div style="font-weight: normal;">Total GST:</div>
              <div style="text-align: right;">₹${totalGST.toFixed(2)}</div>
              
              <div style="font-weight: normal;">Discount:</div>
              <div style="text-align: right;">₹${(order.discount_amount || 0).toFixed(2)}</div>
              
              <div style="font-weight: normal;">Freight:</div>
              <div style="text-align: right;">₹${(order.freight_charges || 0).toFixed(2)}</div>
              
              <div style="font-weight: normal;">Round Off:</div>
              <div style="text-align: right;">₹${(order.round_off || 0).toFixed(2)}</div>
              
              <div style="font-weight: bold; border-top: 1px solid #999; padding-top: 5px; margin-top: 5px;">Grand Total:</div>
              <div style="text-align: right; font-weight: bold; border-top: 1px solid #999; padding-top: 5px; margin-top: 5px;">₹${order.total_amount.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <!-- Bank Details - Full Width Single Line -->
        <div style="border: 2px solid #000; padding: 8px 10px; margin: 10px 0; font-size: 10px;">
          <strong>HDFC BANK</strong> &nbsp;&nbsp;&nbsp;
          <strong>A/c No.:</strong> 59200017041975 &nbsp;&nbsp;&nbsp;
          <strong>IFSC:</strong> HDFC0000138
        </div>

        <!-- Amount in Words - Full Width Single Line -->
        <div style="margin: 10px 0; padding: 8px 10px; font-size: 10px;">
          <strong>Amount (in words):</strong> Rs. ${numberToWords(Math.floor(order.total_amount))} ONLY.
        </div>
        ` : hasMultiplePages && !isLastPage ? `
        <!-- INTERMEDIATE PAGES: Page-wise Amount Summary Only -->
        <div style="border: 2px solid #000; padding: 10px; font-size: 10px; margin: 15px 0;">
          <div style="font-weight: bold; margin-bottom: 8px;">Page Total</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <div style="font-weight: normal;">Taxable Value:</div>
            <div style="text-align: right;">₹${pageTaxableValue.toFixed(2)}</div>
            
            <div style="font-weight: normal;">Total GST:</div>
            <div style="text-align: right;">₹${pageGST.toFixed(2)}</div>
          </div>
          
          <!-- Page Subtotal - Full Width -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-weight: bold; border-top: 1px solid #999; padding-top: 8px;">
            <div>Page Subtotal:</div>
            <div style="text-align: right;">₹${(pageTaxableValue + pageGST).toFixed(2)}</div>
          </div>
        </div>
        ` : ''}
        
        <!-- Page Number -->
        <div style="text-align: right; margin-top: 15px; font-size: 9px; color: #666;">
          Page ${pageNum} of ${totalPages}
        </div>
        
        ${copyType === 'Original Copy' && isLastPage && order.dealers?.name?.trim().endsWith('*') ? `
        <!-- NET LEDGER BALANCE - ORIGINAL COPY ONLY - BOLD RED -->
        <div style="margin: 15px 0; padding: 12px 10px; border: 2px solid #cc0000; background: #ffeeee; font-size: 11px; font-weight: bold; color: #cc0000; text-align: center;">
          Net Ledger Balance: ₹${(dealerBalance?.net_ledger_balance || 0).toFixed(2)}
        </div>
        ` : ''}
        
        ${isLastPage ? `
        <!-- Footer (Only on last page) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px; font-size: 9px;">
          <!-- Terms & Conditions - Left -->
          <div style="border: 1px solid #999; padding: 8px;">
            <h4 style="font-size: 10px; margin-bottom: 5px; font-weight: bold; border-bottom: 1px solid #ddd; padding-bottom: 3px;">Terms & Conditions</h4>
            <p style="line-height: 1.3; margin: 3px 0; font-size: 8px;">1. All disputes subject to JALANDHAR jurisdiction only.</p>
            <p style="line-height: 1.3; margin: 3px 0; font-size: 8px;">2. Interest @ 24% p.a. will be charged if the bill is not paid within 7 days.</p>
            <p style="line-height: 1.3; margin: 3px 0; font-size: 8px;">3. Our responsibility ceases as soon as goods are delivered to the carriers.</p>
            <p style="margin-top: 8px; font-size: 8px;">E. & O.E.</p>
          </div>
          
          <!-- Customer Signature - Right -->
          <div style="display: flex; flex-direction: column; justify-content: flex-end; padding: 8px;">
            <div style="text-align: right; margin-bottom: 40px;">
              <strong>For ${companyInfo?.name || 'SPARTAN SPORTS CORPORATION'}</strong>
            </div>
            <div style="text-align: right;">
              <div style="border-top: 1px solid #000; padding-top: 3px; margin-bottom: 30px;">Authorized Signatory</div>
              <div style="border-top: 1px solid #000; padding-top: 3px;">Customer's Signature</div>
            </div>
          </div>
        </div>
        ` : ''}
      `;
    };

    const billHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>BILL_${order.dealers.name.replace(/\s+/g, '_')}_${order.bill_no}_ORD${order.order_number}_${format(new Date(order.order_date), 'ddMMyyyy')}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-weight: bold;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.4;
            color: #333;
            background: white;
            font-weight: bold;
          }
          
          .invoice-container {
            width: 100%;
            margin: 0 auto;
            padding: 20px;
            background: white;
            border: 3px solid #000;
            page-break-after: always;
            min-height: 1000px;
            font-weight: bold;
          }
          
          .invoice-container:last-child {
            page-break-after: avoid;
          }
          
          /* Header Section */
          .header {
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 20px;
            margin-bottom: 15px;
            border-bottom: 3px solid #000;
            padding-bottom: 15px;
          }
          
          .company-info h1 {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          
          .company-info p {
            font-size: 11px;
            line-height: 1.3;
            font-weight: bold;
          }
          
          .qr-code {
            text-align: right;
            font-size: 10px;
            color: #999;
          }
          
          .qr-code div {
            width: 100px;
            height: 100px;
            border: 1px solid #ddd;
            display: inline-block;
            background: #f5f5f5;
            font-size: 9px;
            padding: 5px;
            text-align: center;
          }
          
          .qr-code img {
            width: 100px;
            height: 100px;
            object-fit: contain;
          }
          
          /* Title */
          .tax-invoice-title {
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            margin: 15px 0;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
          }
          
          /* Bill Info Row */
          .bill-info-row {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 15px;
            margin-bottom: 15px;
            font-size: 11px;
            font-weight: bold;
          }
          
          .bill-info-item {
            border: 1px solid #999;
            padding: 8px;
            font-weight: bold;
          }
          
          .bill-info-item strong {
            display: block;
            margin-bottom: 3px;
            font-size: 10px;
            font-weight: bold;
          }
          
          /* Address Section */
          .addresses {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 15px;
            font-size: 11px;
            font-weight: bold;
          }
          
          .address-box {
            border: 1px solid #999;
            padding: 10px;
            font-weight: bold;
          }
          
          .address-box h3 {
            font-size: 11px;
            margin-bottom: 5px;
            text-decoration: underline;
            font-weight: bold;
          }
          
          .address-box p {
            font-size: 10px;
            line-height: 1.4;
            margin: 3px 0;
            font-weight: bold;
          }
          
          /* Items Table */
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 10px;
            font-weight: bold;
          }
          
          .items-table thead {
            background: #f0f0f0;
            border: 1px solid #999;
            font-weight: bold;
          }
          
          .items-table th {
            border: 1px solid #999;
            padding: 8px;
            font-weight: bold;
            text-align: center;
          }
          
          .items-table td {
            border: 1px solid #999;
            padding: 6px 4px;
            font-weight: bold;
          }
          
          .items-table tbody tr:nth-child(odd) {
            background: #fafafa;
          }
          
          .text-left { text-align: left; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          
          /* Footer Section */
          .footer-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 15px;
            font-size: 9px;
            font-weight: bold;
          }
          
          .terms-box, .signature-box {
            border: 1px solid #999;
            padding: 8px;
            font-weight: bold;
          }
          
          .terms-box h4, .signature-box h4 {
            font-size: 10px;
            margin-bottom: 5px;
            font-weight: bold;
            border-bottom: 1px solid #ddd;
            padding-bottom: 3px;
          }
          
          .terms-box p, .signature-box p {
            line-height: 1.3;
            margin: 3px 0;
            font-weight: bold;
          }
          
          .signature-box {
            text-align: right;
          }
          
          .signature-line {
            margin-top: 30px;
            border-top: 1px solid #000;
            padding-top: 3px;
            font-size: 8px;
          }
          
          @media print {
            body { margin: 0; padding: 0; background: white; font-weight: bold; }
            .invoice-container { padding: 15px; border: 2px solid #000; width: 100%; font-weight: bold; }
            * { font-weight: bold; }
          }
        </style>
      </head>
      <body>
        ${['Original Copy', 'Duplicate Copy', 'Transport Copy'].map((copyType, copyIdx) => `
          ${copyIdx > 0 ? '<div style="page-break-before: always;"></div>' : ''}
          ${pages.map((pageItems, pageIdx) => `
            <div class="invoice-container">
              ${getPageContent(pageIdx + 1, pageItems, pageIdx * ITEMS_PER_PAGE, copyType)}
            </div>
          `).join('')}
        `).join('')}
      </body>
      </html>
    `;

    printWindow.document.write(billHTML);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Bill Preview - Order #{order?.order_number}
          </DialogTitle>
          <DialogDescription>
            Preview and print bill for order {order?.order_number}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin h-8 w-8" />
          </div>
        ) : order ? (
          <div className="space-y-4">
            {/* Bill Header */}
            <div className="border-b-2 pb-4 flex justify-between items-start gap-4">
              <div>
                <h2 className="text-2xl font-bold">BILL/INVOICE</h2>
                <p className="text-gray-600">
                  Bill No: {order.bill_no || 'N/A'} | Date: {format(new Date(order.order_date), 'MMM dd, yyyy')}
                </p>
              </div>
              {companyInfo?.logo_url && (
                <div className="flex items-center justify-end">
                  <img 
                    src={companyInfo.logo_url} 
                    alt="Company Logo" 
                    className="h-20 w-20 object-contain"
                  />
                </div>
              )}
            </div>

            {/* Bill To & Ship To Section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border p-4 rounded">
                <h3 className="font-bold text-sm mb-2">BILL TO</h3>
                <p className="font-semibold">{order.dealers.name}</p>
                <p className="text-sm">{order.dealers.address}</p>
                <p className="text-sm">{order.dealers.city}, {order.dealers.state}, {order.dealers.country}</p>
                <p className="text-sm">Email: {order.dealers.email}</p>
                <p className="text-sm">Phone: {order.dealers.phone}</p>
                <p className="text-sm border-t pt-2 mt-2 font-semibold">
                  GST No: {order.dealers.gst_number || 'N/A'}
                </p>
                <p className="text-sm mt-2">
                  Sales Person: {order.profiles?.first_name || order.sales_person_name || 'Not assigned'}
                </p>
              </div>

              <div className="border p-4 rounded">
                <div className="mb-4 pb-4 border-b">
                  <h3 className="font-bold text-sm mb-2">SHIP TO</h3>
                  <p className="font-semibold text-sm">{order.dealers.name}</p>
                  <p className="text-sm">{order.dealers.address}</p>
                  <p className="text-sm">{order.dealers.city}, {order.dealers.state}, {order.dealers.country}</p>
                  <p className="text-sm">Phone: {order.dealers.phone}</p>
                </div>
                <div>
                  <h3 className="font-bold text-sm mb-2">DELIVERY & TRANSPORT DETAILS</h3>
                  <p className="text-sm"><strong>Delivery Location:</strong> {order.delivery_location || 'N/A'}</p>
                  <p className="text-sm"><strong>Transport Name:</strong> {order.transport_name || 'N/A'}</p>
                  <p className="text-sm"><strong>Booking Destination:</strong> {order.booking_destination || 'N/A'}</p>
                  <p className="text-sm"><strong>Date of Dispatch:</strong> {order.date_of_dispatch ? format(new Date(order.date_of_dispatch), 'MMM dd, yyyy') : 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto border-4 border-black p-4 rounded">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-2 text-left">Code</th>
                    <th className="border p-2 text-left">Item Name</th>
                    <th className="border p-2 text-center">Qty</th>
                    <th className="border p-2 text-right">Rate</th>
                    <th className="border p-2 text-right">Disc %</th>
                    <th className="border p-2 text-right">Taxable</th>
                    <th className="border p-2 text-right">GST %</th>
                    <th className="border p-2 text-right">GST</th>
                    <th className="border p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.sales.map((item) => {
                    const taxable = item.total_price / (1 + item.gst_percent / 100);
                    const gstAmount = taxable * item.gst_percent / 100;
                    return (
                      <tr key={item.id} className="border-b">
                        <td className="border p-2">{item.products.code}</td>
                        <td className="border p-2">{item.products.name}</td>
                        <td className="border p-2 text-center">{item.quantity}</td>
                        <td className="border p-2 text-right">₹{item.unit_price.toFixed(2)}</td>
                        <td className="border p-2 text-right">{item.discount_percent.toFixed(2)}%</td>
                        <td className="border p-2 text-right">₹{taxable.toFixed(2)}</td>
                        <td className="border p-2 text-right">{item.gst_percent.toFixed(2)}%</td>
                        <td className="border p-2 text-right">₹{gstAmount.toFixed(2)}</td>
                        <td className="border p-2 text-right">₹{item.total_price.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* HSN Summary & Totals - Side by Side */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* HSN Summary - Left 50% */}
              <div className="border-2 border-black p-3">
                <div className="text-xs font-bold">HSN Summary</div>
                <div className="grid grid-cols-4 gap-2 font-bold border-b pb-2 mt-2 text-xs">
                  <div>HSN</div>
                  <div className="text-right">Taxable</div>
                  <div className="text-center">IGST</div>
                  <div className="text-right">IGST Amt.</div>
                </div>
                <div className="text-xs">
                  {(() => {
                    const hsnMap = new Map();
                    order.sales.forEach(item => {
                      const hsn = item.products.hsn || 'N/A';
                      if (!hsnMap.has(hsn)) {
                        hsnMap.set(hsn, {
                          taxableValue: 0,
                          gstPercent: item.gst_percent,
                          gstAmount: 0
                        });
                      }
                      const data = hsnMap.get(hsn);
                      const taxable = item.total_price / (1 + item.gst_percent / 100);
                      data.taxableValue += taxable;
                      data.gstAmount += (taxable * item.gst_percent / 100);
                    });
                    
                    return Array.from(hsnMap.entries()).map(([hsn, data]) => (
                      <div key={hsn} className="grid grid-cols-4 gap-2 py-1">
                        <div>{hsn}</div>
                        <div className="text-right">{data.taxableValue.toFixed(2)}</div>
                        <div className="text-center">{data.gstPercent.toFixed(0)}%</div>
                        <div className="text-right">{data.gstAmount.toFixed(2)}</div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Totals Summary - Right 50% */}
              <div className="border-2 border-black p-3">
                <div className="text-xs font-bold">Amount Summary</div>
                <div className="text-xs space-y-1 mt-2">
                  <div className="flex justify-between">
                    <span>Taxable Value:</span>
                    <span>₹{(order.sales.reduce((sum, item) => sum + item.total_price / (1 + item.gst_percent / 100), 0)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total GST:</span>
                    <span>₹{(order.sales.reduce((sum, item) => {
                      const taxable = item.total_price / (1 + item.gst_percent / 100);
                      return sum + (taxable * item.gst_percent / 100);
                    }, 0)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Discount:</span>
                    <span>₹{(order.discount_amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Freight:</span>
                    <span>₹{(order.freight_charges || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Round Off:</span>
                    <span>₹{(order.round_off || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>Grand Total:</span>
                    <span>₹{order.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bank Details - Full Width Single Line */}
            <div className="border-2 border-black p-3 mb-3 text-xs">
              <strong>HDFC BANK</strong> &nbsp;&nbsp;&nbsp;
              <strong>A/c No.:</strong> 59200017041975 &nbsp;&nbsp;&nbsp;
              <strong>IFSC:</strong> HDFC0000138
            </div>

            {/* Amount in Words - Full Width Single Line */}
            <div className="mb-6 text-xs">
              <strong>Amount (in words):</strong> Rs. {numberToWords(Math.floor(order.total_amount))} ONLY.
            </div>

            <div className="bg-gray-100 p-3 rounded text-sm">
              <p><strong>Notes:</strong> All items are inclusive of GST unless otherwise specified.</p>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handlePrint} disabled={loading || !order}>
            <Printer className="h-4 w-4 mr-2" />
            Print Bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PrintBillDialog;
