
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
  SidebarMenuSubTrigger,
  SidebarMenuSubContent,
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
import { signOut, getIdTokenResult } from 'firebase/auth';
import { auth } from '@/lib/firebase/clientApp';
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/lib/definitions';
import { getUserRoleFromFirestore, createUserDocumentInFirestore } from '@/lib/actions/userActions'; 

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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth(); 
  const { toast } = useToast();
  const [isClient, setIsClient] = React.useState(false);
  const [effectiveUserRole, setEffectiveUserRole] = React.useState<UserRole>("Customer"); 
  const [isRoleFromDevTool, setIsRoleFromDevTool] = React.useState(false);
  const [isLoadingRole, setIsLoadingRole] = React.useState(true);


  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    const determineRole = async () => {
      setIsLoadingRole(true);
      if (!user) { // If no user, and not loading, redirect to login.
        if (!loading) router.push('/login');
        setIsLoadingRole(false);
        return;
      }

      if (user && user.email) {
        let roleToSet: UserRole = "Customer"; // Default
        let roleSource = "Default (Customer)";

        try {
          // 1. Attempt to read role from Firestore as the primary source
          const firestoreRole = await getUserRoleFromFirestore(user.uid);
          if (firestoreRole) {
            roleToSet = firestoreRole;
            roleSource = "Firestore";
          } else {
            // If no Firestore role, check if it's the admin email (fallback)
            if (user.email.toLowerCase() === ADMIN_EMAIL) {
              roleToSet = "Admin";
              roleSource = "Admin Email (Fallback)";
            }
            // Ensure Firestore document exists for this user with the determined/default role
            await createUserDocumentInFirestore(user, roleToSet);
            console.log(`[Auth Role] Ensured Firestore document for ${user.email} with role ${roleToSet}`);
          }
        } catch (error) {
            console.error("[Auth Role] Error determining role from Firestore or creating document:", error);
            // Fallback if Firestore operations fail (e.g. network issue)
            if (user.email.toLowerCase() === ADMIN_EMAIL) {
                roleToSet = "Admin";
                roleSource = "Admin Email (Error Fallback)";
            } else {
                roleToSet = "Customer";
                roleSource = "Default (Error Fallback)";
            }
        }
        
        if (!isRoleFromDevTool) {
          // Only update if the role actually needs changing to prevent potential loops
          if (effectiveUserRole !== roleToSet) {
            console.log(`[Auth Role] Setting effective role to: ${roleToSet} (Source: ${roleSource})`);
            setEffectiveUserRole(roleToSet);
          } else {
            // console.log(`[Auth Role] Effective role already ${effectiveUserRole}. No change needed from source ${roleSource}.`);
          }
        } else {
           // console.log(`[Auth Role] Dev tool role active: ${effectiveUserRole}. Not changing based on Firestore/email.`);
        }
      }
      setIsLoadingRole(false);
    };

    if (!loading) { 
        determineRole();
    }
  }, [user, loading, router, isRoleFromDevTool, effectiveUserRole]); // Keep effectiveUserRole for now, as the check `effectiveUserRole !== roleToSet` handles it.

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
    return null; 
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
