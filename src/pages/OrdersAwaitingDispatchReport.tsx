import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AwaitingDispatchOrder {
  order_id: string;
  order_number: number;
  dealer_name: string;
  dealer_id: string;
  order_date: string;
  total_amount: number;
  sales_person_name: string;
  sales_person_id: string;
  days_pending: number;
  hod_status: string | null;
}

const OrdersAwaitingDispatchReport: React.FC = () => {
  const [fromDate, setFromDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });

  const [toDate, setToDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [orders, setOrders] = useState<AwaitingDispatchOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [sortColumn, setSortColumn] = useState<keyof AwaitingDispatchOrder>('order_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [hodStatusFilter, setHodStatusFilter] = useState<'approved' | 'disapproved' | 'all' | 'approved-pending'>('approved');
  const [salesPersons, setSalesPersons] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSalesPerson, setSelectedSalesPerson] = useState<string>('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  const selectedOrders = orders
    .filter((order) => selectedOrderIds.includes(order.order_id))
    .sort((a, b) => new Date(a.order_date).getTime() - new Date(b.order_date).getTime());

  const allSelected = orders.length > 0 && selectedOrderIds.length === orders.length;

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    setSelectedOrderIds((prev) => (checked ? [...prev, orderId] : prev.filter((id) => id !== orderId)));
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedOrderIds(checked ? orders.map((order) => order.order_id) : []);
  };

  const handlePrintSelectedJpg = () => {
    if (selectedOrderIds.length === 0) {
      alert('Please select one or more orders before printing JPG.');
      return;
    }

    const selected = selectedOrders;
    const width = 1200;
    const rowHeight = 56;
    const headerHeight = 140;
    const footerHeight = 80;
    const contentHeight = selected.length * rowHeight;
    const height = Math.max(headerHeight + contentHeight + footerHeight, 420);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      alert('Could not create canvas for JPG generation.');
      return;
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, width, 100);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Orders Awaiting Dispatch', width / 2, 40);
    ctx.font = 'bold 20px Arial';
    ctx.fillText('Selected Orders Report', width / 2, 72);

    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000000';
    ctx.fillText(`Generated: ${new Date().toLocaleString()}`, 40, 120);
    ctx.fillText(`Selected orders: ${selected.length}`, 40, 142);

    const tableTop = 170;
    const colX = [40, 100, 270, 510, 680, 900];
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, tableTop - 18);
    ctx.lineTo(width - 40, tableTop - 18);
    ctx.stroke();

    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('S.No', colX[0], tableTop);
    ctx.fillText('Order No.', colX[1], tableTop);
    ctx.fillText('Order Date', colX[2], tableTop);
    ctx.fillText('Days', colX[3], tableTop);
    ctx.fillText('Amount', colX[5] - 10, tableTop);
    ctx.textAlign = 'right';
    ctx.fillText('', width - 40, tableTop);

    ctx.beginPath();
    ctx.moveTo(40, tableTop + 8);
    ctx.lineTo(width - 40, tableTop + 8);
    ctx.stroke();

    let y = tableTop + 40;
    ctx.font = '16px Arial';
    selected.forEach((order, index) => {
      if (y > height - footerHeight - 20) {
        return;
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = '#000000';
      ctx.fillText(`${index + 1}`, colX[0], y);
      ctx.fillText(`#${order.order_number}`, colX[1], y);
      ctx.fillText(formatDate(order.order_date), colX[2], y);
      ctx.fillText(`${order.days_pending}d`, colX[3], y);
      ctx.textAlign = 'right';
      ctx.fillText(formatCurrency(order.total_amount), width - 40, y);
      y += rowHeight;
    });

    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Total: ${formatCurrency(selected.reduce((sum, order) => sum + order.total_amount, 0))}`, width - 40, height - 28);

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.download = `selected_orders_awaiting_dispatch_${Date.now()}.jpg`;
    link.click();
  };

  // Fetch orders awaiting dispatch based on filters
  const fetchAwaitingDispatchOrders = async (from?: string, to?: string) => {
    setLoading(true);
    try {
      const from_date = from || fromDate;
      const to_date = to || toDate;

      if (!from_date || !to_date) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Step 1: Fetch all online order IDs to exclude them
      const { data: onlineOrderDetailsData } = await supabase
        .from('online_order_details')
        .select('order_id');

      const { data: onlineOrdersData } = await supabase
        .from('online_orders')
        .select('order_id');

      // Create set of online order IDs to exclude
      const onlineOrderIds = new Set<string>();
      (onlineOrderDetailsData || []).forEach(item => {
        if (item.order_id) onlineOrderIds.add(item.order_id);
      });
      (onlineOrdersData || []).forEach(item => {
        if (item.order_id) onlineOrderIds.add(item.order_id);
      });

      console.log('Online order IDs to exclude:', Array.from(onlineOrderIds));

      // Step 2: Fetch orders that are awaiting dispatch
      let query = supabase
        .from('orders')
        .select(
          `
          id,
          order_number,
          order_date,
          total_amount,
          user_id,
          dealer_id,
          hod_status,
          dealers!left(name),
          profiles_user_id:user_id!left(first_name,last_name),
          payments!left(id,payment_method)
        `
        )
        .is('dispatch_number', null) // dispatch_number is null
        .is('dispatch_date', null);   // dispatch_date is null

      // Add HOD status filter - exclude null/pending when filtering for specific status
      if (hodStatusFilter === 'approved') {
        query = query.eq('hod_status', 'approved');
      } else if (hodStatusFilter === 'disapproved') {
        query = query.eq('hod_status', 'disapproved');
      } else if (hodStatusFilter === 'approved-pending') {
        // Include approved and null/pending, but exclude disapproved
        // We'll filter this on the client side after fetching
      }
      // If 'all', don't filter - this includes approved, disapproved, and null/pending

      // Add date range filter
      query = query
        .gte('order_date', `${from_date}T00:00:00.000Z`)
        .lte('order_date', `${to_date}T23:59:59.999Z`);

      if (selectedSalesPerson) {
        query = query.eq('user_id', selectedSalesPerson);
      }

      query = query.order('order_date', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      console.log('Fetched orders with HOD approval:', data?.length || 0, 'orders');

      const userIds = Array.from(new Set((data || [])
        .map((order: any) => order.user_id)
        .filter((id: string | null | undefined): id is string => Boolean(id))
      ));

      const profilesById: Record<string, { first_name?: string; last_name?: string }> = {};
      if (userIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
        .select('id, first_name, last_name, user_type')
        if (profileError) {
          console.error('Supabase profile fetch error:', profileError);
        } else if (profileData) {
          profileData.forEach((profile: any) => {
            profilesById[profile.id] = profile;
          });
        }
      }

      // Step 3: Filter out online orders AND cash orders AND apply HOD status filter for 'approved-pending'
      const filteredData = (data || []).filter(order => {
        // Exclude orders with dealer_name = "Cash", "Online Order" or demo data
        const dealerName = order.dealers?.name || '';
        const normalizedDealerName = dealerName.trim().toLowerCase();
        if (
          normalizedDealerName === 'cash' ||
          normalizedDealerName === 'online order' ||
          normalizedDealerName === 'demo' ||
          normalizedDealerName === 'demo dealer'
        ) {
          console.log(`Excluding order #${order.order_number} - dealer: ${dealerName}`);
          return false;
        }

        // Exclude online orders by ID
        if (onlineOrderIds.has(order.id)) {
          console.log(`Excluding online order #${order.order_number}`);
          return false;
        }
        
        // Exclude cash orders (has payment with payment_method = 'cash')
        if (order.payments && order.payments.length > 0) {
          const hasCashPayment = order.payments.some((p: any) => 
            p.payment_method && p.payment_method.toLowerCase() === 'cash'
          );
          if (hasCashPayment) {
            console.log(`Excluding cash payment order #${order.order_number}`);
            return false;
          }
        }

        // Exclude Pawan or admin sales person orders
        const profile = order.user_id ? profilesById[order.user_id] : undefined;
        const salesPersonName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim().toLowerCase();
        if (profile?.user_type === 'admin') {
          console.log(`Excluding admin sales person order #${order.order_number}`);
          return false;
        }
        if (salesPersonName.includes('pawan')) {
          console.log(`Excluding Pawan sales person order #${order.order_number}`);
          return false;
        }
        if (salesPersonName.includes('admin')) {
          console.log(`Excluding Admin sales person order #${order.order_number}`);
          return false;
        }

        // Filter for 'approved-pending': only include approved and pending (null), exclude disapproved
        if (hodStatusFilter === 'approved-pending') {
          if (order.hod_status === 'disapproved') {
            console.log(`Excluding disapproved order #${order.order_number}`);
            return false;
          }
        }

        return true;
      });

      // Map and transform data
      const mappedOrders: AwaitingDispatchOrder[] = (filteredData || []).map((order: any) => {
        const orderDate = new Date(order.order_date);
        const today = new Date();
        const timeDiff = today.getTime() - orderDate.getTime();
        const daysPending = Math.floor(timeDiff / (1000 * 3600 * 24));
        const profile = order.user_id ? profilesById[order.user_id] : undefined;

        const profileName = `${order.profiles?.first_name || profile?.first_name || ''} ${order.profiles?.last_name || profile?.last_name || ''}`.trim();
        return {
          order_id: order.id,
          order_number: order.order_number,
          dealer_name: order.dealers?.name || order.dealer_id || 'Unknown',
          dealer_id: order.dealer_id,
          order_date: order.order_date,
          total_amount: Number(order.total_amount) || 0,
          sales_person_name: profileName || 'Unknown',
          sales_person_id: order.user_id,
          days_pending: daysPending,
          hod_status: order.hod_status || null,
        };
      });

      setOrders(mappedOrders);
      setSelectedOrderIds([]);

      // Calculate totals
      const total = mappedOrders.reduce((sum, order) => sum + order.total_amount, 0);
      setTotalAmount(total);
      setTotalOrders(mappedOrders.length);
    } catch (error) {
      console.error('Error fetching awaiting dispatch orders:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error loading data: ${errorMsg}`);
      setOrders([]);
      setTotalAmount(0);
      setTotalOrders(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesPersons = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('user_type', 'sales_person')
        .order('first_name', { ascending: true });

      if (error) {
        console.error('Error fetching sales persons:', error);
        return;
      }

      setSalesPersons(
        (data || []).map((profile: any) => ({
          id: profile.id,
          name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.id,
        }))
      );
    } catch (error) {
      console.error('Error fetching sales persons:', error);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchSalesPersons();
    fetchAwaitingDispatchOrders();
  }, []);

  const handleHodStatusFilterChange = (newStatus: 'approved' | 'disapproved' | 'all' | 'approved-pending') => {
    setHodStatusFilter(newStatus);
    // Refetch after a brief delay to allow state to update
    setTimeout(() => {
      fetchAwaitingDispatchOrders();
    }, 0);
  };

  const handleApplyFilter = () => {
    fetchAwaitingDispatchOrders();
  };

  const handleClearFilter = () => {
    const defaultFromDate = new Date();
    defaultFromDate.setDate(defaultFromDate.getDate() - 30);
    const defaultToDate = new Date();

    setFromDate(defaultFromDate.toISOString().split('T')[0]);
    setToDate(defaultToDate.toISOString().split('T')[0]);
    setSelectedSalesPerson('');
    fetchAwaitingDispatchOrders(defaultFromDate.toISOString().split('T')[0], defaultToDate.toISOString().split('T')[0]);
  };

  const handleSort = (column: keyof AwaitingDispatchOrder) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column with ascending direction
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortedOrders = () => {
    const sorted = [...orders].sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];

      // Handle different types
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
        return sortDirection === 'asc' 
          ? (aVal as string).localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal as string);
      } else if (typeof aVal === 'number') {
        return sortDirection === 'asc' 
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      }
      return 0;
    });
    return sorted;
  };

  const getSortIndicator = (column: keyof AwaitingDispatchOrder) => {
    if (sortColumn !== column) return ' ⇅';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=600,width=1000');
    if (!printWindow) {
      alert('Please allow pop-ups to print');
      return;
    }

    const fromDateObj = new Date(fromDate);
    const toDateObj = new Date(toDate);
    const fromDateFormatted = fromDateObj.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const toDateFormatted = toDateObj.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    let htmlContent = `
      <html>
        <head>
          <title>Orders Awaiting Dispatch Report</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              color: #333;
            }
            h1 {
              text-align: center;
              color: #1f2937;
              margin-bottom: 10px;
            }
            .filters {
              text-align: center;
              margin-bottom: 20px;
              font-size: 14px;
              color: #666;
            }
            .summary {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin-bottom: 30px;
            }
            .summary-card {
              background-color: #f0f9ff;
              padding: 15px;
              border-left: 4px solid #3b82f6;
              border-radius: 4px;
            }
            .summary-label {
              font-size: 12px;
              color: #666;
              text-transform: uppercase;
              font-weight: 600;
              margin-bottom: 8px;
            }
            .summary-value {
              font-size: 24px;
              font-weight: bold;
              color: #3b82f6;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            th {
              background-color: #f0f0f0;
              padding: 12px;
              text-align: left;
              border: 1px solid #ddd;
              font-weight: 600;
              font-size: 13px;
            }
            td {
              padding: 12px;
              border: 1px solid #ddd;
              font-size: 13px;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .total-row {
              background-color: #e8e8e8;
              font-weight: bold;
              border-top: 2px solid #333;
            }
            .numeric {
              text-align: right;
            }
            .center {
              text-align: center;
            }
            .status-pending {
              color: #dc2626;
              font-weight: 600;
            }
            .hod-approved {
              background-color: #dcfce7;
              color: #166534;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 600;
              display: inline-block;
            }
            .hod-disapproved {
              background-color: #fee2e2;
              color: #991b1b;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 600;
              display: inline-block;
            }
            .hod-pending {
              background-color: #f3f4f6;
              color: #6b7280;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 600;
              display: inline-block;
            }
            .print-note {
              text-align: center;
              font-size: 12px;
              color: #999;
              margin-top: 30px;
              border-top: 1px solid #ddd;
              padding-top: 15px;
            }
            .no-data {
              text-align: center;
              padding: 40px;
              color: #999;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <h1>Orders Awaiting Dispatch Report</h1>
          <div class="filters">
            <p><strong>Period:</strong> ${fromDateFormatted} to ${toDateFormatted} | <strong>Sales Person:</strong> ${selectedSalesPerson ? (salesPersons.find(sp => sp.id === selectedSalesPerson)?.name || selectedSalesPerson) : 'All'} | <strong>HOD Status:</strong> ${hodStatusFilter === 'all' ? 'All (Approved & Disapproved & Pending)' : hodStatusFilter === 'approved' ? 'Approved Only' : hodStatusFilter === 'disapproved' ? 'Disapproved Only' : 'Approved & Pending'}</p>
          </div>
    `;

    // Summary Cards
    if (orders.length > 0) {
      htmlContent += `
        <div class="summary">
          <div class="summary-card">
            <div class="summary-label">Total Orders</div>
            <div class="summary-value">${totalOrders}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Amount</div>
            <div class="summary-value">${formatCurrency(totalAmount)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Average Amount</div>
            <div class="summary-value">${formatCurrency(totalOrders > 0 ? totalAmount / totalOrders : 0)}</div>
          </div>
        </div>
      `;

      // Orders Table
      htmlContent += `
        <table>
          <thead>
            <tr>
              <th>Order #</th>
              <th>Sales Person</th>
              <th>Dealer</th>
              <th>Order Date</th>
              <th class="center">Days Pending</th>
              <th class="center">HOD Status</th>
              <th class="numeric">Amount</th>
            </tr>
          </thead>
          <tbody>
      `;

      getSortedOrders().forEach((order) => {
        const statusClass = order.days_pending > 7 ? 'status-pending' : '';
        let hodStatusDisplay = '⏳ Pending';
        let hodStatusClass = 'hod-pending';
        if (order.hod_status === 'approved') {
          hodStatusDisplay = '✓ Approved';
          hodStatusClass = 'hod-approved';
        } else if (order.hod_status === 'disapproved') {
          hodStatusDisplay = '✗ Disapproved';
          hodStatusClass = 'hod-disapproved';
        }
        htmlContent += `
          <tr>
            <td>#${order.order_number}</td>
            <td>${order.sales_person_name}</td>
            <td>${order.dealer_name}</td>
            <td>${formatDate(order.order_date)}</td>
            <td class="center ${statusClass}">${order.days_pending} days</td>
            <td class="center"><span class="${hodStatusClass}">${hodStatusDisplay}</span></td>
            <td class="numeric">${formatCurrency(order.total_amount)}</td>
          </tr>
        `;
      });

      // Total Row
      htmlContent += `
        <tr class="total-row">
          <td colspan="6" style="text-align: right;">TOTAL</td>
          <td class="numeric">${formatCurrency(totalAmount)}</td>
        </tr>
      `;

      htmlContent += `</tbody></table>`;
    } else {
      htmlContent += `<div class="no-data">No orders awaiting dispatch for the selected period.</div>`;
    }

    // Print note
    htmlContent += `
      <div class="print-note">
        <strong>Note:</strong> This is a filtered report of orders awaiting dispatch.
        <br>Generated on: ${new Date().toLocaleDateString('en-IN', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
    `;

    htmlContent += `
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div style={{ padding: '24px', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px', color: '#1a1a1a' }}>
            Orders Awaiting Dispatch
          </h1>
          <p style={{ fontSize: '14px', color: '#666' }}>
            View all orders pending dispatch. Filter by date range and HOD approval status.
            {hodStatusFilter !== 'approved' && (
              <span style={{ fontSize: '12px', marginLeft: '16px', color: '#3b82f6', fontWeight: '500' }}>
                • Currently showing: {hodStatusFilter === 'all' ? 'All statuses' : `${hodStatusFilter.charAt(0).toUpperCase() + hodStatusFilter.slice(1)} orders`}
              </span>
            )}
          </p>
        </div>

        {/* Filters */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '32px',
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          {/* From Date Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#333' }}>
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* To Date Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#333' }}>
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Sales Person Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#333' }}>
              Sales Person
            </label>
            <select
              value={selectedSalesPerson}
              onChange={(e) => setSelectedSalesPerson(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
                backgroundColor: 'white',
              }}
            >
              <option value="">All Sales Persons</option>
              {salesPersons.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>

          {/* HOD Status Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#333' }}>
              HOD Approval Status
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleHodStatusFilterChange('approved')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: hodStatusFilter === 'approved' ? '2px solid #3b82f6' : '1px solid #ddd',
                  backgroundColor: hodStatusFilter === 'approved' ? '#dbeafe' : '#ffffff',
                  color: hodStatusFilter === 'approved' ? '#1e40af' : '#666',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: hodStatusFilter === 'approved' ? '600' : '500',
                  transition: 'all 0.2s',
                }}
              >
                ✓ Approved
              </button>
              <button
                onClick={() => handleHodStatusFilterChange('disapproved')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: hodStatusFilter === 'disapproved' ? '2px solid #ef4444' : '1px solid #ddd',
                  backgroundColor: hodStatusFilter === 'disapproved' ? '#fee2e2' : '#ffffff',
                  color: hodStatusFilter === 'disapproved' ? '#b91c1c' : '#666',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: hodStatusFilter === 'disapproved' ? '600' : '500',
                  transition: 'all 0.2s',
                }}
              >
                ✗ Disapproved
              </button>
              <button
                onClick={() => handleHodStatusFilterChange('approved-pending')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: hodStatusFilter === 'approved-pending' ? '2px solid #10b981' : '1px solid #ddd',
                  backgroundColor: hodStatusFilter === 'approved-pending' ? '#d1fae5' : '#ffffff',
                  color: hodStatusFilter === 'approved-pending' ? '#065f46' : '#666',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: hodStatusFilter === 'approved-pending' ? '600' : '500',
                  transition: 'all 0.2s',
                }}
              >
                ✓ + ⏳ (Approved & Pending)
              </button>
              <button
                onClick={() => handleHodStatusFilterChange('all')}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: hodStatusFilter === 'all' ? '2px solid #8b5cf6' : '1px solid #ddd',
                  backgroundColor: hodStatusFilter === 'all' ? '#f3e8ff' : '#ffffff',
                  color: hodStatusFilter === 'all' ? '#6d28d9' : '#666',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: hodStatusFilter === 'all' ? '600' : '500',
                  transition: 'all 0.2s',
                }}
              >
                Both
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <Button
              onClick={handleApplyFilter}
              disabled={loading}
              style={{
                flex: 1,
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              {loading ? 'Loading...' : 'Apply Filter'}
            </Button>
            <Button
              onClick={handleClearFilter}
              disabled={loading}
              style={{
                flex: 1,
                backgroundColor: '#6b7280',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              Clear Filter
            </Button>
            <Button
              onClick={handlePrint}
              disabled={orders.length === 0 || loading}
              style={{
                flex: 1,
                backgroundColor: '#10b981',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                cursor: orders.length === 0 || loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              🖨️ Print Report
            </Button>
            <Button
              onClick={handlePrintSelectedJpg}
              disabled={selectedOrderIds.length === 0 || loading}
              style={{
                flex: 1,
                backgroundColor: '#2563eb',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                cursor: selectedOrderIds.length === 0 || loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              🖼️ Print Selected JPG
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        {orders.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '16px',
              marginBottom: '32px',
            }}
          >
            {/* Total Orders Card */}
            <div
              style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                borderLeft: '4px solid #3b82f6',
              }}
            >
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '500' }}>
                Total Orders
              </p>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>
                {totalOrders}
              </p>
              <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                Awaiting dispatch
              </p>
            </div>

            {/* Total Amount Card */}
            <div
              style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                borderLeft: '4px solid #f59e0b',
              }}
            >
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '500' }}>
                Total Amount
              </p>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>
                {formatCurrency(totalAmount)}
              </p>
              <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                Value awaiting dispatch
              </p>
            </div>

            {/* Average Amount Card */}
            <div
              style={{
                backgroundColor: 'white',
                padding: '20px',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                borderLeft: '4px solid #10b981',
              }}
            >
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px', textTransform: 'uppercase', fontWeight: '500' }}>
                Average Amount
              </p>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>
                {formatCurrency(totalOrders > 0 ? totalAmount / totalOrders : 0)}
              </p>
              <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                Per order
              </p>
            </div>
          </div>
        )}

        {/* Orders Table */}
        {orders.length > 0 ? (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              overflowX: 'auto',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#f3f4f6' }}>
                  <th style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      aria-label="Select all orders"
                      style={{ width: '18px', height: '18px' }}
                    />
                  </th>
                  <th 
                    onClick={() => handleSort('order_number')}
                    style={{ 
                      padding: '12px', 
                      textAlign: 'left', 
                      borderBottom: '1px solid #e5e7eb', 
                      fontWeight: '600', 
                      fontSize: '13px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      backgroundColor: sortColumn === 'order_number' ? '#e5e7eb' : '#f3f4f6',
                      transition: 'background-color 0.2s'
                    }}
                    title="Click to sort"
                  >
                    Order #{getSortIndicator('order_number')}
                  </th>
                  <th 
                    onClick={() => handleSort('sales_person_name')}
                    style={{ 
                      padding: '12px', 
                      textAlign: 'left', 
                      borderBottom: '1px solid #e5e7eb', 
                      fontWeight: '600', 
                      fontSize: '13px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      backgroundColor: sortColumn === 'sales_person_name' ? '#e5e7eb' : '#f3f4f6',
                      transition: 'background-color 0.2s'
                    }}
                    title="Click to sort"
                  >
                    Sales Person{getSortIndicator('sales_person_name')}
                  </th>
                  <th 
                    onClick={() => handleSort('dealer_name')}
                    style={{ 
                      padding: '12px', 
                      textAlign: 'left', 
                      borderBottom: '1px solid #e5e7eb', 
                      fontWeight: '600', 
                      fontSize: '13px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      backgroundColor: sortColumn === 'dealer_name' ? '#e5e7eb' : '#f3f4f6',
                      transition: 'background-color 0.2s'
                    }}
                    title="Click to sort"
                  >
                    Dealer{getSortIndicator('dealer_name')}
                  </th>
                  <th 
                    onClick={() => handleSort('order_date')}
                    style={{ 
                      padding: '12px', 
                      textAlign: 'left', 
                      borderBottom: '1px solid #e5e7eb', 
                      fontWeight: '600', 
                      fontSize: '13px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      backgroundColor: sortColumn === 'order_date' ? '#e5e7eb' : '#f3f4f6',
                      transition: 'background-color 0.2s'
                    }}
                    title="Click to sort"
                  >
                    Order Date{getSortIndicator('order_date')}
                  </th>
                  <th 
                    onClick={() => handleSort('days_pending')}
                    style={{ 
                      padding: '12px', 
                      textAlign: 'center', 
                      borderBottom: '1px solid #e5e7eb', 
                      fontWeight: '600', 
                      fontSize: '13px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      backgroundColor: sortColumn === 'days_pending' ? '#e5e7eb' : '#f3f4f6',
                      transition: 'background-color 0.2s'
                    }}
                    title="Click to sort"
                  >
                    Days Pending{getSortIndicator('days_pending')}
                  </th>
                  <th 
                    onClick={() => handleSort('hod_status')}
                    style={{ 
                      padding: '12px', 
                      textAlign: 'center', 
                      borderBottom: '1px solid #e5e7eb', 
                      fontWeight: '600', 
                      fontSize: '13px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      backgroundColor: sortColumn === 'hod_status' ? '#e5e7eb' : '#f3f4f6',
                      transition: 'background-color 0.2s'
                    }}
                    title="Click to sort"
                  >
                    HOD Status{getSortIndicator('hod_status')}
                  </th>
                  <th 
                    onClick={() => handleSort('total_amount')}
                    style={{ 
                      padding: '12px', 
                      textAlign: 'right', 
                      borderBottom: '1px solid #e5e7eb', 
                      fontWeight: '600', 
                      fontSize: '13px',
                      cursor: 'pointer',
                      userSelect: 'none',
                      backgroundColor: sortColumn === 'total_amount' ? '#e5e7eb' : '#f3f4f6',
                      transition: 'background-color 0.2s'
                    }}
                    title="Click to sort"
                  >
                    Amount{getSortIndicator('total_amount')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {getSortedOrders().map((order, idx) => (
                  <tr key={order.order_id} style={{ backgroundColor: selectedOrderIds.includes(order.order_id) ? '#ecfdf5' : idx % 2 === 0 ? '#ffffff' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px', fontSize: '13px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.includes(order.order_id)}
                        onChange={(e) => handleSelectOrder(order.order_id, e.target.checked)}
                        aria-label={`Select order ${order.order_number}`}
                        style={{ width: '18px', height: '18px' }}
                      />
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px' }}>#{order.order_number}</td>
                    <td style={{ padding: '12px', fontSize: '13px' }}>{order.sales_person_name}</td>
                    <td style={{ padding: '12px', fontSize: '13px' }}>{order.dealer_name}</td>
                    <td style={{ padding: '12px', fontSize: '13px' }}>{formatDate(order.order_date)}</td>
                    <td style={{ padding: '12px', fontSize: '13px', textAlign: 'center', fontWeight: order.days_pending > 7 ? '600' : 'normal', color: order.days_pending > 7 ? '#dc2626' : 'inherit' }}>
                      {order.days_pending} days
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', textAlign: 'center' }}>
                      {order.hod_status === 'approved' ? (
                        <span style={{ 
                          display: 'inline-block',
                          backgroundColor: '#dcfce7',
                          color: '#166534',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          ✓ Approved
                        </span>
                      ) : order.hod_status === 'disapproved' ? (
                        <span style={{ 
                          display: 'inline-block',
                          backgroundColor: '#fee2e2',
                          color: '#991b1b',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          ✗ Disapproved
                        </span>
                      ) : (
                        <span style={{ 
                          display: 'inline-block',
                          backgroundColor: '#f3f4f6',
                          color: '#6b7280',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          ⏳ Pending
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', textAlign: 'right', fontWeight: '500' }}>
                      {formatCurrency(order.total_amount)}
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr style={{ backgroundColor: '#e5e7eb', borderTop: '2px solid #333' }}>
                  <td colSpan={6} style={{ padding: '12px', fontSize: '13px', fontWeight: 'bold', textAlign: 'right' }}>
                    TOTAL
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', fontWeight: 'bold', textAlign: 'right' }}>
                    {formatCurrency(totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : !loading ? (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '40px 20px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <p style={{ fontSize: '14px', color: '#999' }}>
              No orders awaiting dispatch found for the selected date range.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default OrdersAwaitingDispatchReport;
