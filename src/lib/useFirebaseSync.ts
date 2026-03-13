import { useEffect } from "react";
import { useRestaurantStore } from "@/store/restaurantStore";
import { fetchMenuItems, watchMenuItems, fetchCategoryBanners, watchCategoryBanners } from "./firebaseService";

export function useFirebaseSync() {
  const setMenuItems = useRestaurantStore((state) => state.setMenuItems);
  const setCategoryBanners = useRestaurantStore((state) => state.setCategoryBanners);

  useEffect(() => {
    let unsubscribeMenu: (() => void) | undefined;
    let unsubscribeBanners: (() => void) | undefined;

    const init = async () => {
      try {
        // Load menu items
        const items = await fetchMenuItems();
        if (items.length > 0) {
          setMenuItems(items);
        }
        
        unsubscribeMenu = watchMenuItems((newItems) => {
          if (newItems.length > 0) {
            setMenuItems(newItems);
          }
        });

        // Load category banners
        const banners = await fetchCategoryBanners();
        setCategoryBanners(banners);

        unsubscribeBanners = watchCategoryBanners((newBanners) => {
          setCategoryBanners(newBanners);
        });

      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn("Firebase sync failed:", error);
      }
    };

    init();

    return () => {
      unsubscribeMenu?.();
      unsubscribeBanners?.();
    };
  }, [setMenuItems, setCategoryBanners]);
}
