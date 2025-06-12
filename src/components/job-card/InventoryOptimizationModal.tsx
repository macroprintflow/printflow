
"use client";

import type { OptimizeInventoryOutput } from '@/ai/flows/inventory-optimization';
import type { InventorySuggestion, PaperQualityType } from '@/lib/definitions';
import { getPaperQualityLabel, getPaperQualityUnit, KAPPA_MDF_QUALITIES } from '@/lib/definitions';
import { getInventoryOptimizationSuggestions } from '@/lib/actions/jobActions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState, type Dispatch, type SetStateAction } from 'react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from "@/lib/utils";

interface InventoryOptimizationModalProps {
  jobDetails: {
    paperGsm?: number;
    paperThicknessMm?: number;
    paperQuality?: PaperQualityType;
    jobSizeWidth?: number;
    jobSizeHeight?: number;
    quantityForOptimization?: number;
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
    const qualityUnit = jobDetails.paperQuality ? getPaperQualityUnit(jobDetails.paperQuality) : null;
    let missingInfo = false;

    if (!jobDetails.paperQuality) missingInfo = true;
    if (qualityUnit === 'gsm' && !jobDetails.paperGsm) missingInfo = true;
    if (qualityUnit === 'mm' && !jobDetails.paperThicknessMm) missingInfo = true;
    if (!jobDetails.jobSizeWidth || !jobDetails.jobSizeHeight || !jobDetails.quantityForOptimization) missingInfo = true;

    if (missingInfo) {
      toast({
        title: "Missing Information",
        description: `Please fill in Target Paper Quality, ${qualityUnit === 'mm' ? 'Thickness (mm)' : 'GSM'}, Job Size (in inches), and Gross (or Net) Quantity to get suggestions.`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setSuggestions([]);
    setOptimalSuggestion(undefined);

    const actionInput = {
      paperGsm: jobDetails.paperGsm,
      paperThicknessMm: jobDetails.paperThicknessMm,
      paperQuality: jobDetails.paperQuality!,
      jobSizeWidth: jobDetails.jobSizeWidth!,
      jobSizeHeight: jobDetails.jobSizeHeight!,
      quantityToProduce: jobDetails.quantityForOptimization!,
    };

    const result = await getInventoryOptimizationSuggestions(actionInput) as OptimizeInventoryOutput | { error: string };

    if ('error' in result) {
      toast({
        title: "Error",
        description: (result as { error: string }).error,
        variant: "destructive",
      });
    } else {
      const aiResult = result as OptimizeInventoryOutput;
      setSuggestions(aiResult.suggestions || []);
      setOptimalSuggestion(aiResult.optimalSuggestion);
      if (!aiResult.suggestions || aiResult.suggestions.length === 0) {
        toast({
          title: "No Suitable Inventory Found",
          description: "No master sheets found in inventory matching the criteria or suitable for the job size.",
        });
      }
    }
    setIsLoading(false);
  };

  const handleSelect = (suggestion: InventorySuggestion) => {
    onSuggestionSelect(suggestion);
    setIsOpen(false);
  };

  const renderSheetSpec = (suggestion: InventorySuggestion) => {
    const unit = getPaperQualityUnit(suggestion.paperQuality as PaperQualityType);
    if (unit === 'mm' && suggestion.paperThicknessMm !== undefined) {
      return `Thickness: ${suggestion.paperThicknessMm}mm`;
    }
    if (unit === 'gsm' && suggestion.paperGsm !== undefined) {
      return `GSM: ${suggestion.paperGsm}`;
    }
    return suggestion.paperGsm ? `GSM: ${suggestion.paperGsm}` : suggestion.paperThicknessMm ? `Thickness: ${suggestion.paperThicknessMm}mm` : 'N/A';
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-5xl font-body">
        <DialogHeader>
          <DialogTitle className="font-headline">Master Sheet Optimization (from Inventory)</DialogTitle>
          <DialogDescription>
            Get suggestions for the best master sheet size from your current inventory to minimize wastage.
            Click "Fetch Suggestions" after filling in Target Paper Quality, {getPaperQualityUnit(jobDetails.paperQuality as PaperQualityType) === 'mm' ? 'Thickness (mm)' : 'GSM'}, Job Size (in inches), and Gross (or Net) Quantity.
            Suggestions are based on inventory items matching quality (exact) and GSM/Thickness (+/- tolerance).
          </DialogDescription>
        </DialogHeader>

        <div className="my-4">
          <Button onClick={handleFetchSuggestions} disabled={isLoading} className="w-full">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Fetch Suggestions from Inventory
          </Button>
        </div>

        {optimalSuggestion && (
          <div className="my-4 p-4 border border-primary bg-primary/10 text-primary-foreground dark:bg-gray-800 dark:text-white rounded-md">
            <h3 className="text-lg font-semibold font-headline text-primary dark:text-blue-400">Optimal Suggestion</h3>
            <p className="text-sm text-foreground dark:text-gray-200">
              Sheet: {optimalSuggestion.masterSheetSizeWidth.toFixed(2)}in x {optimalSuggestion.masterSheetSizeHeight.toFixed(2)}in
              ({renderSheetSpec(optimalSuggestion)}, Quality: {getPaperQualityLabel(optimalSuggestion.paperQuality as PaperQualityType)}) <br />
              Wastage: {optimalSuggestion.wastagePercentage.toFixed(2)}% |
              Sheets/Master: {optimalSuggestion.sheetsPerMasterSheet} |
              Total Masters Required: {optimalSuggestion.totalMasterSheetsNeeded} <br />
              Layout: {optimalSuggestion.cuttingLayoutDescription || 'N/A'} |
              Shortfall: {Math.max(0, (optimalSuggestion.totalMasterSheetsNeeded || 0) - (optimalSuggestion.availableQuantity || 0))}
            </p>
            <Button variant="default" size="sm" className="mt-2" onClick={() => handleSelect(optimalSuggestion)}>
              Use Optimal Suggestion
            </Button>
          </div>
        )}

        {suggestions.length > 0 && (
          <ScrollArea className="h-[300px] mt-4">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                  <TableHead className="font-headline text-gray-700 dark:text-gray-300">Master Sheet (Inventory)</TableHead>
                  <TableHead className="font-headline text-gray-700 dark:text-gray-300">GSM/Thickness</TableHead>
                  <TableHead className="font-headline text-gray-700 dark:text-gray-300">Quality</TableHead>
                  <TableHead className="font-headline text-gray-700 dark:text-gray-300">Layout</TableHead>
                  <TableHead className="font-headline text-gray-700 dark:text-gray-300 text-right">Wastage %</TableHead>
                  <TableHead className="font-headline text-gray-700 dark:text-gray-300 text-right">Sheets/Master</TableHead>
                  <TableHead className="font-headline text-gray-700 dark:text-gray-300 text-right">Total Masters Required</TableHead>
                  <TableHead className="font-headline text-gray-700 dark:text-gray-300 text-right">Shortfall</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggestions.map((s, index) => (
                  <TableRow
                    key={s.sourceInventoryItemId || index}
                    className={cn(
                      s.sourceInventoryItemId === optimalSuggestion?.sourceInventoryItemId
                        ? "bg-gray-800 text-white hover:bg-gray-700"  // Optimal row for dark, light handled by primary/10 above
                        : "bg-background text-foreground hover:bg-gray-100 dark:hover:bg-gray-900"
                    )}
                  >
                    <TableCell className="text-sm">{s.masterSheetSizeWidth.toFixed(2)} x {s.masterSheetSizeHeight.toFixed(2)}</TableCell>
                    <TableCell className="text-sm">{renderSheetSpec(s)}</TableCell>
                    <TableCell className="text-sm">
                      <Badge variant="outline">{getPaperQualityLabel(s.paperQuality as PaperQualityType)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.cuttingLayoutDescription || '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm">{s.wastagePercentage.toFixed(2)}%</TableCell>
                    <TableCell className="text-right text-sm">{s.sheetsPerMasterSheet}</TableCell>
                    <TableCell className="text-right text-sm">{s.totalMasterSheetsNeeded || 0}</TableCell>
                    <TableCell className={cn("text-right text-sm", (s.totalMasterSheetsNeeded || 0) > (s.availableQuantity || 0) && "text-red-500 dark:text-red-400")}>
                      <Button variant="default" size="sm" onClick={() => handleSelect(s)}>
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

