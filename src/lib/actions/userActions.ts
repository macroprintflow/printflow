
'use server';
import type { UserData, UserRole } from '@/lib/definitions';
import { revalidatePath } from 'next/cache';
import { createUserWithEmailAndPassword, updateProfile, type User as FirebaseUser, deleteUser as deleteFirebaseAuthUser } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/clientApp';
import { doc, setDoc, getDoc, updateDoc, collection, getDocs, deleteDoc, writeBatch } from "firebase/firestore";

const ADMIN_EMAIL_FOR_FIRESTORE = "kuvam@macroprinters.com".toLowerCase();

// Helper to ensure user document exists in Firestore, creating it if not.
// Returns the user's role.
async function ensureUserDocumentAndGetRole(firebaseUser: FirebaseUser): Promise<UserRole> {
  const userRef = doc(db, "users", firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return userSnap.data()?.role as UserRole || "Customer";
  } else {
    // User document doesn't exist, create it.
    // This can happen for users who signed up before this Firestore role system was in place.
    const defaultRole: UserRole = firebaseUser.email?.toLowerCase() === ADMIN_EMAIL_FOR_FIRESTORE ? "Admin" : "Customer";
    const newUserDoc: UserData = {
      id: firebaseUser.uid,
      email: firebaseUser.email || "",
      displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "New User",
      role: defaultRole,
    };
    try {
      await setDoc(userRef, newUserDoc);
      console.log(`[FirestoreUserActions] Created missing Firestore document for user ${firebaseUser.uid} with role ${defaultRole}.`);
      return defaultRole;
    } catch (error) {
      console.error("[FirestoreUserActions] Error creating missing Firestore document:", error);
      return "Customer"; // Fallback role on error
    }
  }
}


export async function getUsersFromFirestore(): Promise<UserData[]> {
  console.log('[FirestoreUserActions] getUsersFromFirestore called.');
  try {
    const usersCollectionRef = collection(db, "users");
    const querySnapshot = await getDocs(usersCollectionRef);
    const users: UserData[] = [];
    querySnapshot.forEach((docSnap) => {
      users.push(docSnap.data() as UserData);
    });
    return users.sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
  } catch (error) {
    console.error("[FirestoreUserActions] Error fetching users from Firestore:", error);
    return [];
  }
}

export async function updateUserRoleInFirestore(userId: string, newRole: UserRole): Promise<{ success: boolean; message?: string; user?: UserData }> {
  console.log(`[FirestoreUserActions] Attempting to update role for userId: ${userId} to newRole: ${newRole} in Firestore.`);
  const userRef = doc(db, "users", userId);
  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return { success: false, message: "User document not found in Firestore." };
    }
    const userData = userSnap.data() as UserData;

    // Prevent changing the primary admin's role away from Admin, unless it's to re-affirm Admin.
    if (userData.email.toLowerCase() === ADMIN_EMAIL_FOR_FIRESTORE && newRole !== 'Admin') {
      // return { success: false, message: "Cannot change the primary admin's role from 'Admin'." };
      // For prototype, allow changing, but this would be a security rule in production.
      console.warn(`[FirestoreUserActions] WARNING: Primary admin role is being changed from Admin for ${ADMIN_EMAIL_FOR_FIRESTORE}. This is generally not advised.`);
    }

    await updateDoc(userRef, { role: newRole });
    const updatedUser: UserData = { ...userData, role: newRole };
    revalidatePath('/settings');
    // IMPORTANT: This client-side role update does NOT set Firebase Custom Claims.
    // Custom Claims are the secure way to manage roles and require Firebase Admin SDK on a backend.
    // This Firestore 'role' field is for UI/prototyping and client-side logic.
    console.log(`[FirestoreUserActions] Role for ${updatedUser.displayName} updated to ${newRole} in Firestore.`);
    return {
      success: true,
      message: `Role for ${updatedUser.displayName} updated to ${newRole} in Firestore.`,
      user: updatedUser
    };
  } catch (error) {
    console.error("[FirestoreUserActions] Error updating user role in Firestore:", error);
    return { success: false, message: `Failed to update role: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

export async function createNewUserWithFirestoreRecord(
  userData: Omit<UserData, 'id'> & { password?: string }
): Promise<{ success: boolean; message?: string; user?: UserData }> {
  console.log('[FirestoreUserActions] Attempting to create new user (Auth + Firestore) with email:', userData.email);

  if (!userData.password) {
    return { success: false, message: "Password is required to create an authentication user." };
  }

  try {
    // 1. Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
    const firebaseUser = userCredential.user;
    console.log(`[FirestoreUserActions] Firebase Auth user created: ${firebaseUser.uid}`);

    if (userData.displayName && userData.displayName.trim() !== '') {
      await updateProfile(firebaseUser as FirebaseUser, { displayName: userData.displayName.trim() });
      console.log(`[FirestoreUserActions] Firebase Auth profile updated for user: ${firebaseUser.uid}`);
    }

    // 2. Create Firestore document for the user
    const newUserDoc: UserData = {
      id: firebaseUser.uid,
      email: userData.email,
      displayName: userData.displayName || firebaseUser.email?.split('@')[0] || "New User",
      role: userData.role, // Use the role specified during creation
    };
    const userRef = doc(db, "users", firebaseUser.uid);
    await setDoc(userRef, newUserDoc);
    console.log(`[FirestoreUserActions] Firestore document created for user ${firebaseUser.uid} with role ${userData.role}.`);

    revalidatePath('/settings');
    return { success: true, message: "User created in Firebase Auth & Firestore document created.", user: newUserDoc };

  } catch (error: any) {
    console.error("[FirestoreUserActions] Error creating user (Auth or Firestore):", error);
    let errorMessage = "Failed to create user. ";
    if (error.code === 'auth/email-already-in-use') {
      errorMessage += "This email is already registered in Firebase Auth. User not created.";
      // Check if Firestore doc exists, if not, offer to create it.
      const userRef = doc(db, "users", error.customData?.uid || `failed-${Date.now()}`); // Use UID if available from error, else a dummy
      const userSnap = await getDoc(userRef);
      if(!userSnap.exists() && error.customData?.uid) {
         // Try to create a Firestore doc if auth user exists but doc doesn't
         // This situation is less likely if signup flow is consistent
      }
    } else if (error.code === 'auth/weak-password') {
      errorMessage += "The password is too weak (at least 6 characters).";
    } else if (error.message && error.message.includes("firestore")) {
      errorMessage += "Error during Firestore document creation: " + error.message;
    }
    else {
      errorMessage += error.message || "Please check the details and try again.";
    }
    return { success: false, message: errorMessage };
  }
}

export async function deleteUserAndFirestoreRecord(userId: string): Promise<{ success: boolean; message?: string }> {
  console.log(`[FirestoreUserActions] Attempting to delete Firestore record for userId: ${userId}`);

  const userRef = doc(db, "users", userId);
  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return { success: false, message: "User document not found in Firestore." };
    }
    const userData = userSnap.data() as UserData;
    if (userData.email.toLowerCase() === ADMIN_EMAIL_FOR_FIRESTORE) {
      return { success: false, message: "Cannot delete the primary admin user's Firestore record." };
    }

    await deleteDoc(userRef);
    console.log(`[FirestoreUserActions] Firestore document deleted for user ${userId}.`);
    
    // IMPORTANT: Deleting Firebase Auth users from the client-side is highly discouraged
    // and often disabled by default due to security risks. This action typically requires
    // the Firebase Admin SDK on a backend.
    // For this prototype, we are ONLY deleting the Firestore record.
    // The Firebase Auth user account will remain.
    
    revalidatePath('/settings');
    return { success: true, message: `Firestore record for ${userData.displayName || userData.email} deleted. (Firebase Auth user account NOT deleted).` };
  } catch (error) {
    console.error("[FirestoreUserActions] Error deleting user document from Firestore:", error);
    return { success: false, message: `Failed to delete Firestore record: ${error instanceof Error ? error.message : "Unknown error"}` };
  }
}

// Function to get user role from Firestore (used in layout)
export async function getUserRoleFromFirestore(userId: string): Promise<UserRole | null> {
  const userRef = doc(db, "users", userId);
  try {
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return (userSnap.data()?.role as UserRole) || null;
    }
    return null; // No document, so no role from Firestore
  } catch (error) {
    console.error(`[FirestoreUserActions] Error fetching role for user ${userId}:`, error);
    return null; // Error fetching, assume no role
  }
}

// Function to create a user document in Firestore if it doesn't exist
export async function createUserDocumentInFirestore(user: FirebaseUser, roleOverride?: UserRole): Promise<UserData | null> {
  const userRef = doc(db, "users", user.uid);
  try {
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      console.log(`[FirestoreUserActions] Document for user ${user.uid} already exists.`);
      return userSnap.data() as UserData;
    }

    const defaultRole: UserRole = roleOverride ?? (user.email?.toLowerCase() === ADMIN_EMAIL_FOR_FIRESTORE ? "Admin" : "Customer");
    
    const newUserDocData: UserData = {
      id: user.uid,
      email: user.email || "",
      displayName: user.displayName || user.email?.split('@')[0] || "User",
      role: defaultRole,
    };
    await setDoc(userRef, newUserDocData);
    console.log(`[FirestoreUserActions] Created Firestore document for new user ${user.uid} with role ${defaultRole}.`);
    return newUserDocData;
  } catch (error) {
    console.error(`[FirestoreUserActions] Error ensuring/creating Firestore document for user ${user.uid}:`, error);
    return null;
  }
}

    