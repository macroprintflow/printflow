
'use server';

import { db } from '@/lib/firebase/clientApp';
import { 
  collection, 
  addDoc, 
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
// import { revalidatePath } from 'next/cache'; // Commented out as it's not effective in this client-side mock setup
import { getJobCards } from '@/lib/actions/jobActions';


const CUSTOMERS_COLLECTION = 'customers';

/**
 * Adds a new customer to the Firestore 'customers' collection.
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
  console.log('[CustomerActions] db instance appears to be available. Proceeding to addDoc.');

  try {
    const docDataPayload = {
      ...customerData,
      createdAt: currentDate,
      updatedAt: currentDate,
    };
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
        if ('code' in error) { // Check if it's a FirebaseError-like object
            console.error('[CustomerActions] Firebase Error Code:', (error as any).code);
            errorMessage += ` (Code: ${(error as any).code})`;
        }
    }
    console.error('[CustomerActions] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return { success: false, message: `Failed to add customer: ${errorMessage}` };
  }
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
    
    const updatedCustomerData = await getCustomerById(customerId); // Fetch the updated data to return
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
    const allJobs = await getJobCards(); // Assumes getJobCards is working and available
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
