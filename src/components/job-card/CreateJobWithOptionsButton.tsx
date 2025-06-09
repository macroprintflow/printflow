
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PlusCircle, FileText, FilePlus2 } from "lucide-react";

export function CreateJobWithOptionsButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");

  const handleOptionClick = (option: "prefill" | "new") => {
    if (option === "prefill") {
      setModalTitle("Pre-Fill from Past Job");
    } else {
      setModalTitle("Create New Job");
    }
    setIsModalOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="font-body">
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Job
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="font-body">
          <DropdownMenuItem onClick={() => handleOptionClick("prefill")} className="font-body">
            <FileText className="mr-2 h-4 w-4" />
            Pre-Fill from Past Job
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleOptionClick("new")} className="font-body">
            <FilePlus2 className="mr-2 h-4 w-4" />
            New Job
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="font-body">
          <DialogHeader>
            <DialogTitle className="font-headline">{modalTitle}</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center">
            <p className="text-xl font-semibold">Step 1</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="font-body">
              Cancel
            </Button>
            <Button onClick={() => {
              setIsModalOpen(false);
              // Placeholder for next step logic
            }} className="font-body">
              Next
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
