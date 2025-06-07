
'use server';
import type { UserData, UserRole } from '@/lib/definitions';
import { revalidatePath } from 'next/cache';

// --- Mock User Store ---
// IMPORTANT: This is a mock in-memory store for demonstration purposes.
// Real user management requires Firebase Admin SDK on a backend.
// Do NOT use this approach for production systems.

declare global {
  var __usersStore__: UserData[] | undefined;
  var __userCounter__: number | undefined;
}

const ADMIN_EMAIL_FOR_MOCK_USERS = "kuvam@macroprinters.com".toLowerCase();

if (global.__usersStore__ === undefined) {
  console.log('[MockUserActions] Initializing global mock users store.');
  global.__usersStore__ = [
    { id: 'user-admin-001', email: ADMIN_EMAIL_FOR_MOCK_USERS, displayName: 'Kuvam Sharma (Admin)', role: 'Admin' },
    { id: 'user-customer-002', email: 'customer1@example.com', displayName: 'Test Customer One', role: 'Customer' },
    { id: 'user-dept-003', email: 'depthead@example.com', displayName: 'Printing Dept Head', role: 'Departmental' },
  ];
}
if (global.__userCounter__ === undefined) {
  global.__userCounter__ = global.__usersStore__!.length + 1;
}
// --- End Mock User Store ---


export async function getAllUsersMock(): Promise<UserData[]> {
  console.log('[MockUserActions] getAllUsersMock called.');
  return [...(global.__usersStore__ || [])];
}

export async function updateUserRoleMock(userId: string, newRole: UserRole): Promise<{ success: boolean; message?: string; user?: UserData }> {
  console.log(`[MockUserActions] updateUserRoleMock called for userId: ${userId}, newRole: ${newRole}`);
  const userIndex = global.__usersStore__!.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return { success: false, message: "User not found." };
  }
  global.__usersStore__![userIndex].role = newRole;
  revalidatePath('/settings'); // Revalidate settings page to show updated roles
  return { success: true, user: global.__usersStore__![userIndex] };
}

export async function createNewUserMock(
  userData: Omit<UserData, 'id'> & { password?: string } // Password is for the form, not stored
): Promise<{ success: boolean; message?: string; user?: UserData }> {
  console.log('[MockUserActions] createNewUserMock called for email:', userData.email);
  
  const existingUser = global.__usersStore__!.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
  if (existingUser) {
    return { success: false, message: "User with this email already exists in the mock store." };
  }

  const newUser: UserData = {
    id: `mock-user-${global.__userCounter__!++}`,
    email: userData.email,
    displayName: userData.displayName,
    role: userData.role,
  };
  global.__usersStore__!.push(newUser);
  revalidatePath('/settings');
  return { success: true, message: "Mock user created successfully.", user: newUser };
}

export async function deleteUserMock(userId: string): Promise<{ success: boolean; message?: string }> {
  console.log(`[MockUserActions] deleteUserMock called for userId: ${userId}`);
  
  // Prevent deletion of the primary admin user in the mock store
  const userToDelete = global.__usersStore__!.find(u => u.id === userId);
  if (userToDelete && userToDelete.email.toLowerCase() === ADMIN_EMAIL_FOR_MOCK_USERS) {
    return { success: false, message: "Cannot delete the primary admin user in this mock setup." };
  }

  const initialLength = global.__usersStore__!.length;
  global.__usersStore__ = global.__usersStore__!.filter(u => u.id !== userId);
  
  if (global.__usersStore__!.length < initialLength) {
    revalidatePath('/settings');
    return { success: true, message: "Mock user deleted successfully." };
  } else {
    return { success: false, message: "User not found or could not be deleted." };
  }
}

// Note: Functions for actually interacting with Firebase Auth (creating users, setting custom claims)
// would require the Firebase Admin SDK and run on a backend. These mocks simulate the UI flow.
