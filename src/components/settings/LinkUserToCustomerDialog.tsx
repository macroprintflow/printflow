
"use client";

import React, { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { UserData, CustomerListItem } from "@/lib/definitions";
import { getCustomersList } from "@/lib/actions/customerActions";
import { linkUserToCustomerMock } from "@/lib/actions/userActions"; // Will create this action
import { useToast } from "@/hooks/use-toast";
import { Loader2, Link2 as LinkIcon, UserCircle, Building } from "lucide-react";

interface LinkUserToCustomerDialogProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  user: UserData | null;
  onLinkUpdated: () => void;
}

export function LinkUserToCustomerDialog({
  isOpen,
  setIsOpen,
  user,
  onLinkUpdated,
}: LinkUserToCustomerDialogProps) {
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [isSavingLink, setIsSavingLink] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && user) {
      setIsLoadingCustomers(true);
      setSelectedCustomerId(user.linkedCustomerId || undefined); // Pre-select if already linked
      getCustomersList()
        .then(setCustomers)
        .catch(() =>
          toast({
            title: "Error",
            description: "Could not load customer list.",
            variant: "destructive",
          })
        )
        .finally(() => setIsLoadingCustomers(false));
    } else {
      setSearchTerm(""); // Reset search term when dialog closes or no user
    }
  }, [isOpen, user, toast]);

  const filteredCustomers = customers.filter((customer) =>
    customer.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveLink = async () => {
    if (!user || !selectedCustomerId) {
      toast({
        title: "Selection Missing",
        description: "Please select a customer to link.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingLink(true);
    const result = await linkUserToCustomerMock(user.id, selectedCustomerId);
    setIsSavingLink(false);

    if (result.success) {
      toast({
        title: "Link Saved",
        description: `${user.displayName || user.email} linked to customer.`,
      });
      onLinkUpdated();
      setIsOpen(false);
    } else {
      toast({
        title: "Error",
        description: result.message || "Failed to save link.",
        variant: "destructive",
      });
    }
  };
  
  const handleUnlink = async () => {
    if (!user) return;
    setIsSavingLink(true);
    // Assuming customerId = "" means unlink for the mock action
    const result = await linkUserToCustomerMock(user.id, ""); 
    setIsSavingLink(false);

    if (result.success) {
      toast({
        title: "User Unlinked",
        description: `${user.displayName || user.email} has been unlinked from the customer.`,
      });
      onLinkUpdated();
      setIsOpen(false);
    } else {
      toast({
        title: "Error",
        description: result.message || "Failed to unlink user.",
        variant: "destructive",
      });
    }
  };


  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md font-body">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center">
            <LinkIcon className="mr-2 h-5 w-5 text-primary" /> Link User to Customer
          </DialogTitle>
          <DialogDescription>
            Link <span className="font-semibold">{user.displayName || user.email}</span> to an existing customer account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-3 p-3 rounded-md bg-muted/50 border">
            <UserCircle className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">{user.displayName}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div>
            <Label htmlFor="customerSearch" className="mb-1">Select Customer</Label>
            <Input
              id="customerSearch"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-2"
            />
            {isLoadingCustomers ? (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <Select
                value={selectedCustomerId}
                onValueChange={setSelectedCustomerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a customer account" />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-[200px]">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.fullName}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-4 text-sm text-center text-muted-foreground">
                        No customers match your search.
                      </div>
                    )}
                     {customers.length === 0 && !isLoadingCustomers && (
                        <div className="p-4 text-sm text-center text-muted-foreground">
                            No customers found. Add customers first.
                        </div>
                    )}
                  </ScrollArea>
                </SelectContent>
              </Select>
            )}
          </div>
           {user.linkedCustomerId && (
            <div className="flex items-center p-3 rounded-md bg-green-50 border border-green-200 dark:bg-green-900/30 dark:border-green-700">
              <Building className="mr-2 h-5 w-5 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-700 dark:text-green-300">
                Currently linked to: <span className="font-semibold">{customers.find(c => c.id === user.linkedCustomerId)?.fullName || user.linkedCustomerId}</span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between pt-4 border-t">
          {user.linkedCustomerId ? (
            <Button variant="destructive" onClick={handleUnlink} disabled={isSavingLink}>
              {isSavingLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Unlink User
            </Button>
          ) : (
            <div /> // Placeholder for layout if not linked
          )}
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSavingLink}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={handleSaveLink} disabled={isSavingLink || !selectedCustomerId}>
              {isSavingLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
              {user.linkedCustomerId ? "Update Link" : "Save Link"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

