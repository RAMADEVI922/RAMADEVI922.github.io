import { useEffect } from "react";
import { useRestaurantStore } from "@/store/restaurantStore";
import {
  fetchMenuItems,
  fetchCategoryBanners,
  fetchPaymentConfig,
  type FirebaseOrder,
  type FirebaseNotification
} from "./firebaseService";

// Fetch-only sync — no onSnapshot listeners to avoid burning Firestore quota.
// Menu items and banners are loaded once on app start and cached in localStorage.
export function useFirebaseSync() {
  const setMenuItems = useRestaurantStore((state) => state.setMenuItems);
  const setCategoryBanners = useRestaurantStore((state) => state.setCategoryBanners);
  const setPaymentQRCode = useRestaurantStore((state) => state.setPaymentQRCode);
  const setPaymentUPIId = useRestaurantStore((state) => state.setPaymentUPIId);

  useEffect(() => {
    let cancelled = false;

    const runInit = async () => {
      if (cancelled) return;
      try {
        const [items, banners, paymentConfig] = await Promise.allSettled([
          fetchMenuItems(),
          fetchCategoryBanners(),
          fetchPaymentConfig(),
        ]);

        if (cancelled) return;

        if (items.status === 'fulfilled' && items.value.length > 0) {
          const store = useRestaurantStore.getState();
          const localItems = store.menuItems;
          const menuItemImages = store.menuItemImages;
          const localById = new Map(localItems.map(i => [i.id, i]));
          const firestoreIds = new Set(items.value.map((i: { id: string }) => i.id));
          const localOnly = localItems.filter(i => !firestoreIds.has(i.id));
          const merged = items.value.map((i: { id: string; image?: string }) => {
            const local = localById.get(i.id);
            const persistedImage = menuItemImages[i.id];
            if (!i.image && persistedImage) return { ...i, image: persistedImage };
            if (!i.image && local?.image?.startsWith('data:')) return { ...i, image: local.image };
            return i;
          });
          setMenuItems([...localOnly, ...merged]);
        }

        if (banners.status === 'fulfilled') {
          setCategoryBanners(banners.value);
        }

        // Load payment config from Firestore — overrides localStorage so all devices stay in sync
        if (paymentConfig.status === 'fulfilled' && paymentConfig.value) {
          const { qrCodes, upiIds } = paymentConfig.value;
          Object.entries(qrCodes || {}).forEach(([provider, img]) => setPaymentQRCode(provider, img as string));
          Object.entries(upiIds || {}).forEach(([provider, id]) => setPaymentUPIId(provider, id as string));
        }
      } catch (error) {
        console.warn("Firebase sync failed:", error);
      }
    };

    const hydrated = useRestaurantStore.persist.hasHydrated();
    if (hydrated) {
      runInit();
    } else {
      const unsub = useRestaurantStore.persist.onFinishHydration(() => {
        runInit();
        unsub();
      });
    }

    return () => { cancelled = true; };
  }, [setMenuItems, setCategoryBanners, setPaymentQRCode, setPaymentUPIId]);
}
