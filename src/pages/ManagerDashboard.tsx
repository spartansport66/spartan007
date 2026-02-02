"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { DollarSign, Package, LogOut, Loader2, Building, Boxes, Lock, CalendarIcon } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import MonthlyBarChart from '@/components/MonthlyBarChart';
import SalesPersonMonthlySalesChart from '@/components/SalesPersonMonthlySalesChart'; // Re-used for single person view
import { formatCurrency } from '@/utils/formatters';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface SalesDataPoint {
  month: string; // e.g., "Jan 2024"
  sales: number;
}

interface SalesPersonOption {
  id: string;
  name: string;
}

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: sessionLoading, userType } = useSession();
  const [loadingData, setLoadingData] = useState(true);

  // State for Date Range Filter
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // State for Dashboard Metrics
  const [totalSalesValue, setTotalSalesValue] = useState<number>(0);
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [activeDealersCount, setActiveDealersCount] = useState<number>(0);
  const [productsCount, setProductsCount] = useState<number>(0);
  
  // State for Sales Person Chart
  const [allSalesPersons, setAllSalesPersons] = useState<SalesPersonOption[]>([]);
  const [selectedSalesPersonId, setSelectedSalesPersonId] = useState<string>(''); // Default to empty string
  const [salesPersonChartData, setSalesPersonChartData] = useState<SalesDataPoint[]>([]);
  const [loadingSalesPersonData, setLoadingSalesPersonData] = useState(false);

  // Monthly Sales Data for Company Chart
  const [monthlySalesData, setMonthlySalesData] = useState<SalesDataPoint[]>([]);

  const fetchSalesPersonOptions = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('user_type', 'sales_person');
    
    if (error) {
      console.error('Error fetching sales persons:', error.message);
      setAllSalesPersons([]);
    } else {
      const persons = (data || []).map(p => ({
        id: p.id,
        name: `${p.first_name} ${p.last_name || ''}`.trim(),
      }));
      setAllSalesPersons(persons);
      
      // Set the default selection only if no selection has been made yet
      setSelectedSalesPersonId(currentId => {
        if (!currentId && persons.length > 0) {
          return persons[0].id;
        }
        return currentId;
      });
    }
  }, []); // Dependency array is now empty

  const fetchSalesPersonData = useCallback(async (salesPersonId: string, startDateISO?: string, endDateISO?: string) => {
    if (!salesPersonId) {
      setSalesPersonChartData([]);
      return;
    }
    setLoadingSalesPersonData(true);
    try {
      let query = supabase
        .from('sales')
        .select('total_price, sale_date, orders(user_id)')
        .eq('orders.user_id', salesPersonId); // Filter by specific sales person ID

      if (startDateISO) {
        query = query.gte('sale_date', startDateISO);
      }
      if (endDateISO) {
        query = query.lte('sale_date', endDateISO);
      }

      const { data: salesData, error } = await query;

      if (error) throw error;

      // --- Single Person View ---
      const salesByMonth: { [key: string]: number } = {};
      (salesData || []).forEach(sale => {
        // DEFENSIVE CHECK: Ensure the sale is attributed to the selected sales person.
        if (sale.orders?.user_id !== salesPersonId) {
          return;
        }

        const date = new Date(sale.sale_date);
        const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
        salesByMonth[monthYear] = (salesByMonth[monthYear] || 0) + sale.total_price;
      });

      const formattedMonthlySales: SalesDataPoint[] = Object.keys(salesByMonth).map(month => ({
        month,
        sales: salesByMonth[month],
      }));
      
      setSalesPersonChartData(formattedMonthlySales);

    } catch (error: any) {
      console.error('Error fetching sales person sales:', error);
      showError(error.message || 'Failed to fetch sales person sales data.');
      setSalesPersonChartData([]);
    } finally {
      setLoadingSalesPersonData(false);
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const startDateISO = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') + 'T00:00:00.000Z' : undefined;
      const endDateISO = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59.999Z' : undefined;

      // 1. Fetch products count (All time)
      const { count: productsCount, error: productsError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });
      if (!productsError) {
        setProductsCount(productsCount || 0);
      }

      // 2. Fetch total count of ALL dealers (Simple Query, relies on RLS policy allowing SELECT)
      const { count: dealersCount, error: dealersCountError } = await supabase
        .from('dealers')
        .select('*', { count: 'exact', head: true });

      if (dealersCountError) {
        console.error('[ManagerDashboard] Error fetching total dealers count:', dealersCountError.message);
        setActiveDealersCount(0);
      } else {
        setActiveDealersCount(dealersCount || 0);
      }

      // 3. Fetch total sales value and orders (Filtered by date)
      let salesQuery = supabase
        .from('sales')
        .select('total_price, sale_date, orders(dealer_id)');
      
      if (startDateISO) {
        salesQuery = salesQuery.gte('sale_date', startDateISO);
      }
      if (endDateISO) {
        salesQuery = salesQuery.lte('sale_date', endDateISO);
      }

      const { data: salesData, error: salesError } = await salesQuery;
      
      if (salesError) {
        console.error('[ManagerDashboard] Error fetching sales data:', salesError.message);
        setTotalSalesValue(0);
        setTotalOrders(0);
      } else {
        const total = (salesData || []).reduce((sum, sale) => sum + sale.total_price, 0);
        setTotalSalesValue(total);
        setTotalOrders(salesData?.length || 0);

        // 4. Monthly Sales Data for Company Chart (Filtered by date)
        const salesByMonth: { [key: string]: number } = {};
        (salesData || []).forEach(sale => {
          const date = new Date(sale.sale_date);
          const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
          salesByMonth[monthYear] = (salesByMonth[monthYear] || 0) + sale.total_price;
        });

        const formattedMonthlySales = Object.keys(salesByMonth).map(month => ({
          month,
          sales: salesByMonth[month],
        }));
        
        setMonthlySalesData(formattedMonthlySales);
      }
      
    } catch (error: any) {
      console.error('ManagerDashboard: Error fetching dashboard data:', error);
    } finally {
      setLoadingData(false);
    }
  }, [user, dateRange]);

  useEffect(() => {
    if (!sessionLoading) {
      if (!user) {
        navigate('/login');
      } else if (userType !== 'manager') {
        showError('Access Denied: Only managers can view this page.');
        navigate('/');
      } else {
        fetchSalesPersonOptions();
        fetchDashboardData();
      }
    }
  }, [sessionLoading, user, userType, fetchDashboardData, fetchSalesPersonOptions, navigate]);

  // Effect to fetch individual sales person data when selection or date range changes
  useEffect(() => {
    const startDateISO = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') + 'T00:00:00.000Z' : undefined;
    const endDateISO = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59.999Z' : undefined;
    
    if (selectedSalesPersonId) {
      fetchSalesPersonData(selectedSalesPersonId, startDateISO, endDateISO);
    } else {
      setSalesPersonChartData([]);
    }
  }, [selectedSalesPersonId, dateRange, fetchSalesPersonData]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.warn('Logout API call failed, but proceeding with client-side logout:', error.message);
        showError(`Logout failed: ${error.message}. You are being redirected.`);
      } else {
        showSuccess('Logged out successfully!');
      }
      navigate('/login');
    } catch (error: any) {
      console.error('Unexpected error during logout:', error);
      showError(`An unexpected error occurred during logout: ${error.message}. Redirecting.`);
      navigate('/login');
    }
  };

  if (sessionLoading || loadingData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300 mb-4">Loading manager dashboard...</p>
        <Button onClick={handleLogout} variant="destructive" className="flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          Force Logout
        </Button>
      </div>
    );
  }

  if (userType !== 'manager') {
    return null;
  }

  const salesOverview = [
    {
      title: "Total Sales Value",
      value: formatCurrency(totalSalesValue),
      change: "Sales in selected period",
      icon: <DollarSign className="h-4 w-4 text-white" />,
      colorClass: "bg-green-500 dark:bg-green-700",
      valueColor: "text-green-800 dark:text-green-200"
    },
    {
      title: "Total Orders",
      value: totalOrders.toString(),
      change: "Orders placed in selected period",
      icon: <Package className="h-4 w-4 text-white" />,
      colorClass: "bg-green-500 dark:bg-green-700",
      valueColor: "text-green-800 dark:text-green-200"
    },
    {
      title: "Active Dealers",
      value: activeDealersCount.toString(),
      change: "Total registered dealers",
      icon: <Building className="h-4 w-4 text-white" />,
      colorClass: "bg-green-500 dark:bg-green-700",
      valueColor: "text-green-800 dark:text-green-200"
    },
    {
      title: "Total Products",
      value: productsCount.toString(),
      change: "Products in catalog (All Time)",
      icon: <Boxes className="h-4 w-4 text-white" />,
      colorClass: "bg-green-500 dark:bg-green-700",
      valueColor: "text-green-800 dark:text-green-200"
    },
  ];

  const selectedSalesPersonName = allSalesPersons.find(sp => sp.id === selectedSalesPersonId)?.name || 'Select Sales Person';

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary">Manager Dashboard</h1>
        <div className="flex items-center gap-4">
          {/* Date Range Picker */}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-[200px] justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Filter by Date Range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={(range) => {
                  setDateRange(range);
                  if (range?.from && range?.to) {
                    setIsCalendarOpen(false);
                  }
                }}
                numberOfMonths={2}
              />
              <div className="p-2 flex justify-end">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setDateRange(undefined);
                    setIsCalendarOpen(false);
                  }}
                >
                  Clear Filter
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Lock className="h-4 w-4" /> Account
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/change-password')}>
                Change Password
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* 1. Sales Overview (4 cards) */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        {salesOverview.map((item, index) => (
          <Card key={index} className="bg-card text-card-foreground shadow-md h-full">
            <CardHeader className={`flex flex-row items-center justify-between space-y-0 pb-2 p-4 ${item.colorClass} text-white rounded-t-lg`}>
              <CardTitle className="text-base font-medium text-white">{item.title}</CardTitle>
              {item.icon}
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className={`text-3xl font-medium ${item.valueColor}`}>{item.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{item.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* 2. Monthly Sales Trend Chart (Company Wide) */}
      {/* Height reduced from h-[500px] to h-[250px] */}
      <Card className="bg-card text-card-foreground shadow-lg h-[250px] mb-6">
        <CardHeader className="bg-green-500 dark:bg-green-700 text-white rounded-t-lg p-4">
          <CardTitle className="text-xl font-semibold">Monthly Sales Trend (Company Wide)</CardTitle>
          <CardDescription className="text-green-100 dark:text-green-200">
            Sales performance over the last recorded periods.
          </CardDescription>
        </CardHeader>
        {/* Content height adjusted from h-[430px] to h-[180px] */}
        <CardContent className="p-4 h-[180px]">
          {loadingData ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <MonthlyBarChart data={monthlySalesData} />
          )}
        </CardContent>
      </Card>
      
      {/* 3. Sales Person Monthly Sales Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Height reduced from h-[500px] to h-[250px] */}
        <Card className="bg-card text-card-foreground shadow-lg h-[250px] lg:col-span-2">
          {/* Reduced padding from p-4 to p-2 */}
          <CardHeader className="bg-indigo-500 dark:bg-indigo-700 text-white rounded-t-lg p-2">
            <div className="flex justify-between items-center">
              {/* Reduced font size from text-xl to text-base */}
              <CardTitle className="text-base font-semibold">Sales Person Monthly Sales Trend</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="salesPersonFilter" className="text-white text-sm">Select Sales Person:</Label>
                <Select 
                  value={selectedSalesPersonId} 
                  onValueChange={setSelectedSalesPersonId}
                  disabled={allSalesPersons.length === 0 || loadingSalesPersonData}
                >
                  <SelectTrigger id="salesPersonFilter" className="w-[250px] text-foreground bg-white/10 hover:bg-white/20">
                    <SelectValue placeholder="Select Sales Person" />
                  </SelectTrigger>
                  <SelectContent>
                    {allSalesPersons.map(sp => (
                      <SelectItem key={sp.id} value={sp.id}>{sp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <CardDescription className="text-indigo-100 dark:text-indigo-200 text-xs">
              Monthly sales performance for {selectedSalesPersonName} in the chosen date range.
            </CardDescription>
          </CardHeader>
          {/* Content height adjusted from h-[430px] to h-[180px] */}
          <CardContent className="p-4 h-[180px]">
            <SalesPersonMonthlySalesChart 
              data={salesPersonChartData} 
              salesPersonName={selectedSalesPersonName} 
              loading={loadingSalesPersonData}
            />
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-8">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default ManagerDashboard;