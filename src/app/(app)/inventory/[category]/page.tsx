
"use client"; 

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Archive, PlusCircle, Search, History, ArrowLeft, Printer, Layers, FileText, Newspaper, Box, ShoppingCart, Warehouse } from "lucide-react"; // Removed unused icons, added Layers
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useMemo, useCallback } from "react";
import { AddItemDialog } from "@/components/inventory/AddItemDialog";
import { InventoryAdjustmentsDialog } from "@/components/inventory/InventoryAdjustmentsDialog";
import { getInventoryItems } from "@/lib/actions/jobActions";
import type { InventoryItem, PaperQualityType, PaperSubCategoryFilterValue } from "@/lib/definitions";
import { PAPER_QUALITY_OPTIONS, PAPER_SUB_CATEGORIES, KAPPA_MDF_QUALITIES, getPaperQualityUnit, getPaperQualityLabel } from "@/lib/definitions";
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

const getSubCategoryDisplayName = (filterValue: PaperSubCategoryFilterValue | null): string => {
    if (!filterValue || filterValue === "__ALL_PAPER__") return "All Paper Types";
    const subCat = PAPER_SUB_CATEGORIES.find(sc => sc.filterValue === filterValue);
    return subCat ? subCat.name : "Paper";
}

const paperCategoryIcons: Record<PaperSubCategoryFilterValue, React.ElementType> = {
    "SBS": FileText,
    "KAPPA_GROUP": Newspaper,
    "GREYBACK": FileText,
    "WHITEBACK": FileText,
    "ART_PAPER_GROUP": Newspaper,
    "JAPANESE_PAPER": FileText,
    "IMPORTED_PAPER": FileText,
    "MDF": Box,
    "BUTTER_PAPER": FileText,
    "OTHER_PAPER_GROUP": Archive,
    "__ALL_PAPER__": Printer,
};


export default function CategorizedInventoryPage() {
  const params = useParams();
  const router = useRouter(); 
  const categorySlug = params.category as string;
  const categoryDisplayName = getCategoryDisplayName(categorySlug);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [isAdjustmentsDialogOpen, setIsAdjustmentsDialogOpen] = useState(false);
  const [selectedItemForAdjustments, setSelectedItemForAdjustments] = useState<InventoryItem | null>(null);
  const [selectedPaperQuality, setSelectedPaperQuality] = useState<PaperSubCategoryFilterValue | null>(null);
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

  const availableSpecsForSelectedQuality = useMemo(() => {
    if (!selectedPaperQuality || selectedPaperQuality === "__ALL_PAPER__") return [];

    // Find the definition for the selected paper quality (e.g., "SBS", "KAPPA_GROUP")
    const subCategoryDef = PAPER_SUB_CATEGORIES.find(sc => sc.filterValue === selectedPaperQuality);
    if (!subCategoryDef) return [];

    // Filter inventory items to get only those matching the selected paper quality and type 'Master Sheet'
    const itemsOfSelectedQuality = inventoryItems.filter(item => {
      if (item.type !== 'Master Sheet') return false;
      if (!item.paperQuality) return false;

      // For "OTHER_PAPER_GROUP", find items whose quality is not in any *other* defined sub-category.
      if (subCategoryDef.filterValue === "OTHER_PAPER_GROUP") {
        const allExplicitPaperQualities = PAPER_SUB_CATEGORIES
          .filter(sc => sc.filterValue !== "__ALL_PAPER__" && sc.filterValue !== "OTHER_PAPER_GROUP")
          .flatMap(sc => sc.qualityValues);
        return !allExplicitPaperQualities.includes(item.paperQuality as PaperQualityType);
      }
      // For specific paper groups, check if the item's quality is one of the values defined for that group.
      return subCategoryDef.qualityValues.includes(item.paperQuality as PaperQualityType);
    });
    
    if (itemsOfSelectedQuality.length === 0) return [];
    
    // Determine the unit (GSM or mm) based on the first item found for this quality.
    // This assumes all items of a certain quality (e.g., all SBS) use the same unit.
    const firstItemPaperQualityType = itemsOfSelectedQuality[0]?.paperQuality as PaperQualityType | undefined;
    if (!firstItemPaperQualityType) return []; 
    
    const unit = getPaperQualityUnit(firstItemPaperQualityType);
    if (!unit) return []; // If unit cannot be determined (should not happen for defined qualities)

    const specs = new Set<number>();
    if (unit === 'GSM') {
      itemsOfSelectedQuality.forEach(item => {
        // Crucial check: item must have a defined, positive, numeric GSM value.
        if (item.paperGsm !== undefined && typeof item.paperGsm === 'number' && item.paperGsm > 0) {
          specs.add(item.paperGsm);
        }
      });
    } else if (unit === 'mm') {
      itemsOfSelectedQuality.forEach(item => {
        // Crucial check: item must have a defined, positive, numeric Thickness value.
        if (item.paperThicknessMm !== undefined && typeof item.paperThicknessMm === 'number' && item.paperThicknessMm > 0) {
          specs.add(item.paperThicknessMm);
        }
      });
    }
    
    return Array.from(specs).sort((a,b) => a-b).map(value => ({ value, unit }));
  }, [inventoryItems, selectedPaperQuality]);

  const filteredItems = useMemo(() => {
    let itemsToFilter = [...inventoryItems]; 

    if (categorySlug === "paper") {
      itemsToFilter = itemsToFilter.filter(item => item.type === 'Master Sheet');

      if (selectedPaperQuality && selectedPaperQuality !== "__ALL_PAPER__") {
        const subCategoryDef = PAPER_SUB_CATEGORIES.find(sc => sc.filterValue === selectedPaperQuality);
        if (subCategoryDef) {
          itemsToFilter = itemsToFilter.filter(item => {
            if (!item.paperQuality) return false;
            if (subCategoryDef.filterValue === "OTHER_PAPER_GROUP") {
              const allExplicitPaperQualities = PAPER_SUB_CATEGORIES
                .filter(sc => sc.filterValue !== "__ALL_PAPER__" && sc.filterValue !== "OTHER_PAPER_GROUP")
                .flatMap(sc => sc.qualityValues);
              return !allExplicitPaperQualities.includes(item.paperQuality as PaperQualityType);
            }
            return subCategoryDef.qualityValues.includes(item.paperQuality as PaperQualityType);
          });

          if (selectedSpec) {
            itemsToFilter = itemsToFilter.filter(item => 
              selectedSpec.unit === 'GSM' ? item.paperGsm === selectedSpec.value : item.paperThicknessMm === selectedSpec.value
            );
          }
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
        (item.masterSheetSizeWidth && item.masterSheetSizeHeight && `${item.masterSheetSizeWidth.toFixed(1)} x ${item.masterSheetSizeHeight.toFixed(1)}in`.toLowerCase().includes(lowerCaseQuery)) ||
        item.type.toLowerCase().includes(lowerCaseQuery) ||
        (item.paperGsm && item.paperGsm.toString().includes(lowerCaseQuery)) ||
        (item.paperThicknessMm && item.paperThicknessMm.toString().includes(lowerCaseQuery)) ||
        (item.id && item.id.toLowerCase().includes(lowerCaseQuery)) ||
        (item.locationCode && item.locationCode.toLowerCase().includes(lowerCaseQuery))
      );
    }
    return itemsToFilter;
  }, [inventoryItems, searchQuery, categorySlug, selectedPaperQuality, selectedSpec]);

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
              const IconComponent = paperCategoryIcons[subCat.filterValue] || FileText;
              return (
                <Button 
                  key={subCat.filterValue} 
                  variant="outline" 
                  className="h-16 p-4 flex flex-col items-start justify-center text-left hover:shadow-md transition-shadow"
                  onClick={() => {
                    setSelectedPaperQuality(subCat.filterValue);
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

  const renderPaperSpecifications = () => {
    if (!selectedPaperQuality || selectedPaperQuality === "__ALL_PAPER__") { 
        return (
          <div className="space-y-6">
            <Button variant="outline" onClick={() => setSelectedPaperQuality(null)} className="mb-4 font-body">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Paper Types
            </Button>
            <Card>
              <CardHeader>
                <CardTitle className="font-headline">Error</CardTitle>
              </CardHeader>
              <CardContent><p className="font-body">Invalid state. Please go back and select a paper type.</p></CardContent>
            </Card>
          </div>
        );
    }

    if (availableSpecsForSelectedQuality.length === 0) {
        return (
            <div className="space-y-6">
            <Button variant="outline" onClick={() => setSelectedPaperQuality(null)} className="mb-4 font-body">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Paper Types
            </Button>
            <Card>
                <CardHeader>
                <CardTitle className="font-headline flex items-center">
                    <Layers className="mr-2 h-6 w-6 text-primary" /> 
                    No Stock or Specifications for {getSubCategoryDisplayName(selectedPaperQuality)}
                </CardTitle>
                </CardHeader>
                <CardContent className="text-center py-8">
                <p className="text-muted-foreground font-body">
                    No items of this paper type ({getSubCategoryDisplayName(selectedPaperQuality)}) are currently in stock with defined GSM/Thickness,
                    or no distinct GSM/Thickness values were found for existing stock. This could be because items are missing GSM/Thickness values or type is not 'Master Sheet'.
                </p>
                <Button className="mt-6 font-body" onClick={() => setIsAddItemDialogOpen(true)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Item to {getSubCategoryDisplayName(selectedPaperQuality)}
                </Button>
                </CardContent>
            </Card>
            </div>
        );
    }
    

    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => setSelectedPaperQuality(null)} className="mb-4 font-body">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Paper Types
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center">
              <Layers className="mr-2 h-6 w-6 text-primary" /> 
              Select Specification for {getSubCategoryDisplayName(selectedPaperQuality)}
            </CardTitle>
            <CardDescription className="font-body">
              Choose a specific GSM or Thickness for {getSubCategoryDisplayName(selectedPaperQuality).toLowerCase()}.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {availableSpecsForSelectedQuality.map((spec) => (
              <Button 
                key={`${spec.value}-${spec.unit}`}
                variant="outline" 
                className="h-16 p-4 flex flex-col items-start justify-center text-left hover:shadow-md transition-shadow"
                onClick={() => setSelectedSpec(spec)}
              >
                <div className="flex items-center">
                  <Layers className="mr-2 h-5 w-5 text-muted-foreground" />
                  <span className="font-medium font-body">{spec.value} {spec.unit}</span>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderInventoryTable = useCallback((items: InventoryItem[]) => {
    let currentFilterDisplayName = categoryDisplayName;
    if (categorySlug === "paper") {
      if (selectedPaperQuality && selectedPaperQuality !== "__ALL_PAPER__") {
        currentFilterDisplayName = getSubCategoryDisplayName(selectedPaperQuality);
        if (selectedSpec) {
          currentFilterDisplayName += ` - ${selectedSpec.value}${selectedSpec.unit}`;
        }
      } else if (selectedPaperQuality === "__ALL_PAPER__") {
        currentFilterDisplayName = "All Paper Types";
      } else {
        currentFilterDisplayName = "Paper"; 
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
              : `There are no inventory items currently matching: ${currentFilterDisplayName.toLowerCase()}.`
            }
          </p>
           <Button className="mt-6 font-body" onClick={() => setIsAddItemDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Item to {currentFilterDisplayName}
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
            <TableHead className="font-headline">Item Group/Quality</TableHead>
            <TableHead className="font-headline">GSM/Thickness</TableHead>
            <TableHead className="font-headline">Location</TableHead>
            <TableHead className="font-headline text-right">Available Stock</TableHead>
            <TableHead className="font-headline">Unit</TableHead>
            <TableHead className="font-headline text-right">Reorder Point</TableHead>
            <TableHead className="font-headline text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const itemNameDisplay = 
              (item.type === 'Master Sheet' && item.masterSheetSizeWidth && item.masterSheetSizeHeight)
                ? `${item.masterSheetSizeWidth.toFixed(1)} x ${item.masterSheetSizeHeight.toFixed(1)}in`
                : item.name;
            const itemFontWeight = 
              (item.type === 'Master Sheet' && item.masterSheetSizeWidth && item.masterSheetSizeHeight)
                ? 'font-semibold' 
                : 'font-medium';
            
            return (
              <TableRow key={item.id}>
                <TableCell 
                  className={`font-body ${itemFontWeight} hover:underline cursor-pointer`}
                  onClick={() => handleViewAdjustments(item)}
                >
                  {itemNameDisplay}
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
                <TableCell>
                  <Badge variant="default" className="font-body capitalize bg-accent text-accent-foreground">
                    {item.paperQuality ? getPaperQualityLabel(item.paperQuality) : item.itemGroup}
                  </Badge>
                </TableCell>
                <TableCell className="font-body">
                  {KAPPA_MDF_QUALITIES.includes(item.paperQuality as PaperQualityType) && item.paperThicknessMm ? `${item.paperThicknessMm} mm` : item.paperGsm ? `${item.paperGsm} GSM` : '-'}
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
  }, [isLoading, searchQuery, categoryDisplayName, selectedPaperQuality, selectedSpec, categorySlug, inventoryItems]); // Added inventoryItems dependency

  
  if (categorySlug === "paper") {
    if (!selectedPaperQuality) {
      return renderPaperSubCategories();
    }
    if (selectedPaperQuality !== "__ALL_PAPER__" && !selectedSpec) {
      return renderPaperSpecifications();
    }
  }


  let currentOverallCategoryName = categoryDisplayName;
  if (categorySlug === "paper") {
      if (selectedPaperQuality && selectedPaperQuality !== "__ALL_PAPER__") {
        currentOverallCategoryName = getSubCategoryDisplayName(selectedPaperQuality);
        if (selectedSpec) {
            currentOverallCategoryName += ` - ${selectedSpec.value}${selectedSpec.unit}`;
        }
      } else if (selectedPaperQuality === "__ALL_PAPER__") {
        currentOverallCategoryName = "All Paper Types";
      }
  }


  const handleBackButtonClick = () => {
    if (categorySlug === "paper") {
      if (selectedSpec) {
        setSelectedSpec(null); 
      } else if (selectedPaperQuality) {
        setSelectedPaperQuality(null); 
      } else {
        router.push('/inventory'); 
      }
    } else {
      router.push('/inventory'); 
    }
  };

  const backButtonText = categorySlug === "paper" 
    ? (selectedSpec ? "Back to Specifications" : (selectedPaperQuality && selectedPaperQuality !== "__ALL_PAPER__") ? "Back to Paper Types" : "Back to Main Categories")
    : "Back to Main Categories";


  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={handleBackButtonClick} className="mb-4 font-body">
        <ArrowLeft className="mr-2 h-4 w-4" /> {backButtonText}
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
             <Button className="w-full sm:w-auto font-body" variant="outline" onClick={() => setIsAddItemDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Single Item
            </Button>
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
      <AddItemDialog 
        isOpen={isAddItemDialogOpen} 
        setIsOpen={setIsAddItemDialogOpen} 
        onItemAdded={handleInventoryUpdate} 
      />
      <InventoryAdjustmentsDialog
        isOpen={isAdjustmentsDialogOpen}
        setIsOpen={setIsAdjustmentsDialogOpen}
        item={selectedItemForAdjustments}
      />
    </div>
  );
}

    
