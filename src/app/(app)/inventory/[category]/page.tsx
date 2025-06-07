
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Archive, PlusCircle, Search, History, ArrowLeft, Printer, Layers, FileText, Newspaper, Box, ShoppingCart, Warehouse, Wand2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useMemo, useCallback } from "react";
import { InventoryAdjustmentsDialog } from "@/components/inventory/InventoryAdjustmentsDialog";
import { getInventoryItems } from "@/lib/actions/jobActions";
import type { InventoryItem, PaperQualityType, PaperSubCategoryFilterValue, PaperSubCategory, ArtPaperFinishFilterValue, KappaFinishFilterValue, SubCategoryFinishFilterValue } from "@/lib/definitions";
import { PAPER_SUB_CATEGORIES, KAPPA_MDF_QUALITIES, getPaperQualityUnit, getPaperQualityLabel } from "@/lib/definitions";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

const getCategoryDisplayName = (slug: string | string[] | undefined): string => {
  if (typeof slug !== 'string') return "Inventory";
  switch (slug) {
    case "paper": return "Paper";
    case "inks": return "Inks";
    case "plastic-trays": return "Plastic Trays";
    case "glass-jars": return "Glass Jars";
    case "magnets": return "Magnets";
    case "other-materials": return "Other Materials";
    default: return "Inventory";
  }
};

// Helper function to format dimension numbers
const formatDimension = (num?: number): string => {
  if (num === undefined || num === null) return '';
  if (Number.isInteger(num)) {
    return num.toString();
  }
  return num.toFixed(1); // Keep one decimal if not an integer
};

export default function CategorizedInventoryPage() {
  const params = useParams();
  const router = useRouter();
  const categorySlug = params.category as string;
  const categoryDisplayName = getCategoryDisplayName(categorySlug);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [isAdjustmentsDialogOpen, setIsAdjustmentsDialogOpen] = useState(false);
  const [selectedItemForAdjustments, setSelectedItemForAdjustments] = useState<InventoryItem | null>(null);

  const [selectedPaperQualityFilter, setSelectedPaperQualityFilter] = useState<PaperSubCategoryFilterValue | null>(null);
  const [selectedSubCategoryFinishFilter, setSelectedSubCategoryFinishFilter] = useState<SubCategoryFinishFilterValue | null>(null);
  const [selectedSpec, setSelectedSpec] = useState<{ value: number; unit: 'GSM' | 'mm' } | null>(null);

  const fetchInventory = useCallback(async () => {
    setIsLoading(true);
    const items = await getInventoryItems();
    setInventoryItems(items);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleInventoryUpdate = () => {
    fetchInventory();
  };

  const currentPaperSubCategoryDefinition = useMemo(() => {
    if (!selectedPaperQualityFilter) return null;
    return PAPER_SUB_CATEGORIES.find(sc => sc.filterValue === selectedPaperQualityFilter) || null;
  }, [selectedPaperQualityFilter]);

  const getDynamicSpecsFromInventory = useCallback(() => {
    if (!currentPaperSubCategoryDefinition) return [];

    let qualitiesToMatch: PaperQualityType[] = [];
    if(currentPaperSubCategoryDefinition.filterValue === "OTHER_PAPER_GROUP"){
       // For "OTHER_PAPER_GROUP", qualitiesToMatch remains empty; filter logic below handles it.
    } else if (currentPaperSubCategoryDefinition.subFinishes && selectedSubCategoryFinishFilter) {
      const finishDef = currentPaperSubCategoryDefinition.subFinishes.find(f => f.finishFilterValue === selectedSubCategoryFinishFilter);
      if (finishDef) {
          qualitiesToMatch = [finishDef.actualQualityValue];
      } else {
          return []; // Explicitly return empty array if selected finish is not found
      }
    } else {
        qualitiesToMatch = currentPaperSubCategoryDefinition.qualityValues;
    }

    const itemsOfSelectedQuality = inventoryItems.filter(item => {
      if (item.type !== 'Master Sheet') return false;
      if (!item.paperQuality) return false;
      if ((item.availableStock ?? 0) <= 0) return false;


      if(currentPaperSubCategoryDefinition.filterValue === "OTHER_PAPER_GROUP"){
         const allExplicitPaperQualities = PAPER_SUB_CATEGORIES
            .filter(sc => sc.filterValue !== "__ALL_PAPER__" && sc.filterValue !== "OTHER_PAPER_GROUP")
            .flatMap(sc => sc.qualityValues);
        return !allExplicitPaperQualities.includes(item.paperQuality as PaperQualityType);
      }
      return qualitiesToMatch.includes(item.paperQuality as PaperQualityType);
    });


    if (itemsOfSelectedQuality.length === 0) return [];
    
    let unit: 'GSM' | 'mm' | null = null;
    if (currentPaperSubCategoryDefinition.subFinishes && selectedSubCategoryFinishFilter) {
        const finishDef = currentPaperSubCategoryDefinition.subFinishes.find(f => f.finishFilterValue === selectedSubCategoryFinishFilter);
        if(finishDef) unit = finishDef.specUnit;
    } else if (currentPaperSubCategoryDefinition.specUnit) {
        unit = currentPaperSubCategoryDefinition.specUnit;
    } else {
        const firstItemPaperQualityType = itemsOfSelectedQuality[0]?.paperQuality as PaperQualityType | undefined;
        if (firstItemPaperQualityType) unit = getPaperQualityUnit(firstItemPaperQualityType);
    }

    if (!unit) return [];

    const specs = new Set<number>();
    if (unit === 'GSM') {
      itemsOfSelectedQuality.forEach(item => {
        if (item.paperGsm !== undefined && typeof item.paperGsm === 'number' && item.paperGsm > 0) {
          specs.add(item.paperGsm);
        }
      });
    } else if (unit === 'mm') {
      itemsOfSelectedQuality.forEach(item => {
        if (item.paperThicknessMm !== undefined && typeof item.paperThicknessMm === 'number' && item.paperThicknessMm > 0) {
          specs.add(item.paperThicknessMm);
        }
      });
    }
    return Array.from(specs).sort((a, b) => a - b).map(value => ({ value, unit: unit!, type: 'spec' as const }));
  }, [inventoryItems, currentPaperSubCategoryDefinition, selectedSubCategoryFinishFilter]);


  const specsToDisplay = useMemo(() => {
    if (!currentPaperSubCategoryDefinition) return [];

    if (currentPaperSubCategoryDefinition.subFinishes && currentPaperSubCategoryDefinition.subFinishes.length > 0) {
      if (!selectedSubCategoryFinishFilter) {
        return currentPaperSubCategoryDefinition.subFinishes.map(finish => ({
          name: finish.name,
          value: finish.finishFilterValue,
          type: 'finish' as const,
          icon: finish.icon || Wand2,
        }));
      } else {
        const selectedFinishDef = currentPaperSubCategoryDefinition.subFinishes.find(f => f.finishFilterValue === selectedSubCategoryFinishFilter);
        if (selectedFinishDef && selectedFinishDef.predefinedSpecs) {
          return selectedFinishDef.predefinedSpecs.map(specValue => ({
            value: specValue,
            unit: selectedFinishDef.specUnit,
            type: 'spec' as const,
          }));
        }
        const dynamicSpecs = getDynamicSpecsFromInventory();
        if (dynamicSpecs.length === 0 && selectedFinishDef) { 
            return [];
        }
        return dynamicSpecs;
      }
    }

    if (currentPaperSubCategoryDefinition.predefinedSpecs && currentPaperSubCategoryDefinition.specUnit) {
      return currentPaperSubCategoryDefinition.predefinedSpecs.map(specValue => ({
        value: specValue,
        unit: currentPaperSubCategoryDefinition.specUnit!,
        type: 'spec' as const,
      }));
    }
    return getDynamicSpecsFromInventory();
  }, [currentPaperSubCategoryDefinition, selectedSubCategoryFinishFilter, getDynamicSpecsFromInventory]);


  const filteredItems = useMemo(() => {
    let itemsToFilter = [...inventoryItems];

    if (categorySlug === "paper") {
      itemsToFilter = itemsToFilter.filter(item => item.type === 'Master Sheet');

      if (currentPaperSubCategoryDefinition && currentPaperSubCategoryDefinition.filterValue !== "__ALL_PAPER__") {
        let targetPaperQualities: PaperQualityType[] = [];

        if (currentPaperSubCategoryDefinition.subFinishes && selectedSubCategoryFinishFilter) {
          const finishDef = currentPaperSubCategoryDefinition.subFinishes.find(f => f.finishFilterValue === selectedSubCategoryFinishFilter);
          if (finishDef) targetPaperQualities = [finishDef.actualQualityValue];
        } else {
          targetPaperQualities = currentPaperSubCategoryDefinition.qualityValues;
        }
        
        if (currentPaperSubCategoryDefinition.filterValue === "OTHER_PAPER_GROUP") {
            const allExplicitPaperQualities = PAPER_SUB_CATEGORIES
              .filter(sc => sc.filterValue !== "__ALL_PAPER__" && sc.filterValue !== "OTHER_PAPER_GROUP")
              .flatMap(sc => sc.qualityValues);
            itemsToFilter = itemsToFilter.filter(item => item.paperQuality && !allExplicitPaperQualities.includes(item.paperQuality as PaperQualityType));
        } else if (targetPaperQualities.length > 0) {
             itemsToFilter = itemsToFilter.filter(item => item.paperQuality && targetPaperQualities.includes(item.paperQuality as PaperQualityType));
        }


        if (selectedSpec) {
          itemsToFilter = itemsToFilter.filter(item =>
            selectedSpec.unit === 'GSM' ? item.paperGsm === selectedSpec.value : item.paperThicknessMm === selectedSpec.value
          );
        }
      }
    } else if (categorySlug === "inks") {
      itemsToFilter = itemsToFilter.filter(item => item.itemGroup === "Inks");
    } else if (categorySlug === "plastic-trays") {
      itemsToFilter = itemsToFilter.filter(item => item.itemGroup === "Plastic Trays");
    } else if (categorySlug === "glass-jars") {
      itemsToFilter = itemsToFilter.filter(item => item.itemGroup === "Glass Jars");
    } else if (categorySlug === "magnets") {
      itemsToFilter = itemsToFilter.filter(item => item.itemGroup === "Magnets");
    } else if (categorySlug === "other-materials") {
      itemsToFilter = itemsToFilter.filter(item => item.itemGroup === "Other Stock");
    } else {
      itemsToFilter = [];
    }

    if (searchQuery.trim() !== "") {
      const lowerCaseQuery = searchQuery.toLowerCase();
      itemsToFilter = itemsToFilter.filter(item =>
        item.name.toLowerCase().includes(lowerCaseQuery) ||
        (item.masterSheetSizeWidth && item.masterSheetSizeHeight && `${formatDimension(item.masterSheetSizeWidth)} x ${formatDimension(item.masterSheetSizeHeight)} in`.toLowerCase().includes(lowerCaseQuery)) ||
        item.type.toLowerCase().includes(lowerCaseQuery) ||
        (item.paperGsm && item.paperGsm.toString().includes(lowerCaseQuery)) ||
        (item.paperThicknessMm && item.paperThicknessMm.toString().includes(lowerCaseQuery)) ||
        (item.id && item.id.toLowerCase().includes(lowerCaseQuery)) ||
        (item.locationCode && item.locationCode.toLowerCase().includes(lowerCaseQuery))
      );
    }
    return itemsToFilter;
  }, [inventoryItems, searchQuery, categorySlug, currentPaperSubCategoryDefinition, selectedSubCategoryFinishFilter, selectedSpec]);


  const handleViewAdjustments = (item: InventoryItem) => {
    setSelectedItemForAdjustments(item);
    setIsAdjustmentsDialogOpen(true);
  };

  const renderPaperSubCategories = () => {
    return (
      <div className="space-y-6">
        <Button variant="outline" asChild className="mb-4 font-body">
          <Link href="/inventory">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Main Categories
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center">
              <Printer className="mr-2 h-6 w-6 text-primary" /> Select Paper Type
            </CardTitle>
            <CardDescription className="font-body">
              Choose a specific type of paper to view its stock.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {PAPER_SUB_CATEGORIES.map((subCat) => {
              const IconComponent = subCat.icon || FileText;
              return (
                <Button
                  key={subCat.filterValue}
                  variant="outline"
                  className="h-16 p-4 flex flex-col items-start justify-center text-left hover:shadow-md transition-shadow"
                  onClick={() => {
                    setSelectedPaperQualityFilter(subCat.filterValue);
                    setSelectedSubCategoryFinishFilter(null);
                    setSelectedSpec(null);
                  }}
                >
                  <div className="flex items-center">
                    <IconComponent className="mr-2 h-5 w-5 text-muted-foreground" />
                    <span className="font-medium font-body">{subCat.name}</span>
                  </div>
                </Button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderFinishesOrSpecs = () => {
    if (!currentPaperSubCategoryDefinition || currentPaperSubCategoryDefinition.filterValue === "__ALL_PAPER__") {
        return <p>Invalid selection or "All Paper" view selected.</p>;
    }

    const title = selectedSubCategoryFinishFilter && currentPaperSubCategoryDefinition.subFinishes
      ? `Select Specification for ${currentPaperSubCategoryDefinition.subFinishes.find(f => f.finishFilterValue === selectedSubCategoryFinishFilter)?.name || currentPaperSubCategoryDefinition.name}`
      : currentPaperSubCategoryDefinition.subFinishes
        ? `Select Finish for ${currentPaperSubCategoryDefinition.name}`
        : `Select Specification for ${currentPaperSubCategoryDefinition.name}`;

    const description = selectedSubCategoryFinishFilter
      ? `Choose a specific GSM or Thickness for the selected finish.`
      : currentPaperSubCategoryDefinition.subFinishes
        ? `Choose a finish for ${currentPaperSubCategoryDefinition.name.toLowerCase()}.`
        : `Choose a specific GSM or Thickness for ${currentPaperSubCategoryDefinition.name.toLowerCase()}.`;

    if (specsToDisplay.length === 0) {
      return (
        <div className="space-y-6">
          <Button variant="outline" onClick={() => {
            if (selectedSubCategoryFinishFilter) setSelectedSubCategoryFinishFilter(null);
            else setSelectedPaperQualityFilter(null);
          }} className="mb-4 font-body">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Card>
            <CardHeader>
              <CardTitle className="font-headline flex items-center">
                <Layers className="mr-2 h-6 w-6 text-primary" />
                No Specifications for {title.replace("Select Specification for ", "").replace("Select Finish for ", "")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground font-body">
                No predefined or dynamically found specifications for this selection.
                This could mean no items of this type are in stock with defined GSM/Thickness, or this paper type has no predefined specs.
              </p>
              <Button asChild className="mt-6 font-body">
                <Link href="/inventory/new-purchase">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New Item to Purchase
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => {
          if (selectedSpec) {
             setSelectedSpec(null);
          } else if (selectedSubCategoryFinishFilter) {
             setSelectedSubCategoryFinishFilter(null);
          } else {
             setSelectedPaperQualityFilter(null);
          }
        }} className="mb-4 font-body">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center">
              <Layers className="mr-2 h-6 w-6 text-primary" /> {title}
            </CardTitle>
            <CardDescription className="font-body">{description}</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {specsToDisplay.map((specItem) => {
              const IconComponent = specItem.type === 'finish' ? (specItem.icon || Wand2) : Layers;
              const buttonText = specItem.type === 'finish' ? specItem.name : `${specItem.value} ${specItem.unit}`;
              return (
                <Button
                  key={specItem.type === 'finish' ? specItem.value : `${specItem.value}-${specItem.unit}`}
                  variant="outline"
                  className="h-16 p-4 flex flex-col items-start justify-center text-left hover:shadow-md transition-shadow"
                  onClick={() => {
                    if (specItem.type === 'finish') {
                      setSelectedSubCategoryFinishFilter(specItem.value as SubCategoryFinishFilterValue);
                      setSelectedSpec(null); 
                    } else {
                      setSelectedSpec({ value: specItem.value, unit: specItem.unit as 'GSM' | 'mm' });
                    }
                  }}
                >
                  <div className="flex items-center">
                    <IconComponent className="mr-2 h-5 w-5 text-muted-foreground" />
                    <span className="font-medium font-body">{buttonText}</span>
                  </div>
                </Button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    );
  };


  const renderInventoryTable = useCallback((items: InventoryItem[]) => {
    let currentFilterDisplayName = categoryDisplayName;
    if (categorySlug === "paper") {
      if (currentPaperSubCategoryDefinition) {
        currentFilterDisplayName = currentPaperSubCategoryDefinition.name;
        if (selectedSubCategoryFinishFilter && currentPaperSubCategoryDefinition.subFinishes) {
           const finishDef = currentPaperSubCategoryDefinition.subFinishes.find(f => f.finishFilterValue === selectedSubCategoryFinishFilter);
           if(finishDef) currentFilterDisplayName = finishDef.name;
        }
        if (selectedSpec) {
          currentFilterDisplayName += ` - ${selectedSpec.value}${selectedSpec.unit}`;
        }
      } else if (selectedPaperQualityFilter === "__ALL_PAPER__") {
        currentFilterDisplayName = "All Paper Types";
      }
    }


    if (isLoading) {
      return (
        <div className="text-center py-12">
          <Archive className="mx-auto h-12 w-12 text-muted-foreground animate-pulse" />
          <p className="mt-4 text-lg text-muted-foreground font-body">Loading {currentFilterDisplayName.toLowerCase()} inventory...</p>
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <div className="text-center py-12">
          <Archive className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold font-headline">
            {searchQuery.trim() !== "" ? `No ${currentFilterDisplayName} Match Your Search` : `No Items in ${currentFilterDisplayName}`}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground font-body">
            {searchQuery.trim() !== ""
              ? "Try adjusting your search terms or clearing the search."
              : `There are no inventory items currently matching: ${currentFilterDisplayName.toLowerCase()}. Ensure items have positive stock.`
            }
          </p>
           <Button asChild className="mt-6 font-body">
             <Link href="/inventory/new-purchase">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Item to Purchase
             </Link>
          </Button>
        </div>
      );
    }
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-headline">Item Name (Size)</TableHead>
            <TableHead className="font-headline">Type</TableHead>
            <TableHead className="font-headline">Location</TableHead>
            <TableHead className="font-headline text-right">Available Stock</TableHead>
            <TableHead className="font-headline">Unit</TableHead>
            <TableHead className="font-headline text-right">Reorder Point</TableHead>
            <TableHead className="font-headline text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
             const isMasterSheetWithDims = item.type === 'Master Sheet' && item.masterSheetSizeWidth && item.masterSheetSizeHeight;
             const itemNameDisplay = isMasterSheetWithDims
                ? `${formatDimension(item.masterSheetSizeWidth)} x ${formatDimension(item.masterSheetSizeHeight)} in`
                : item.name;

            return (
              <TableRow key={item.id}>
                <TableCell
                  className={`font-body hover:underline cursor-pointer`}
                  onClick={() => handleViewAdjustments(item)}
                >
                  {isMasterSheetWithDims ? (
                    <span className="text-base font-semibold">{itemNameDisplay}</span>
                  ) : (
                    <span className="font-medium">{itemNameDisplay}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={
                    item.type === 'Master Sheet' ? 'secondary' :
                    item.type === 'Paper Stock' ? 'outline' :
                    item.type === 'Ink' ? 'default' : 'secondary'
                  } className="font-body capitalize">
                    {item.type}
                  </Badge>
                </TableCell>
                <TableCell className="font-body">
                  <div className="flex items-center">
                   {item.locationCode && <Warehouse className="mr-1.5 h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                   {item.locationCode || '-'}
                  </div>
                </TableCell>
                <TableCell className="font-body text-right">{item.availableStock?.toLocaleString() ?? 0}</TableCell>
                <TableCell className="font-body">{item.unit}</TableCell>
                <TableCell className="font-body text-right">{item.reorderPoint ? item.reorderPoint.toLocaleString() : '-'}</TableCell>
                <TableCell className="text-center">
                  <Button variant="ghost" size="icon" onClick={() => handleViewAdjustments(item)} title="View Stock History">
                    <History className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }, [isLoading, searchQuery, categoryDisplayName, categorySlug, currentPaperSubCategoryDefinition, selectedSubCategoryFinishFilter, selectedSpec, inventoryItems]);


  if (categorySlug === "paper") {
    if (!selectedPaperQualityFilter) {
      return renderPaperSubCategories();
    }
    if (currentPaperSubCategoryDefinition &&
        currentPaperSubCategoryDefinition.filterValue !== "__ALL_PAPER__" &&
        (
          (currentPaperSubCategoryDefinition.subFinishes && !selectedSubCategoryFinishFilter) ||
          (!selectedSpec)
        ) &&
        specsToDisplay.length > 0
      ) {
      return renderFinishesOrSpecs();
    }
  }

  let currentOverallCategoryName = categoryDisplayName;
   if (categorySlug === "paper") {
      if (currentPaperSubCategoryDefinition) {
        currentOverallCategoryName = currentPaperSubCategoryDefinition.name;
         if (selectedSubCategoryFinishFilter && currentPaperSubCategoryDefinition.subFinishes) {
           const finishDef = currentPaperSubCategoryDefinition.subFinishes.find(f => f.finishFilterValue === selectedSubCategoryFinishFilter);
           if(finishDef) currentOverallCategoryName = finishDef.name;
        }
        if (selectedSpec) {
            currentOverallCategoryName += ` - ${selectedSpec.value}${selectedSpec.unit}`;
        }
      } else if (selectedPaperQualityFilter === "__ALL_PAPER__") {
        currentOverallCategoryName = "All Paper Types";
      }
  }


  const handleBackButtonClick = () => {
    if (categorySlug === "paper") {
      if (selectedSpec) {
        setSelectedSpec(null);
      } else if (selectedSubCategoryFinishFilter) {
        setSelectedSubCategoryFinishFilter(null);
      } else if (selectedPaperQualityFilter) {
        setSelectedPaperQualityFilter(null);
      } else {
        router.push('/inventory');
      }
    } else {
      router.push('/inventory');
    }
  };

  const getBackButtonText = () => {
    if (categorySlug === "paper") {
      if (selectedSpec) return "Back to Specifications";
      if (selectedSubCategoryFinishFilter && currentPaperSubCategoryDefinition?.subFinishes) return `Back to ${currentPaperSubCategoryDefinition.name} Finishes`;
      if (selectedPaperQualityFilter) return "Back to Paper Types";
    }
    return "Back to Main Categories";
  };

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={handleBackButtonClick} className="mb-4 font-body">
        <ArrowLeft className="mr-2 h-4 w-4" /> {getBackButtonText()}
      </Button>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="font-headline flex items-center">
              <Archive className="mr-2 h-6 w-6 text-primary" /> {currentOverallCategoryName} Inventory
            </CardTitle>
            <CardDescription className="font-body">
              View and manage your stock. Click item name for stock history.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-grow sm:flex-grow-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${currentOverallCategoryName.toLowerCase()}...`}
                className="pl-10 w-full sm:w-64 font-body"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button asChild className="w-full sm:w-auto font-body">
              <Link href="/inventory/new-purchase">
                <ShoppingCart className="mr-2 h-4 w-4" /> Enter Purchase
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {renderInventoryTable(filteredItems)}
        </CardContent>
      </Card>
      
      <InventoryAdjustmentsDialog
        isOpen={isAdjustmentsDialogOpen}
        setIsOpen={setIsAdjustmentsDialogOpen}
        item={selectedItemForAdjustments}
      />
    </div>
  );
}

    