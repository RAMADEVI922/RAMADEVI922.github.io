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
        setMenuItems(items);
        unsubscribe = watchMenuItems(setMenuItems);
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
