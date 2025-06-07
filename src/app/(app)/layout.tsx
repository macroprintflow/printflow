
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
} from '@/components/ui/sidebar';
import AppLogo from '@/components/AppLogo';
import { Header } from '@/components/layout/Header';
import { LayoutDashboard, Briefcase, FileUp, FilePlus2, CalendarCheck2, ClipboardList, UserCircle, Settings, Archive, LogOut, type LucideIcon, ShoppingBag, Check } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import ClientOnlyWrapper from '@/components/ClientOnlyWrapper';
import { useAuth } from '@/contexts/AuthContext';
import { signOut, getIdTokenResult } from 'firebase/auth'; // getIdTokenResult might not be needed if not checking claims
import { auth } from '@/lib/firebase/clientApp';
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/lib/definitions';
// getUserRoleFromFirestore and createUserDocumentInFirestore imports removed

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  allowedRoles: UserRole[];
}

const allNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, allowedRoles: ['Admin', 'Manager'] },
  { href: '/jobs', label: 'All Jobs', icon: Briefcase, allowedRoles: ['Admin', 'Manager'] },
  { href: '/for-approval', label: 'For Approval', icon: FileUp, allowedRoles: ['Admin', 'Manager'] },
  { href: '/jobs/new', label: 'New Job Card', icon: FilePlus2, allowedRoles: ['Admin', 'Manager'] },
  { href: '/planning', label: 'Production Planning', icon: CalendarCheck2, allowedRoles: ['Admin', 'Manager'] },
  { href: '/tasks', label: 'Departmental Tasks', icon: ClipboardList, allowedRoles: ['Admin', 'Manager', 'Departmental'] },
  { href: '/inventory', label: 'Inventory', icon: Archive, allowedRoles: ['Admin', 'Manager'] },
  { href: '/customer/my-jobs', label: 'My Jobs', icon: ShoppingBag, allowedRoles: ['Customer'] },
];

const ADMIN_EMAIL = "kuvam@macroprinters.com".toLowerCase();
const MANAGER_EMAIL = "niharikasehgal0512@gmail.com".toLowerCase();

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

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    const determineRoleLogic = async () => {
      if (isDeterminingRoleRef.current) return;
      if (loading) {
        // If auth is still loading, don't determine role yet, wait for user object
        return;
      }

      isDeterminingRoleRef.current = true;
      setIsLoadingRole(true);

      if (!user) {
        if (!loading && pathname !== '/login' && pathname !== '/signup') { // Ensure we are not on login/signup page already
          router.push('/login');
        }
        setIsLoadingRole(false);
        isDeterminingRoleRef.current = false;
        return;
      }

      if (isRoleFromDevTool) {
        // Dev tool role is active, no recalculation needed from "backend"
        setIsLoadingRole(false);
        isDeterminingRoleRef.current = false;
        return;
      }

      let roleToSet: UserRole = "Customer"; // Default role

      // Simplified role determination (no Firestore fetch)
      if (user.email?.toLowerCase() === ADMIN_EMAIL) {
        roleToSet = "Admin";
      } else if (user.email?.toLowerCase() === MANAGER_EMAIL) {
        roleToSet = "Manager";
      } else {
        // In a more complex app, you might have other rules or default roles
        // For now, non-admin/manager users are Customers
        roleToSet = "Customer";
      }
      
      console.log(`[Auth Role] Determined role via simple check: ${roleToSet} for ${user.email}`);

      if (effectiveUserRole !== roleToSet) {
        console.log(`[Auth Role] Setting effective role to: ${roleToSet}`);
        setEffectiveUserRole(roleToSet);
      }
      setIsLoadingRole(false);
      isDeterminingRoleRef.current = false;
    };

    determineRoleLogic();
  }, [user, loading, isRoleFromDevTool, router, effectiveUserRole, pathname]);


  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
      setIsRoleFromDevTool(false);
      setEffectiveUserRole("Customer"); // Reset effective role on logout
      router.push('/login');
    } catch (error) {
      console.error("Logout error:", error);
      toast({ title: 'Logout Failed', description: 'Could not log you out. Please try again.', variant: 'destructive' });
    }
  };

  const handleRoleSwitch = (newRole: UserRole) => {
    setEffectiveUserRole(newRole);
    setIsRoleFromDevTool(true); // Indicate that the role is now set by dev tool
    toast({ title: 'Dev Tool: Role Switched', description: `Viewing as ${newRole}. (Session only)`});
  };

  if (loading || isLoadingRole || (!user && pathname !== '/login' && pathname !== '/signup')) {
     // While loading or if no user and not on auth pages, render nothing or a loader
     // This prevents rendering the layout before role determination or if user is not authenticated
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && (pathname !== '/login' && pathname !== '/signup')) {
    // This case should ideally be caught by the loading condition or the effect redirecting.
    // But as a fallback, if not loading and no user, and not on auth pages, show loader.
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  // If user is not authenticated and trying to access protected routes,
  // the useEffect hook would have redirected to '/login'.
  // If on '/login' or '/signup' page itself, children will be login/signup pages.
  if (!user && (pathname === '/login' || pathname === '/signup')) {
     return <ClientOnlyWrapper>{children}</ClientOnlyWrapper>;
  }


  const userDisplayName = user?.displayName || user?.email?.split('@')[0] || "User";
  const userEmail = user?.email || "No email";

  const userRoleDisplay = effectiveUserRole;

  const visibleNavItems = allNavItems.filter(item =>
    item.allowedRoles.includes(effectiveUserRole)
  );

  const isDesignatedAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  return (
    <ClientOnlyWrapper>
      <SidebarProvider defaultOpen>
        <Sidebar variant="sidebar" collapsible="icon" className="bg-sidebar/80 backdrop-blur-lg">
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
              {visibleNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
                    tooltip={{ children: item.label, className: "font-body" }}
                    className="font-body bg-card/60 hover:bg-accent/80 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:shadow-lg"
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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
                      <span className="text-sm font-medium text-white">{userDisplayName}</span>
                      <span className="text-xs text-white/70">{userRoleDisplay}</span>
                    </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 font-body" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{userDisplayName}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {userEmail}
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
    </ClientOnlyWrapper>
  );
}
