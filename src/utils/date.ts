export const getStartOfUTCDayISO = (date: Date = new Date()): string => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  // Ensure the string ends with 'Z' for UTC
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0)).toISOString();
};

export const getEndOfUTCDayISO = (date: Date = new Date()): string => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  // Ensure the string ends with 'Z' for UTC
  return new Date(Date.UTC(year, month, day, 23, 59, 59, 999)).toISOString();
};