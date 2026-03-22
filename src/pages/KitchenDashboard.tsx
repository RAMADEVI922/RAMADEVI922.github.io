import { useEffect, useCallback, useState } from 'react';
import { useRestaurantStore } from '@/store/restaurantStore';
import { fetchOrders, type FirebaseOrder } from '@/lib/firebaseService';
import { computePriority } from '@/lib/aiPriority';
import { ChefHat, RefreshCw, Clock, Flame, CheckCircle2, Utensils, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ColStatus = 'pending' | 'confirmed' | 'preparing' | 'served';

const COLS: { key: ColStatus; label: string; icon: React.ReactNode; bg: string; border: string }[] = [
  { key: 'pending',   label: 'New Orders',  icon: <ShoppingBag className="h-4 w-4" />,  bg: 'bg-red-50',    border: 'border-red-200' },
  { key: 'confirmed', label: 'Confirmed',   icon: <CheckCircle2 className="h-4 w-4" />, bg: 'bg-blue-50',   border: 'border-blue-200' },
  { key: 'preparing', label: 'Preparing',   icon: <Flame className="h-4 w-4" />,        bg: 'bg-orange-50', border: 'border-orange-200' },
  { key: 'served',    label: 'Ready',       icon: <Utensils className="h-4 w-4" />,     bg: 'bg-green-50',  border: 'border-green-200' },
];

function elapsed(createdAt: Date | string) {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (mins < 1) return 'just now';
  return `${mins}m ago`;
}

export default function KitchenDashboard() {
  const { orders, setOrders, updateOrderStatus } = useRestaurantStore();
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const raw = await fetchOrders();
      const mapped = raw.map((o: FirebaseOrder) => ({ ...o, createdAt: new Date(o.createdAt) }));
      setOrders(mapped as any);
      setLastRefreshed(new Date());
    } finally {
      setRefreshing(false);
    }
  }, [setOrders]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 12000);
    return () => clearInterval(t);
  }, [refresh]);

  // Only show orders from last 3 hours
  const THREE_HOURS = 3 * 60 * 60 * 1000;
  const recentOrders = orders.filter(
    (o) => Date.now() - new Date(o.createdAt).getTime() < THREE_HOURS
  );

  const activeKitchenCount = recentOrders.filter(
    (o) => o.status === 'confirmed' || o.status === 'preparing'
  ).length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-orange-500/20 flex items-center justify-center">
            <ChefHat className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <p className="font-bold text-sm">Kitchen Dashboard</p>
            <p className="text-xs text-gray-400">
              {lastRefreshed ? `Updated ${lastRefreshed.toLocaleTimeString()}` : 'Loading...'}
              {' · '}{activeKitchenCount} active
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={refresh}
          disabled={refreshing}
          className="text-gray-400 hover:text-white gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </header>

      {/* Kanban columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 min-h-[calc(100vh-64px)]">
        {COLS.map((col) => {
          const colOrders = recentOrders
            .filter((o) => o.status === col.key)
            .map((o) => ({ ...o, priority: computePriority(o) }))
            .sort((a, b) => b.priority.score - a.priority.score);

          return (
            <div key={col.key} className="flex flex-col gap-2">
              {/* Column header */}
              <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${col.bg} ${col.border} border`}>
                <div className="flex items-center gap-2 text-gray-800">
                  {col.icon}
                  <span className="font-bold text-sm">{col.label}</span>
                </div>
                <span className="text-xs font-bold bg-white/60 px-2 py-0.5 rounded-full text-gray-700">
                  {colOrders.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 flex-1">
                {colOrders.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-gray-600 text-xs py-8">
                    No orders
                  </div>
                )}
                {colOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2"
                  >
                    {/* Table + priority */}
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-base">Table {order.tableId}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${order.priority.color}`}>
                        {order.priority.label}
                      </span>
                    </div>

                    {/* Wait time */}
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {elapsed(order.createdAt)}
                      {order.priority.reasons.length > 0 && (
                        <span className="ml-1 text-orange-400">· {order.priority.reasons[0]}</span>
                      )}
                    </div>

                    {/* Items */}
                    <div className="space-y-0.5">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between text-xs text-gray-300">
                          <span className="truncate">{item.name}</span>
                          <span className="text-gray-500 ml-2 shrink-0">×{item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="flex justify-between text-xs pt-1 border-t border-gray-800">
                      <span className="text-gray-500">{order.items.reduce((s, i) => s + i.quantity, 0)} items</span>
                      <span className="font-semibold text-white">₹{order.total.toLocaleString('en-IN')}</span>
                    </div>

                    {/* Advance button */}
                    {col.key !== 'served' && (
                      <button
                        onClick={() => {
                          const next: Record<ColStatus, ColStatus> = {
                            pending: 'confirmed', confirmed: 'preparing', preparing: 'served', served: 'served',
                          };
                          updateOrderStatus(order.id, next[col.key]);
                        }}
                        className="w-full text-xs py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/40 text-orange-300 font-semibold transition-all"
                      >
                        {col.key === 'pending' ? '✓ Confirm' : col.key === 'confirmed' ? '🔥 Start Cooking' : '✅ Mark Ready'}
                      </button>
                    )}
                    {col.key === 'served' && (
                      <div className="text-center text-xs text-green-400 font-semibold py-1">
                        ✓ Ready to serve
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
