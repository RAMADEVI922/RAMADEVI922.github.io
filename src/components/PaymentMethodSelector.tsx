import { useState } from 'react';
import { useRestaurantStore } from '@/store/restaurantStore';
import { CreditCard, Banknote, ExternalLink } from 'lucide-react';

interface PaymentMethodSelectorProps {
  orderId: string;
  onSelect?: (method: 'cash' | 'online') => void;
  selectedMethod?: 'cash' | 'online';
}

const PROVIDERS = [
  {
    id: 'phonepe',
    label: 'PhonePe',
    color: 'border-purple-400 bg-purple-50 text-purple-700',
    dot: 'bg-purple-500',
    btnColor: 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white',
  },
  {
    id: 'gpay',
    label: 'GPay',
    color: 'border-blue-400 bg-blue-50 text-blue-700',
    dot: 'bg-blue-500',
    btnColor: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white',
  },
  {
    id: 'paytm',
    label: 'Paytm',
    color: 'border-sky-400 bg-sky-50 text-sky-700',
    dot: 'bg-sky-500',
    btnColor: 'bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white',
  },
];

// Build-time fallback UPI IDs from env — always available on every device
const ENV_UPI: Record<string, string> = {
  phonepe: import.meta.env.VITE_UPI_PHONEPE || '',
  gpay:    import.meta.env.VITE_UPI_GPAY    || '',
  paytm:   import.meta.env.VITE_UPI_PAYTM   || '',
};

// Build UPI deep link with amount pre-filled
// Falls back to standard upi:// if no provider-specific scheme
function buildDeepLink(provider: string, upiId: string, amount: number): string {
  const base = `pa=${encodeURIComponent(upiId)}&pn=Restaurant&am=${amount.toFixed(2)}&cu=INR&tn=TablePayment`;
  if (provider === 'phonepe') return `phonepe://pay?${base}`;
  if (provider === 'gpay') return `tez://upi/pay?${base}`;
  // Paytm and generic fallback
  return `upi://pay?${base}`;
}

export function PaymentMethodSelector({ orderId, onSelect, selectedMethod: initialMethod }: PaymentMethodSelectorProps) {
  const { updateOrderPaymentMethod, paymentQRCodes, paymentUPIIds, orders } = useRestaurantStore();
  const [selectedMethod, setSelectedMethod] = useState<'cash' | 'online' | null>(initialMethod || null);
  const [activeProvider, setActiveProvider] = useState<string>(() => {
    return PROVIDERS.find((p) => paymentQRCodes[p.id])?.id || PROVIDERS[0].id;
  });

  const order = orders.find((o) => o.id === orderId);
  const total = order?.total ?? 0;

  const handleSelectMethod = (method: 'cash' | 'online') => {
    setSelectedMethod(method);
    updateOrderPaymentMethod(orderId, method);
    onSelect?.(method);
  };

  const hasAnyQR = PROVIDERS.some((p) => paymentQRCodes[p.id]);
  const activeProviderInfo = PROVIDERS.find((p) => p.id === activeProvider)!;
  // Use store value first, fall back to build-time env constant
  const activeUPIId = paymentUPIIds[activeProvider] || ENV_UPI[activeProvider] || '';
  const hasQR = !!paymentQRCodes[activeProvider];

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-base">Payment Method</h3>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleSelectMethod('cash')}
          className={`p-4 rounded-xl border-2 transition-all ${
            selectedMethod === 'cash' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
        >
          <Banknote className="h-6 w-6 mx-auto mb-2" />
          <p className="text-sm font-medium">Cash on Delivery</p>
        </button>

        <button
          onClick={() => handleSelectMethod('online')}
          className={`p-4 rounded-xl border-2 transition-all ${
            selectedMethod === 'online' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
          }`}
        >
          <CreditCard className="h-6 w-6 mx-auto mb-2" />
          <p className="text-sm font-medium">Online Payment</p>
        </button>
      </div>

      {selectedMethod === 'cash' && (
        <div className="p-3 bg-green-500/10 border border-green-200 rounded-xl">
          <p className="text-sm text-green-700">✓ Cash payment selected. The waiter will collect payment when serving.</p>
        </div>
      )}

      {selectedMethod === 'online' && (
        <div className="space-y-3">
          {/* Provider tabs */}
          <div className="flex gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveProvider(p.id)}
                className={`flex-1 py-2 px-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                  activeProvider === p.id
                    ? p.color + ' border-2'
                    : 'border-border text-muted-foreground hover:border-primary/40'
                }`}
              >
                {paymentQRCodes[p.id] && (
                  <span className={`inline-block h-2 w-2 rounded-full ${p.dot} mr-1.5 align-middle`} />
                )}
                {p.label}
              </button>
            ))}
          </div>

          {/* QR + App button */}
          <div className="flex flex-col items-center p-5 bg-white border border-border rounded-2xl shadow-sm">
            {hasQR && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Scan to pay via {activeProviderInfo.label}
                </p>
                <img
                  src={paymentQRCodes[activeProvider]}
                  alt={`${activeProvider} QR`}
                  className="w-52 h-52 object-contain rounded-xl border border-border"
                />
                <p className="text-xs text-muted-foreground mt-2 mb-2 text-center">
                  Scan with your {activeProviderInfo.label} app to pay
                </p>
              </>
            )}

            {activeUPIId ? (
              <a
                href={buildDeepLink(activeProvider, activeUPIId, total)}
                className={`w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl font-bold text-base transition-all shadow-md ${activeProviderInfo.btnColor}`}
              >
                <ExternalLink className="h-5 w-5 shrink-0" />
                Pay ₹{total.toLocaleString('en-IN')} via {activeProviderInfo.label}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                Payment not configured. Please pay via cash or ask the waiter.
              </p>
            )}
          </div>
        </div>
      )}

      {!selectedMethod && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-200 rounded-xl">
          <p className="text-sm text-yellow-700">Please select a payment method to proceed.</p>
        </div>
      )}
    </div>
  );
}
