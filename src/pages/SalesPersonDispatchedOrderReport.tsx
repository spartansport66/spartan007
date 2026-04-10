import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DispatchedOrder {
  order_id: string;
  order_number: number;
  dealer_name: string;
  dealer_id: string;
  order_date: string;
  dispatch_date: string;
  gate_pass_dispatch_date: string;
  dispatch_number: number;
  total_amount: number;
  sales_person_name: string;
  sales_person_id: string;
}

interface SalesPersonSummary {
  sales_person_id: string;
  sales_person_name: string;
  monthly_target: number;
  total_sales: number;
  pending_sales: number;
  order_count: number;
  total_orders_count: number;
  total_orders_amount: number;
}

interface FilteredData {
  orders: DispatchedOrder[];
  summary: SalesPersonSummary[];
}

const SalesPersonDispatchedOrderReport: React.FC = () => {
  const [salesPersons, setSalesPersons] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSalesPerson, setSelectedSalesPerson] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [orders, setOrders] = useState<DispatchedOrder[]>([]);
  const [summary, setSummary] = useState<SalesPersonSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalSalesSum, setTotalSalesSum] = useState(0);
  const [totalPendingSalesSum, setTotalPendingSalesSum] = useState(0);

  // Fetch all sales persons on component mount
  useEffect(() => {
    const fetchSalesPersons = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .eq('user_type', 'sales_person')
          .order('first_name', { ascending: true });

        if (error) throw error;

        const formatted = (data || []).map((p: any) => ({
          id: p.id,
          name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.id,
        }));

        setSalesPersons(formatted);

        // DEBUG: Check sales_target table
        const { data: targetTableCheck, error: tableError } = await supabase
          .from('sales_targets')
          .select('*')
          .limit(10);

        console.log('🔍 === DIAGNOSTIC: Sales Targets Table Check ===');
        console.log('🔍 Table exists?', !tableError);
        console.log('🔍 Sample data in table:', targetTableCheck);
        if (tableError) {
          console.log('🔍 Table error:', tableError);
        }
      } catch (error) {
        console.error('Error fetching sales persons:', error);
      }
    };

    fetchSalesPersons();
  }, []);

  // Fetch dispatched orders based on filters
  const fetchDispatchedOrders = async (spId?: string, month?: string) => {
    setLoading(true);
    try {
      const sp = spId || selectedSalesPerson;
      const m = month || selectedMonth;

      if (!m) {
        setOrders([]);
        setSummary([]);
        setLoading(false);
        return;
      }

      // Parse month to get start and end dates
      const [year, monthNum] = m.split('-');
      const startDate = new Date(`${year}-${monthNum}-01T00:00:00Z`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
      endDate.setHours(23, 59, 59, 999);

      const startDateISO = startDate.toISOString();
      const endDateISO = endDate.toISOString();

      // Build filter conditions - use correct null syntax for PostgREST
      let query = supabase
        .from('orders')
        .select(
          `
          id,
          order_number,
          order_date,
          dispatch_date,
          gate_pass_dispatch_time,
          dispatch_number,
          total_amount,
          user_id,
          dealer_id,
          profiles!left(first_name, last_name),
          dealers!left(name)
        `
        )
        .not('dispatch_number', 'is', null) // dispatch_id not null
        .not('dispatch_date', 'is', null);  // dispatch_date not null

      // Add date range filter
      query = query
        .gte('dispatch_date', startDateISO)
        .lte('dispatch_date', endDateISO);

      // Add sales person filter if selected
      if (sp) {
        query = query.eq('user_id', sp);
      }

      query = query.order('user_id', { ascending: true }).order('dispatch_date', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      console.log('Fetched orders:', data?.length || 0, 'orders');
      console.log('Query params:', { sp, m, startDateISO, endDateISO });

      // Map and transform data
      const mappedOrders: DispatchedOrder[] = (data || []).map((order: any) => ({
        order_id: order.id,
        order_number: order.order_number,
        dealer_name: order.dealers?.name || 'Unknown',
        dealer_id: order.dealer_id,
        order_date: order.order_date,
        dispatch_date: order.dispatch_date,
        gate_pass_dispatch_date: order.gate_pass_dispatch_time,
        dispatch_number: order.dispatch_number,
        total_amount: Number(order.total_amount) || 0,
        sales_person_name: `${order.profiles?.first_name || ''} ${order.profiles?.last_name || ''}`.trim() || 'Unknown',
        sales_person_id: order.user_id,
      }));

      setOrders(mappedOrders);

      // Batch fetch all unique sales person profiles
      const uniqueSalesPersonIds = [...new Set(mappedOrders.map(o => o.sales_person_id).filter(Boolean))];
      
      let profilesMap: { [key: string]: any } = {};
      let targetsMap: { [key: string]: number } = {}; // Sales person ID -> target amount
      let totalOrdersMap: { [key: string]: { count: number; amount: number } } = {}; // Sales person ID -> {count, amount}
      
      if (uniqueSalesPersonIds.length > 0) {
        // Fetch profiles
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', uniqueSalesPersonIds);

        if (profilesData) {
          profilesData.forEach(p => {
            profilesMap[p.id] = p;
          });
        }
        
        if (profilesError) {
          console.warn('Error fetching profiles:', profilesError);
        }

        // Fetch monthly sales targets from sales_targets table
        // Convert month (2026-04) to date (2026-04-01)
        const [year, monthNum] = m.split('-');
        const targetMonthDate = `${year}-${monthNum}-01`;

        console.log('🔍 DEBUG: Fetching targets for:', { targetMonthDate, uniqueSalesPersonIds });

        // First, check what's in the sales_targets table for this month
        const { data: allTargetsForMonth, error: allTargetsError } = await supabase
          .from('sales_targets')
          .select('id, sales_person_id, target_month, target_amount')
          .eq('target_month', targetMonthDate);

        console.log('🔍 ALL targets for month', targetMonthDate, ':', allTargetsForMonth);
        console.log('🔍 Error (if any):', allTargetsError);

        // Now fetch for specific sales persons
        const { data: targetsData, error: targetsError } = await supabase
          .from('sales_targets')
          .select('sales_person_id, target_amount')
          .eq('target_month', targetMonthDate)
          .in('sales_person_id', uniqueSalesPersonIds);

        console.log('🔍 Targets for these sales persons:', { 
          query: { targetMonthDate, uniqueSalesPersonIds },
          result: targetsData,
          error: targetsError 
        });

        if (targetsData) {
          targetsData.forEach((t: any) => {
            targetsMap[t.sales_person_id] = Number(t.target_amount) || 0;
          });
        }

        console.log('✅ Final targets map loaded:', targetsMap);

        if (targetsError) {
          console.warn('❌ Error fetching targets:', targetsError);
        }

        // Fetch total orders and amounts for each sales person (from all orders)
        console.log('🔍 Fetching total orders for sales persons...');

        for (const spId of uniqueSalesPersonIds) {
          const { data: allOrdersData, error: allOrdersError } = await supabase
            .from('orders')
            .select('id, total_amount')
            .eq('user_id', spId)
            .gte('order_date', startDateISO)
            .lte('order_date', endDateISO);

          if (allOrdersData) {
            totalOrdersMap[spId] = {
              count: allOrdersData.length,
              amount: allOrdersData.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
            };
            console.log(`🔍 Sales person ${spId}: ${allOrdersData.length} orders in ${m}, amount: ${totalOrdersMap[spId].amount}`);
          }

          if (allOrdersError) {
            console.warn(`❌ Error fetching orders for ${spId}:`, allOrdersError);
            totalOrdersMap[spId] = { count: 0, amount: 0 };
          }
        }

        console.log('✅ Total orders map:', totalOrdersMap);
      }

      // Calculate summary
      if (sp) {
        // Single sales person selected
        const totalSales = mappedOrders.reduce((sum, o) => sum + o.total_amount, 0);

        const profileData = profilesMap[sp];
        const target = targetsMap[sp] || 0; // Get from sales_target table
        const pendingSales = Math.max(0, target - totalSales);

        setSummary([
          {
            sales_person_id: sp,
            sales_person_name: `${profileData?.first_name || ''} ${profileData?.last_name || ''}`.trim() || 'Unknown',
            monthly_target: target,
            total_sales: totalSales,
            pending_sales: pendingSales,
            order_count: mappedOrders.length,
            total_orders_count: totalOrdersMap[sp]?.count || 0,
            total_orders_amount: totalOrdersMap[sp]?.amount || 0,
          },
        ]);

        // Only set totals if monthly_target > 0
        if (target > 0) {
          setTotalSalesSum(totalSales);
          setTotalPendingSalesSum(pendingSales);
        } else {
          setTotalSalesSum(0);
          setTotalPendingSalesSum(0);
        }
      } else {
        // All sales persons - group by sales person
        const grouped: { [key: string]: DispatchedOrder[] } = {};
        mappedOrders.forEach((order) => {
          if (!grouped[order.sales_person_id]) {
            grouped[order.sales_person_id] = [];
          }
          grouped[order.sales_person_id].push(order);
        });

        const summaryData: SalesPersonSummary[] = [];
        let totalSalesForAll = 0;
        let totalPendingForAll = 0;

        for (const spId in grouped) {
          const spOrders = grouped[spId];
          const totalSales = spOrders.reduce((sum, o) => sum + o.total_amount, 0);

          const profileData = profilesMap[spId];
          const target = targetsMap[spId] || 0; // Get from sales_target table
          const pendingSales = Math.max(0, target - totalSales);

          summaryData.push({
            sales_person_id: spId,
            sales_person_name: `${profileData?.first_name || ''} ${profileData?.last_name || ''}`.trim() || 'Unknown',
            monthly_target: target,
            total_sales: totalSales,
            pending_sales: pendingSales,
            order_count: spOrders.length,
            total_orders_count: totalOrdersMap[spId]?.count || 0,
            total_orders_amount: totalOrdersMap[spId]?.amount || 0,
          });

          totalSalesForAll += totalSales;
          totalPendingForAll += pendingSales;
        }

        setSummary(summaryData.sort((a, b) => a.sales_person_name.localeCompare(b.sales_person_name)));
        
        // Only calculate totals for sales persons with monthly_target > 0
        const filteredSummaryData = summaryData.filter(s => s.monthly_target > 0);
        const filteredTotalSalesForAll = filteredSummaryData.reduce((sum, item) => sum + item.total_sales, 0);
        const filteredTotalPendingForAll = filteredSummaryData.reduce((sum, item) => sum + item.pending_sales, 0);
        
        setTotalSalesSum(filteredTotalSalesForAll);
        setTotalPendingSalesSum(filteredTotalPendingForAll);
      }
    } catch (error) {
      console.error('Error fetching dispatched orders:', error);
      console.log('Complete error object:', JSON.stringify(error, null, 2));
      setOrders([]);
      setSummary([]);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error loading data: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when filters change
  useEffect(() => {
    fetchDispatchedOrders();
  }, []);

  const handleRefresh = () => {
    fetchDispatchedOrders();
  };

  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    if (!printWindow) {
      alert('Please allow pop-ups to print');
      return;
    }

    const selectedPersonName = selectedSalesPerson 
      ? salesPersons.find(sp => sp.id === selectedSalesPerson)?.name || 'Unknown'
      : 'All Sales Persons';

    const monthDate = new Date(`${selectedMonth}-01`);
    const monthName = monthDate.toLocaleDateString('en-IN', { year: 'numeric', month: 'long' });

    let htmlContent = `
      <html>
        <head>
          <title>Sales Person Dispatched Order Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
            h1 { text-align: center; color: #1f2937; margin-bottom: 10px; }
            .filters { text-align: center; margin-bottom: 20px; font-size: 14px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background-color: #f0f0f0; padding: 12px; text-align: left; border: 1px solid #ddd; font-weight: 600; }
            td { padding: 12px; border: 1px solid #ddd; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .total-row { background-color: #e8e8e8; font-weight: bold; }
            .pending-section { margin-top: 40px; }
            .section-title { font-size: 16px; font-weight: 600; color: #dc2626; margin-bottom: 10px; }
            .numeric { text-align: right; }
            .center { text-align: center; }
          </style>
        </head>
        <body>
          <h1>Sales Person Dispatched Order Report</h1>
          <div class="filters">
            <p><strong>Month:</strong> ${monthName} | <strong>Sales Person:</strong> ${selectedPersonName}</p>
          </div>
    `;

    // Summary Table
    const filteredSummary = summary.filter(s => s.monthly_target > 0);
    if (filteredSummary.length > 0) {
      htmlContent += `
        <h2>Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Sales Person</th>
              <th class="numeric">Monthly Target</th>
              <th class="numeric">Total Sales</th>
              <th class="numeric">Pending Sales</th>
              <th class="numeric">Total Orders Amount</th>
              <th class="numeric">Achievement %</th>
            </tr>
          </thead>
          <tbody>
      `;

      filteredSummary.forEach((item) => {
        const achievementPercent = item.monthly_target > 0 
          ? ((item.total_sales / item.monthly_target) * 100).toFixed(1) 
          : '0.0';
        
        htmlContent += `
          <tr>
            <td>${item.sales_person_name}</td>
            <td class="numeric">${formatCurrency(item.monthly_target)}</td>
            <td class="numeric">${formatCurrency(item.total_sales)}</td>
            <td class="numeric">${formatCurrency(item.pending_sales)}</td>
            <td class="numeric">${formatCurrency(item.total_orders_amount)}</td>
            <td class="numeric">${achievementPercent}%</td>
          </tr>
        `;
      });

      // Total Row
      const totalMonthlyTarget = filteredSummary.reduce((sum, item) => sum + item.monthly_target, 0);
      const totalOrdersAmount = filteredSummary.reduce((sum, item) => sum + item.total_orders_amount, 0);
      const totalAchievementPercent = totalMonthlyTarget > 0 
        ? ((totalSalesSum / totalMonthlyTarget) * 100).toFixed(1) 
        : '0.0';

      htmlContent += `
        <tr class="total-row">
          <td>TOTAL</td>
          <td class="numeric">${formatCurrency(totalMonthlyTarget)}</td>
          <td class="numeric">${formatCurrency(filteredSummary.filter(s => s.pending_sales === 0).reduce((sum, item) => sum + item.total_sales, 0) + filteredSummary.filter(s => s.pending_sales > 0).reduce((sum, item) => sum + item.total_sales, 0))}</td>
          <td class="numeric">${formatCurrency(filteredSummary.reduce((sum, item) => sum + item.pending_sales, 0))}</td>
          <td class="numeric">${formatCurrency(totalOrdersAmount)}</td>
          <td class="numeric">${totalAchievementPercent}%</td>
        </tr>
      `;

      htmlContent += `</tbody></table>`;
    }

    // Pending Sales Table
    const pendingItems = summary.filter(item => item.monthly_target > 0 && item.pending_sales > 0);
    if (pendingItems.length > 0) {
      htmlContent += `
        <div class="pending-section">
          <h2 class="section-title">⚠️ Pending Sales Targets</h2>
          <table>
            <thead>
              <tr style="background-color: #fef2f2;">
                <th>Sales Person</th>
                <th class="numeric">Monthly Target</th>
                <th class="numeric">Achieved</th>
                <th class="numeric">Still Needed</th>
                <th class="numeric">Total Orders Amount</th>
                <th class="numeric">% Remaining</th>
              </tr>
            </thead>
            <tbody>
      `;

      pendingItems.forEach((item) => {
        const remainingPercent = item.monthly_target > 0 
          ? (((item.monthly_target - item.total_sales) / item.monthly_target) * 100).toFixed(1)
          : '0.0';

        htmlContent += `
          <tr>
            <td>${item.sales_person_name}</td>
            <td class="numeric">${formatCurrency(item.monthly_target)}</td>
            <td class="numeric">${formatCurrency(item.total_sales)}</td>
            <td class="numeric">${formatCurrency(item.pending_sales)}</td>
            <td class="numeric">${formatCurrency(item.total_orders_amount)}</td>
            <td class="numeric">${remainingPercent}%</td>
          </tr>
        `;
      });

      htmlContent += `</tbody></table></div>`;
    }

    // Orders Table
    const filteredOrders = orders.filter(o => filteredSummary.map(s => s.sales_person_id).includes(o.sales_person_id));
    if (filteredOrders.length > 0) {
      htmlContent += `
        <div style="margin-top: 40px;">
          <h2>Orders Detail</h2>
          <table>
            <thead>
              <tr>
                <th>Sales Person</th>
                <th>Order #</th>
                <th>Dealer</th>
                <th>Order Date</th>
                <th>Dispatch #</th>
                <th>Dispatch Date</th>
                <th>Gate Pass Date</th>
                <th class="numeric">Amount</th>
              </tr>
            </thead>
            <tbody>
      `;

      filteredOrders.forEach((order) => {
        htmlContent += `
          <tr>
            <td>${order.sales_person_name}</td>
            <td>#${order.order_number}</td>
            <td>${order.dealer_name}</td>
            <td>${formatDate(order.order_date)}</td>
            <td>${order.dispatch_number || '—'}</td>
            <td>${formatDate(order.dispatch_date)}</td>
            <td>${formatDate(order.gate_pass_dispatch_date)}</td>
            <td class="numeric">${formatCurrency(order.total_amount)}</td>
          </tr>
        `;
      });

      htmlContent += `</tbody></table></div>`;
    }

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

  const monthName = selectedMonth
    ? new Date(`${selectedMonth}-01`).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })
    : 'Select Month';

  return (
    <div style={{ padding: '24px', backgroundColor: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px', color: '#1a1a1a' }}>
            Sales Person-wise Dispatched Orders Report
          </h1>
          <p style={{ fontSize: '14px', color: '#666' }}>
            View all dispatched orders by sales person for the selected month
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
          {/* Month Filter */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#333' }}>
              Month
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                fetchDispatchedOrders(selectedSalesPerson, e.target.value);
              }}
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
              onChange={(e) => {
                setSelectedSalesPerson(e.target.value);
                fetchDispatchedOrders(e.target.value, selectedMonth);
              }}
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
              {salesPersons.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh and Print Buttons */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <Button
              onClick={handleRefresh}
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
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
            <Button
              onClick={handlePrint}
              disabled={summary.length === 0 || loading}
              style={{
                flex: 1,
                backgroundColor: '#10b981',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                cursor: summary.length === 0 || loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              🖨️ Print Report
            </Button>
          </div>
        </div>

        {/* Diagnostic Info - Only show when no data */}
        {orders.length === 0 && !loading && (
          <div style={{
            backgroundColor: '#fff3cd',
            borderLeft: '4px solid #ffc107',
            borderRadius: '4px',
            padding: '12px',
            marginBottom: '24px',
            fontSize: '12px',
            color: '#333'
          }}>
            <strong>Debug Info:</strong> Month: {selectedMonth || 'Not set'} | 
            Sales Person: {selectedSalesPerson ? 'Selected' : 'All'} | 
            <span style={{marginLeft: '16px', color: 'red'}}>⚠️ No data found. Try selecting different filters.</span>
          </div>
        )}

        {/* Summary Cards */}
        {summary.filter(s => s.monthly_target > 0).length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '16px',
              marginBottom: '32px',
            }}
          >
            {/* Total Sales Card */}
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
                Total Sales
              </p>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981' }}>
                {formatCurrency(totalSalesSum)}
              </p>
              <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                {orders.length} orders
              </p>
            </div>

            {/* Pending Sales Card */}
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
                Pending Sales Target
              </p>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>
                {formatCurrency(totalPendingSalesSum)}
              </p>
              <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                To achieve target for {monthName}
              </p>
            </div>

            {/* Total Target Card */}
            {summary.length === 1 && (
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
                  Monthly Target
                </p>
                <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6' }}>
                  {formatCurrency(summary[0].monthly_target)}
                </p>
                <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                  {(((summary[0].total_sales / summary[0].monthly_target) * 100) || 0).toFixed(1)}% achieved
                </p>
              </div>
            )}
          </div>
        )}

        {/* Summary Table */}
        {summary.filter(s => s.monthly_target > 0).length > 1 && (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              marginBottom: '32px',
              overflowX: 'auto',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                    Sales Person
                  </th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                    Monthly Target
                  </th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                    Total Sales
                  </th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                    Pending Sales
                  </th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                    Total Orders Amount
                  </th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                    Achievement %
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.filter(s => s.monthly_target > 0).map((item, idx) => {
                  const achievementPercent = item.monthly_target > 0 ? ((item.total_sales / item.monthly_target) * 100).toFixed(1) : '0.0';
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px', fontSize: '14px', color: '#1f2937' }}>
                        <strong>{item.sales_person_name}</strong>
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', textAlign: 'right', color: '#1f2937' }}>
                        {formatCurrency(item.monthly_target)}
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', textAlign: 'right', color: '#10b981', fontWeight: '500' }}>
                        {formatCurrency(item.total_sales)}
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', textAlign: 'right', color: item.pending_sales > 0 ? '#f59e0b' : '#10b981', fontWeight: '500' }}>
                        {formatCurrency(item.pending_sales)}
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', textAlign: 'right', color: '#8b5cf6', fontWeight: '500' }}>
                        {formatCurrency(item.total_orders_amount)}
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', textAlign: 'right', color: Number(achievementPercent) >= 100 ? '#10b981' : '#f59e0b', fontWeight: '500' }}>
                        {achievementPercent}%
                      </td>
                    </tr>
                  );
                })}
                {/* Total Row */}
                <tr style={{ backgroundColor: '#f0f9ff', borderTop: '2px solid #e5e7eb', fontWeight: 'bold' }}>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#1f2937', fontWeight: '600' }}>
                    TOTAL
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', textAlign: 'right', color: '#1f2937' }}>
                    {formatCurrency(summary.filter(s => s.monthly_target > 0).reduce((sum, item) => sum + item.monthly_target, 0))}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', textAlign: 'right', color: '#10b981', fontWeight: '600' }}>
                    {formatCurrency(totalSalesSum)}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', textAlign: 'right', color: '#f59e0b', fontWeight: '600' }}>
                    {formatCurrency(totalPendingSalesSum)}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', textAlign: 'right', color: '#8b5cf6', fontWeight: '600' }}>
                    {formatCurrency(summary.filter(s => s.monthly_target > 0).reduce((sum, item) => sum + item.total_orders_amount, 0))}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', textAlign: 'right', color: '#1f2937', fontWeight: '600' }}>
                    {totalSalesSum && summary.filter(s => s.monthly_target > 0).reduce((sum, item) => sum + item.monthly_target, 0) > 0
                      ? ((totalSalesSum / summary.filter(s => s.monthly_target > 0).reduce((sum, item) => sum + item.monthly_target, 0)) * 100).toFixed(1)
                      : '0.0'}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Orders Table */}
        <div
          style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflowX: 'auto',
          }}
        >
          <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
              Dispatched Orders {selectedMonth ? `- ${monthName}` : ''}
            </h2>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
              <p>Loading dispatched orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
              <p>No dispatched orders found for the selected filters.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                    Sales Person
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                    Order #
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                    Dealer
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                    Order Date
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                    Dispatch #
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                    Dispatch Date
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                    Gate Pass Date
                  </th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.filter(o => summary.filter(s => s.monthly_target > 0).map(s => s.sales_person_id).includes(o.sales_person_id)).map((order, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: idx % 2 === 0 ? '#fafbfc' : 'white' }}>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#1f2937' }}>
                      {order.sales_person_name}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#1f2937', fontWeight: '500' }}>
                      #{order.order_number}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#1f2937' }}>
                      {order.dealer_name}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#666' }}>
                      {formatDate(order.order_date)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#1f2937', fontWeight: '500' }}>
                      {order.dispatch_number || '—'}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#666' }}>
                      {formatDate(order.dispatch_date)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#666' }}>
                      {formatDate(order.gate_pass_dispatch_date)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', textAlign: 'right', color: '#10b981', fontWeight: '500' }}>
                      {formatCurrency(order.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pending Sales Section - Show sales persons with unfulfilled targets */}
        {summary.length > 0 && summary.some(s => s.monthly_target > 0 && s.pending_sales > 0) && (
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              marginTop: '32px',
              overflowX: 'auto',
            }}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#dc2626', margin: 0 }}>
                ⚠️ Pending Sales Targets
              </h2>
              <p style={{ fontSize: '13px', color: '#666', marginTop: '4px', margin: 0 }}>
                Sales persons who haven't achieved their monthly targets yet
              </p>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#fef2f2', borderBottom: '2px solid #fecaca' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#dc2626' }}>
                    Sales Person
                  </th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#dc2626' }}>
                    Monthly Target
                  </th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#dc2626' }}>
                    Achieved
                  </th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#dc2626' }}>
                    Still Needed
                  </th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#dc2626' }}>
                    Total Orders Amount
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#dc2626' }}>
                    % Remaining
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary
                  .filter(item => item.monthly_target > 0 && item.pending_sales > 0)
                  .map((item, idx) => {
                    const remainingPercent = item.monthly_target > 0 
                      ? (((item.monthly_target - item.total_sales) / item.monthly_target) * 100).toFixed(1)
                      : '0.0';
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #fee2e2', backgroundColor: idx % 2 === 0 ? '#fef2f2' : 'white' }}>
                        <td style={{ padding: '12px', fontSize: '13px', color: '#1f2937', fontWeight: '500' }}>
                          {item.sales_person_name}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', textAlign: 'right', color: '#1f2937' }}>
                          {formatCurrency(item.monthly_target)}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', textAlign: 'right', color: '#10b981', fontWeight: '500' }}>
                          {formatCurrency(item.total_sales)}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', textAlign: 'right', color: '#dc2626', fontWeight: '600' }}>
                          {formatCurrency(item.pending_sales)}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', textAlign: 'right', color: '#8b5cf6', fontWeight: '500' }}>
                          {formatCurrency(item.total_orders_amount)}
                        </td>
                        <td style={{ padding: '12px', fontSize: '13px', textAlign: 'center', color: '#dc2626', fontWeight: '500' }}>
                          {remainingPercent}%
                        </td>
                      </tr>
                    );
                  })}
                {/* Pending Total Row */}
                {summary.filter(item => item.monthly_target > 0 && item.pending_sales > 0).length > 0 && (
                  <tr style={{ backgroundColor: '#fef2f2', borderTop: '2px solid #fecaca', fontWeight: 'bold' }}>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#dc2626', fontWeight: '600' }}>
                      TOTAL PENDING
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', textAlign: 'right', color: '#dc2626', fontWeight: '600' }}>
                      {formatCurrency(
                        summary
                          .filter(item => item.monthly_target > 0 && item.pending_sales > 0)
                          .reduce((sum, item) => sum + item.monthly_target, 0)
                      )}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', textAlign: 'center', color: '#3b82f6', fontWeight: '600' }}>
                      {summary
                        .filter(item => item.monthly_target > 0 && item.pending_sales > 0)
                        .reduce((sum, item) => sum + item.order_count, 0)}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', textAlign: 'right', color: '#10b981', fontWeight: '600' }}>
                      {formatCurrency(
                        summary
                          .filter(item => item.monthly_target > 0 && item.pending_sales > 0)
                          .reduce((sum, item) => sum + item.total_sales, 0)
                      )}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', textAlign: 'right', color: '#dc2626', fontWeight: '600' }}>
                      {formatCurrency(
                        summary
                          .filter(item => item.monthly_target > 0 && item.pending_sales > 0)
                          .reduce((sum, item) => sum + item.pending_sales, 0)
                      )}
                    </td>
                    <td style={{ padding: '12px', fontSize: '13px', textAlign: 'center', color: '#dc2626', fontWeight: '600' }}>
                      -
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Note */}
        <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#eff6ff', borderLeft: '4px solid #3b82f6', borderRadius: '4px' }}>
          <p style={{ fontSize: '13px', color: '#1e40af', marginBottom: '8px', margin: 0 }}>
            <strong>📊 Report Information:</strong>
          </p>
          <ul style={{ fontSize: '12px', color: '#1e40af', marginLeft: '20px', marginTop: '8px', margin: 0 }}>
            <li>Shows only orders with dispatch number, dispatch date, and gate pass dispatch date</li>
            <li>Monthly targets are fetched from the <code>sales_targets</code> table by sales person and month</li>
            <li>Pending sales = Monthly Target - Total Sales for the month</li>
            <li>Dispatched orders shown are from: {selectedMonth ? monthName : 'all months'}</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SalesPersonDispatchedOrderReport;
