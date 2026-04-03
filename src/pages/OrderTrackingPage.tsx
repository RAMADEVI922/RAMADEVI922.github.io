import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useRestaurantStore } from '@/store/restaurantStore';
import { fetchOrders, fetchNotifications, upsertNotification } from '@/lib/firebaseService';
import type { FirebaseOrder, FirebaseNotification } from '@/lib/firebaseService';
import { formatOrderTime } from '@/lib/orderUtils';
import { predictWaitTime } from '@/lib/aiPriority';
import { CheckCircle2, Clock, ChefHat, Utensils, ShoppingBag, RefreshCw, CreditCard, Banknote, ExternalLink, Users, Star, Receipt, Tag, Loader2 } from 'lucide-react';
import { validateCoupon, incrementCouponUsage } from '@/lib/firebaseService';
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
  order: { id: string; tableId: string; items: Array<{ id: string; name: string; price: number; quantity: number }>; total: number; paymentMethod?: string; splitCount?: number };
  onCash: () => void;
  onOnlinePaid: () => void;
}

function PaymentModal({ order, onCash, onOnlinePaid }: PaymentModalProps) {
  const { paymentQRCodes, paymentUPIIds, updateOrderPaymentMethod, confirmOnlinePayment, setSplitCount } = useRestaurantStore();
  const [mode, setMode] = useState<'choose' | 'online' | 'cash_done' | 'split' | 'bill_mobile'>('choose');
  const [activeProvider, setActiveProvider] = useState(PROVIDERS[0].id);
  const [splitPeople, setSplitPeople] = useState(order.splitCount || 2);
  const [mobileNumber, setMobileNumber] = useState('');
  const [mobileSent, setMobileSent] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState<{ code: string; discount: number; id: string } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');

  const discountedTotal = couponApplied
    ? Math.round(order.total * (1 - couponApplied.discount / 100))
    : order.total;
  const perPerson = Math.ceil(discountedTotal / splitPeople);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError('');
    try {
      const result = await validateCoupon(couponCode, order.total);
      if (!result) {
        setCouponError('Could not validate coupon — check connection');
      } else if ('error' in result) {
        setCouponError(result.error);
      } else {
        setCouponApplied({ code: result.code, discount: result.discount, id: result.id });
        setCouponError('');
      }
    } catch {
      setCouponError('Could not validate coupon');
    } finally {
      setCouponLoading(false);
    }
  };

  const activeProviderInfo = PROVIDERS.find((p) => p.id === activeProvider)!;
  const activeUPIId = paymentUPIIds[activeProvider] || ENV_UPI[activeProvider] || '';
  const hasQR = !!paymentQRCodes[activeProvider];

  const handleCash = async () => {
    updateOrderPaymentMethod(order.id, 'cash');
    setMode('cash_done');
    const itemLines = order.items.map((i) => `${i.name} ×${i.quantity} — ₹${(i.price * i.quantity).toLocaleString('en-IN')}`).join('\n');
    const splitNote = splitPeople > 1 ? `\nSplit: ${splitPeople} people × ₹${perPerson.toLocaleString('en-IN')}` : '';
    const discountNote = couponApplied ? `\nCoupon: ${couponApplied.code} (${couponApplied.discount}% off) → ₹${discountedTotal.toLocaleString('en-IN')}` : '';
    const msg = `💵 CASH PAYMENT — Table ${order.tableId}\n${itemLines}\nTotal: ₹${discountedTotal.toLocaleString('en-IN')}${discountNote}${splitNote}\nPlease collect cash from the customer.`;
    try {
      await upsertNotification({
        id: `N${order.tableId}_cash_${Date.now()}`,
        tableId: order.tableId,
        type: 'cash_payment',
        message: msg,
        read: false,
        createdAt: Date.now(),
      });
      if (couponApplied) await incrementCouponUsage(couponApplied.id);
    } catch (_) {}
    onCash();
  };

  const handleOnlinePaid = async () => {
    updateOrderPaymentMethod(order.id, 'online');
    confirmOnlinePayment(order.id);
    if (couponApplied) await incrementCouponUsage(couponApplied.id).catch(() => {});
    onOnlinePaid();
  };

  const handleSendMobileForBill = async () => {
    if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
      toast.error('Enter a valid 10-digit mobile number'); return;
    }
    try {
      await upsertNotification({
        id: `N${order.tableId}_bill_mobile_${Date.now()}`,
        tableId: order.tableId,
        type: 'request_bill',
        message: `🧾 Bill request — Table ${order.tableId}\nMobile: ${mobileNumber}\nTotal: ₹${order.total.toLocaleString('en-IN')}`,
        read: false,
        createdAt: Date.now(),
      });
      setMobileSent(true);
      toast.success('Waiter notified — bill coming shortly');
    } catch (_) {
      toast.error('Failed to send request');
    }
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
            {couponApplied && (
              <div className="flex justify-between text-sm text-green-600 font-semibold">
                <span>Coupon ({couponApplied.code}) -{couponApplied.discount}%</span>
                <span>-₹{(order.total - discountedTotal).toLocaleString('en-IN')}</span>
              </div>
            )}
            {couponApplied && (
              <div className="flex justify-between font-bold text-green-700 text-base border-t border-green-200 pt-1">
                <span>You Pay</span>
                <span>₹{discountedTotal.toLocaleString('en-IN')}</span>
              </div>
            )}
            {splitPeople > 1 && (
              <div className="flex justify-between text-sm text-primary font-semibold pt-1">
                <span>Per person ({splitPeople} people)</span>
                <span>₹{perPerson.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {mode === 'choose' && (
            <>
              {/* Coupon code */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" /> Have a coupon?
                </label>
                {couponApplied ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-green-50 border border-green-300">
                    <span className="text-sm font-bold text-green-700">✓ {couponApplied.code} — {couponApplied.discount}% off applied!</span>
                    <button onClick={() => setCouponApplied(null)} className="text-xs text-green-600 underline">Remove</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                      placeholder="Enter coupon code"
                      className="flex-1 border border-border rounded-xl px-3 py-2 text-sm font-mono font-bold focus:ring-2 focus:ring-primary/50 outline-none"
                    />
                    <Button size="sm" variant="outline" onClick={handleApplyCoupon} disabled={couponLoading || !couponCode.trim()} className="shrink-0">
                      {couponLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply'}
                    </Button>
                  </div>
                )}
                {couponError && <p className="text-xs text-red-500">{couponError}</p>}
              </div>
              {/* Bill split toggle */}
              <button
                onClick={() => setMode('split')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/30 transition-all"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="h-4 w-4 text-primary" />
                  Split Bill
                </div>
                <span className="text-xs text-muted-foreground">
                  {splitPeople > 1 ? `${splitPeople} people · ₹${perPerson}/each` : 'Tap to split'}
                </span>
              </button>

              {/* Need bill */}
              <button
                onClick={() => setMode('bill_mobile')}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/30 transition-all"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Receipt className="h-4 w-4 text-orange-500" />
                  Need a Bill?
                </div>
                <span className="text-xs text-muted-foreground">Enter mobile number</span>
              </button>

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

          {/* Bill split screen */}
          {mode === 'split' && (
            <div className="space-y-4">
              <button onClick={() => setMode('choose')} className="text-xs text-primary underline">← Back</button>
              <p className="font-semibold text-center">Split Bill Between</p>
              <div className="flex items-center justify-center gap-6">
                <button
                  onClick={() => setSplitPeople((p) => Math.max(1, p - 1))}
                  className="h-10 w-10 rounded-full border-2 border-border text-xl font-bold hover:bg-muted/30 transition-all"
                >−</button>
                <div className="text-center">
                  <p className="text-4xl font-bold">{splitPeople}</p>
                  <p className="text-xs text-muted-foreground">people</p>
                </div>
                <button
                  onClick={() => setSplitPeople((p) => Math.min(20, p + 1))}
                  className="h-10 w-10 rounded-full border-2 border-border text-xl font-bold hover:bg-muted/30 transition-all"
                >+</button>
              </div>
              <div className="bg-primary/5 rounded-xl p-4 text-center">
                <p className="text-sm text-muted-foreground">Each person pays</p>
                <p className="text-3xl font-bold text-primary">₹{perPerson.toLocaleString('en-IN')}</p>
                <p className="text-xs text-muted-foreground mt-1">Total ₹{order.total.toLocaleString('en-IN')} ÷ {splitPeople}</p>
              </div>
              <Button
                onClick={() => { setSplitCount(order.id, splitPeople); setMode('choose'); }}
                className="w-full"
              >
                Confirm Split
              </Button>
            </div>
          )}

          {/* Bill mobile screen */}
          {mode === 'bill_mobile' && (
            <div className="space-y-4">
              <button onClick={() => setMode('choose')} className="text-xs text-primary underline">← Back</button>
              {mobileSent ? (
                <div className="text-center py-4 space-y-3">
                  <div className="text-4xl">✅</div>
                  <p className="font-bold text-lg">Waiter Notified</p>
                  <p className="text-sm text-muted-foreground">Your waiter will bring the bill to Table {order.tableId} shortly.</p>
                </div>
              ) : (
                <>
                  <p className="font-semibold text-center">Enter your mobile number</p>
                  <p className="text-xs text-center text-muted-foreground">Your waiter will bring the bill to your table</p>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    className="w-full border border-border rounded-xl px-4 py-3 text-center text-lg font-bold tracking-widest focus:ring-2 focus:ring-primary/50 outline-none"
                  />
                  <Button
                    onClick={handleSendMobileForBill}
                    className="w-full"
                    disabled={mobileNumber.length < 10}
                  >
                    Request Bill
                  </Button>
                </>
              )}
            </div>
          )}

          {mode === 'cash_done' && (
            <div className="text-center py-4 space-y-3">
              <div className="text-4xl">✅</div>
              <p className="font-bold text-lg">Waiter Notified</p>
              <p className="text-muted-foreground text-sm">
                Your waiter will collect{' '}
                {splitPeople > 1
                  ? `₹${perPerson.toLocaleString('en-IN')} from each of ${splitPeople} people`
                  : `₹${order.total.toLocaleString('en-IN')}`}.
              </p>
            </div>
          )}

          {mode === 'online' && (
            <div className="space-y-4">
              <button onClick={() => setMode('choose')} className="text-xs text-primary underline">← Back</button>
              {splitPeople > 1 && (
                <div className="bg-primary/5 rounded-xl p-3 text-center text-sm">
                  <span className="font-semibold text-primary">Split: </span>
                  {splitPeople} people · ₹{perPerson.toLocaleString('en-IN')} each
                </div>
              )}
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
                    href={buildDeepLink(activeProvider, activeUPIId, splitPeople > 1 ? perPerson : order.total)}
                    className={`w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl font-bold text-base transition-all shadow-md ${activeProviderInfo.btnColor}`}
                  >
                    <ExternalLink className="h-5 w-5 shrink-0" />
                    Pay ₹{(splitPeople > 1 ? perPerson : order.total).toLocaleString('en-IN')} via {activeProviderInfo.label}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">Payment not configured. Please pay cash.</p>
                )}
              </div>
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
  const { orders, setOrders, confirmOnlinePayment, updateOrderPaymentMethod, setSplitCount } = useRestaurantStore();
  const [refreshing, setRefreshing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddMorePrompt, setShowAddMorePrompt] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const prevStatusRef = useRef<OrderStatus | null>(null);
  const seenPaymentRequestRef = useRef(false);

  // Always track the latest order for this table (including served ones)
  const order = orders
    .filter((o) => o.tableId === tableId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;

  // Poll Firestore every 10s
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

        // Only trigger payment modal if:
        // 1. Not already seen/done
        // 2. There's a payment_request notification for this table
        // 3. The notification was created AFTER the order was placed
        // 4. The order status is 'served' (waiter has actually marked it served)
        if (!seenPaymentRequestRef.current && !paymentDone) {
          const allTableOrders = updated.filter((o: any) => o.tableId === tableId);
          const latestOrder = allTableOrders.sort(
            (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];

          if (latestOrder && (latestOrder.status === 'served' || latestOrder.status === 'delivered')) {
            const orderTime = new Date(latestOrder.createdAt).getTime();
            const payReq = (rawNotifs as FirebaseNotification[]).find(
              (n) =>
                n.tableId === tableId &&
                n.type === 'payment_request' &&
                !n.read &&
                n.createdAt > orderTime // must be newer than the order
            );
            if (payReq) {
              seenPaymentRequestRef.current = true;
              // Show "add more items?" prompt first, then payment modal
              setShowAddMorePrompt(true);
              try {
                await upsertNotification({ ...payReq, read: true });
              } catch (_) {}
            }
          }
        }
      } catch (e) {
        console.warn('[OrderTracking] poll failed:', e);
      }
    };

    poll();
    const interval = setInterval(poll, 10_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [setOrders, tableId, paymentDone]);

  // Trap native back swipe/button while payment modal is open
  useEffect(() => {
    if (!showPaymentModal) return;
    // Push many dummy history entries so back gesture has many levels to consume
    for (let i = 0; i < 10; i++) {
      window.history.pushState({ paymentLock: true }, '');
    }
    const onPop = (e: PopStateEvent) => {
      // Always re-push to prevent navigation
      window.history.pushState({ paymentLock: true }, '');
      e.stopImmediatePropagation();
    };
    // Block beforeunload (tab close / refresh)
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Please complete your payment before leaving.';
      return e.returnValue;
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [showPaymentModal]);
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
      {/* Add more items prompt */}
      {showAddMorePrompt && !showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="text-center">
              <div className="text-4xl mb-2">🍽️</div>
              <p className="text-xl font-bold">Food is on the way!</p>
              <p className="text-muted-foreground text-sm mt-1">Your waiter will arrive in a few minutes.</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
              <p className="font-semibold text-sm">Would you like to add more items?</p>
              <p className="text-xs text-muted-foreground mt-1">You can order more before paying</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => navigate(`/menu/${tableId}`)}
                className="gap-2"
              >
                <ShoppingBag className="h-4 w-4" />
                Add More Items
              </Button>
              <Button
                onClick={() => { setShowAddMorePrompt(false); setShowPaymentModal(true); }}
                className="gap-2 bg-primary text-white"
              >
                <CreditCard className="h-4 w-4" />
                Pay Now
              </Button>
            </div>
          </div>
        </div>
      )}

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
              <div className="text-5xl mb-3">🚶</div>
              <p className="text-2xl font-bold text-green-600">Waiter is Coming!</p>
              <p className="text-muted-foreground mt-1">Your food is ready — waiter will arrive shortly</p>
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

        {/* Wait time prediction */}
        {!isServed && (
          (() => {
            const activeKitchenOrders = orders.filter(
              (o) => o.status === 'confirmed' || o.status === 'preparing'
            ).length;
            const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
            const wt = predictWaitTime(itemCount, activeKitchenOrders, order.status);
            return (
              <div className="bg-white rounded-2xl border border-border p-4 shadow-sm flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                  <Clock className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Estimated Wait</p>
                  <p className="text-xl font-bold text-orange-500">{wt.label}</p>
                  <p className="text-xs text-muted-foreground">Based on {activeKitchenOrders} active orders in kitchen</p>
                </div>
              </div>
            );
          })()
        )}

        {/* Feedback prompt after payment done */}
        {paymentDone && (
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-2xl border border-orange-200 p-5 text-center space-y-3">
            <div className="text-3xl">🌟</div>
            <p className="font-bold">Enjoyed your meal?</p>
            <p className="text-sm text-muted-foreground">Share your experience — it takes 30 seconds!</p>
            <Button
              onClick={() => navigate(`/feedback/${tableId}`)}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2"
            >
              <Star className="h-4 w-4" />
              Leave Feedback
            </Button>
          </div>
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
          <p className="text-center text-xs text-muted-foreground">Auto-refreshes every 10 seconds</p>
          <Button variant="outline" className="w-full" disabled={showPaymentModal} onClick={() => { if (!showPaymentModal) navigate(`/order-summary/${tableId}`); }}>
            View Order Summary & Payment
          </Button>
        </div>
      </div>
    </div>
  );
}
