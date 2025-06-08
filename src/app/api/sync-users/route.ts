
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import fs from 'fs/promises';
import path from 'path';

// Attempt to parse credentials and catch potential errors
let serviceAccount;
try {
  if (!process.env.FIREBASE_ADMIN_CREDENTIALS) {
    throw new Error("FIREBASE_ADMIN_CREDENTIALS environment variable is not set.");
  }
  serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
  console.log('[API Sync Users] Successfully parsed FIREBASE_ADMIN_CREDENTIALS. Project ID:', serviceAccount.project_id);
} catch (error) {
  console.error('[API Sync Users] CRITICAL ERROR parsing FIREBASE_ADMIN_CREDENTIALS:', error);
  // Return an error response if credentials can't be parsed, as the app cannot initialize.
  // Note: This GET handler might not be the best place for this, ideally it's at app startup,
  // but for this specific API route, it's a necessary check.
  // However, NextResponse cannot be used directly at the top level like this.
  // The error will be thrown, and the GET handler will fail if admin.apps.length is 0.
}

if (serviceAccount && !admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('[API Sync Users] Firebase Admin SDK initialized successfully.');
  } catch (initError) {
    console.error('[API Sync Users] CRITICAL ERROR initializing Firebase Admin SDK:', initError);
  }
} else if (admin.apps.length) {
  console.log('[API Sync Users] Firebase Admin SDK already initialized.');
} else {
  console.error('[API Sync Users] CRITICAL ERROR: Service account not loaded, Firebase Admin SDK cannot be initialized.');
}

export async function GET() {
  if (!admin.apps.length) {
    console.error("[API Sync Users] Firebase Admin SDK not initialized. Cannot process request.");
    return NextResponse.json({ status: 'error', message: 'Firebase Admin SDK not initialized.' }, { status: 500 });
  }

  const users: any[] = [];
  let nextPageToken;

  try {
    console.log("[API Sync Users] Attempting to list Firebase Auth users...");
    do {
      const result = await admin.auth().listUsers(1000, nextPageToken);
      users.push(...result.users);
      nextPageToken = result.pageToken;
    } while (nextPageToken);
    console.log(`[API Sync Users] Successfully listed ${users.length} Firebase Auth users.`);

    const mockUsers = users.map((u) => ({
      id: u.uid,
      displayName: u.displayName || '',
      email: u.email || '',
      role: 'Customer', // default role
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
