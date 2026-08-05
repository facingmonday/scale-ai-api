export const formatCurrency = (value: number) => {
  if (value === undefined || value === null) return "$0.00";
  const formatted = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
};
