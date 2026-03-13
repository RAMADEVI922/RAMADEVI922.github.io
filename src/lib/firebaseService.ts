import { collection, doc, setDoc, deleteDoc, getDocs, onSnapshot, query, orderBy, getDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";

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

const menuItemsCollection = collection(db, "menuItems");
const photosCollection = collection(db, "photos");

export async function fetchMenuItems(): Promise<FirebaseMenuItem[]> {
  const q = query(menuItemsCollection, orderBy("name"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<FirebaseMenuItem, "id">),
  }));
}

export async function upsertMenuItem(item: FirebaseMenuItem): Promise<void> {
  const docRef = doc(menuItemsCollection, item.id);
  await setDoc(docRef, { ...item });
}

export async function deleteMenuItem(id: string): Promise<void> {
  const docRef = doc(menuItemsCollection, id);
  await deleteDoc(docRef);
}

export async function uploadMenuItemImage(
  file: File,
  itemId: string,
  onProgress?: (progress: number) => void
): Promise<string> {
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

  // Adding a 15-second timeout to prevent the UI from hanging indefinitely
  const timeoutPromise = new Promise<string>((_, reject) =>
    setTimeout(() => {
      uploadTask.cancel();
      reject(new Error("Upload timed out after 15 seconds"));
    }, 15000)
  );

  return Promise.race([uploadPromise, timeoutPromise]);
}

export function watchMenuItems(onChanged: (items: FirebaseMenuItem[]) => void) {
  const q = query(menuItemsCollection, orderBy("name"));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<FirebaseMenuItem, "id">),
    }));
    onChanged(items);
  });
  return unsubscribe;
}

export async function saveCategoryBanner(category: string, url: string): Promise<void> {
  const docRef = doc(photosCollection, "category_banners");
  await setDoc(docRef, { [category]: url }, { merge: true });
}

export async function fetchCategoryBanners(): Promise<Record<string, string>> {
  const docRef = doc(photosCollection, "category_banners");
  const snapshot = await getDoc(docRef);
  return (snapshot.data() as Record<string, string>) || {};
}

export function watchCategoryBanners(onChanged: (banners: Record<string, string>) => void) {
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

  return Promise.race([uploadPromise, timeoutPromise]);
}

export async function deleteCategoryBanner(category: string): Promise<void> {
  const docRef = doc(photosCollection, "category_banners");
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    const data = snapshot.data();
    delete data[category];
    await setDoc(docRef, data);
  }
}
