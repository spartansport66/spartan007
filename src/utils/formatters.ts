export const formatCurrency = (amount: number, decimalPlaces: number = 2): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(amount);
};

export const formatLakhs = (amount: number): string => {
  const lakh = 100000;
  const valueInLakhs = amount / lakh;
  // Use toFixed(2) for 2 decimal places and append 'L' for Lakhs
  return `${valueInLakhs.toFixed(2)} L`;
};