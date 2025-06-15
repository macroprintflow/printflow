// src/lib/actions/inventoryActions.ts
import { getDB } from "../firebase/clientApp";
import { collection, getDocs } from "firebase/firestore";
import type { InventoryItem } from "@/lib/definitions"; // ✅ Make sure this type is correct

export async function getInventoryItems(): Promise<InventoryItem[]> {
  const db = getDB();
  const snapshot = await getDocs(collection(db, "inventoryItems"));

  return snapshot.docs.map((doc) => {
    const data = doc.data();

    // Ensure all required InventoryItem fields are mapped
    return {
        id: doc.id,
        name: data.itemName, // 👈 renamed
        paperQuality: data.paperQuality,
        paperGsm: data.paperGsm ?? null,
        paperThicknessMm: data.paperThicknessMm ?? null,
        masterSheetSizeWidth: data.masterSheetSizeWidth,
        masterSheetSizeHeight: data.masterSheetSizeHeight,
        availableStock: data.availableStock,
        type: data.type,
        locationCode: data.locationCode,
        itemGroup: data.itemGroup ?? "", // 👈 added
        specification: data.specification ?? "", // 👈 added
        unit: data.unit ?? "", // 👈 added
    } satisfies InventoryItem;
  });
}
