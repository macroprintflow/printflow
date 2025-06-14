
"use client";
import type { ReactNode } from 'react';
import * as React from 'react'; 
import { SidebarTrigger } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, Terminal } from 'lucide-react'; // Added Terminal
// Removed useAppConsole as setIsConsoleViewerOpen will be passed down if needed, or handled in AppLayout

interface HeaderProps {
  title?: string;
  children?: ReactNode;
  onToggleConsole?: () => void; // Optional prop to toggle console from AppLayout
}

function getCategoryDisplayNameFromSlug(slug: string): string {
  switch (slug) {
    case "paper": return "Paper";
    case "inks": return "Inks";
    case "plastic-trays": return "Plastic Trays";
    case "glass-jars": return "Glass Jars";
    case "magnets": return "Magnets";
    case "other-materials": return "Other Materials";
    default: return slug; 
  }
}

function getTitleFromPath(pathname: string): string {
  if (pathname.startsWith('/jobs/new')) return 'Create New Job Card';
  if (pathname.startsWith('/jobs')) return 'All Job Cards';
  if (pathname.startsWith('/dashboard')) return 'Dashboard';
  if (pathname.startsWith('/templates/new')) return 'Create New Job Template';
  if (pathname.startsWith('/templates')) return 'Manage Job Templates';
  if (pathname.startsWith('/planning')) return 'Production Planning';
  if (pathname.startsWith('/tasks')) return 'Departmental Tasks';
  
  const inventoryCategoryMatch = pathname.match(/^\/inventory\/([a-zA-Z0-9-]+)$/);
  if (inventoryCategoryMatch) {
    const categorySlug = inventoryCategoryMatch[1];
    return `Inventory - ${getCategoryDisplayNameFromSlug(categorySlug)}`;
  }
  if (pathname.startsWith('/inventory')) return 'Inventory Management';
  
  return 'PrintFlow';
}

export function Header({ title, children, onToggleConsole }: HeaderProps) {
  const pathname = usePathname();
  const pageTitle = title || getTitleFromPath(pathname);
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[var(--ios-border)] bg-[var(--ios-bg)] px-4 backdrop-blur-xl md:px-6">
      {isClient && (
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
      )}
      <h1 className="text-lg font-headline font-semibold md:text-xl text-foreground">{pageTitle}</h1>
      <div className="ml-auto flex items-center gap-4">
        {/* This button is now in AppLayout's user dropdown for better dev tool grouping */}
        {/* {onToggleConsole && (
          <Button variant="ghost" size="icon" onClick={onToggleConsole} title="Toggle App Console">
            <Terminal className="h-5 w-5" />
          </Button>
        )} */}
        {pathname === '/jobs' && (
          <Button asChild size="sm" variant="secondary">
            <Link href="/jobs/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Create Job Card
            </Link>
          </Button>
        )}
        {pathname === '/templates' && (
          <Button asChild size="sm" variant="secondary">
            <Link href="/templates/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Create Template
            </Link>
          </Button>
        )}
        {children}
      </div>
    </header>
  );
}
