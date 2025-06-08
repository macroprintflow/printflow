
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, PlusCircle, Eye, Edit } from "lucide-react";
import { getAllCustomerData } from "@/lib/actions/customerActions"; // Import the action to get customer data
import type { CustomerData } from "@/lib/definitions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Image from "next/image";

export default async function CustomersPage() {
  const customers: CustomerData[] = await getAllCustomerData();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-headline flex items-center">
              <Users className="mr-2 h-6 w-6 text-primary" /> Customer Management
            </CardTitle>
            <CardDescription className="font-body">
              View, search, and manage all customers. (Currently using mock data)
            </CardDescription>
          </div>
          {/* "Add New Customer" button here might be redundant if it's in the sidebar submenu,
              but can be kept for discoverability or if the sidebar one is removed.
              The actual dialog is triggered from the sidebar in AppLayout.
          */}
          {/* 
          <Button asChild>
            <Link href="#"> <PlusCircle className="mr-2 h-4 w-4" /> Add New Customer </Link>
          </Button> 
          */}
        </CardHeader>
        <CardContent>
          {customers.length > 0 ? (
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
                      {/* Future: Link to a customer detail/edit page */}
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
                You can add new customers via the "Customers" menu in the sidebar.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
