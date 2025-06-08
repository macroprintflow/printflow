
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { UserData } from '@/lib/definitions';

// Define the path to the mock users JSON file
const MOCK_DATA_DIR = path.join(process.cwd(), '.data');
const MOCK_USERS_FILE_PATH = path.join(MOCK_DATA_DIR, 'mock-users.json');

// Helper function to ensure the .data directory exists
async function ensureDataDirectoryExists(): Promise<void> {
  try {
    await fs.mkdir(MOCK_DATA_DIR, { recursive: true });
  } catch (error: any) {
    // Ignore EEXIST error (directory already exists), but log others
    if (error.code !== 'EEXIST') {
      console.error('[API Add Mock User] Error creating .data directory:', error);
    }
  }
}

// Helper function to load users from the JSON file
async function loadMockUsers(): Promise<UserData[]> {
  await ensureDataDirectoryExists(); // Ensure directory exists before read attempt
  try {
    const fileContent = await fs.readFile(MOCK_USERS_FILE_PATH, 'utf-8');
    return JSON.parse(fileContent) as UserData[];
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return an empty array
      console.log('[API Add Mock User] mock-users.json not found, starting with empty list.');
      return [];
    }
    // For other errors, log and return empty (or handle more gracefully)
    console.error('[API Add Mock User] Error reading mock-users.json:', error);
    return [];
  }
}

// Helper function to save users to the JSON file
async function saveMockUsers(users: UserData[]): Promise<void> {
  await ensureDataDirectoryExists(); // Ensure directory exists before write attempt
  try {
    await fs.writeFile(MOCK_USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf-8');
  } catch (error) {
    console.error('[API Add Mock User] Error writing to mock-users.json:', error);
    // Depending on requirements, you might want to throw this error
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, email, displayName } = body;

    if (!uid || !email) {
      return NextResponse.json({ message: 'Missing uid or email in request body' }, { status: 400 });
    }

    const mockUsers = await loadMockUsers();

    // Check if user already exists in mock list (by Firebase UID)
    const existingUserIndex = mockUsers.findIndex(u => u.id === uid);

    if (existingUserIndex !== -1) {
      // User exists, optionally update their displayName if provided and different
      if (displayName && mockUsers[existingUserIndex].displayName !== displayName) {
        mockUsers[existingUserIndex].displayName = displayName;
        await saveMockUsers(mockUsers);
        console.log(`[API Add Mock User] User ${email} (ID: ${uid}) already in mock list. Updated displayName.`);
        return NextResponse.json({ message: 'User already in mock list, displayName updated.', user: mockUsers[existingUserIndex] }, { status: 200 });
      }
      console.log(`[API Add Mock User] User ${email} (ID: ${uid}) already exists in mock list. No changes made.`);
      return NextResponse.json({ message: 'User already in mock list. No changes made.' }, { status: 200 });
    }

    // User does not exist, add them
    const newUser: UserData = {
      id: uid, // Use Firebase UID as the ID
      email: email,
      displayName: displayName || email.split('@')[0] || 'User',
      role: 'Customer', // Default role for new sign-ups
      // linkedCustomerId will be undefined by default
    };

    mockUsers.push(newUser);
    await saveMockUsers(mockUsers);

    console.log(`[API Add Mock User] User ${email} (ID: ${uid}) added to mock-users.json`);
    return NextResponse.json({ message: 'User added to mock list successfully', user: newUser }, { status: 201 });

  } catch (error: any) {
    console.error('[API Add Mock User] Error processing request:', error);
    return NextResponse.json({ message: `Internal Server Error: ${error.message}` }, { status: 500 });
  }
}
