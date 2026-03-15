import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';

interface PaymentSettings {
  id: string;
  bankName: string | null;
  bankIban: string | null;
  bankTitle: string | null;
  easypaisaNumber: string | null;
  easypaisaName: string | null;
  nayapayNumber: string | null;
  nayapayName: string | null;
  sadapayNumber: string | null;
  sadapayName: string | null;
  jsbankNumber: string | null;
  jsbankName: string | null;
  whatsappNumber: string | null;
  instructions: string | null;
  updatedAt: string;
}

interface SettingsResponse {
  success: boolean;
  data: PaymentSettings;
}

const empty: Omit<PaymentSettings, 'id' | 'updatedAt'> = {
  bankName: '',
  bankIban: '',
  bankTitle: '',
  easypaisaNumber: '',
  easypaisaName: '',
  nayapayNumber: '',
  nayapayName: '',
  sadapayNumber: '',
  sadapayName: '',
  jsbankNumber: '',
  jsbankName: '',
  whatsappNumber: '',
  instructions: '',
};

type FormState = typeof empty;

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
        <span className="text-xl">{icon}</span>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
      <label className="text-sm font-medium text-gray-600 pt-2">{label}</label>
      <div className="sm:col-span-2">{children}</div>
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
        mono ? 'font-mono' : ''
      }`}
    />
  );
}

function WalletPair({
  label,
  numberVal,
  nameVal,
  onNumber,
  onName,
  numberPlaceholder,
  namePlaceholder,
}: {
  label: string;
  numberVal: string;
  nameVal: string;
  onNumber: (v: string) => void;
  onName: (v: string) => void;
  numberPlaceholder?: string;
  namePlaceholder?: string;
}) {
  return (
    <FieldRow label={label}>
      <div className="grid grid-cols-2 gap-2">
        <Input value={numberVal} onChange={onNumber} placeholder={numberPlaceholder ?? '03XX-XXXXXXX'} mono />
        <Input value={nameVal} onChange={onName} placeholder={namePlaceholder ?? 'Account name'} />
      </div>
    </FieldRow>
  );
}

// ── Preview card ───────────────────────────────────────────────────────────────
function PreviewCard({ form }: { form: FormState }) {
  const hasBank = form.bankName || form.bankIban || form.bankTitle;
  const hasEasypaisa = form.easypaisaNumber;
  const hasNayaPay = form.nayapayNumber;
  const hasSadaPay = form.sadapayNumber;
  const hasJsBank = form.jsbankNumber;
  const hasWhatsApp = form.whatsappNumber;

  const nothing = !hasBank && !hasEasypaisa && !hasNayaPay && !hasSadaPay && !hasJsBank && !hasWhatsApp;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
        <span className="text-xl">👁️</span>
        <h2 className="text-base font-bold text-gray-900">Company Preview</h2>
        <span className="text-xs text-gray-400 ml-1">How companies will see it</span>
      </div>

      {nothing ? (
        <p className="text-sm text-gray-400 text-center py-6">Fill in payment details to see preview</p>
      ) : (
        <div className="space-y-3 text-sm">
          {hasBank && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-1">
              <p className="font-bold text-blue-800 text-xs uppercase tracking-wide mb-2">🏦 Bank Transfer</p>
              {form.bankName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Bank</span>
                  <span className="font-medium text-gray-800">{form.bankName}</span>
                </div>
              )}
              {form.bankTitle && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Account Title</span>
                  <span className="font-medium text-gray-800">{form.bankTitle}</span>
                </div>
              )}
              {form.bankIban && (
                <div className="flex justify-between">
                  <span className="text-gray-500">IBAN</span>
                  <span className="font-mono font-semibold text-gray-900 text-xs">{form.bankIban}</span>
                </div>
              )}
            </div>
          )}

          {(hasEasypaisa || hasNayaPay || hasSadaPay || hasJsBank) && (
            <div className="grid grid-cols-2 gap-2">
              {hasEasypaisa && (
                <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                  <p className="text-xs font-bold text-green-700 mb-1">📱 Easypaisa</p>
                  <p className="font-mono text-xs text-gray-800">{form.easypaisaNumber}</p>
                  {form.easypaisaName && <p className="text-xs text-gray-500 mt-0.5">{form.easypaisaName}</p>}
                </div>
              )}
              {hasNayaPay && (
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                  <p className="text-xs font-bold text-purple-700 mb-1">💜 NayaPay</p>
                  <p className="font-mono text-xs text-gray-800">{form.nayapayNumber}</p>
                  {form.nayapayName && <p className="text-xs text-gray-500 mt-0.5">{form.nayapayName}</p>}
                </div>
              )}
              {hasSadaPay && (
                <div className="bg-teal-50 border border-teal-100 rounded-xl p-3">
                  <p className="text-xs font-bold text-teal-700 mb-1">🟢 SadaPay</p>
                  <p className="font-mono text-xs text-gray-800">{form.sadapayNumber}</p>
                  {form.sadapayName && <p className="text-xs text-gray-500 mt-0.5">{form.sadapayName}</p>}
                </div>
              )}
              {hasJsBank && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                  <p className="text-xs font-bold text-orange-700 mb-1">🏦 JS Bank</p>
                  <p className="font-mono text-xs text-gray-800">{form.jsbankNumber}</p>
                  {form.jsbankName && <p className="text-xs text-gray-500 mt-0.5">{form.jsbankName}</p>}
                </div>
              )}
            </div>
          )}

          {hasWhatsApp && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex items-center gap-3">
              <span className="text-xl">💬</span>
              <div>
                <p className="text-xs font-bold text-green-800">WhatsApp Confirmation</p>
                <p className="font-mono text-xs text-gray-700">{form.whatsappNumber}</p>
              </div>
            </div>
          )}

          {form.instructions && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <p className="text-xs font-bold text-yellow-800 mb-1">📋 Instructions</p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap">{form.instructions}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function PaymentSettings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({ ...empty });
  const [isDirty, setIsDirty] = useState(false);

  const { data, isLoading, error } = useQuery<SettingsResponse>({
    queryKey: ['admin-payment-settings'],
    queryFn: async () => {
      const res = await api.get('/admin/payment-settings');
      return res.data;
    },
  });

  // Populate form when data arrives
  useEffect(() => {
    if (data?.data) {
      const s = data.data;
      setForm({
        bankName: s.bankName ?? '',
        bankIban: s.bankIban ?? '',
        bankTitle: s.bankTitle ?? '',
        easypaisaNumber: s.easypaisaNumber ?? '',
        easypaisaName: s.easypaisaName ?? '',
        nayapayNumber: s.nayapayNumber ?? '',
        nayapayName: s.nayapayName ?? '',
        sadapayNumber: s.sadapayNumber ?? '',
        sadapayName: s.sadapayName ?? '',
        jsbankNumber: s.jsbankNumber ?? '',
        jsbankName: s.jsbankName ?? '',
        whatsappNumber: s.whatsappNumber ?? '',
        instructions: s.instructions ?? '',
      });
      setIsDirty(false);
    }
  }, [data]);

  const set = (key: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => api.put('/admin/payment-settings', form),
    onSuccess: () => {
      toast.success('Payment settings saved!');
      queryClient.invalidateQueries({ queryKey: ['admin-payment-settings'] });
      setIsDirty(false);
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err.response?.data?.error || 'Failed to save settings');
    },
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-100 rounded w-1/3" />
          <div className="h-40 bg-gray-100 rounded" />
          <div className="h-40 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
          Failed to load payment settings. Please refresh.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Settings</h1>
          <p className="text-gray-500 text-sm mt-1">
            Configure payment accounts shown to companies when they pay for a subscription.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data?.data?.updatedAt && (
            <span className="text-xs text-gray-400">
              Last saved:{' '}
              {new Date(data.data.updatedAt).toLocaleString('en-PK', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !isDirty}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saveMutation.isPending ? (
              <>
                <span className="animate-spin">⏳</span> Saving...
              </>
            ) : (
              <>💾 Save Settings</>
            )}
          </button>
        </div>
      </div>

      {isDirty && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-amber-800 text-sm flex items-center gap-2">
          <span>⚠️</span>
          <span>You have unsaved changes. Click <strong>Save Settings</strong> to apply.</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ── Left: form ─────────────────────────────────────────────────────── */}
        <div className="xl:col-span-3 space-y-6">

          {/* Bank Transfer */}
          <Section title="Bank Transfer" icon="🏦">
            <FieldRow label="Bank Name">
              <Input value={form.bankName ?? ''} onChange={set('bankName')} placeholder="e.g. Meezan Bank, HBL..." />
            </FieldRow>
            <FieldRow label="Account Title">
              <Input value={form.bankTitle ?? ''} onChange={set('bankTitle')} placeholder="e.g. StaffTrack Pvt Ltd" />
            </FieldRow>
            <FieldRow label="IBAN">
              <Input
                value={form.bankIban ?? ''}
                onChange={set('bankIban')}
                placeholder="PK00XXXX0000000000000000"
                mono
              />
            </FieldRow>
          </Section>

          {/* Mobile Wallets */}
          <Section title="Mobile Wallets" icon="📱">
            <WalletPair
              label="Easypaisa"
              numberVal={form.easypaisaNumber ?? ''}
              nameVal={form.easypaisaName ?? ''}
              onNumber={set('easypaisaNumber')}
              onName={set('easypaisaName')}
            />
            <WalletPair
              label="NayaPay"
              numberVal={form.nayapayNumber ?? ''}
              nameVal={form.nayapayName ?? ''}
              onNumber={set('nayapayNumber')}
              onName={set('nayapayName')}
            />
            <WalletPair
              label="SadaPay"
              numberVal={form.sadapayNumber ?? ''}
              nameVal={form.sadapayName ?? ''}
              onNumber={set('sadapayNumber')}
              onName={set('sadapayName')}
            />
            <WalletPair
              label="JS Bank"
              numberVal={form.jsbankNumber ?? ''}
              nameVal={form.jsbankName ?? ''}
              onNumber={set('jsbankNumber')}
              onName={set('jsbankName')}
            />
            <p className="text-xs text-gray-400 pt-1">
              Number format: 03XX-XXXXXXX &nbsp;•&nbsp; Leave blank to hide that wallet option
            </p>
          </Section>

          {/* WhatsApp */}
          <Section title="WhatsApp Confirmation" icon="💬">
            <FieldRow label="WhatsApp Number">
              <Input
                value={form.whatsappNumber ?? ''}
                onChange={set('whatsappNumber')}
                placeholder="923XXXXXXXXX (with country code, no +)"
                mono
              />
            </FieldRow>
            <p className="text-xs text-gray-400">
              Companies will see a &quot;Confirm on WhatsApp&quot; button linking to this number with a pre-filled
              message containing their invoice ID and amount.
            </p>
          </Section>

          {/* After-payment instructions */}
          <Section title="After Payment Instructions" icon="📋">
            <textarea
              value={form.instructions ?? ''}
              onChange={(e) => { setForm((p) => ({ ...p, instructions: e.target.value })); setIsDirty(true); }}
              placeholder={`e.g.\n1. Send screenshot on WhatsApp\n2. Include Invoice ID in message\n3. Payment verified within 24 hours`}
              rows={5}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
            <p className="text-xs text-gray-400">
              Shown to companies in a yellow info box on the payment page.
            </p>
          </Section>
        </div>

        {/* ── Right: live preview ─────────────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-4">
          <PreviewCard form={form} />

          {/* Tips */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 space-y-2">
            <p className="text-sm font-semibold text-blue-800">💡 Tips</p>
            <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
              <li>Leave any section blank to hide it from the payment page</li>
              <li>IBAN format: start with PK then 22 characters</li>
              <li>WhatsApp number must include country code (e.g. 923001234567)</li>
              <li>Instructions support line breaks — use short numbered steps</li>
              <li>Changes take effect immediately for new invoices</li>
            </ul>
          </div>

          {/* Save shortcut */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
            <p className="text-xs text-gray-500 font-medium mb-3">Quick Actions</p>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !isDirty}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {saveMutation.isPending ? 'Saving...' : '💾 Save Settings'}
            </button>
            {!isDirty && (
              <p className="text-xs text-center text-gray-400 mt-2">No unsaved changes</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
