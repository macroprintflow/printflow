
"use client"; // This page now needs client-side interactivity for CSV export

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link"; // Keep Link if other links are present or might be added
import { Users, PlusCircle, Eye, Edit, Download } from "lucide-react"; // Added Download icon
import { getAllCustomerData } from "@/lib/actions/customerActions";
import type { CustomerData } from "@/lib/definitions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Image from "next/image";
import { useEffect, useState } from "react"; // Added for state management
import { useToast } from "@/hooks/use-toast"; // Added for potential feedback

const EXPECTED_CSV_HEADERS = ["fullName", "email", "phoneNumberCountryCode", "phoneNumber", "street", "city", "state", "zipCode", "country"];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchCustomers() {
      setIsLoading(true);
      try {
        const data = await getAllCustomerData();
        setCustomers(data);
      } catch (error) {
        console.error("Failed to fetch customers:", error);
        toast({ title: "Error", description: "Could not load customer data.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    }
    fetchCustomers();
  }, [toast]);

  const handleExportSampleCsv = () => {
    const headerString = EXPECTED_CSV_HEADERS.join(',') + '\r\n';
    const sampleRow1 = "John Doe,john.doe@example.com,+1,5551234567,123 Main St,Anytown,CA,90210,USA" + '\r\n';
    const sampleRow2 = "Jane Smith,jane.smith@example.com,+44,2079460958,456 Oak Ave,London,,SW1A 1AA,UK" + '\r\n';
    const sampleRow3 = "Amit Patel,amit.patel@example.in,+91,9876543210,789 Banyan Rd,Mumbai,MH,400001,India" + '\r\n';

    const csvString = headerString + sampleRow1 + sampleRow2 + sampleRow3;

    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) { // feature detection
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "sample-customers.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } else {
        toast({ title: "Export Failed", description: "Your browser does not support this feature.", variant: "destructive"});
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="font-headline flex items-center">
              <Users className="mr-2 h-6 w-6 text-primary" /> Customer Management
            </CardTitle>
            <CardDescription className="font-body">
              View, search, and manage all customers.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {/* Add New Customer is typically handled by the sidebar dialog, so no button here unless specifically desired */}
            <Button onClick={handleExportSampleCsv} variant="outline" className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" /> Export Sample CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="flex justify-center items-center py-12">
                <Users className="mx-auto h-12 w-12 text-muted-foreground animate-pulse" />
                 <p className="mt-4 text-lg text-muted-foreground font-body">Loading customers...</p>
            </div>
          ) : customers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-headline">Full Name</TableHead>
                  <TableHead className="font-headline">Email</TableHead>
                  <TableHead className="font-headline">Phone</TableHead>
                  <TableHead className="font-headline">City</TableHead>
                  <TableHead className="font-headline text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium font-body">{customer.fullName}</TableCell>
                    <TableCell className="font-body">{customer.email || '-'}</TableCell>
                    <TableCell className="font-body">
                      {customer.phoneNumber?.number 
                        ? `${customer.phoneNumber.countryCode || ''} ${customer.phoneNumber.number}` 
                        : '-'}
                    </TableCell>
                    <TableCell className="font-body">{customer.address?.city || '-'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="sm" disabled title="View Details (Coming Soon)"> 
                        <Eye className="mr-1 h-3 w-3" /> View
                      </Button>
                       <Button variant="outline" size="sm" disabled title="Edit Customer (Coming Soon)">
                        <Edit className="mr-1 h-3 w-3" /> Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Image src="https://placehold.co/300x200.png" alt="No Customers Yet" width={300} height={200} className="mb-6 rounded-lg mx-auto" data-ai-hint="empty state users"/>
              <h3 className="mt-4 text-xl font-semibold font-headline">No Customers Found</h3>
              <p className="mt-1 text-sm text-muted-foreground font-body">
                It looks like no customers have been added yet.
                You can add new customers via the "Customers" menu in the sidebar or by importing a CSV.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
