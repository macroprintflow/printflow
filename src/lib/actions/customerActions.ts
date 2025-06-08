
'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { db } from '@/lib/firebase/clientApp'; // db is kept for when simulation is removed
import {
  // collection, // Commenting out actual Firestore imports for simulation
  // addDoc,
  // getDocs,
  // query,
  // orderBy,
  // doc,
  // getDoc,
  // updateDoc,
  // deleteDoc
} from 'firebase/firestore';
import type {
  CustomerFormValues,
  CustomerData,
  CustomerListItem,
  JobCardData
} from '@/lib/definitions';
// import { revalidatePath } from 'next/cache'; // Commented out as it's less relevant for client-side mock

const MOCK_CUSTOMERS_DIR = path.join(process.cwd(), '.data');
const MOCK_CUSTOMERS_FILE_PATH = path.join(MOCK_CUSTOMERS_DIR, 'mock-customers.json');

declare global {
  var __mockCustomersStore__: CustomerData[] | undefined;
  var __mockCustomerCounter__: number | undefined; // To ensure unique IDs for mock data
}

// Helper to ensure directory exists
async function ensureDataDirectoryExists(): Promise<void> {
  try {
    await fs.mkdir(MOCK_CUSTOMERS_DIR, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') { // Ignore if directory already exists
      console.error('[CustomerActions] Error creating mock data directory:', error);
      // Depending on how critical this is, you might throw or handle differently
    }
  }
}

async function loadMockCustomersFromFile(): Promise<CustomerData[]> {
  await ensureDataDirectoryExists(); // Ensure directory exists before trying to read/write
  try {
    const fileContent = await fs.readFile(MOCK_CUSTOMERS_FILE_PATH, 'utf-8');
    const customers = JSON.parse(fileContent) as CustomerData[];
    console.log(`[CustomerActions] Loaded ${customers.length} mock customers from file: ${MOCK_CUSTOMERS_FILE_PATH}`);
    return customers;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log(`[CustomerActions] Mock customers data file not found at ${MOCK_CUSTOMERS_FILE_PATH}. Starting with an empty store.`);
      return [];
    }
    console.error('[CustomerActions] Error reading mock customers data file:', error);
    return []; // Start with empty if error
  }
}

async function saveMockCustomersToFile(customers: CustomerData[]): Promise<void> {
  await ensureDataDirectoryExists(); // Ensure directory exists before trying to read/write
  try {
    await fs.writeFile(MOCK_CUSTOMERS_FILE_PATH, JSON.stringify(customers, null, 2), 'utf-8');
    console.log(`[CustomerActions] Saved ${customers.length} mock customers to file: ${MOCK_CUSTOMERS_FILE_PATH}`);
  } catch (error) {
    console.error('[CustomerActions] Error writing mock customers data file:', error);
  }
}

// Initialize store from file when the module first loads
// This IIFE (Immediately Invoked Function Expression) handles the async initialization.
(async () => {
  if (global.__mockCustomersStore__ === undefined) {
    console.log('[CustomerActions] Initializing mock customers store from file...');
    global.__mockCustomersStore__ = await loadMockCustomersFromFile();
    // Initialize counter based on loaded data to avoid ID collisions if file exists
    if (global.__mockCustomersStore__.length > 0) {
        const maxId = Math.max(...global.__mockCustomersStore__.map(c => parseInt(c.id!.replace('mock-', '') || '0')), 0);
        global.__mockCustomerCounter__ = maxId + 1;
    } else {
        global.__mockCustomerCounter__ = 1;
    }
    console.log(`[CustomerActions] Mock customer counter initialized to: ${global.__mockCustomerCounter__}`);
  }
})();


const CUSTOMERS_COLLECTION = 'customers'; // Kept for eventual real implementation

export async function addCustomer(
  customerData: CustomerFormValues
): Promise<{ success: boolean; message: string; customerId?: string; customer?: CustomerData }> {
  const currentDate = new Date().toISOString();
  console.log('[CustomerActions] addCustomer called with data (SIMULATED - File Persistent):', JSON.stringify(customerData, null, 2));

  // Ensure store is initialized (it should be by the IIFE, but as a fallback)
  if (global.__mockCustomersStore__ === undefined) {
    global.__mockCustomersStore__ = await loadMockCustomersFromFile();
    global.__mockCustomerCounter__ = (global.__mockCustomersStore__.length > 0 ? Math.max(...global.__mockCustomersStore__.map(c => parseInt(c.id!.replace('mock-', ''))), 0) : 0) + 1;
  }


  const mockCustomerId = `mock-${global.__mockCustomerCounter__!++}`;
  const newCustomer: CustomerData = {
      id: mockCustomerId,
      ...customerData,
      createdAt: currentDate,
      updatedAt: currentDate,
  };

  global.__mockCustomersStore__!.push(newCustomer);
  await saveMockCustomersToFile(global.__mockCustomersStore__!); // Save to file

  // revalidatePath('/customers'); // Usually for server-side data, less impact here but kept for consistency
  // revalidatePath('/jobs/new');
  console.log(`[CustomerActions] Customer ${newCustomer.fullName} added to mock store (file persistent) with ID ${newCustomer.id}.`);
  return { success: true, message: 'Customer added successfully (SIMULATED - File Persistent).', customerId: mockCustomerId, customer: newCustomer };
}

export async function getCustomersList(): Promise<CustomerListItem[]> {
  console.log('[CustomerActions] getCustomersList called (SIMULATED - File Persistent).');
  // Ensure store is initialized
  if (global.__mockCustomersStore__ === undefined) {
    global.__mockCustomersStore__ = await loadMockCustomersFromFile();
    global.__mockCustomerCounter__ = (global.__mockCustomersStore__.length > 0 ? Math.max(...global.__mockCustomersStore__.map(c => parseInt(c.id!.replace('mock-', ''))), 0) : 0) + 1;

  }

  if (global.__mockCustomersStore__ && global.__mockCustomersStore__.length > 0) {
    return global.__mockCustomersStore__.map(c => ({ id: c.id!, fullName: c.fullName })).sort((a,b) => a.fullName.localeCompare(b.fullName));
  }
  
  console.warn('[CustomerActions] Mock store is empty for getCustomersList, and Firestore fetch is bypassed. Returning empty list.');
  return [];
}

export async function getAllCustomerData(): Promise<CustomerData[]> {
   console.log('[CustomerActions] getAllCustomerData called (SIMULATED - File Persistent).');
   // Ensure store is initialized
  if (global.__mockCustomersStore__ === undefined) {
    global.__mockCustomersStore__ = await loadMockCustomersFromFile();
    global.__mockCustomerCounter__ = (global.__mockCustomersStore__.length > 0 ? Math.max(...global.__mockCustomersStore__.map(c => parseInt(c.id!.replace('mock-', ''))), 0) : 0) + 1;
  }

  if (global.__mockCustomersStore__ && global.__mockCustomersStore__.length > 0) {
    return [...global.__mockCustomersStore__].sort((a,b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }
  
  console.warn('[CustomerActions] Mock store is empty for getAllCustomerData, and Firestore fetch is bypassed. Returning empty list.');
  return [];
}

export async function getCustomerById(customerId: string): Promise<CustomerData | null> {
  console.log(`[CustomerActions] getCustomerById called for ID (SIMULATED - File Persistent): ${customerId}`);
  // Ensure store is initialized
  if (global.__mockCustomersStore__ === undefined) {
    global.__mockCustomersStore__ = await loadMockCustomersFromFile();
  }
  const customer = global.__mockCustomersStore__?.find(c => c.id === customerId);
  if (customer) {
    console.log(`[CustomerActions] Fetched mock customer by ID ${customerId}:`, customer.fullName);
    return customer;
  }
  console.log(`[CustomerActions] No mock customer found with ID: ${customerId}`);
  return null;
}

export async function updateCustomer(
  customerId: string,
  customerData: Partial<CustomerFormValues>
): Promise<{ success: boolean; message: string; customer?: CustomerData }> {
  const currentDate = new Date().toISOString();
  console.log(`[CustomerActions] updateCustomer called for ID (SIMULATED - File Persistent): ${customerId}`);
  // Ensure store is initialized
  if (global.__mockCustomersStore__ === undefined) {
    global.__mockCustomersStore__ = await loadMockCustomersFromFile();
  }

  const customerIndex = global.__mockCustomersStore__!.findIndex(c => c.id === customerId);
  if (customerIndex === -1) {
    return { success: false, message: "Customer not found in mock store for update." };
  }
  
  global.__mockCustomersStore__![customerIndex] = {
    ...global.__mockCustomersStore__![customerIndex],
    ...customerData,
    updatedAt: currentDate,
  };
  await saveMockCustomersToFile(global.__mockCustomersStore__!);
  
  // revalidatePath('/customers');
  // revalidatePath(`/customers/${customerId}`);
  // revalidatePath('/jobs/new');
  
  return { success: true, message: 'Customer updated successfully (SIMULATED - File Persistent).', customer: global.__mockCustomersStore__![customerIndex] };
}

export async function deleteCustomer(customerId: string): Promise<{ success: boolean; message: string }> {
  console.log(`[CustomerActions] deleteCustomer called for ID (SIMULATED - File Persistent): ${customerId}`);
  // Ensure store is initialized
  if (global.__mockCustomersStore__ === undefined) {
    global.__mockCustomersStore__ = await loadMockCustomersFromFile();
  }

  const initialLength = global.__mockCustomersStore__!.length;
  global.__mockCustomersStore__ = global.__mockCustomersStore__!.filter(c => c.id !== customerId);

  if (global.__mockCustomersStore__!.length < initialLength) {
    await saveMockCustomersToFile(global.__mockCustomersStore__!);
    // revalidatePath('/customers');
    // revalidatePath('/jobs/new');
    return { success: true, message: 'Customer deleted successfully (SIMULATED - File Persistent).' };
  }
  return { success: false, message: 'Customer not found in mock store for deletion.' };
}

export async function getJobsByCustomerName(customerName: string): Promise<JobCardData[]> {
  console.log(`[CustomerActions] getJobsByCustomerName called for (File Persistent): ${customerName}`);
  try {
    // Assuming getJobCards is in jobActions.ts and is working.
    const { getJobCards } = await import('@/lib/actions/jobActions'); // Dynamic import to avoid circular dependency issues if any
    const allJobs = await getJobCards();
    const customerJobs = allJobs.filter(job => job.customerName.toLowerCase() === customerName.toLowerCase());
    customerJobs.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateB !== dateA) {
        return dateB - dateA; // Sort by date descending
      }
      return a.jobName.localeCompare(b.jobName); // Then by job name ascending
    });
    console.log(`[CustomerActions] Found ${customerJobs.length} jobs for customer ${customerName}.`);
    return customerJobs;
  } catch (error) {
    console.error(`[CustomerActions] Error fetching jobs for customer ${customerName}:`, error);
    return [];
  }
}
    