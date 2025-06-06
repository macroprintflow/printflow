
"use client";
import type { ReactNode } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';

interface HeaderProps {
  title?: string;
  children?: ReactNode;
}

function getTitleFromPath(pathname: string): string {
  if (pathname.startsWith('/jobs/new')) return 'Create New Job Card';
  if (pathname.startsWith('/jobs')) return 'All Job Cards';
  if (pathname.startsWith('/dashboard')) return 'Dashboard';
  if (pathname.startsWith('/templates/new')) return 'Create New Job Template';
  if (pathname.startsWith('/templates')) return 'Manage Job Templates';
  if (pathname.startsWith('/planning')) return 'Production Planning';
  if (pathname.startsWith('/tasks')) return 'Departmental Tasks';
  if (pathname.startsWith('/inventory')) return 'Inventory Management';
  return 'PrintFlow';
}

export function Header({ title, children }: HeaderProps) {
  const pathname = usePathname();
  const pageTitle = title || getTitleFromPath(pathname);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <div className="md:hidden">
        <SidebarTrigger />
      </div>
      <h1 className="text-lg font-headline font-semibold md:text-xl">{pageTitle}</h1>
      <div className="ml-auto flex items-center gap-4">
        {pathname === '/jobs' && (
          <Button asChild size="sm">
            <Link href="/jobs/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Create Job Card
            </Link>
          </Button>
        )}
        {pathname === '/templates' && (
          <Button asChild size="sm">
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
