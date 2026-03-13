import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth, signInAnonymously } from "firebase/auth";
import fs from "fs";

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDVw_vhFXStAKYWCA0lE3IMxmNDZrGwnqs",
  authDomain: "qr-menu-19cd1.firebaseapp.com",
  projectId: "qr-menu-19cd1",
  storageBucket: "qr-menu-19cd1.appspot.com",
};
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const auth = getAuth(app);

async function testUpload() {
  try {
    console.log("Signing in anonymously...");
    await signInAnonymously(auth);
    console.log("Signed in. Attempting upload...");
    
    // Create a 1x1 pixel transparent PNG buffer
    const buffer = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    
    const storageRef = ref(storage, 'test-upload/test-image.png');
    
    await uploadBytes(storageRef, arrayBuffer, { contentType: 'image/png' });
    console.log("Upload successful!");
    
    const url = await getDownloadURL(storageRef);
    console.log("Download URL:", url);
    process.exit(0);
  } catch (error) {
    console.error("FIREBASE ERROR:", error);
    process.exit(1);
  }
}

testUpload();
