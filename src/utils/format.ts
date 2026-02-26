export function formatCurrency(amount: number, withSymbol = true) {
  // returns string like "Rs.123.45" or just number if withSymbol=false
  const formatted = amount.toFixed(2);
  return withSymbol ? `Rs.${formatted}` : formatted;
}
