
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
  console.log(`[UserActions] Attempting to update role for userId: ${userId} to newRole: ${newRole}`);
  
  // Simulate writing to Firestore for a Cloud Function to pick up
  console.log(`[UserActions] SIMULATING Firestore write: userRoleChanges/${userId} => { role: "${newRole}", requestedBy: "admin@example.com" }`);
  // In a real app, this would be an actual Firestore write.
  // The Cloud Function would then set custom claims.

  // For this prototype, we'll still update the local mock store so the UI reflects the *intended* change.
  const userIndex = global.__usersStore__!.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return { success: false, message: "User not found in mock store." };
  }
  if (global.__usersStore__![userIndex].email.toLowerCase() === ADMIN_EMAIL_FOR_MOCK_USERS && newRole !== 'Admin') {
      // Allow changing if newRole is Admin, just in case it was changed by mistake.
  }

  global.__usersStore__![userIndex].role = newRole;
  revalidatePath('/settings'); 
  
  // Note: The client will need to refresh its ID token to see actual custom claims if they were set by a real backend.
  // For this simulation, the UI on the settings page updates, but the user's actual session role (if they are logged in)
  // would only change if custom claims were truly updated and their token refreshed.
  // The admin's "Switch Role (Dev)" tool is for immediate UI testing.
  return { 
    success: true, 
    message: `Mock role for ${global.__usersStore__![userIndex].displayName} set to ${newRole}. (Simulated Firestore write for backend processing).`,
    user: global.__usersStore__![userIndex] 
  };
}

export async function createNewUserMock(
  userData: Omit<UserData, 'id'> & { password?: string }
): Promise<{ success: boolean; message?: string; user?: UserData }> {
  console.log('[UserActions] Attempting to create new user with email:', userData.email);
  
  const existingMockUser = global.__usersStore__!.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
  if (existingMockUser) {
    // If user exists in mock store, simulate updating their role if different
    if (existingMockUser.role !== userData.role) {
        console.log(`[UserActions] User ${userData.email} exists in mock store. Simulating role update to ${userData.role}.`);
        console.log(`[UserActions] SIMULATING Firestore write: userRoleChanges/${existingMockUser.id} => { role: "${userData.role}", requestedBy: "admin@example.com" }`);
        existingMockUser.role = userData.role;
        existingMockUser.displayName = userData.displayName;
    }
    revalidatePath('/settings');
    return { success: false, message: "User with this email already exists in the mock store. Role potentially updated in mock." };
  }

  if (!userData.password) {
    return { success: false, message: "Password is required to create an authentication user." };
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
    const firebaseUser = userCredential.user;

    if (userData.displayName && userData.displayName.trim() !== '') {
      await updateProfile(firebaseUser as FirebaseUser, { displayName: userData.displayName.trim() });
    }

    // Simulate writing initial role to Firestore for Cloud Function
    console.log(`[UserActions] SIMULATING Firestore write for initial role: userRoleChanges/${firebaseUser.uid} => { role: "${userData.role}", requestedBy: "admin@example.com" }`);

    const newUser: UserData = {
      id: firebaseUser.uid,
      email: userData.email,
      displayName: userData.displayName,
      role: userData.role, 
    };
    global.__usersStore__!.push(newUser);
    revalidatePath('/settings');
    return { success: true, message: "User created in Firebase Auth & mock store. Simulated Firestore write for role.", user: newUser };

  } catch (error: any) {
    console.error("[UserActions] Firebase Auth user creation error:", error);
    let errorMessage = "Failed to create user in Firebase Auth. ";
    if (error.code === 'auth/email-already-in-use') {
      errorMessage += "This email is already registered in Firebase. Try logging in or use a different email.";
      const userInMock = global.__usersStore__!.find(u => u.email.toLowerCase() === userData.email.toLowerCase());
      if (userInMock) {
        userInMock.role = userData.role;
        userInMock.displayName = userData.displayName;
         revalidatePath('/settings');
        return { success: true, message: "User already exists in Firebase. Mock store entry updated. Simulated Firestore write for role.", user: userInMock };
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
  console.log(`[UserActions] deleteUserMock called for userId: ${userId}`);
  
  const userToDelete = global.__usersStore__!.find(u => u.id === userId);
  if (!userToDelete) {
    return { success: false, message: "User not found in mock store." };
  }

  if (userToDelete.email.toLowerCase() === ADMIN_EMAIL_FOR_MOCK_USERS) {
    return { success: false, message: "Cannot delete the primary admin user in this mock setup." };
  }

  // Simulate write to Firestore for user deletion/role removal if needed by a backend process
  console.log(`[UserActions] SIMULATING Firestore write or backend call to handle deletion/role removal for user: ${userId}`);

  const initialLength = global.__usersStore__!.length;
  global.__usersStore__ = global.__usersStore__!.filter(u => u.id !== userId);
  
  if (global.__usersStore__!.length < initialLength) {
    revalidatePath('/settings');
    return { success: true, message: "Mock user removed from list. (Actual Firebase user NOT deleted by this action. Simulated backend trigger for full deletion/cleanup)." };
  } else {
    return { success: false, message: "User not found or could not be removed from mock list." };
  }
}
