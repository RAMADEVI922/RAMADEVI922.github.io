import { useEffect } from "react";
import { useRestaurantStore } from "@/store/restaurantStore";
import { fetchMenuItems, watchMenuItems } from "./firebaseService";

export function useFirebaseSync() {
  const setMenuItems = useRestaurantStore((state) => state.setMenuItems);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      try {
        const items = await fetchMenuItems();
        if (items.length > 0) {
          setMenuItems(items);
        }
        
        unsubscribe = watchMenuItems((newItems) => {
          if (newItems.length > 0) {
            setMenuItems(newItems);
          }
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn("Firebase sync failed:", error);
      }
    };

    init();

    return () => {
      unsubscribe?.();
    };
  }, [setMenuItems]);
}
