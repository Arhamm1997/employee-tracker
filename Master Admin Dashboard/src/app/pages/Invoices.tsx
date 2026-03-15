import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';

type InvoiceStatus = 'all' | 'PENDING' | 'PAID' | 'REJECTED';

interface AdminInvoice {
  id: string;
  invoiceNumber: string;
  companyId: string;
  companyName: string;
  companyEmail: string;
  planName: string;
  billingCycle: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  hasScreenshot: boolean;
  screenshotUrl: string | null;
  paidAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

interface InvoicesResponse {
  success: boolean;
  data: {
    invoices: AdminInvoice[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export default function Invoices() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus>('all');
  const [page, setPage] = useState(1);

  // Approve / Reject modal state
  const [rejectModal, setRejectModal] = useState<{ id: string; invoiceNumber: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [screenshotModal, setScreenshotModal] = useState<{ url: string; invoiceNumber: string } | null>(null);

  const { data, isLoading, error } = useQuery<InvoicesResponse>({
    queryKey: ['admin-invoices', statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await api.get(`/admin/invoices?${params}`);
      return res.data;
    },
    refetchInterval: 30000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/invoices/${id}/approve`),
    onSuccess: () => {
      toast.success('Payment approved! Subscription activated.');
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err.response?.data?.error || 'Approval failed');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/admin/invoices/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Invoice rejected. Email sent to company.');
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      setRejectModal(null);
      setRejectReason('');
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err.response?.data?.error || 'Rejection failed');
    },
  });

  const invoices = data?.data?.invoices ?? [];
  const totalPages = data?.data?.totalPages ?? 1;

  const statusTabs: { label: string; value: InvoiceStatus; color: string }[] = [
    { label: 'All', value: 'all', color: 'text-gray-600' },
    { label: 'Pending', value: 'PENDING', color: 'text-yellow-600' },
    { label: 'Paid', value: 'PAID', color: 'text-green-600' },
    { label: 'Rejected', value: 'REJECTED', color: 'text-red-600' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 text-sm mt-1">Payment verification aur invoice management</p>
        </div>
        <div className="text-sm text-gray-500">
          Total: <span className="font-semibold text-gray-900">{data?.data?.total ?? 0}</span>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              statusFilter === tab.value
                ? 'bg-white shadow-sm text-gray-900'
                : `${tab.color} hover:bg-white/50`
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="text-center py-16 text-gray-400">Loading invoices...</div>
        ) : error ? (
          <div className="text-center py-16 text-red-500">Failed to load invoices</div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No invoices found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Invoice #</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Company</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Plan</th>
                  <th className="text-right py-3 px-4 text-gray-500 font-medium">Amount</th>
                  <th className="text-center py-3 px-4 text-gray-500 font-medium">Method</th>
                  <th className="text-center py-3 px-4 text-gray-500 font-medium">Screenshot</th>
                  <th className="text-center py-3 px-4 text-gray-500 font-medium">Status</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Date</th>
                  <th className="text-center py-3 px-4 text-gray-500 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-gray-800 text-xs">{inv.invoiceNumber}</td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{inv.companyName}</p>
                        <p className="text-xs text-gray-400">{inv.companyEmail}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-gray-700">{inv.planName}</p>
                        <p className="text-xs text-gray-400 capitalize">{inv.billingCycle}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900">
                      {inv.currency} {inv.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {inv.paymentMethod ? (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full capitalize">
                          {inv.paymentMethod}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {inv.hasScreenshot && inv.screenshotUrl ? (
                        <button
                          onClick={() => setScreenshotModal({ url: `${API_URL}${inv.screenshotUrl}`, invoiceNumber: inv.invoiceNumber })}
                          className="text-xs text-indigo-600 hover:underline font-medium"
                        >
                          View
                        </button>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(inv.createdAt).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {inv.status === 'PENDING' && (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => approveMutation.mutate(inv.id)}
                            disabled={approveMutation.isPending}
                            className="bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            ✅ Approve
                          </button>
                          <button
                            onClick={() => { setRejectModal({ id: inv.id, invoiceNumber: inv.invoiceNumber }); setRejectReason(''); }}
                            className="bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                          >
                            ❌ Reject
                          </button>
                        </div>
                      )}
                      {inv.status === 'PAID' && (
                        <span className="text-green-600 text-xs font-medium">
                          {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('en-PK', { month: 'short', day: 'numeric' }) : 'Paid'}
                        </span>
                      )}
                      {inv.status === 'REJECTED' && (
                        <span className="text-red-400 text-xs" title={inv.rejectionReason ?? ''}>
                          Rejected
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-6 py-4 border-t border-gray-100">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              ← Prev
            </button>
            <span className="text-sm text-gray-600">Page {page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              Next →
            </button>
          </div>
        )}
      </div>

      {/* ── Screenshot modal ──────────────────────────────────────────────── */}
      {screenshotModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setScreenshotModal(null)}>
          <div className="bg-white rounded-2xl overflow-hidden max-w-2xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">
                Payment Screenshot — {screenshotModal.invoiceNumber}
              </h3>
              <button onClick={() => setScreenshotModal(null)}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <img
                src={screenshotModal.url}
                alt="Payment screenshot"
                className="max-w-full h-auto rounded-lg mx-auto"
                onError={(e) => { (e.target as HTMLImageElement).alt = 'Failed to load image'; }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Reject modal ──────────────────────────────────────────────────── */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Reject Invoice</h3>
            <p className="text-gray-500 text-sm mb-4">
              Invoice <span className="font-mono font-semibold">{rejectModal.invoiceNumber}</span> reject karne ki wajah likhein.
              Company ko email bheji jayegi.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Rejection reason (e.g. Screenshot unclear, wrong amount...)"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => rejectMutation.mutate({ id: rejectModal.id, reason: rejectReason })}
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold disabled:opacity-60"
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    PAID: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
  };
  const icons: Record<string, string> = { PENDING: '🟡', PAID: '🟢', REJECTED: '🔴' };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {icons[status] ?? '⚪'} {status}
    </span>
  );
}
