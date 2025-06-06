
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

interface InventoryOptimizationModalProps {
  jobDetails: {
    paperGsm?: number;
    paperThicknessMm?: number; // Added for thickness
    paperQuality?: PaperQualityType;
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
    const qualityUnit = jobDetails.paperQuality ? getPaperQualityUnit(jobDetails.paperQuality) : null;
    let missingInfo = false;

    if (!jobDetails.paperQuality || jobDetails.paperQuality === '') missingInfo = true;
    if (qualityUnit === 'gsm' && !jobDetails.paperGsm) missingInfo = true;
    if (qualityUnit === 'mm' && !jobDetails.paperThicknessMm) missingInfo = true;
    if (!jobDetails.jobSizeWidth || !jobDetails.jobSizeHeight || !jobDetails.netQuantity) missingInfo = true;
    
    if (missingInfo) {
       toast({
        title: "Missing Information",
        description: `Please fill in Target Paper Quality, ${qualityUnit === 'mm' ? 'Thickness (mm)' : 'GSM'}, Job Size (in inches), and Net Quantity to get suggestions.`,
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
      paperQuality: jobDetails.paperQuality!, // Assert non-null as checked above
      jobSizeWidth: jobDetails.jobSizeWidth!,
      jobSizeHeight: jobDetails.jobSizeHeight!,
      netQuantity: jobDetails.netQuantity!,
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
            Click "Fetch Suggestions" after filling in Target Paper Quality, {getPaperQualityUnit(jobDetails.paperQuality as PaperQualityType) === 'mm' ? 'Thickness (mm)' : 'GSM'}, Job Size (in inches), and Net Quantity.
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
          <div className="my-4 p-4 border border-green-500 bg-green-50 rounded-md">
            <h3 className="text-lg font-semibold text-green-700 font-headline">Optimal Suggestion</h3>
            <p className="text-sm text-green-600">
              Sheet: {optimalSuggestion.masterSheetSizeWidth.toFixed(2)}in x {optimalSuggestion.masterSheetSizeHeight.toFixed(2)}in 
              ({renderSheetSpec(optimalSuggestion)}, Quality: {getPaperQualityLabel(optimalSuggestion.paperQuality as PaperQualityType)}) <br />
              Wastage: {optimalSuggestion.wastagePercentage.toFixed(2)}% | 
              Sheets/Master: {optimalSuggestion.sheetsPerMasterSheet} | 
              Total Masters: {optimalSuggestion.totalMasterSheetsNeeded} <br />
              Layout: {optimalSuggestion.cuttingLayoutDescription || 'N/A'}
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
                  <TableHead className="font-headline">Master Sheet (Inventory)</TableHead>
                  <TableHead className="font-headline">GSM/Thickness</TableHead>
                  <TableHead className="font-headline">Quality</TableHead>
                  <TableHead className="font-headline">Layout</TableHead>
                  <TableHead className="font-headline text-right">Wastage %</TableHead>
                  <TableHead className="font-headline text-right">Sheets/Master</TableHead>
                  <TableHead className="font-headline text-right">Total Masters</TableHead>
                  <TableHead className="font-headline text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggestions.map((s, index) => (
                  <TableRow key={s.sourceInventoryItemId || index} className={s.sourceInventoryItemId === optimalSuggestion?.sourceInventoryItemId ? "bg-green-50" : ""}>
                    <TableCell>{s.masterSheetSizeWidth.toFixed(2)} x {s.masterSheetSizeHeight.toFixed(2)}</TableCell>
                    <TableCell>{renderSheetSpec(s)}</TableCell>
                    <TableCell>
                        <Badge variant="outline">{getPaperQualityLabel(s.paperQuality as PaperQualityType)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.cuttingLayoutDescription || '-'}
                    </TableCell>
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

    