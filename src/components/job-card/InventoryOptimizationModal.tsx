
"use client";

import type { OptimizeInventoryInput, OptimizeInventoryOutput } from '@/ai/flows/inventory-optimization';
import type { InventorySuggestion } from '@/lib/definitions';
import { getInventoryOptimizationSuggestions } from '@/lib/actions/jobActions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface InventoryOptimizationModalProps {
  jobDetails: {
    paperGsm?: number;
    paperQuality?: string;
    jobSizeWidth?: number;
    jobSizeHeight?: number;
    netQuantity?: number;
  };
  onSuggestionSelect: (suggestion: InventorySuggestion) => void;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

export function InventoryOptimizationModal({
  jobDetails,
  onSuggestionSelect,
  isOpen,
  setIsOpen,
}: InventoryOptimizationModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<InventorySuggestion[]>([]);
  const [optimalSuggestion, setOptimalSuggestion] = useState<InventorySuggestion | undefined>(undefined);
  const { toast } = useToast();

  const handleFetchSuggestions = async () => {
    if (!jobDetails.paperGsm || !jobDetails.paperQuality || !jobDetails.jobSizeWidth || !jobDetails.jobSizeHeight || !jobDetails.netQuantity) {
       toast({
        title: "Missing Information",
        description: "Please fill in Paper GSM, Quality, Job Size, and Net Quantity to get suggestions.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setSuggestions([]);
    setOptimalSuggestion(undefined);

    const input: OptimizeInventoryInput = {
      paperGsm: jobDetails.paperGsm,
      paperQuality: jobDetails.paperQuality,
      jobSizeWidth: jobDetails.jobSizeWidth,
      jobSizeHeight: jobDetails.jobSizeHeight,
      netQuantity: jobDetails.netQuantity,
    };

    const result = await getInventoryOptimizationSuggestions(input);

    if ('error' in result) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    } else {
      setSuggestions(result.suggestions || []);
      setOptimalSuggestion(result.optimalSuggestion);
      if (!result.suggestions || result.suggestions.length === 0) {
        toast({
          title: "No Suggestions",
          description: "No suitable master sheet sizes found for the given criteria.",
        });
      }
    }
    setIsLoading(false);
  };

  const handleSelect = (suggestion: InventorySuggestion) => {
    onSuggestionSelect(suggestion);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-3xl font-body">
        <DialogHeader>
          <DialogTitle className="font-headline">Master Sheet Optimization</DialogTitle>
          <DialogDescription>
            Get suggestions for the best master sheet size to minimize wastage based on your job specifications.
            Click "Fetch Suggestions" after filling in Paper GSM, Quality, Job Size (in inches), and Net Quantity.
          </DialogDescription>
        </DialogHeader>
        
        <div className="my-4">
          <Button onClick={handleFetchSuggestions} disabled={isLoading} className="w-full">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Fetch Suggestions
          </Button>
        </div>

        {optimalSuggestion && (
          <div className="my-4 p-4 border border-green-500 bg-green-50 rounded-md">
            <h3 className="text-lg font-semibold text-green-700 font-headline">Optimal Suggestion</h3>
            <p className="text-sm text-green-600">
              Size: {optimalSuggestion.masterSheetSizeWidth.toFixed(2)}in x {optimalSuggestion.masterSheetSizeHeight.toFixed(2)}in | 
              Wastage: {optimalSuggestion.wastagePercentage.toFixed(2)}% | 
              Sheets/Master: {optimalSuggestion.sheetsPerMasterSheet} | 
              Total Masters: {optimalSuggestion.totalMasterSheetsNeeded}
            </p>
            <Button size="sm" className="mt-2 bg-green-600 hover:bg-green-700" onClick={() => handleSelect(optimalSuggestion)}>
              Use Optimal Suggestion
            </Button>
          </div>
        )}

        {suggestions.length > 0 && (
          <ScrollArea className="h-[300px] mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-headline">Master Sheet Size (in)</TableHead>
                  <TableHead className="font-headline text-right">Wastage %</TableHead>
                  <TableHead className="font-headline text-right">Sheets/Master</TableHead>
                  <TableHead className="font-headline text-right">Total Masters</TableHead>
                  <TableHead className="font-headline text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggestions.map((s, index) => (
                  <TableRow key={index} className={s === optimalSuggestion ? "bg-green-50" : ""}>
                    <TableCell>{s.masterSheetSizeWidth.toFixed(2)} x {s.masterSheetSizeHeight.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{s.wastagePercentage.toFixed(2)}%</TableCell>
                    <TableCell className="text-right">{s.sheetsPerMasterSheet}</TableCell>
                    <TableCell className="text-right">{s.totalMasterSheetsNeeded}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleSelect(s)}>
                        Select
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
        
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
