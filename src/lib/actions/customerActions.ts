
'use server';

import { db } from '@/lib/firebase/clientApp';
import { 
  collection, 
  // addDoc, // Commenting out actual Firestore write
  getDocs, 
  query, 
  orderBy,
  doc,
  getDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import type { 
  CustomerFormValues, 
  CustomerData,
  CustomerListItem,
  JobCardData
} from '@/lib/definitions';
// import { revalidatePath } from 'next/cache'; 


const CUSTOMERS_COLLECTION = 'customers';

/**
 * Adds a new customer.
 * WARNING: This version is modified to SIMULATE a successful Firestore write.
 * The actual addDoc call is bypassed to unblock UI development due to persistent hanging issues.
 * This DOES NOT write to the actual Firestore database.
 */
export async function addCustomer(
  customerData: CustomerFormValues
): Promise<{ success: boolean; message: string; customerId?: string; customer?: CustomerData }> {
  const currentDate = new Date().toISOString();
  console.log('[CustomerActions] addCustomer called with data:', JSON.stringify(customerData, null, 2));

  if (!db) {
    console.error('[CustomerActions] CRITICAL: Firestore db instance is NOT initialized or available! This is a problem in clientApp.ts or Firebase setup.');
    return { success: false, message: 'Database connection error. Firestore instance is not available.' };
  }
  console.log('[CustomerActions] db instance appears to be available.');
  
  const docDataPayload = {
    ...customerData,
    createdAt: currentDate,
    updatedAt: currentDate,
  };
  console.log('[CustomerActions] Payload prepared:', JSON.stringify(docDataPayload, null, 2));

  // --- SIMULATION START ---
  console.warn('[CustomerActions] SIMULATING Firestore addDoc success. No data will be written to actual Firestore.');
  const mockCustomerId = `mock-${Date.now()}`;
  const newCustomer: CustomerData = {
      id: mockCustomerId,
      ...customerData,
      createdAt: currentDate, 
      updatedAt: currentDate,
  };
  // global.__mockCustomersStore__ = global.__mockCustomersStore__ || []; // If using a global mock store
  // global.__mockCustomersStore__.push(newCustomer);
  // revalidatePath('/customers'); 
  // revalidatePath('/jobs/new'); 
  return { success: true, message: 'Customer added successfully (SIMULATED).', customerId: mockCustomerId, customer: newCustomer };
  // --- SIMULATION END ---

  /* Original Firestore write attempt - currently bypassed
  try {
    console.log('[CustomerActions] Attempting addDoc to collection:', CUSTOMERS_COLLECTION, 'with payload:', JSON.stringify(docDataPayload, null, 2));
    
    const docRef = await addDoc(collection(db, CUSTOMERS_COLLECTION), docDataPayload);

    console.log('[CustomerActions] addDoc successful. Firestore Document ID:', docRef.id);
    
    const newCustomer: CustomerData = {
        id: docRef.id,
        ...customerData,
        createdAt: currentDate, 
        updatedAt: currentDate,
    };
    // revalidatePath('/customers'); 
    // revalidatePath('/jobs/new'); 
    return { success: true, message: 'Customer added successfully.', customerId: docRef.id, customer: newCustomer };
  } catch (error) {
    console.error('[CustomerActions] Firebase Error caught while adding customer:', error);
    let errorMessage = 'An unexpected error occurred while adding the customer.';
    if (error instanceof Error) {
        errorMessage = error.message;
        if ('code' in error) { 
            console.error('[CustomerActions] Firebase Error Code:', (error as any).code);
            errorMessage += ` (Code: ${(error as any).code})`;
        }
    }
    console.error('[CustomerActions] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return { success: false, message: `Failed to add customer: ${errorMessage}` };
  }
  */
}

/**
 * Fetches a list of customers (id and fullName) for selection purposes.
 */
export async function getCustomersList(): Promise<CustomerListItem[]> {
  console.log('[CustomerActions] getCustomersList called.');
  if (!db) {
    console.error('[CustomerActions] CRITICAL: Firestore db instance is NOT initialized for getCustomersList.');
    return [];
  }

  // --- SIMULATION FOR getCustomersList IF REAL FETCH FAILS ---
  // This part can be enabled if getDocs also hangs. For now, assuming reads might work.
  // if (global.__mockCustomersStore__ && global.__mockCustomersStore__.length > 0) {
  //   console.warn('[CustomerActions] SIMULATING getCustomersList from mock store.');
  //   return global.__mockCustomersStore__.map(c => ({ id: c.id!, fullName: c.fullName }));
  // }
  // --- END SIMULATION ---

  try {
    const customersCollection = collection(db, CUSTOMERS_COLLECTION);
    const q = query(customersCollection, orderBy('fullName', 'asc'));
    const querySnapshot = await getDocs(q);
    
    const customers: CustomerListItem[] = querySnapshot.docs.map(doc => ({
      id: doc.id,
      fullName: doc.data().fullName as string,
    }));
    
    console.log(`[CustomerActions] Fetched ${customers.length} customers for list.`);
    return customers;
  } catch (error) {
    console.error('[CustomerActions] Error fetching customers list:', error);
    return [];
  }
}

/**
 * Fetches all customer documents with their full data.
 */
export async function getAllCustomerData(): Promise<CustomerData[]> {
   console.log('[CustomerActions] getAllCustomerData called.');
  if (!db) {
    console.error('[CustomerActions] CRITICAL: Firestore db instance is NOT initialized for getAllCustomerData.');
    return [];
  }
  try {
    const customersCollection = collection(db, CUSTOMERS_COLLECTION);
    const q = query(customersCollection, orderBy('createdAt', 'desc')); // Or 'fullName'
    const querySnapshot = await getDocs(q);
    
    const customers: CustomerData[] = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        fullName: data.fullName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        address: data.address,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      } as CustomerData;
    });
    
    console.log(`[CustomerActions] Fetched ${customers.length} full customer data records.`);
    return customers;
  } catch (error) {
    console.error('[CustomerActions] Error fetching all customer data:', error);
    return [];
  }
}

/**
 * Fetches a single customer document by ID.
 */
export async function getCustomerById(customerId: string): Promise<CustomerData | null> {
  console.log(`[CustomerActions] getCustomerById called for ID: ${customerId}`);
  if (!db) {
    console.error(`[CustomerActions] CRITICAL: Firestore db instance is NOT initialized for getCustomerById: ${customerId}.`);
    return null;
  }
  try {
    const customerDocRef = doc(db, CUSTOMERS_COLLECTION, customerId);
    const docSnap = await getDoc(customerDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const customer: CustomerData = {
        id: docSnap.id,
        fullName: data.fullName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        address: data.address,
        createdAt: data.createdAt, 
        updatedAt: data.updatedAt, 
      };
      console.log(`[CustomerActions] Fetched customer by ID ${customerId}:`, customer.fullName);
      return customer;
    } else {
      console.log(`[CustomerActions] No customer found with ID: ${customerId}`);
      return null;
    }
  } catch (error) {
    console.error(`[CustomerActions] Error fetching customer by ID ${customerId}:`, error);
    return null;
  }
}

/**
 * Updates an existing customer in the Firestore 'customers' collection.
 */
export async function updateCustomer(
  customerId: string,
  customerData: Partial<CustomerFormValues>
): Promise<{ success: boolean; message: string; customer?: CustomerData }> {
  const currentDate = new Date().toISOString();
  console.log(`[CustomerActions] updateCustomer called for ID: ${customerId} with data:`, JSON.stringify(customerData, null, 2));
  if (!db) {
    console.error(`[CustomerActions] CRITICAL: Firestore db instance is NOT initialized for updateCustomer: ${customerId}.`);
    return { success: false, message: 'Database connection error.' };
  }
  try {
    const customerDocRef = doc(db, CUSTOMERS_COLLECTION, customerId);
    await updateDoc(customerDocRef, {
      ...customerData,
      updatedAt: currentDate, 
    });
    console.log(`[CustomerActions] Customer updated with ID: ${customerId}`);
    // revalidatePath('/customers');
    // revalidatePath(`/customers/${customerId}`); 
    // revalidatePath('/jobs/new');
    
    const updatedCustomerData = await getCustomerById(customerId); 
    return { success: true, message: 'Customer updated successfully.', customer: updatedCustomerData || undefined };
  } catch (error) {
    console.error(`[CustomerActions] Error updating customer ${customerId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to update customer: ${errorMessage}` };
  }
}

/**
 * Deletes a customer from the Firestore 'customers' collection.
 */
export async function deleteCustomer(customerId: string): Promise<{ success: boolean; message: string }> {
  console.log(`[CustomerActions] deleteCustomer called for ID: ${customerId}`);
  if (!db) {
    console.error(`[CustomerActions] CRITICAL: Firestore db instance is NOT initialized for deleteCustomer: ${customerId}.`);
    return { success: false, message: 'Database connection error.' };
  }
  try {
    const customerDocRef = doc(db, CUSTOMERS_COLLECTION, customerId);
    await deleteDoc(customerDocRef);
    console.log(`[CustomerActions] Customer deleted with ID: ${customerId}`);
    // revalidatePath('/customers');
    // revalidatePath('/jobs/new');
    return { success: true, message: 'Customer deleted successfully.' };
  } catch (error) {
    console.error(`[CustomerActions] Error deleting customer ${customerId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to delete customer: ${errorMessage}` };
  }
}

export async function getJobsByCustomerName(customerName: string): Promise<JobCardData[]> {
  console.log(`[CustomerActions] getJobsByCustomerName called for: ${customerName}`);
  try {
    // Assuming getJobCards is in jobActions.ts and is working.
    // This import might need adjustment if getJobCards itself is problematic.
    const { getJobCards } = await import('@/lib/actions/jobActions');
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
