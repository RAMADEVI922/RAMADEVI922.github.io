import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRestaurantStore } from '@/store/restaurantStore';
import { OrderItemsList } from '@/components/OrderItemsList';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { PaymentMethodSelector } from '@/components/PaymentMethodSelector';
import { calculateWaitingTime, formatOrderTime } from '@/lib/orderUtils';
import { sendBillEmail, isEmailConfigured } from '@/lib/emailService';
import { ArrowLeft, Plus, Mail, Loader2, Printer, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function OrderSummaryPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { setCurrentTableId, confirmOnlinePayment } = useRestaurantStore();
  const [waitingTime, setWaitingTime] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [notFoundTimer, setNotFoundTimer] = useState(false);
  const [email, setEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (tableId) setCurrentTableId(tableId);
  }, [tableId, setCurrentTableId]);

  const order = useRestaurantStore((state) =>
    tableId ? state.orders.find((o) => o.tableId === tableId && o.status !== 'served') ?? null : null
  );

  useEffect(() => {
    const timer = setTimeout(() => setNotFoundTimer(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!order) { if (notFoundTimer) setIsLoading(false); return; }
    setIsLoading(false);
    const update = () => setWaitingTime(calculateWaitingTime(order.createdAt));
    update();
    const interval = setInterval(update, 10000);
    return () => clearInterval(interval);
  }, [order, notFoundTimer]);

  if (isLoading || (!order && !notFoundTimer)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading order...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2">Order Not Found</h1>
          <p className="text-muted-foreground mb-6">We couldn't find an active order for this table.</p>
          <Button onClick={() => navigate(`/menu/${tableId}`)}>Back to Menu</Button>
        </div>
      </div>
    );
  }

  const isOnlinePaid = order.paymentMethod === 'online' && order.paymentStatus === 'paid';

  const handleSendBill = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    setSendingEmail(true);
    try {
      await sendBillEmail({
        toEmail: email,
        tableId: tableId!,
        orderId: order.id,
        items: order.items,
        total: order.total,
        paymentMethod: order.paymentMethod || 'cash',
        orderTime: formatOrderTime(order.createdAt),
      });
      setEmailSent(true);
      toast.success(`Bill sent to ${email}`);
    } catch (e: any) {
      toast.error(`Failed to send email: ${e?.message || 'Please try again'}`);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleIvePaid = () => {
    confirmOnlinePayment(order.id);
    toast.success('Payment confirmed! Thank you.');
    // Trigger print immediately
    setTimeout(() => handlePrintReceipt(), 300);
  };

  const handleCompleteOrder = () => {
    if (!order.paymentMethod) { toast.error('Please select a payment method'); return; }
    toast.success('Order placed! Enjoy your meal.');
    navigate(`/menu/${tableId}`, { replace: true });
  };

  const handlePrintReceipt = () => {
    const itemsRows = order.items
      .map((i) => `<tr>
        <td style="padding:4px 0">${i.name}</td>
        <td style="padding:4px 8px;text-align:center">${i.quantity}</td>
        <td style="padding:4px 0;text-align:right">&#8377;${(i.price * i.quantity).toLocaleString('en-IN')}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Receipt - Table ${tableId}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Courier New',monospace;font-size:13px;width:300px;margin:0 auto;padding:16px}
  .center{text-align:center}.bold{font-weight:bold}
  .divider{border-top:1px dashed #000;margin:8px 0}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-weight:bold;padding:4px 0;border-bottom:1px solid #000}
  th:last-child,td:last-child{text-align:right}
  th:nth-child(2),td:nth-child(2){text-align:center}
  .total-row td{font-weight:bold;font-size:14px;padding-top:8px;border-top:1px solid #000}
  .footer{margin-top:16px;text-align:center;font-size:11px;color:#555}
  @media print{@page{margin:0;size:80mm auto}}
</style></head><body>
<div class="center bold" style="font-size:16px;margin-bottom:4px">QR Restaurant</div>
<div class="center" style="font-size:11px;color:#555;margin-bottom:12px">Thank you for dining with us!</div>
<div class="divider"></div>
<div style="margin:8px 0;font-size:12px">
  <div>Table: <strong>${tableId}</strong></div>
  <div>Order: <strong>${order.id}</strong></div>
  <div>Time: <strong>${formatOrderTime(order.createdAt)}</strong></div>
  <div>Payment: <strong>${order.paymentMethod === 'online' ? '✓ Online Payment (Paid)' : 'Cash on Delivery'}</strong></div>
</div>
<div class="divider"></div>
<table>
  <thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead>
  <tbody>${itemsRows}</tbody>
  <tfoot><tr class="total-row"><td colspan="2">TOTAL</td><td>&#8377;${order.total.toLocaleString('en-IN')}</td></tr></tfoot>
</table>
<div class="divider"></div>
<div class="footer"><div>Scan QR to reorder anytime</div><div style="margin-top:4px">qr-menu-19cd1.web.app</div></div>
<script>window.onload=()=>{window.print()}</script>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      const a = document.createElement('a');
      a.href = url; a.download = `receipt-${tableId}-${order.id}.html`; a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  // ── After online payment confirmed: show receipt screen ──────────────────
  if (isOnlinePaid) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 bg-background border-b border-border z-10">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="w-20" />
            <h1 className="text-xl font-bold">Payment Done</h1>
            <div className="w-20" />
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col items-center gap-6">
          <CheckCircle2 className="h-20 w-20 text-green-500" />
          <div className="text-center">
            <p className="text-2xl font-bold">Payment Confirmed!</p>
            <p className="text-muted-foreground mt-1">₹{order.total.toLocaleString('en-IN')} paid via {order.paymentMethod === 'online' ? 'Online' : 'Cash'}</p>
          </div>

          {/* Email bill */}
          {isEmailConfigured && (
            <div className="w-full bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Get Bill on Email</span>
                <span className="text-xs text-muted-foreground">(optional)</span>
              </div>
              {emailSent ? (
                <p className="text-sm text-green-600">✓ Bill sent to {email}</p>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendBill()}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <Button onClick={handleSendBill} disabled={sendingEmail || !email} size="sm" className="shrink-0">
                    {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
                  </Button>
                </div>
              )}
            </div>
          )}

          <Button onClick={handlePrintReceipt} className="w-full" size="lg">
            <Printer className="h-4 w-4 mr-2" />
            Print / Download Receipt
          </Button>
          <Button onClick={handleCompleteOrder} variant="outline" className="w-full" size="lg">
            Done — Back to Menu
          </Button>
        </div>
      </div>
    );
  }

  // ── Normal order summary ─────────────────────────────────────────────────
  const isOnlineSelected = order.paymentMethod === 'online';

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 bg-background border-b border-border z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate(`/menu/${tableId}`)} className="flex items-center gap-2 text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Menu</span>
          </button>
          <h1 className="text-xl font-bold">Order Summary</h1>
          <div className="w-20" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Order Info */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Table</p>
              <p className="text-2xl font-bold">#{tableId}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Order Time</p>
              <p className="text-lg font-semibold">{formatOrderTime(order.createdAt)}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Status</p>
            <OrderStatusBadge status={order.status} waitingTime={waitingTime} />
          </div>
        </div>

        {/* Items */}
        <div className="space-y-3">
          <h2 className="font-semibold text-base">Order Items</h2>
          <div className="bg-card border border-border rounded-lg p-4">
            <OrderItemsList items={order.items} total={order.total} />
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-card border border-border rounded-lg p-4">
          <PaymentMethodSelector orderId={order.id} selectedMethod={order.paymentMethod} />
        </div>

        {/* When online is selected: show "I've Paid" + Complete Order only */}
        {isOnlineSelected ? (
          <div className="space-y-3">
            <Button
              onClick={handleIvePaid}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              <CheckCircle2 className="h-5 w-5 mr-2" />
              I've Paid — Show My Receipt
            </Button>
            <Button onClick={handleCompleteOrder} variant="outline" className="w-full" size="lg">
              Complete Order Without Receipt
            </Button>
          </div>
        ) : (
          /* Cash flow: show all options */
          <div className="space-y-3">
            {/* Email Bill */}
            {order.paymentMethod && isEmailConfigured && (
              <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-base">Get Bill on Email</h3>
                  <span className="text-xs text-muted-foreground">(optional)</span>
                </div>
                {emailSent ? (
                  <p className="text-sm text-green-600">✓ Bill sent to {email}</p>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendBill()}
                      className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <Button onClick={handleSendBill} disabled={sendingEmail || !email} size="sm" className="shrink-0">
                      {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            <Button onClick={() => navigate(`/menu/${tableId}`)} variant="outline" className="w-full" size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Add More Items
            </Button>
            {order.paymentMethod && (
              <Button onClick={handlePrintReceipt} variant="outline" className="w-full" size="lg">
                <Printer className="h-4 w-4 mr-2" />
                Print / Download Receipt
              </Button>
            )}
            <Button onClick={handleCompleteOrder} disabled={!order.paymentMethod} className="w-full" size="lg">
              Complete Order
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
