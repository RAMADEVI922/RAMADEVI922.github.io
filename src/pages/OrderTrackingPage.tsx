import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useRestaurantStore } from '@/store/restaurantStore';
import { fetchOrders, fetchNotifications, upsertNotification } from '@/lib/firebaseService';
import type { FirebaseOrder, FirebaseNotification } from '@/lib/firebaseService';
import { formatOrderTime } from '@/lib/orderUtils';
import { CheckCircle2, Clock, ChefHat, Utensils, ShoppingBag, RefreshCw, CreditCard, Banknote, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'served';

const STEPS: { key: OrderStatus | 'placed'; label: string; sub: string; icon: React.ReactNode }[] = [
  { key: 'placed',    label: 'Order Placed',    sub: 'We received your order',         icon: <ShoppingBag className="h-5 w-5" /> },
  { key: 'confirmed', label: 'Confirmed',        sub: 'Kitchen accepted your order',    icon: <CheckCircle2 className="h-5 w-5" /> },
  { key: 'preparing', label: 'Preparing',        sub: 'Chef is cooking your food',      icon: <ChefHat className="h-5 w-5" /> },
  { key: 'served',    label: 'Ready to Serve',   sub: 'Your food is on the way!',       icon: <Utensils className="h-5 w-5" /> },
];

function stepIndex(status: OrderStatus): number {
  if (status === 'pending')   return 0;
  if (status === 'confirmed') return 1;
  if (status === 'preparing') return 2;
  if (status === 'served')    return 3;
  return 0;
}

const PROVIDERS = [
  { id: 'phonepe', label: 'PhonePe', color: 'border-purple-400 bg-purple-50 text-purple-700', dot: 'bg-purple-500', btnColor: 'bg-purple-600 hover:bg-purple-700 text-white' },
  { id: 'gpay',    label: 'GPay',    color: 'border-blue-400 bg-blue-50 text-blue-700',       dot: 'bg-blue-500',   btnColor: 'bg-blue-600 hover:bg-blue-700 text-white' },
  { id: 'paytm',   label: 'Paytm',   color: 'border-sky-400 bg-sky-50 text-sky-700',          dot: 'bg-sky-500',    btnColor: 'bg-sky-500 hover:bg-sky-600 text-white' },
];

const ENV_UPI: Record<string, string> = {
  phonepe: import.meta.env.VITE_UPI_PHONEPE || '',
  gpay:    import.meta.env.VITE_UPI_GPAY    || '',
  paytm:   import.meta.env.VITE_UPI_PAYTM   || '',
};

function buildDeepLink(provider: string, upiId: string, amount: number): string {
  const base = `pa=${encodeURIComponent(upiId)}&pn=Restaurant&am=${amount.toFixed(2)}&cu=INR&tn=TablePayment`;
  if (provider === 'phonepe') return `phonepe://pay?${base}`;
  if (provider === 'gpay') return `tez://upi/pay?${base}`;
  return `upi://pay?${base}`;
}

// ── Payment Modal ─────────────────────────────────────────────────────────────
interface PaymentModalProps {
  order: { id: string; tableId: string; items: Array<{ id: string; name: string; price: number; quantity: number }>; total: number; paymentMethod?: string };
  onCash: () => void;
  onOnlinePaid: () => void;
}

function PaymentModal({ order, onCash, onOnlinePaid }: PaymentModalProps) {
  const { paymentQRCodes, paymentUPIIds, updateOrderPaymentMethod, confirmOnlinePayment } = useRestaurantStore();
  const [mode, setMode] = useState<'choose' | 'online' | 'cash_done'>('choose');
  const [activeProvider, setActiveProvider] = useState(PROVIDERS[0].id);

  const activeProviderInfo = PROVIDERS.find((p) => p.id === activeProvider)!;
  const activeUPIId = paymentUPIIds[activeProvider] || ENV_UPI[activeProvider] || '';
  const hasQR = !!paymentQRCodes[activeProvider];

  const handleCash = async () => {
    updateOrderPaymentMethod(order.id, 'cash');
    setMode('cash_done');
    // Build detailed cash notification for waiter
    const itemLines = order.items.map((i) => `${i.name} ×${i.quantity} — ₹${(i.price * i.quantity).toLocaleString('en-IN')}`).join('\n');
    const msg = `💵 CASH PAYMENT — Table ${order.tableId}\n${itemLines}\nTotal: ₹${order.total.toLocaleString('en-IN')}\nPlease collect cash from the customer.`;
    try {
      await upsertNotification({
        id: `N${order.tableId}_cash_${Date.now()}`,
        tableId: order.tableId,
        type: 'cash_payment',
        message: msg,
        read: false,
        createdAt: Date.now(),
      });
    } catch (_) {}
    onCash();
  };

  const handleOnlinePaid = () => {
    updateOrderPaymentMethod(order.id, 'online');
    confirmOnlinePayment(order.id);
    onOnlinePaid();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="p-5 border-b border-border">
          <div className="text-center">
            <div className="text-3xl mb-1">💳</div>
            <p className="text-xl font-bold">Time to Pay</p>
            <p className="text-muted-foreground text-sm mt-0.5">Your food has been served!</p>
          </div>
        </div>

        {/* Order summary */}
        <div className="px-5 py-4 bg-muted/30 border-b border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Your Order</p>
          <div className="space-y-1">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.name} <span className="text-muted-foreground">×{item.quantity}</span></span>
                <span className="font-medium">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold pt-2 border-t border-border text-base">
              <span>Total</span>
              <span>₹{order.total.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {mode === 'choose' && (
            <>
              <p className="text-sm font-semibold text-center text-muted-foreground">How would you like to pay?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode('online')}
                  className="p-4 rounded-xl border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-all flex flex-col items-center gap-2"
                >
                  <CreditCard className="h-7 w-7 text-primary" />
                  <p className="text-sm font-semibold">Online Payment</p>
                  <p className="text-xs text-muted-foreground">UPI / QR Code</p>
                </button>
                <button
                  onClick={handleCash}
                  className="p-4 rounded-xl border-2 border-border hover:border-green-400 hover:bg-green-50 transition-all flex flex-col items-center gap-2"
                >
                  <Banknote className="h-7 w-7 text-green-600" />
                  <p className="text-sm font-semibold">Cash</p>
                  <p className="text-xs text-muted-foreground">Pay to waiter</p>
                </button>
              </div>
            </>
          )}

          {mode === 'cash_done' && (
            <div className="text-center py-4 space-y-3">
              <div className="text-4xl">✅</div>
              <p className="font-bold text-lg">Waiter Notified</p>
              <p className="text-muted-foreground text-sm">Your waiter will come to collect the cash payment of ₹{order.total.toLocaleString('en-IN')}.</p>
            </div>
          )}

          {mode === 'online' && (
            <div className="space-y-4">
              <button onClick={() => setMode('choose')} className="text-xs text-primary underline">← Back</button>
              {/* Provider tabs */}
              <div className="flex gap-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setActiveProvider(p.id)}
                    className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                      activeProvider === p.id ? p.color : 'border-border text-muted-foreground'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col items-center p-4 bg-white border border-border rounded-2xl shadow-sm">
                {hasQR && (
                  <>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Scan to pay via {activeProviderInfo.label}
                    </p>
                    <img
                      src={paymentQRCodes[activeProvider]}
                      alt={`${activeProvider} QR`}
                      className="w-48 h-48 object-contain rounded-xl border border-border mb-2"
                    />
                  </>
                )}
                {activeUPIId ? (
                  <a
                    href={buildDeepLink(activeProvider, activeUPIId, order.total)}
                    className={`w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl font-bold text-base transition-all shadow-md ${activeProviderInfo.btnColor}`}
                  >
                    <ExternalLink className="h-5 w-5 shrink-0" />
                    Pay ₹{order.total.toLocaleString('en-IN')} via {activeProviderInfo.label}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">Payment not configured. Please pay cash.</p>
                )}
              </div>

              <Button
                onClick={handleOnlinePaid}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                <CheckCircle2 className="h-5 w-5 mr-2" />
                I've Paid — Show Receipt
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function OrderTrackingPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { orders, setOrders, confirmOnlinePayment, updateOrderPaymentMethod } = useRestaurantStore();
  const [refreshing, setRefreshing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const prevStatusRef = useRef<OrderStatus | null>(null);
  const seenPaymentRequestRef = useRef(false);

  const order = orders.find(
    (o) => o.tableId === tableId && o.status !== 'served'
  ) ?? orders.filter((o) => o.tableId === tableId).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0] ?? null;

  // Poll Firestore every 30s
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const [rawOrders, rawNotifs] = await Promise.all([fetchOrders(), fetchNotifications()]);
        if (cancelled) return;

        const updated = rawOrders.map((o: FirebaseOrder) => ({
          ...o,
          createdAt: new Date(o.createdAt),
          readyAt: o.readyAt ?? Date.now(),
        }));
        const store = useRestaurantStore.getState();
        const firestoreIds = new Set(updated.map((o: any) => o.id));
        const localOnly = store.orders.filter((o) => !firestoreIds.has(o.id));
        setOrders([...updated, ...localOnly] as any);

        // Check for payment_request notification for this table
        if (!seenPaymentRequestRef.current && !paymentDone) {
          const payReq = (rawNotifs as FirebaseNotification[]).find(
            (n) => n.tableId === tableId && n.type === 'payment_request' && !n.read
          );
          if (payReq) {
            seenPaymentRequestRef.current = true;
            setShowPaymentModal(true);
            // Mark it read so it doesn't re-trigger
            try {
              await upsertNotification({ ...payReq, read: true });
            } catch (_) {}
          }
        }
      } catch (e) {
        console.warn('[OrderTracking] poll failed:', e);
      }
    };

    poll();
    const interval = setInterval(poll, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [setOrders, tableId, paymentDone]);

  // Toast when status changes
  useEffect(() => {
    if (!order) return;
    const s = order.status as OrderStatus;
    if (prevStatusRef.current && prevStatusRef.current !== s) {
      const messages: Record<string, string> = {
        confirmed: '✅ Your order has been confirmed!',
        preparing: '👨‍🍳 Chef is now preparing your food!',
        served:    '🍽️ Your food is ready and on the way!',
      };
      if (messages[s]) toast.success(messages[s], { duration: 5000 });
    }
    prevStatusRef.current = s;
  }, [order?.status]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const raw = await fetchOrders();
      const updated = raw.map((o: FirebaseOrder) => ({
        ...o,
        createdAt: new Date(o.createdAt),
        readyAt: o.readyAt ?? Date.now(),
      }));
      const store = useRestaurantStore.getState();
      const firestoreIds = new Set(updated.map((o: any) => o.id));
      const localOnly = store.orders.filter((o) => !firestoreIds.has(o.id));
      setOrders([...updated, ...localOnly] as any);
      toast.success('Status updated');
    } catch {
      toast.error('Could not refresh');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCashSelected = () => {
    setShowPaymentModal(false);
    setPaymentDone(true);
    toast.success('Waiter notified — they will collect cash shortly');
  };

  const handleOnlinePaid = () => {
    setShowPaymentModal(false);
    setPaymentDone(true);
    navigate(`/order-summary/${tableId}`);
  };

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-xl font-bold mb-2">No active order</p>
          <p className="text-muted-foreground mb-6">Place an order first to track it here.</p>
          <Button onClick={() => navigate(`/menu/${tableId}`)}>Go to Menu</Button>
        </div>
      </div>
    );
  }

  const currentStep = stepIndex(order.status as OrderStatus);
  const isServed = order.status === 'served';

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-background">
      {/* Payment modal overlay */}
      {showPaymentModal && order && (
        <PaymentModal
          order={order}
          onCash={handleCashSelected}
          onOnlinePaid={handleOnlinePaid}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Table</p>
            <p className="text-xl font-bold">#{tableId}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Order Time</p>
            <p className="text-sm font-semibold">{formatOrderTime(order.createdAt)}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-8">
        {/* Status headline */}
        <div className="text-center">
          {isServed ? (
            <>
              <div className="text-5xl mb-3">🍽️</div>
              <p className="text-2xl font-bold text-green-600">Food is Ready!</p>
              <p className="text-muted-foreground mt-1">Your waiter is bringing it to you</p>
            </>
          ) : order.status === 'preparing' ? (
            <>
              <div className="text-5xl mb-3">👨‍🍳</div>
              <p className="text-2xl font-bold">Being Prepared</p>
              <p className="text-muted-foreground mt-1">Chef is cooking your order</p>
            </>
          ) : order.status === 'confirmed' ? (
            <>
              <div className="text-5xl mb-3">✅</div>
              <p className="text-2xl font-bold">Order Confirmed</p>
              <p className="text-muted-foreground mt-1">Kitchen has accepted your order</p>
            </>
          ) : (
            <>
              <div className="text-5xl mb-3">🛎️</div>
              <p className="text-2xl font-bold">Order Received</p>
              <p className="text-muted-foreground mt-1">Waiting for kitchen to confirm</p>
            </>
          )}
        </div>

        {/* Progress stepper */}
        <div className="bg-white rounded-2xl border border-border p-6 shadow-sm">
          <div className="relative">
            <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-border" />
            <div
              className="absolute left-5 top-5 w-0.5 bg-primary transition-all duration-700"
              style={{ height: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
            />
            <div className="space-y-6">
              {STEPS.map((step, i) => {
                const done = i < currentStep;
                const active = i === currentStep;
                const future = i > currentStep;
                return (
                  <div key={step.key} className="flex items-start gap-4 relative">
                    <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-500 shrink-0 ${
                      done   ? 'bg-primary border-primary text-white' :
                      active ? 'bg-primary border-primary text-white shadow-lg shadow-primary/30 scale-110' :
                               'bg-background border-border text-muted-foreground'
                    }`}>
                      {done ? <CheckCircle2 className="h-5 w-5" /> : step.icon}
                    </div>
                    <div className={`pt-1.5 transition-all duration-300 ${future ? 'opacity-40' : ''}`}>
                      <p className={`font-semibold text-sm ${active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step.label}
                        {active && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-primary">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                            Now
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Order items summary */}
        <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
          <p className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wider">Your Order</p>
          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>{item.name} <span className="text-muted-foreground">× {item.quantity}</span></span>
                <span className="font-medium">₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold pt-2 border-t border-border text-base">
              <span>Total</span>
              <span>₹{order.total.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Pay now button (if served and modal was dismissed) */}
        {isServed && !showPaymentModal && !paymentDone && (
          <Button
            className="w-full bg-primary text-white"
            size="lg"
            onClick={() => setShowPaymentModal(true)}
          >
            <CreditCard className="h-5 w-5 mr-2" />
            Pay Now — ₹{order.total.toLocaleString('en-IN')}
          </Button>
        )}

        {/* Refresh + actions */}
        <div className="space-y-3">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/30 transition-all"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Status'}
          </button>
          <p className="text-center text-xs text-muted-foreground">Auto-refreshes every 30 seconds</p>
          <Button variant="outline" className="w-full" onClick={() => navigate(`/order-summary/${tableId}`)}>
            View Order Summary & Payment
          </Button>
        </div>
      </div>
    </div>
  );
}
