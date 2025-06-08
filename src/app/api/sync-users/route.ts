
import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import fs from 'fs/promises'; // Keep fs for writing mock-users.json
import path from 'path'; // Keep path for constructing file path

let parsedServiceAccount: admin.ServiceAccount | undefined;

// Try to parse credentials once at module load
const serviceAccountJsonString = process.env.FIREBASE_ADMIN_CREDENTIALS;

if (!serviceAccountJsonString) {
  console.error('[API Sync Users] CRITICAL ERROR: FIREBASE_ADMIN_CREDENTIALS environment variable is not set.');
} else {
  try {
    parsedServiceAccount = JSON.parse(serviceAccountJsonString) as admin.ServiceAccount;
    console.log('[API Sync Users] Successfully parsed FIREBASE_ADMIN_CREDENTIALS. Project ID:', parsedServiceAccount.project_id);
  } catch (error) {
    console.error('[API Sync Users] CRITICAL ERROR parsing FIREBASE_ADMIN_CREDENTIALS:', error);
    // parsedServiceAccount will remain undefined
  }
}

// Initialize Firebase Admin SDK
if (parsedServiceAccount && !admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(parsedServiceAccount),
    });
    console.log('[API Sync Users] Firebase Admin SDK initialized successfully.');
  } catch (initError) {
    console.error('[API Sync Users] CRITICAL ERROR initializing Firebase Admin SDK:', initError);
  }
} else if (admin.apps.length) {
  console.log('[API Sync Users] Firebase Admin SDK already initialized.');
} else if (!parsedServiceAccount) {
  // This case is if parsing failed or env var was missing and SDK isn't already initialized
  console.error('[API Sync Users] CRITICAL ERROR: Service account credentials not available for Firebase Admin SDK initialization, and SDK not already initialized.');
}


export async function GET(req: NextRequest) {
  if (!admin.apps.length) {
    console.error("[API Sync Users] Firebase Admin SDK not initialized. Cannot process request.");
    return NextResponse.json({ status: 'error', message: 'Firebase Admin SDK not initialized. Check server logs for critical errors during startup.' }, { status: 500 });
  }

  const usersList: admin.auth.UserRecord[] = [];
  let nextPageToken;

  try {
    console.log("[API Sync Users] Attempting to list Firebase Auth users...");
    do {
      const result = await admin.auth().listUsers(1000, nextPageToken);
      usersList.push(...result.users);
      nextPageToken = result.pageToken;
    } while (nextPageToken);
    console.log(`[API Sync Users] Successfully listed ${usersList.length} Firebase Auth users.`);

    const mockUsers = usersList.map((u) => ({
      id: u.uid,
      displayName: u.displayName || u.email?.split('@')[0] || '', // Ensure displayName has a fallback
      email: u.email || '',
      role: 'Customer', // default role
      // linkedCustomerId will be undefined by default
    }));

    const dataPath = path.join(process.cwd(), '.data/mock-users.json');
    await fs.mkdir(path.dirname(dataPath), { recursive: true });
    await fs.writeFile(dataPath, JSON.stringify(mockUsers, null, 2));
    console.log(`[API Sync Users] Successfully wrote ${mockUsers.length} users to mock-users.json.`);

    return NextResponse.json({ status: 'success', count: mockUsers.length });
  } catch (error) {
    console.error("[API Sync Users] Error during GET request processing:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ status: 'error', message: `Failed to sync users: ${errorMessage}` }, { status: 500 });
  }
}
