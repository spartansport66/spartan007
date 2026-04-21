# Billing Dashboard Components

A comprehensive set of reusable React components for building a professional billing dashboard, similar to the CRM reference design.

## 📦 Components

### 1. **BillingProgressCard**
Shows overall billing/invoice generation progress with a circular gauge.

```tsx
<BillingProgressCard
  percentage={76}
  label="Invoice Generation"
  color="#F59E0B"
/>
```

**Props:**
- `percentage` (number): Progress percentage (0-100)
- `label` (string): Title/label for the progress
- `color` (string, optional): Color of the progress circle (default: #F59E0B)

---

### 2. **RevenueSummaryCard**
Displays revenue metrics compared to targets with progress bars.

```tsx
<RevenueSummaryCard
  totalRevenue={52000000}
  targetRevenue={65000000}
  percentage={80}
  currency="₹"
/>
```

**Props:**
- `totalRevenue` (number): Current revenue amount
- `targetRevenue` (number): Target revenue to reach
- `percentage` (number): Achievement percentage
- `currency` (string, optional): Currency symbol (default: ₹)

---

### 3. **PendingPaymentsCard**
Shows outstanding payments and payment overdue status.

```tsx
<PendingPaymentsCard
  payments={[
    {
      id: '1',
      dealerName: 'Premium Corp',
      amount: 500000,
      invoiceNumber: '001',
      daysOverdue: 5,
    },
  ]}
  total={500000}
/>
```

**Props:**
- `payments` (PendingPayment[]): Array of pending payments
- `total` (number): Total pending amount

**PendingPayment Interface:**
```tsx
interface PendingPayment {
  id: string;
  dealerName: string;
  amount: number;
  invoiceNumber: string;
  daysOverdue: number;
}
```

---

### 4. **CustomerMetricsCard**
Displays top customers/dealers with their revenue breakdown.

```tsx
<CustomerMetricsCard
  customers={[
    { id: '1', name: 'Premium Corp', revenue: 5000000, percentage: 100, orders: 24 },
    { id: '2', name: 'Elite Traders', revenue: 4200000, percentage: 84, orders: 18 },
  ]}
  totalCustomers={25}
/>
```

**Props:**
- `customers` (CustomerMetric[]): Array of customer metrics
- `totalCustomers` (number): Total number of customers

**CustomerMetric Interface:**
```tsx
interface CustomerMetric {
  id: string;
  name: string;
  revenue: number;
  percentage: number;
  orders: number;
}
```

---

### 5. **MonthlyRevenueChart**
Bar chart comparing monthly revenue against targets.

```tsx
<MonthlyRevenueChart
  data={[
    { month: 'Jan', revenue: 4500000, target: 5000000 },
    { month: 'Feb', revenue: 5200000, target: 5000000 },
    // ... more months
  ]}
/>
```

**Props:**
- `data` (MonthData[]): Array of monthly revenue data
- `maxValue` (number, optional): Maximum value for chart scaling

**MonthData Interface:**
```tsx
interface MonthData {
  month: string;
  revenue: number;
  target: number;
}
```

---

### 6. **InvoiceStatusChart**
Pie chart showing invoice status distribution (Paid, Pending, Overdue, Cancelled).

```tsx
<InvoiceStatusChart
  statuses={[
    { status: 'Paid', count: 245, percentage: 60, color: '#10B981' },
    { status: 'Pending', count: 85, percentage: 21, color: '#F59E0B' },
    { status: 'Overdue', count: 50, percentage: 12, color: '#EF4444' },
    { status: 'Cancelled', count: 20, percentage: 5, color: '#6B7280' },
  ]}
  total={400}
/>
```

**Props:**
- `statuses` (InvoiceStatus[]): Array of invoice statuses
- `total` (number): Total invoice count

**InvoiceStatus Interface:**
```tsx
interface InvoiceStatus {
  status: string;
  count: number;
  percentage: number;
  color: string;
}
```

---

### 7. **PaymentAgeingCard**
Shows payment ageing analysis (0-30 days, 30-60 days, etc.).

```tsx
<PaymentAgeingCard
  data={[
    { period: '0-30 Days', amount: 2500000, percentage: 45, invoices: 25, color: '#10B981' },
    { period: '30-60 Days', amount: 1200000, percentage: 21, invoices: 12, color: '#F59E0B' },
    { period: '60-90 Days', amount: 950000, percentage: 17, invoices: 10, color: '#FF6B6B' },
    { period: '90+ Days', amount: 800000, percentage: 14, invoices: 8, color: '#DC2626' },
  ]}
  totalAmount={5450000}
/>
```

**Props:**
- `data` (AgeingData[]): Array of ageing period data
- `totalAmount` (number): Total outstanding amount

**AgeingData Interface:**
```tsx
interface AgeingData {
  period: string;
  amount: number;
  percentage: number;
  invoices: number;
  color: string;
}
```

---

## 🎨 Layout Examples

### Complete Dashboard Layout

```tsx
<div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
  {/* Row 1 */}
  <div className="lg:col-span-1">
    <BillingProgressCard percentage={76} label="Invoice Generation" />
  </div>
  <div className="lg:col-span-1">
    <RevenueSummaryCard totalRevenue={52M} targetRevenue={65M} percentage={80} />
  </div>
  <div className="lg:col-span-2">
    <PendingPaymentsCard payments={[...]} total={...} />
  </div>
</div>

<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
  {/* Row 2 */}
  <CustomerMetricsCard customers={[...]} totalCustomers={25} />
  <PaymentAgeingCard data={[...]} totalAmount={...} />
</div>

<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Row 3 */}
  <MonthlyRevenueChart data={[...]} />
  <InvoiceStatusChart statuses={[...]} total={400} />
</div>
```

---

## 🚀 Quick Start

1. **Import components**:
```tsx
import {
  BillingProgressCard,
  RevenueSummaryCard,
  PendingPaymentsCard,
  CustomerMetricsCard,
  MonthlyRevenueChart,
  InvoiceStatusChart,
  PaymentAgeingCard,
} from '@/components/dashboard';
```

2. **Use with your data**:
```tsx
const MyDashboard = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    // Fetch data from your API
    fetchDashboardData().then(setData);
  }, []);

  if (!data) return <div>Loading...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <BillingProgressCard percentage={data.invoiceProgress} label="Invoices" />
      {/* ... more components ... */}
    </div>
  );
};
```

3. **Customize styling**:
All components use Tailwind CSS and accept standard Tailwind classes via wrapper divs.

---

## 📊 Data Sources

Each component can be connected to your Supabase database:

```tsx
// Example: Fetch billing progress
const fetchBillingProgress = async () => {
  const { data } = await supabase
    .from('invoices')
    .select('status')
    .eq('month', currentMonth);
  
  const percentage = (data.filter(d => d.status === 'generated').length / data.length) * 100;
  return percentage;
};

// Example: Fetch revenue summary
const fetchRevenueSummary = async () => {
  const { data } = await supabase
    .from('orders')
    .select('total_amount')
    .gte('order_date', monthStart)
    .lte('order_date', monthEnd);
  
  return data.reduce((sum, d) => sum + d.total_amount, 0);
};
```

---

## 🎯 Features

✅ Responsive design (mobile, tablet, desktop)
✅ Gradient backgrounds and modern styling
✅ Hover effects and transitions
✅ Color-coded status indicators
✅ Interactive charts and progress bars
✅ TypeScript support
✅ Accessibility-friendly
✅ Dark mode compatible (with theme adjustments)
✅ Performance optimized

---

## 🔧 Customization

### Change Colors
Colors can be customized in each component or globally:

```tsx
// Component level
<BillingProgressCard color="#EF4444" />

// Tailwind classes in wrapper components
<div className="bg-gradient-to-r from-purple-100 to-blue-100">
  <CustomerMetricsCard {...props} />
</div>
```

### Adjust Spacing
Use Tailwind's gap and padding utilities:

```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-12 p-8">
  {/* Components here */}
</div>
```

---

## 📝 Notes

- All monetary values are in the smallest unit (paise for ₹)
- Percentages should be between 0-100
- Colors should be valid hex codes or Tailwind color names
- Components handle empty states gracefully

## 📄 Reference

See `USAGE_EXAMPLE.tsx` for a complete working example with mock data.
