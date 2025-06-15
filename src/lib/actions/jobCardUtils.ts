import { getDB } from "@/lib/firebase/clientApp";
import { doc, getDoc, setDoc } from "firebase/firestore";

export async function getNextJobCardNumber(): Promise<string> {
  const db = getDB(); // ✅ Ensures connection to "macroprintflow"
  const settingsRef = doc(db, "settings", "jobCardCounter");
  const snapshot = await getDoc(settingsRef);

  let lastNumber = 0;
  let currentLetter = "A";

  if (snapshot.exists()) {
    const data = snapshot.data();
    lastNumber = data.lastNumber || 0;
    currentLetter = data.currentLetter || "A";
  }

  let newNumber = lastNumber + 1;
  let newLetter = currentLetter;

  if (newNumber > 999) {
    newNumber = 1;
    newLetter = String.fromCharCode(currentLetter.charCodeAt(0) + 1);
  }

  const formattedNumber = String(newNumber).padStart(3, "0");
  const nextJobCardNumber = `MP-${formattedNumber}${newLetter}`;

  await setDoc(settingsRef, {
    lastNumber: newNumber,
    currentLetter: newLetter,
    updatedAt: new Date().toISOString(),
  });

  console.log("[getNextJobCardNumber] Generated:", nextJobCardNumber);
  return nextJobCardNumber;
}
