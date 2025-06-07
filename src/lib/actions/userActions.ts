
'use server';
import type { UserData, UserRole } from '@/lib/definitions';
import { revalidatePath } from 'next/cache';
import { createUserWithEmailAndPassword, updateProfile, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase/clientApp'; // Assuming clientApp is correctly configured

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
    return { success: false, message: "User not found in mock store." };
  }
  // Prevent changing the role of the primary admin in the mock store via this UI
  if (global.__usersStore__![userIndex].email.toLowerCase() === ADMIN_EMAIL_FOR_MOCK_USERS && newRole !== 'Admin') {
      // return { success: false, message: "Cannot change the role of the primary admin user via this interface." };
      // Allow changing if newRole is Admin, just in case it was changed by mistake.
  }

  global.__usersStore__![userIndex].role = newRole;
  revalidatePath('/settings'); // Revalidate settings page to show updated roles
  return { success: true, user: global.__usersStore__![userIndex] };
}

export async function createNewUserMock(
  userData: Omit<UserData, 'id'> & { password?: string }
): Promise<{ success: boolean; message?: string; user?: UserData }> {
  console.log('[MockUserActions] createNewUserMock called for email:', userData.email);
  
  // Check if user already exists in the mock store
  const existingMockUser = global.__usersStore__!.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
  if (existingMockUser) {
    return { success: false, message: "User with this email already exists in the mock store." };
  }

  if (!userData.password) {
    return { success: false, message: "Password is required to create an authentication user." };
  }

  try {
    // Attempt to create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
    const firebaseUser = userCredential.user;

    if (userData.displayName && userData.displayName.trim() !== '') {
      await updateProfile(firebaseUser as FirebaseUser, { displayName: userData.displayName.trim() });
    }

    // If Firebase Auth user creation is successful, add to mock store
    const newUser: UserData = {
      id: firebaseUser.uid, // Use UID from Firebase Auth
      email: userData.email,
      displayName: userData.displayName,
      role: userData.role, // Role is still mock, not a custom claim
    };
    global.__usersStore__!.push(newUser);
    revalidatePath('/settings');
    return { success: true, message: "User created successfully in Firebase Auth and mock store.", user: newUser };

  } catch (error: any) {
    console.error("[MockUserActions] Firebase Auth user creation error:", error);
    let errorMessage = "Failed to create user in Firebase Auth. ";
    if (error.code === 'auth/email-already-in-use') {
      errorMessage += "This email is already registered in Firebase. Try logging in or use a different email.";
       // Optionally, find and update the mock store if the email exists in Auth but not in mock (or vice-versa)
      const userInMock = global.__usersStore__!.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
      if (userInMock) {
        // User exists in mock, maybe update their role if provided different
        userInMock.role = userData.role;
        userInMock.displayName = userData.displayName;
         revalidatePath('/settings');
        return { success: true, message: "User already exists in Firebase. Mock store entry updated.", user: userInMock };
      }

    } else if (error.code === 'auth/weak-password') {
      errorMessage += "The password is too weak (at least 6 characters).";
    } else {
      errorMessage += error.message || "Please check the details and try again.";
    }
    return { success: false, message: errorMessage };
  }
}

export async function deleteUserMock(userId: string): Promise<{ success: boolean; message?: string }> {
  console.log(`[MockUserActions] deleteUserMock called for userId: ${userId}`);
  
  const userToDelete = global.__usersStore__!.find(u => u.id === userId);
  if (!userToDelete) {
    return { success: false, message: "User not found in mock store." };
  }

  // Prevent deletion of the primary admin user in the mock store
  if (userToDelete.email.toLowerCase() === ADMIN_EMAIL_FOR_MOCK_USERS) {
    return { success: false, message: "Cannot delete the primary admin user in this mock setup." };
  }

  // Note: This does NOT delete the user from Firebase Authentication.
  // Real Firebase user deletion requires Admin SDK or re-authentication of the user.
  // This is a MOCK deletion from the local list only.

  const initialLength = global.__usersStore__!.length;
  global.__usersStore__ = global.__usersStore__!.filter(u => u.id !== userId);
  
  if (global.__usersStore__!.length < initialLength) {
    revalidatePath('/settings');
    return { success: true, message: "Mock user removed from the list. (Actual Firebase user not deleted)." };
  } else {
    return { success: false, message: "User not found or could not be removed from mock list." };
  }
}
