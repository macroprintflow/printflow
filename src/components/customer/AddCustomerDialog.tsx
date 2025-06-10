
"use client";

import React, { useState, type Dispatch, type SetStateAction } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { CustomerFormValues } from "@/lib/definitions";
import { CustomerDataSchema, COUNTRY_CODES } from "@/lib/definitions";
import { addCustomer } from "@/lib/actions/customerActions";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, UserPlus, Home, Mail, Phone, Upload } from "lucide-react"; // Added Upload icon
import { useToast } from "@/hooks/use-toast";

interface AddCustomerDialogProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  onCustomerAdded?: (newCustomer: {id: string, fullName: string}) => void;
}

export function AddCustomerDialog({ isOpen, setIsOpen, onCustomerAdded }: AddCustomerDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(CustomerDataSchema.omit({ id: true, createdAt: true, updatedAt: true })),
    defaultValues: {
      fullName: "",
      email: "",
      phoneNumber: { countryCode: "+91", number: "" },
      address: { street: "", city: "", state: "", zipCode: "", country: "India" },
    },
  });

  async function onSubmit(values: CustomerFormValues) {
    setIsSubmitting(true);
    try {
      const result = await addCustomer(values);
      if (result.success && result.customerId && result.customer) {
        toast({
          title: "Customer Added",
          description: `${values.fullName} has been successfully added.`,
        });
        form.reset();
        setIsOpen(false);
        if (onCustomerAdded) {
          onCustomerAdded({id: result.customerId, fullName: result.customer.fullName});
        }
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to add customer.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Add customer error:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while adding the customer.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) form.reset(); // Reset form when dialog is closed
      setIsOpen(open);
    }}>
      <DialogContent className="sm:max-w-2xl font-body">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center">
            <UserPlus className="mr-2 h-6 w-6 text-primary" /> Add New Customer
          </DialogTitle>
          <DialogDescription>
            Fill in the details below to add a new customer to the system.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <ScrollArea className="max-h-[60vh] p-1 pr-4 -mr-2">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (Optional)</FormLabel>
                      <FormControl>
                         <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input type="email" placeholder="e.g., john.doe@example.com" {...field} value={field.value ?? ""} className="pl-10"/>
                         </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <FormField
                    control={form.control}
                    name="phoneNumber.countryCode"
                    render={({ field }) => ( // field.value here is the dialCode from the form state
                      <FormItem className="md:col-span-1">
                        <FormLabel>Country Code</FormLabel>
                        <Select
                          onValueChange={(selectedItemValue) => { // selectedItemValue is cc.code
                            const selectedCountry = COUNTRY_CODES.find(c => c.code === selectedItemValue);
                            if (selectedCountry) {
                              field.onChange(selectedCountry.dialCode); // Update form with dialCode
                            }
                          }}
                          // Convert the form's dialCode (field.value) back to a cc.code for the Select's value
                          value={COUNTRY_CODES.find(c => c.dialCode === field.value)?.code || ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select code" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COUNTRY_CODES.map(cc => (
                              // Use unique cc.code as the SelectItem's value
                              <SelectItem key={cc.code} value={cc.code}> 
                                {cc.name} ({cc.dialCode})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phoneNumber.number"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Phone Number (Optional)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input type="tel" placeholder="e.g., 9876543210" {...field} value={field.value ?? ""} className="pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2 pt-2">
                    <FormLabel className="flex items-center"><Home className="mr-2 h-5 w-5 text-muted-foreground" /> Address (Optional)</FormLabel>
                    <FormField
                    control={form.control}
                    name="address.street"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-xs text-muted-foreground pl-1">Street Address</FormLabel>
                        <FormControl>
                            <Textarea placeholder="e.g., 123 Main St, Apt 4B" {...field} value={field.value ?? ""} rows={2}/>
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name="address.city"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs text-muted-foreground pl-1">City</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., New Delhi" {...field} value={field.value ?? ""} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="address.state"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs text-muted-foreground pl-1">State / Province</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., Delhi" {...field} value={field.value ?? ""} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="address.zipCode"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs text-muted-foreground pl-1">ZIP / Postal Code</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., 110001" {...field} value={field.value ?? ""} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    </div>
                     <FormField
                        control={form.control}
                        name="address.country"
                        render={({ field }) => (
                        <FormItem>
                             <FormLabel className="text-xs text-muted-foreground pl-1">Country</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              value={field.value || "India"} // Default to India if undefined
                            >
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select country" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {COUNTRY_CODES.map(cc => (
                                <SelectItem key={cc.code} value={cc.name}> 
                                    {cc.name}
                                </SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="pt-6 border-t sm:justify-between">
              <Button type="button" variant="secondary" disabled={isSubmitting} onClick={() => toast({ title: "Coming Soon!", description: "CSV import functionality will be available in a future update."})}>
                <Upload className="mr-2 h-4 w-4" />
                Import .csv
              </Button>
              <div className="flex gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isSubmitting}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  {isSubmitting ? "Adding Customer..." : "Add Customer"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
