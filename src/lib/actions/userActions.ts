
'use server';
import type { UserData, UserRole } from '@/lib/definitions';
import { revalidatePath } from 'next/cache';
import { createUserWithEmailAndPassword, updateProfile, type User as FirebaseUser } from 'firebase/auth'; // Removed deleteUser from firebase/auth
import { auth } from '@/lib/firebase/clientApp'; // db import removed

const ADMIN_EMAIL_FOR_MOCK_STORE = "kuvam@macroprinters.com".toLowerCase();

declare global {
  var __usersStore__: UserData[] | undefined;
  var __userCounter__: number | undefined;
}

// Initialize mock user store if it doesn't exist
if (global.__usersStore__ === undefined) {
  console.log('[MockUserActions] Initializing global mock user store.');
  global.__usersStore__ = [
    { id: 'admin-user-mock-id', email: ADMIN_EMAIL_FOR_MOCK_STORE, displayName: 'Kuvam Sharma (Admin)', role: 'Admin' },
    { id: 'manager-user-mock-id', email: 'manager@example.com', displayName: 'Manager User', role: 'Manager' },
    { id: 'dept-user-mock-id', email: 'dept@example.com', displayName: 'Departmental User', role: 'Departmental' },
    { id: 'customer-user-mock-id', email: 'customer@example.com', displayName: 'Customer User', role: 'Customer' },
  ];
}
if (global.__userCounter__ === undefined) {
  global.__userCounter__ = (global.__usersStore__?.length || 0) + 1;
}


export async function getAllUsersMock(): Promise<UserData[]> {
  console.log('[MockUserActions] getAllUsersMock called.');
  return [...(global.__usersStore__ || [])].sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
}

export async function updateUserRoleMock(userId: string, newRole: UserRole): Promise<{ success: boolean; message?: string; user?: UserData }> {
  console.log(`[MockUserActions] Attempting to update role for userId: ${userId} to newRole: ${newRole}`);
  const userIndex = global.__usersStore__!.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return { success: false, message: "User not found in mock store." };
  }
  const user = global.__usersStore__![userIndex];
  if (user.email.toLowerCase() === ADMIN_EMAIL_FOR_MOCK_STORE && newRole !== 'Admin') {
    // For prototype, allow changing, but log a warning.
    console.warn(`[MockUserActions] WARNING: Primary admin role is being changed from Admin for ${ADMIN_EMAIL_FOR_MOCK_STORE}.`);
  }
  global.__usersStore__![userIndex].role = newRole;
  revalidatePath('/settings');
  console.log(`[MockUserActions] Role for ${user.displayName} updated to ${newRole} in mock store.`);
  return { success: true, message: `Role for ${user.displayName} updated to ${newRole}.`, user: global.__usersStore__![userIndex] };
}

export async function createNewUserMock(
  userData: Omit<UserData, 'id'> & { password?: string }
): Promise<{ success: boolean; message?: string; user?: UserData }> {
  console.log('[MockUserActions] Attempting to create new mock user with email:', userData.email);

  // Note: This function ONLY adds to the mock store for the Settings page.
  // It DOES NOT create an actual Firebase Auth user.
  // Real user creation should happen via the dedicated /signup page.

  if (global.__usersStore__!.some(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
    return { success: false, message: `Mock user with email ${userData.email} already exists in the mock store.` };
  }

  const newUser: UserData = {
    id: `mock-user-${global.__userCounter__!++}`,
    email: userData.email,
    displayName: userData.displayName || userData.email.split('@')[0] || "New Mock User",
    role: userData.role,
  };
  global.__usersStore__!.push(newUser);
  console.log(`[MockUserActions] Mock user ${newUser.displayName} added to store with role ${userData.role}.`);
  revalidatePath('/settings');
  return { success: true, message: "Mock user added to list. (This does NOT create a real Firebase Auth account).", user: newUser };
}

export async function deleteUserMock(userId: string): Promise<{ success: boolean; message?: string }> {
  console.log(`[MockUserActions] Attempting to delete mock user with ID: ${userId}`);
  const userIndex = global.__usersStore__!.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return { success: false, message: "Mock user not found." };
  }
  const user = global.__usersStore__![userIndex];
  if (user.email.toLowerCase() === ADMIN_EMAIL_FOR_MOCK_STORE) {
    return { success: false, message: "Cannot delete the primary admin user from the mock store." };
  }
  global.__usersStore__!.splice(userIndex, 1);
  revalidatePath('/settings');
  console.log(`[MockUserActions] Mock user ${user.displayName} deleted from store.`);
  return { success: true, message: `Mock user ${user.displayName} deleted.` };
}

// These Firestore-specific functions are no longer needed for mock user management.
// They are kept here commented out or removed if they were placeholders.
// export async function getUsersFromFirestore(): Promise<UserData[]> { /* ... */ }
// export async function updateUserRoleInFirestore(userId: string, newRole: UserRole): Promise<{ success: boolean; message?: string; user?: UserData }> { /* ... */ }
// export async function createNewUserWithFirestoreRecord(...) { /* ... */ }
// export async function deleteUserAndFirestoreRecord(userId: string): Promise<{ success: boolean; message?: string }> { /* ... */ }
// export async function getUserRoleFromFirestore(userId: string): Promise<UserRole | null> { /* ... */ }
// export async function createUserDocumentInFirestore(user: FirebaseUser, roleOverride?: UserRole): Promise<UserData | null> { /* ... */ }


// This function remains for actual Firebase Auth signup.
// The createUserDocumentInFirestore part is removed.
export async function createUserDocumentInAuth(user: FirebaseUser, roleOverride?: UserRole): Promise<UserData | null> {
  // This function's purpose was to create a Firestore doc.
  // With the revert, it's mostly a placeholder or can be refactored if needed.
  // For now, it doesn't need to do anything with Firestore.
  // It's called from signup page but won't interact with Firestore.
  console.log(`[UserActions] createUserDocumentInAuth called for ${user.uid}, but Firestore interaction is removed in this version.`);
  // We can return a basic UserData object based on the FirebaseUser if needed by the caller,
  // but it won't be stored in Firestore by this specific function anymore.
  const determinedRole: UserRole = roleOverride ?? (user.email?.toLowerCase() === ADMIN_EMAIL_FOR_MOCK_STORE ? "Admin" : "Customer");
  return {
    id: user.uid,
    email: user.email || "",
    displayName: user.displayName || user.email?.split('@')[0] || "User",
    role: determinedRole,
  };
}
