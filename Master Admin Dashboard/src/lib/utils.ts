import { format } from 'date-fns';

export function formatCurrency(amount: number): string {
  return `PKR ${amount.toLocaleString()}`;
}

export function formatDate(date: string): string {
  return format(new Date(date), 'dd MMM yyyy HH:mm');
}

export function formatDateShort(date: string): string {
  return format(new Date(date), 'dd MMM yyyy');
}

export function getStatusColor(
  status: string
): { bg: string; text: string; dot?: string } {
  const statusMap: Record<string, { bg: string; text: string; dot?: string }> = {
    active: { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
    trial: { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
    suspended: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      dot: 'bg-yellow-500',
    },
    cancelled: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
    paid: { bg: 'bg-green-100', text: 'text-green-800' },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    overdue: { bg: 'bg-red-100', text: 'text-red-800' },
    online: { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
    offline: { bg: 'bg-slate-100', text: 'text-slate-800', dot: 'bg-slate-500' },
    idle: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
    open: { bg: 'bg-blue-100', text: 'text-blue-800' },
    'in-progress': { bg: 'bg-purple-100', text: 'text-purple-800' },
    resolved: { bg: 'bg-green-100', text: 'text-green-800' },
    closed: { bg: 'bg-slate-100', text: 'text-slate-800' },
    low: { bg: 'bg-slate-100', text: 'text-slate-800' },
    medium: { bg: 'bg-blue-100', text: 'text-blue-800' },
    high: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    critical: { bg: 'bg-red-100', text: 'text-red-800' },
    error: { bg: 'bg-red-100', text: 'text-red-800' },
    warn: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
    info: { bg: 'bg-blue-100', text: 'text-blue-800' },
  };

  return (
    statusMap[status.toLowerCase()] || {
      bg: 'bg-slate-100',
      text: 'text-slate-800',
    }
  );
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function exportToCSV(data: unknown[], filename: string): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0] as Record<string, unknown>);
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = (row as Record<string, unknown>)[header];
          return typeof value === 'string' && value.includes(',')
            ? `"${value}"`
            : value;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
