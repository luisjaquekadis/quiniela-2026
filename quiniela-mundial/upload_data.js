import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, collection } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = {
  apiKey: "AIzaSyDhff7KUaRRHXZ1naA6XhL21HQAQYOxgrE",
  authDomain: "quiniela-backup.firebaseapp.com",
  projectId: "quiniela-backup",
  storageBucket: "quiniela-backup.firebasestorage.app",
  messagingSenderId: "95031328885",
  appId: "1:95031328885:web:1c9c4f436173386450b83c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function upload() {
  const data = JSON.parse(fs.readFileSync("firebase_backup.json", "utf8"));
  
  for (const groupId in data) {
    const group = data[groupId];
    console.log(`Uploading group: ${groupId}`);
    
    // Upload main group document
    await setDoc(doc(db, "groups", groupId), group.data);
    
    // Upload profiles
    for (const profId in group.profiles) {
      await setDoc(doc(db, "groups", groupId, "profiles", profId), group.profiles[profId]);
    }
    
    // Upload predictions
    for (const predId in group.predictions) {
      await setDoc(doc(db, "groups", groupId, "predictions", predId), group.predictions[predId]);
    }
  }
  
  console.log("Upload complete!");
  process.exit(0);
}

upload();
