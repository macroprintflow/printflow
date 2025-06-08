
'use server';
import type { UserData, UserRole } from '@/lib/definitions';
import { revalidatePath } from 'next/cache';
// Firebase Auth imports are not directly used for mock store management here but kept for context of original file structure
// import { createUserWithEmailAndPassword, updateProfile, type User as FirebaseUser } from 'firebase/auth';
// import { auth } from '@/lib/firebase/clientApp';

import { promises as fs } from 'fs';
import path from 'path';

const MOCK_DATA_DIR = path.join(process.cwd(), '.data');
const MOCK_USERS_FILE_PATH = path.join(MOCK_DATA_DIR, 'mock-users.json');

const ADMIN_EMAIL_FOR_MOCK_STORE = "kuvam@macroprinters.com".toLowerCase();

declare global {
  var __usersStore__: UserData[] | undefined;
  var __userCounter__: number | undefined; // For generating new mock IDs if needed
}

// Helper to ensure directory exists
async function ensureDataDirectoryExists(): Promise<void> {
  try {
    await fs.mkdir(MOCK_DATA_DIR, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      console.error('[UserActions] Error creating mock data directory:', error);
    }
  }
}

async function loadMockUsersFromFile(): Promise<UserData[]> {
  await ensureDataDirectoryExists();
  try {
    const fileContent = await fs.readFile(MOCK_USERS_FILE_PATH, 'utf-8');
    const users = JSON.parse(fileContent) as UserData[];
    console.log(`[UserActions] Loaded ${users.length} mock users from file: ${MOCK_USERS_FILE_PATH}`);
    return users;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log(`[UserActions] Mock users data file not found at ${MOCK_USERS_FILE_PATH}. Initializing with default admin or empty.`);
      // Initialize with a default admin if the store is completely new and file doesn't exist
      return [{ id: 'admin-user-mock-id', email: ADMIN_EMAIL_FOR_MOCK_STORE, displayName: 'Kuvam Sharma (Admin)', role: 'Admin' }];
    }
    console.error('[UserActions] Error reading mock users data file:', error);
    return [{ id: 'admin-user-mock-id', email: ADMIN_EMAIL_FOR_MOCK_STORE, displayName: 'Kuvam Sharma (Admin)', role: 'Admin' }]; // Fallback
  }
}

async function saveMockUsersToFile(users: UserData[]): Promise<void> {
  await ensureDataDirectoryExists();
  try {
    await fs.writeFile(MOCK_USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf-8');
    console.log(`[UserActions] Saved ${users.length} mock users to file: ${MOCK_USERS_FILE_PATH}`);
  } catch (error) {
    console.error('[UserActions] Error writing mock users data file:', error);
  }
}

// Initialize store from file when the module first loads
(async () => {
  if (global.__usersStore__ === undefined) {
    console.log('[UserActions] Initializing mock users store from file...');
    global.__usersStore__ = await loadMockUsersFromFile();
    if (global.__usersStore__.length > 0) {
        const maxIdNum = Math.max(...global.__usersStore__.map(u => parseInt(u.id.replace(/[^0-9]/g, '') || '0')), 0);
        global.__userCounter__ = maxIdNum + 1;
    } else {
        global.__userCounter__ = 1; // Start counter if store was empty
    }
    console.log(`[UserActions] Mock user counter initialized to: ${global.__userCounter__}`);
  }
})();


export async function getAllUsersMock(): Promise<UserData[]> {
  console.log('[UserActions] getAllUsersMock called (File Persistent).');
  if (global.__usersStore__ === undefined) { // Should be initialized by IIFE, but as a fallback
    global.__usersStore__ = await loadMockUsersFromFile();
  }
  return [...(global.__usersStore__ || [])].sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
}

export async function updateUserRoleMock(userId: string, newRole: UserRole): Promise<{ success: boolean; message?: string; user?: UserData }> {
  console.log(`[UserActions] Attempting to update role for userId: ${userId} to newRole: ${newRole} (File Persistent)`);
  if (global.__usersStore__ === undefined) { global.__usersStore__ = await loadMockUsersFromFile(); }

  const userIndex = global.__usersStore__!.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return { success: false, message: "User not found in mock store." };
  }
  const user = global.__usersStore__![userIndex];
  // if (user.email.toLowerCase() === ADMIN_EMAIL_FOR_MOCK_STORE && newRole !== 'Admin') {
  //   console.warn(`[UserActions] WARNING: Primary admin role is being changed from Admin for ${ADMIN_EMAIL_FOR_MOCK_STORE}.`);
  // }
  global.__usersStore__![userIndex].role = newRole;
  await saveMockUsersToFile(global.__usersStore__!);
  revalidatePath('/settings');
  console.log(`[UserActions] Role for ${user.displayName || user.email} updated to ${newRole} in mock store.`);
  return { success: true, message: `Role for ${user.displayName || user.email} updated to ${newRole}.`, user: global.__usersStore__![userIndex] };
}

export async function createNewUserMock(
  userData: Omit<UserData, 'id'> & { password?: string }
): Promise<{ success: boolean; message?: string; user?: UserData }> {
  console.log('[UserActions] Attempting to create new mock user with email (File Persistent):', userData.email);
  if (global.__usersStore__ === undefined) { global.__usersStore__ = await loadMockUsersFromFile(); }
  if (global.__userCounter__ === undefined) { // Fallback if IIFE didn't set it
    global.__userCounter__ = (global.__usersStore__!.length > 0 ? Math.max(...global.__usersStore__!.map(u => parseInt(u.id.replace(/[^0-9]/g, '') || '0')), 0) : 0) + 1;
  }


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
  await saveMockUsersToFile(global.__usersStore__!);
  console.log(`[UserActions] Mock user ${newUser.displayName} added to store with role ${userData.role}.`);
  revalidatePath('/settings');
  return { success: true, message: "Mock user added to list. (This does NOT create a real Firebase Auth account).", user: newUser };
}

export async function deleteUserMock(userId: string): Promise<{ success: boolean; message?: string }> {
  console.log(`[UserActions] Attempting to delete mock user with ID (File Persistent): ${userId}`);
  if (global.__usersStore__ === undefined) { global.__usersStore__ = await loadMockUsersFromFile(); }

  const userIndex = global.__usersStore__!.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return { success: false, message: "Mock user not found." };
  }
  const user = global.__usersStore__![userIndex];
  // if (user.email.toLowerCase() === ADMIN_EMAIL_FOR_MOCK_STORE) {
  //   return { success: false, message: "Cannot delete the primary admin user from the mock store." };
  // }
  global.__usersStore__!.splice(userIndex, 1);
  await saveMockUsersToFile(global.__usersStore__!);
  revalidatePath('/settings');
  console.log(`[UserActions] Mock user ${user.displayName || user.email} deleted from store.`);
  return { success: true, message: `Mock user ${user.displayName || user.email} deleted.` };
}

export async function linkUserToCustomerMock(userId: string, customerId: string): Promise<{ success: boolean; message?: string; user?: UserData }> {
  console.log(`[UserActions] Attempting to link userId: ${userId} to customerId: ${customerId} (File Persistent)`);
  if (global.__usersStore__ === undefined) { global.__usersStore__ = await loadMockUsersFromFile(); }

  const userIndex = global.__usersStore__!.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return { success: false, message: "User not found in mock store." };
  }
  global.__usersStore__![userIndex].linkedCustomerId = customerId === "" ? undefined : customerId;
  await saveMockUsersToFile(global.__usersStore__!);
  revalidatePath('/settings');
  const action = customerId === "" ? "unlinked from customer" : `linked to customer ID ${customerId}`;
  console.log(`[UserActions] User ${global.__usersStore__![userIndex].displayName || global.__usersStore__![userIndex].email} ${action} in mock store.`);
  return {
    success: true,
    message: `User ${action}.`,
    user: global.__usersStore__![userIndex]
  };
}


// This function remains for actual Firebase Auth signup (if it were fully implemented and used).
// The createUserDocumentInFirestore part was removed previously.
export async function createUserDocumentInAuth(user: any /* FirebaseUser */, roleOverride?: UserRole): Promise<UserData | null> {
  console.log(`[UserActions] createUserDocumentInAuth called for ${user.uid}, but Firestore interaction is removed in this version.`);
  const determinedRole: UserRole = roleOverride ?? (user.email?.toLowerCase() === ADMIN_EMAIL_FOR_MOCK_STORE ? "Admin" : "Customer");
  return {
    id: user.uid,
    email: user.email || "",
    displayName: user.displayName || user.email?.split('@')[0] || "User",
    role: determinedRole,
  };
}
