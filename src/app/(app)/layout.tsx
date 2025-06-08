
"use client";
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarSeparator, // Import SidebarSeparator
} from '@/components/ui/sidebar';
import AppLogo from '@/components/AppLogo';
import { Header } from '@/components/layout/Header';
import { LayoutDashboard, Briefcase, FileUp, FilePlus2, CalendarCheck2, ClipboardList, UserCircle, Settings, Archive, LogOut, type LucideIcon, ShoppingBag, Check, Loader2, ChevronRight, ListChecks, ChevronDown, UserRoundPlus, Users } from 'lucide-react'; // Added Users
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub as RadixDropdownMenuSub,
  DropdownMenuSubTrigger as RadixDropdownMenuSubTrigger,
  DropdownMenuSubContent as RadixDropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from '@/components/ui/button';
import ClientOnlyWrapper from '@/components/ClientOnlyWrapper';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/clientApp';
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/lib/definitions';
// Import AddCustomerDialog if it exists, or prepare for it
// import { AddCustomerDialog } from '@/components/customer/AddCustomerDialog';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  allowedRoles: UserRole[];
  isSubmenuTrigger?: boolean; // To identify items that open submenus
}

const allNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, allowedRoles: ['Admin', 'Manager'] },
  { href: '#jobs-trigger', label: 'Jobs', icon: Briefcase, allowedRoles: ['Admin', 'Manager'], isSubmenuTrigger: true },
  { href: '#customers-trigger', label: 'Customers', icon: Users, allowedRoles: ['Admin', 'Manager'], isSubmenuTrigger: true }, // New Customers menu
  { href: '/for-approval', label: 'For Approval', icon: FileUp, allowedRoles: ['Admin', 'Manager'] },
  { href: '/planning', label: 'Production Planning', icon: CalendarCheck2, allowedRoles: ['Admin', 'Manager'] },
  { href: '/tasks', label: 'Departmental Tasks', icon: ClipboardList, allowedRoles: ['Admin', 'Manager', 'Departmental'] },
  { href: '/inventory', label: 'Inventory', icon: Archive, allowedRoles: ['Admin', 'Manager'] },
  { href: '/customer/my-jobs', label: 'My Jobs', icon: ShoppingBag, allowedRoles: ['Customer'] },
];

const ADMIN_EMAIL = "kuvam@macroprinters.com".toLowerCase();
const MANAGER_EMAIL = "niharikasehgal0512@gmail.com".toLowerCase();
const DEPARTMENTAL_EMAIL = "niharikasehgal@icloud.com".toLowerCase();

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isClient, setIsClient] = React.useState(false);
  const [effectiveUserRole, setEffectiveUserRole] = React.useState<UserRole>("Customer");
  const [isRoleFromDevTool, setIsRoleFromDevTool] = React.useState(false);
  const [isLoadingRole, setIsLoadingRole] = React.useState(true);
  const isDeterminingRoleRef = React.useRef(false);

  const [isJobsSubmenuOpen, setIsJobsSubmenuOpen] = React.useState(pathname.startsWith('/jobs'));
  const [isCustomersSubmenuOpen, setIsCustomersSubmenuOpen] = React.useState(pathname.startsWith('/customers')); // State for Customers submenu
  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = React.useState(false); // State for AddCustomerDialog

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    const determineRoleLogic = async () => {
      if (isDeterminingRoleRef.current || loading) {
        return;
      }

      isDeterminingRoleRef.current = true;
      setIsLoadingRole(true);

      if (!user) {
        if (pathname !== '/login' && pathname !== '/signup') {
          router.push('/login');
        }
        setIsLoadingRole(false);
        isDeterminingRoleRef.current = false;
        return;
      }

      if (isRoleFromDevTool) {
        setIsLoadingRole(false);
        isDeterminingRoleRef.current = false;
        return;
      }

      let roleToSet: UserRole;
      const userEmailLower = user.email?.toLowerCase();

      if (userEmailLower === ADMIN_EMAIL) {
        roleToSet = "Admin";
      } else if (userEmailLower === MANAGER_EMAIL) {
        roleToSet = "Manager";
      } else if (userEmailLower === DEPARTMENTAL_EMAIL) {
        roleToSet = "Departmental";
      } else {
        roleToSet = "Customer";
      }

      if (effectiveUserRole !== roleToSet) {
        setEffectiveUserRole(roleToSet);
      }
      setIsLoadingRole(false);
      isDeterminingRoleRef.current = false;
    };

    determineRoleLogic();
  }, [user, loading, isRoleFromDevTool, router, effectiveUserRole, pathname]);


  const visibleNavItems = React.useMemo(() =>
    allNavItems.filter(item =>
      item.allowedRoles.includes(effectiveUserRole)
    ), [effectiveUserRole]);

  React.useEffect(() => {
    if (!isLoadingRole && user && visibleNavItems.length > 0) {
      const defaultRoutes: Record<UserRole, string> = {
        Admin: '/dashboard',
        Manager: '/dashboard',
        Departmental: '/tasks',
        Customer: '/customer/my-jobs',
      };

      const roleDefaultRoute = defaultRoutes[effectiveUserRole];

      const isCurrentPathAllowedOrSubPath = visibleNavItems.some(item => {
        if (item.href === '#jobs-trigger') return pathname.startsWith('/jobs');
        if (item.href === '#customers-trigger') return pathname.startsWith('/customers') || isAddCustomerDialogOpen; // Consider dialog open state
        return pathname.startsWith(item.href);
      });


      if (!isCurrentPathAllowedOrSubPath && pathname !== roleDefaultRoute && !pathname.startsWith('/login') && !pathname.startsWith('/signup') && !pathname.startsWith('/profile')) {
        const isDefaultRouteVisible = visibleNavItems.some(item => item.href === roleDefaultRoute || (item.href === '#jobs-trigger' && roleDefaultRoute.startsWith('/jobs')) || (item.href === '#customers-trigger' && roleDefaultRoute.startsWith('/customers')));
        if (isDefaultRouteVisible) {
          router.replace(roleDefaultRoute);
        } else {
          handleLogout();
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingRole, user, effectiveUserRole, pathname, router, visibleNavItems, isAddCustomerDialogOpen]);


  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      setIsRoleFromDevTool(false);
      setEffectiveUserRole("Customer");
      router.push('/login');
    } catch (error) {
      console.error("Logout error:", error);
      toast({ title: 'Logout Failed', description: 'Could not log you out. Please try again.', variant: 'destructive' });
    }
  };

  const handleRoleSwitch = (newRole: UserRole) => {
    setEffectiveUserRole(newRole);
    setIsRoleFromDevTool(true);
    toast({ title: 'Dev Tool: Role Switched', description: `Viewing as ${newRole}. (Session only)`});
  };

  if (loading || isLoadingRole || (!user && pathname !== '/login' && pathname !== '/signup')) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && (pathname === '/login' || pathname === '/signup')) {
     return <ClientOnlyWrapper>{children}</ClientOnlyWrapper>;
  }

  const userDisplayName = user?.displayName || user?.email?.split('@')[0] || "User";
  const userEmailDisplay = user?.email || "No email";
  const userRoleDisplay = effectiveUserRole;
  const isDesignatedAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  return (
    <ClientOnlyWrapper>
      <SidebarProvider defaultOpen>
        <Sidebar variant="sidebar" collapsible="icon" className="bg-card text-card-foreground">
          <SidebarHeader className="p-4 justify-between items-center">
            <AppLogo />
            {isClient && (
              <div className="hidden group-data-[collapsible=icon]:block">
                <SidebarTrigger />
              </div>
            )}
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {visibleNavItems.map((item, index) => (
                <React.Fragment key={item.href}>
                  {/* Add Separator between logical groups */}
                  {index > 0 && !item.isSubmenuTrigger && !visibleNavItems[index-1].isSubmenuTrigger &&
                   (item.label === "For Approval" || item.label === "Inventory" || item.label === "My Jobs") && // Logic for separators
                    <SidebarSeparator className="my-1" />
                  }

                  {item.href === '#jobs-trigger' && (
                    <SidebarMenuItem>
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <SidebarMenuButton
                            isActive={pathname.startsWith('/jobs')}
                            onClick={() => setIsJobsSubmenuOpen(!isJobsSubmenuOpen)}
                          >
                            <span className="flex items-center gap-2 w-full">
                              <item.icon className="h-5 w-5 shrink-0" />
                              <span className="truncate">{item.label}</span>
                              {isJobsSubmenuOpen ? <ChevronDown className="ml-auto h-4 w-4 shrink-0" /> : <ChevronRight className="ml-auto h-4 w-4 shrink-0" />}
                            </span>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right" align="center" className="font-body">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                      {isJobsSubmenuOpen && (
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <SidebarMenuSubButton asChild isActive={pathname === '/jobs'}>
                                  <Link href="/jobs">
                                    <ListChecks className="h-4 w-4 shrink-0" />
                                    <span className="truncate">View all jobs</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </TooltipTrigger>
                              <TooltipContent side="right" align="center" className="font-body">View all jobs</TooltipContent>
                            </Tooltip>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <SidebarMenuSubButton asChild isActive={pathname === '/jobs/new'}>
                                  <Link href="/jobs/new">
                                    <FilePlus2 className="h-4 w-4 shrink-0" />
                                    <span className="truncate">Create Job card</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </TooltipTrigger>
                              <TooltipContent side="right" align="center" className="font-body">Create Job card</TooltipContent>
                            </Tooltip>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  )}

                  {item.href === '#customers-trigger' && ( // New Customers Menu
                    <SidebarMenuItem>
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <SidebarMenuButton
                            isActive={pathname.startsWith('/customers') || isAddCustomerDialogOpen}
                            onClick={() => setIsCustomersSubmenuOpen(!isCustomersSubmenuOpen)}
                          >
                            <span className="flex items-center gap-2 w-full">
                              <item.icon className="h-5 w-5 shrink-0" />
                              <span className="truncate">{item.label}</span>
                              {isCustomersSubmenuOpen ? <ChevronDown className="ml-auto h-4 w-4 shrink-0" /> : <ChevronRight className="ml-auto h-4 w-4 shrink-0" />}
                            </span>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right" align="center" className="font-body">{item.label}</TooltipContent>
                      </Tooltip>
                      {isCustomersSubmenuOpen && (
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                             <Tooltip>
                              <TooltipTrigger asChild>
                                <SidebarMenuSubButton onClick={() => setIsAddCustomerDialogOpen(true)}>
                                  <UserRoundPlus className="h-4 w-4 shrink-0" />
                                  <span className="truncate">Add Customer</span>
                                </SidebarMenuSubButton>
                              </TooltipTrigger>
                              <TooltipContent side="right" align="center" className="font-body">Add New Customer</TooltipContent>
                            </Tooltip>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <SidebarMenuSubButton asChild isActive={pathname === '/customers'}>
                                  <Link href="/customers"> {/* Placeholder link */}
                                    <Users className="h-4 w-4 shrink-0" />
                                    <span className="truncate">View Customers</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </TooltipTrigger>
                              <TooltipContent side="right" align="center" className="font-body">View All Customers</TooltipContent>
                            </Tooltip>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  )}

                  {item.href !== '#jobs-trigger' && item.href !== '#customers-trigger' && (
                    <SidebarMenuItem>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            asChild
                            isActive={pathname === item.href || (item.href !== '/dashboard' && item.href !== '/tasks' && item.href !== '/customer/my-jobs' && pathname.startsWith(item.href))}
                          >
                            <Link href={item.href}>
                              <span className="flex items-center gap-2 w-full">
                                <item.icon className="h-5 w-5 shrink-0" />
                                <span className="truncate">{item.label}</span>
                                <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground group-data-[active=true]:text-primary-foreground group-data-[collapsible=icon]:hidden" />
                              </span>
                            </Link>
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right" align="center" className="font-body">
                           {item.label}
                        </TooltipContent>
                      </Tooltip>
                    </SidebarMenuItem>
                  )}
                </React.Fragment>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-full justify-start gap-2 p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:p-0">
                  <Avatar className="h-8 w-8 group-data-[collapsible=icon]:h-6 group-data-[collapsible=icon]:w-6">
                      <AvatarImage src={user?.photoURL || `https://placehold.co/100x100.png?text=${userDisplayName.charAt(0).toUpperCase()}`} alt="User Avatar" data-ai-hint="user avatar"/>
                      <AvatarFallback>{userDisplayName.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start group-data-[collapsible=icon]:hidden">
                      <span className="text-sm font-medium text-foreground">{userDisplayName}</span>
                      <span className="text-xs text-muted-foreground">{userRoleDisplay}</span>
                    </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 font-body" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{userDisplayName}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {userEmailDisplay}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="w-full">
                    <UserCircle className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                {(effectiveUserRole === 'Admin' || effectiveUserRole === 'Manager') && (
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="w-full">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {isDesignatedAdmin && (
                  <>
                    <RadixDropdownMenuSub>
                      <RadixDropdownMenuSubTrigger>
                        <UserCircle className="mr-2 h-4 w-4" />
                        <span>Switch Role (Dev)</span>
                      </RadixDropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <RadixDropdownMenuSubContent>
                          {(["Admin", "Manager", "Departmental", "Customer"] as UserRole[]).map((role) => (
                            <DropdownMenuItem
                              key={role}
                              onClick={() => handleRoleSwitch(role)}
                              className={cn("cursor-pointer", effectiveUserRole === role && "bg-accent font-semibold")}
                            >
                              {role}
                              {effectiveUserRole === role && <Check className="ml-auto h-4 w-4" />}
                            </DropdownMenuItem>
                          ))}
                        </RadixDropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </RadixDropdownMenuSub>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>
          <Header />
          <main className="flex-1 p-4 md:p-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
      {/* Conditionally render AddCustomerDialog if the component exists
      {isClient && effectiveUserRole === 'Admin' && AddCustomerDialog && (
        <AddCustomerDialog isOpen={isAddCustomerDialogOpen} setIsOpen={setIsAddCustomerDialogOpen} />
      )}
      */}
    </ClientOnlyWrapper>
  );
}

    