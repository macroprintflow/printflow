
'use server';

import { db } from '@/lib/firebase/clientApp';
import { 
  collection, 
  addDoc, 
  getDocs, 
  serverTimestamp, 
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
  CustomerListItem
} from '@/lib/definitions';
import { revalidatePath } from 'next/cache';

const CUSTOMERS_COLLECTION = 'customers';

/**
 * Adds a new customer to the Firestore 'customers' collection.
 */
export async function addCustomer(
  customerData: CustomerFormValues
): Promise<{ success: boolean; message: string; customerId?: string; customer?: CustomerData }> {
  try {
    const docRef = await addDoc(collection(db, CUSTOMERS_COLLECTION), {
      ...customerData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log('[CustomerActions] Customer added with ID:', docRef.id);
    revalidatePath('/customers'); // If you create a page to list all customers
    revalidatePath('/jobs/new'); // To refresh customer list in job card form
    
    const newCustomer: CustomerData = {
        id: docRef.id,
        ...customerData,
        createdAt: new Date().toISOString(), // Approximate for return, Firestore handles actual server time
        updatedAt: new Date().toISOString(),
    };
    return { success: true, message: 'Customer added successfully.', customerId: docRef.id, customer: newCustomer };
  } catch (error) {
    console.error('[CustomerActions] Error adding customer:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to add customer: ${errorMessage}` };
  }
}

/**
 * Fetches a list of customers (id and fullName) for selection purposes.
 */
export async function getCustomersList(): Promise<CustomerListItem[]> {
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
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
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
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString(),
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
  try {
    const customerDocRef = doc(db, CUSTOMERS_COLLECTION, customerId);
    await updateDoc(customerDocRef, {
      ...customerData,
      updatedAt: serverTimestamp(),
    });
    console.log(`[CustomerActions] Customer updated with ID: ${customerId}`);
    revalidatePath('/customers');
    revalidatePath(`/customers/${customerId}`); // If you have a detail page
    revalidatePath('/jobs/new');
    
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
  try {
    const customerDocRef = doc(db, CUSTOMERS_COLLECTION, customerId);
    await deleteDoc(customerDocRef);
    console.log(`[CustomerActions] Customer deleted with ID: ${customerId}`);
    revalidatePath('/customers');
    revalidatePath('/jobs/new');
    return { success: true, message: 'Customer deleted successfully.' };
  } catch (error) {
    console.error(`[CustomerActions] Error deleting customer ${customerId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to delete customer: ${errorMessage}` };
  }
}
