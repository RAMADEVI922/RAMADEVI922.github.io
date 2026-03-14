import { useEffect } from 'react';
import { useRestaurantStore } from '@/store/restaurantStore';
import { watchOrders, saveOrder, updateOrderStatus, fetchOrders } from './firebaseService';

export function useOrdersSync() {
  const orders = useRestaurantStore((state) => state.orders);
  const setOrders = useRestaurantStore((state) => state.setOrders);
  const updateOrderStatus: any = useRestaurantStore((state) => state.updateOrderStatus);

  // Load initial orders from Firebase
  useEffect(() => {
    console.log('🔄 useOrdersSync: Loading initial orders from Firebase');
    
    const loadOrders = async () => {
      try {
        const firebaseOrders = await fetchOrders();
        console.log('📥 useOrdersSync: Loaded', firebaseOrders.length, 'orders from Firebase');
        
        // Convert Firebase orders back to local format
        const convertedOrders = firebaseOrders.map((order) => ({
          ...order,
          createdAt: new Date(order.createdAt),
        }));
        
        setOrders(convertedOrders);
      } catch (error) {
        console.warn('Failed to load orders from Firebase:', error);
      }
    };

    loadOrders();
  }, [setOrders]);

  // Watch for real-time updates from Firebase
  useEffect(() => {
    console.log('👁️ useOrdersSync: Setting up real-time listener for orders');
    
    const unsubscribe = watchOrders((firebaseOrders) => {
      console.log('📊 useOrdersSync: Received', firebaseOrders.length, 'orders from Firebase');
      
      // Convert Firebase orders back to local format
      const convertedOrders = firebaseOrders.map((order) => ({
        ...order,
        createdAt: new Date(order.createdAt),
      }));
      
      setOrders(convertedOrders);
    });

    return () => {
      console.log('🛑 useOrdersSync: Cleaning up real-time listener');
      unsubscribe();
    };
  }, [setOrders]);

  // Sync local orders to Firebase when they change
  useEffect(() => {
    console.log('💾 useOrdersSync: Syncing', orders.length, 'orders to Firebase');
    
    orders.forEach((order) => {
      const firebaseOrder = {
        ...order,
        createdAt: order.createdAt.toISOString(),
      };
      
      saveOrder(firebaseOrder).catch((error) => {
        console.warn('Failed to sync order to Firebase:', error);
      });
    });
  }, [orders]);
}

export function useSyncOrderStatus(orderId: string, status: string) {
  useEffect(() => {
    console.log('🔄 useSyncOrderStatus: Syncing order', orderId, 'status to', status);
    
    updateOrderStatus(orderId, status).catch((error) => {
      console.warn('Failed to sync order status:', error);
    });
  }, [orderId, status]);
}
