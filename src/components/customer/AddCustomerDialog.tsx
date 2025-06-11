
"use client";

import React, { useState, type Dispatch, type SetStateAction, useRef } from "react";
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
import { Loader2, UserPlus, Home, Mail, Phone, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AddCustomerDialogProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  onCustomerAdded?: (newCustomer: {id: string, fullName: string}) => void;
}

const EXPECTED_CSV_HEADERS = ["fullName", "email", "phoneNumberCountryCode", "phoneNumber", "street", "city", "state", "zipCode", "country"];


export function AddCustomerDialog({ isOpen, setIsOpen, onCustomerAdded }: AddCustomerDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImportCsvClick = () => {
    fileInputRef.current?.click();
  };

  const handleCsvFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingCsv(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast({ title: "Error Reading File", description: "Could not read the CSV file content.", variant: "destructive" });
        setIsImportingCsv(false);
        return;
      }

      const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== ''); // Split lines and remove empty ones
      if (lines.length < 2) {
        toast({ title: "Invalid CSV", description: "CSV file must contain a header row and at least one data row.", variant: "destructive" });
        setIsImportingCsv(false);
        return;
      }

      const headerLine = lines[0].split(',').map(h => h.trim());
      const dataLines = lines.slice(1);

      // Validate headers
      const missingHeaders = EXPECTED_CSV_HEADERS.filter(expectedHeader => !headerLine.includes(expectedHeader) && expectedHeader === "fullName"); // Only fullName is truly mandatory from headers
      if (missingHeaders.length > 0 && missingHeaders.includes("fullName")) {
          toast({ title: "Invalid CSV Header", description: `Missing mandatory header(s): ${missingHeaders.join(', ')}. Expected: ${EXPECTED_CSV_HEADERS.join(', ')}`, variant: "destructive", duration: 7000 });
          setIsImportingCsv(false);
          if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
          return;
      }
      
      const headerMap = headerLine.reduce((acc, header, index) => {
        acc[header] = index;
        return acc;
      }, {} as Record<string, number>);


      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const line of dataLines) {
        const values = line.split(',').map(v => v.trim());
        const customer: CustomerFormValues = {
          fullName: values[headerMap["fullName"]] || "",
          email: values[headerMap["email"]] || undefined,
          phoneNumber: {
            countryCode: values[headerMap["phoneNumberCountryCode"]] || "+91",
            number: values[headerMap["phoneNumber"]] || undefined,
          },
          address: {
            street: values[headerMap["street"]] || undefined,
            city: values[headerMap["city"]] || undefined,
            state: values[headerMap["state"]] || undefined,
            zipCode: values[headerMap["zipCode"]] || undefined,
            country: values[headerMap["country"]] || "India",
          },
        };

        // Basic validation for fullName
        if (!customer.fullName) {
          errorCount++;
          errors.push(`Skipped row (missing fullName): ${line.substring(0, 50)}...`);
          continue;
        }
        
        // Validate email if present
        if (customer.email) {
            const emailValidation = CustomerDataSchema.shape.email.safeParse(customer.email);
            if (!emailValidation.success) {
                errorCount++;
                errors.push(`Skipped row (invalid email for ${customer.fullName}): ${customer.email}`);
                continue;
            }
        }


        try {
          const result = await addCustomer(customer);
          if (result.success) {
            successCount++;
            if (onCustomerAdded && result.customerId && result.customer) {
              onCustomerAdded({id: result.customerId, fullName: result.customer.fullName});
            }
          } else {
            errorCount++;
            errors.push(`Failed to add ${customer.fullName}: ${result.message}`);
          }
        } catch (err) {
          errorCount++;
          errors.push(`Error adding ${customer.fullName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }

      toast({
        title: "CSV Import Complete",
        description: (
          <div>
            <p>Successfully added: {successCount} customer(s).</p>
            {errorCount > 0 && <p>Failed to add: {errorCount} customer(s).</p>}
            {errors.length > 0 && (
              <ScrollArea className="max-h-20 mt-2">
                <ul className="text-xs list-disc list-inside">
                  {errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </ScrollArea>
            )}
          </div>
        ),
        duration: errorCount > 0 ? 10000 : 5000,
      });
      setIsImportingCsv(false);
      if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
      if (successCount > 0) setIsOpen(false); // Close dialog if any customer was added
    };

    reader.onerror = () => {
      toast({ title: "Error Reading File", description: "An error occurred while trying to read the CSV file.", variant: "destructive" });
      setIsImportingCsv(false);
      if (fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
    };

    reader.readAsText(file);
  };


  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) form.reset(); // Reset form when dialog is closed
      setIsOpen(open);
    }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col font-body">
 <DialogHeader>
 <DialogTitle className="font-headline flex items-center">
            <UserPlus className="mr-2 h-6 w-6 text-primary" /> Add New Customer
          </DialogTitle>
          <DialogDescription>
            Fill in the details below to add a new customer to the system.
            <br />
            For CSV import, ensure headers are: {EXPECTED_CSV_HEADERS.join(', ')}
          </DialogDescription>
        </DialogHeader>
        
        <input 
          type="file"
          accept=".csv"
          ref={fileInputRef}
          onChange={handleCsvFileSelect}
          className="hidden"
        />

        <Form {...form}>
 <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
 <ScrollArea className="flex-1 overflow-y-auto">
              <div className="space-y-4 px-4 pb-4 pt-1">
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
                    render={({ field }) => ( 
                      <FormItem className="md:col-span-1">
                        <FormLabel>Country Code</FormLabel>
                        <Select
                          onValueChange={(selectedItemValue) => { 
                            const selectedCountry = COUNTRY_CODES.find(c => c.code === selectedItemValue);
                            if (selectedCountry) {
                              field.onChange(selectedCountry.dialCode); 
                            }
                          }}
                          value={COUNTRY_CODES.find(c => c.dialCode === field.value)?.code || ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select code" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COUNTRY_CODES.map(cc => (
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
                              value={field.value || "India"} 
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
              <Button type="button" variant="secondary" onClick={handleImportCsvClick} disabled={isSubmitting || isImportingCsv}>
                {isImportingCsv ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {isImportingCsv ? "Importing..." : "Import .csv"}
              </Button>
              <div className="flex gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isSubmitting || isImportingCsv}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting || isImportingCsv}>
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