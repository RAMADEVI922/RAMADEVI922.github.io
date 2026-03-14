import { collection, doc, setDoc, deleteDoc, getDocs, onSnapshot, query, orderBy, getDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage, isFirebaseConfigured } from "./firebase";

// Compress and resize image to base64 — keeps it under Firestore's 1MB doc limit
function compressImageToBase64(file: File, maxWidth = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export interface FirebaseMenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
  dietary?: string[];
  image?: string;
}

export interface Photo {
  id: string;
  url: string;
}

// Lazy initialization of collections to avoid errors when Firebase is not configured
const getMenuItemsCollection = () => db ? collection(db, "menuItems") : null;
const getPhotosCollection = () => db ? collection(db, "photos") : null;
const getOrdersCollection = () => db ? collection(db, "orders") : null;
const getNotificationsCollection = () => db ? collection(db, "notifications") : null;

export async function fetchMenuItems(): Promise<FirebaseMenuItem[]> {
  const menuItemsCollection = getMenuItemsCollection();
  if (!isFirebaseConfigured || !menuItemsCollection) {
    console.warn('Firebase not configured. Returning empty menu items.');
    return [];
  }
  
  try {
    const q = query(menuItemsCollection, orderBy("name"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<FirebaseMenuItem, "id">),
    }));
  } catch (error) {
    console.warn('Failed to fetch menu items from Firebase:', error);
    return [];
  }
}

export async function upsertMenuItem(item: FirebaseMenuItem): Promise<void> {
  const menuItemsCollection = getMenuItemsCollection();
  if (!isFirebaseConfigured || !menuItemsCollection) {
    console.warn('Firebase not configured. Menu item not saved.');
    return;
  }

  try {
    // Strip base64 images before saving to Firestore — too large for 1MB limit
    const itemToSave = { ...item };
    if (itemToSave.image?.startsWith('data:')) {
      delete itemToSave.image;
    }
    const docRef = doc(menuItemsCollection, item.id);
    await setDoc(docRef, itemToSave);
  } catch (error) {
    console.warn('Failed to upsert menu item:', error);
  }
}

export async function deleteMenuItem(id: string): Promise<void> {
  const menuItemsCollection = getMenuItemsCollection();
  if (!isFirebaseConfigured || !menuItemsCollection) {
    console.warn('Firebase not configured. Menu item not deleted.');
    return;
  }

  try {
    const docRef = doc(menuItemsCollection, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn('Failed to delete menu item:', error);
  }
}

export async function uploadMenuItemImage(
  file: File,
  itemId: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  // Helper to convert file to base64 as fallback
  const toBase64 = () => compressImageToBase64(file);

  // If Firebase Storage is not configured, use base64
  if (!isFirebaseConfigured || !storage) {
    console.warn('Firebase Storage not configured. Converting image to base64.');
    const b64 = await toBase64();
    onProgress?.(100);
    return b64;
  }

  try {
    const storageRef = ref(storage, `menuItems/${itemId}/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    const uploadPromise = new Promise<string>((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress?.(progress);
        },
        (error) => reject(error),
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          } catch (e) {
            reject(e);
          }
        }
      );
    });

    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => {
        uploadTask.cancel();
        reject(new Error("Upload timed out after 15 seconds"));
      }, 15000)
    );

    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (error) {
    // Storage not enabled or failed — fall back to base64
    console.warn('Firebase Storage upload failed, falling back to base64:', error);
    const b64 = await compressImageToBase64(file); onProgress?.(100); return b64;
  }
}

export function watchMenuItems(onChanged: (items: FirebaseMenuItem[]) => void) {
  const menuItemsCollection = getMenuItemsCollection();
  if (!isFirebaseConfigured || !menuItemsCollection) {
    console.warn('Firebase not configured. Menu items will not be watched.');
    return () => {};
  }

  try {
    const q = query(menuItemsCollection, orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<FirebaseMenuItem, "id">),
      }));
      onChanged(items);
    });
    return unsubscribe;
  } catch (error) {
    console.warn('Failed to watch menu items:', error);
    return () => {};
  }
}

export async function saveCategoryBanner(category: string, url: string): Promise<void> {
  // Skip Firestore for base64 images — they exceed the 1MB document limit.
  // The URL is already persisted in Zustand localStorage via categoryImages.
  if (url.startsWith('data:')) {
    console.warn('Skipping Firestore save for base64 image — stored locally only.');
    return;
  }

  const photosCollection = getPhotosCollection();
  if (!photosCollection) {
    console.warn('Firebase not configured. Category banner not saved.');
    return;
  }
  const docRef = doc(photosCollection, "category_banners");
  await setDoc(docRef, { [category]: url }, { merge: true });
}

export async function fetchCategoryBanners(): Promise<Record<string, string>> {
  const photosCollection = getPhotosCollection();
  if (!photosCollection) {
    console.warn('Firebase not configured. Returning empty banners.');
    return {};
  }
  const docRef = doc(photosCollection, "category_banners");
  const snapshot = await getDoc(docRef);
  return (snapshot.data() as Record<string, string>) || {};
}

export function watchCategoryBanners(onChanged: (banners: Record<string, string>) => void) {
  const photosCollection = getPhotosCollection();
  if (!photosCollection) {
    console.warn('Firebase not configured. Category banners will not be watched.');
    return () => {};
  }
  const docRef = doc(photosCollection, "category_banners");
  const unsubscribe = onSnapshot(docRef, (doc) => {
    const data = (doc.data() as Record<string, string>) || {};
    onChanged(data);
  });
  return unsubscribe;
}

export async function uploadCategoryImage(
  file: File,
  category: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  // If Firebase Storage is not configured, use compressed base64
  if (!isFirebaseConfigured || !storage) {
    console.warn('Firebase Storage not configured. Converting image to base64.');
    const b64 = await compressImageToBase64(file);
    onProgress?.(100);
    return b64;
  }

  try {
    const storageRef = ref(storage, `categoryBanners/${category}_${Date.now()}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    const uploadPromise = new Promise<string>((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress?.(progress);
        },
        (error) => reject(error),
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          } catch (e) {
            reject(e);
          }
        }
      );
    });

    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => {
        uploadTask.cancel();
        reject(new Error("Upload timed out after 15 seconds"));
      }, 15000)
    );

    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (error) {
    // Storage not enabled or failed — fall back to base64
    console.warn('Firebase Storage upload failed, falling back to base64:', error);
    const b64 = await compressImageToBase64(file); onProgress?.(100); return b64;
  }
}

export async function deleteCategoryBanner(category: string): Promise<void> {
  const photosCollection = getPhotosCollection();
  if (!photosCollection) {
    console.warn('Firebase not configured. Category banner not deleted.');
    return;
  }
  const docRef = doc(photosCollection, "category_banners");
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    const data = snapshot.data();
    delete data[category];
    await setDoc(docRef, data);
  }
}

// Orders Collection
export interface FirebaseOrder {
  id: string;
  tableId: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    category: string;
  }>;
  status: 'pending' | 'confirmed' | 'preparing' | 'served';
  total: number;
  createdAt: number;
  readyAt: number;
}

export interface FirebaseNotification {
  id: string;
  tableId: string;
  type: 'order' | 'call_waiter' | 'request_bill' | 'extra_order';
  message: string;
  read: boolean;
  createdAt: number;
}

// Order Functions
export async function fetchOrders(): Promise<FirebaseOrder[]> {
  const ordersCollection = getOrdersCollection();
  if (!isFirebaseConfigured || !ordersCollection) {
    console.warn('Firebase not configured. Returning empty orders.');
    return [];
  }
  
  try {
    const q = query(ordersCollection, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<FirebaseOrder, "id">),
    }));
  } catch (error) {
    console.warn('Failed to fetch orders from Firebase:', error);
    return [];
  }
}

export async function upsertOrder(order: FirebaseOrder): Promise<void> {
  const ordersCollection = getOrdersCollection();
  if (!isFirebaseConfigured || !ordersCollection) {
    console.warn('Firebase not configured. Order not saved.');
    return;
  }

  try {
    const docRef = doc(ordersCollection, order.id);
    await setDoc(docRef, { ...order });
  } catch (error) {
    console.warn('Failed to upsert order:', error);
  }
}

export async function deleteOrder(id: string): Promise<void> {
  const ordersCollection = getOrdersCollection();
  if (!isFirebaseConfigured || !ordersCollection) {
    console.warn('Firebase not configured. Order not deleted.');
    return;
  }

  try {
    const docRef = doc(ordersCollection, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn('Failed to delete order:', error);
  }
}

export function watchOrders(onChanged: (orders: FirebaseOrder[]) => void) {
  const ordersCollection = getOrdersCollection();
  if (!isFirebaseConfigured || !ordersCollection) {
    console.warn('Firebase not configured. Orders will not be watched.');
    return () => {};
  }

  try {
    const q = query(ordersCollection, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<FirebaseOrder, "id">),
      }));
      onChanged(orders);
    });
    return unsubscribe;
  } catch (error) {
    console.warn('Failed to watch orders:', error);
    return () => {};
  }
}

// Notification Functions
export async function fetchNotifications(): Promise<FirebaseNotification[]> {
  const notificationsCollection = getNotificationsCollection();
  if (!isFirebaseConfigured || !notificationsCollection) {
    console.warn('Firebase not configured. Returning empty notifications.');
    return [];
  }
  
  try {
    const q = query(notificationsCollection, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<FirebaseNotification, "id">),
    }));
  } catch (error) {
    console.warn('Failed to fetch notifications from Firebase:', error);
    return [];
  }
}

export async function upsertNotification(notification: FirebaseNotification): Promise<void> {
  const notificationsCollection = getNotificationsCollection();
  if (!isFirebaseConfigured || !notificationsCollection) {
    console.warn('Firebase not configured. Notification not saved.');
    return;
  }

  try {
    const docRef = doc(notificationsCollection, notification.id);
    await setDoc(docRef, { ...notification });
  } catch (error) {
    console.warn('Failed to upsert notification:', error);
  }
}

export function watchNotifications(onChanged: (notifications: FirebaseNotification[]) => void) {
  const notificationsCollection = getNotificationsCollection();
  if (!isFirebaseConfigured || !notificationsCollection) {
    console.warn('Firebase not configured. Notifications will not be watched.');
    return () => {};
  }

  try {
    const q = query(notificationsCollection, orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<FirebaseNotification, "id">),
      }));
      onChanged(notifications);
    });
    return unsubscribe;
  } catch (error) {
    console.warn('Failed to watch notifications:', error);
    return () => {};
  }
}

