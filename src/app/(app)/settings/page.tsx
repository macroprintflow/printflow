
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Settings, AlertTriangle, Users, Link2 as LinkIcon, Trash2, Edit } from "lucide-react"; 
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import type { UserData, UserRole } from "@/lib/definitions";
import { getAllUsersMock, updateUserRoleMock, deleteUserMock } from "@/lib/actions/userActions"; // Assuming updateUserRoleMock and deleteUserMock exist and are simple
import { useToast } from "@/hooks/use-toast";
// Placeholder for a future "Link User to Customer" modal
// import { LinkUserToCustomerDialog } from "@/components/settings/LinkUserToCustomerDialog";

export default function SettingsPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  // const [isLinkUserDialogOpen, setIsLinkUserDialogOpen] = useState(false);
  // const [selectedUserForLinking, setSelectedUserForLinking] = useState<UserData | null>(null);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const fetchedUsers = await getAllUsersMock();
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching mock users:", error);
      toast({ title: "Error", description: "Could not load mock user list.", variant: "destructive" });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [toast]); // Removed toast from deps as it's stable

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    // This is a simplified version for the mock. A real implementation would involve a select dropdown or modal.
    const result = await updateUserRoleMock(userId, newRole);
    if (result.success) {
      toast({ title: "Mock Role Updated", description: result.message });
      fetchUsers(); // Re-fetch to show updated role
    } else {
      toast({ title: "Error", description: result.message || "Failed to update mock role.", variant: "destructive" });
    }
  };
  
  const handleDeleteUser = async (userId: string, userName: string) => {
     // Basic confirmation for mock
    if (confirm(`Are you sure you want to delete mock user "${userName}"? This action only affects the mock list.`)) {
      const result = await deleteUserMock(userId);
      if (result.success) {
        toast({ title: "Mock User Deleted", description: result.message });
        fetchUsers();
      } else {
        toast({ title: "Error", description: result.message || "Failed to delete mock user.", variant: "destructive" });
      }
    }
  };

  // const openLinkUserDialog = (user: UserData) => {
  //   setSelectedUserForLinking(user);
  //   setIsLinkUserDialogOpen(true);
  // };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center">
            <Settings className="mr-2 h-6 w-6 text-primary" /> Application Settings
          </CardTitle>
          <CardDescription className="font-body">
            Configure application preferences and manage users (mock data for now).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="font-body">General application settings will go here. This section is under construction.</p>
          <div className="mt-6 p-8 border-2 border-dashed rounded-lg text-center">
            <p className="text-muted-foreground font-body">Customizable settings options will be available soon.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center">
            <Users className="mr-2 h-6 w-6 text-primary" /> Mock User Management
          </CardTitle>
          <CardDescription className="font-body">
            View and manage mock users. These users are for UI demonstration and do not reflect actual Firebase Auth users yet.
            Role changes here are temporary and only affect the mock list display.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
            <p>Loading users...</p>
          ) : users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-headline">Display Name</TableHead>
                  <TableHead className="font-headline">Email</TableHead>
                  <TableHead className="font-headline">Role</TableHead>
                  <TableHead className="font-headline">Linked Customer</TableHead>
                  <TableHead className="font-headline text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-body font-medium">{user.displayName || "N/A"}</TableCell>
                    <TableCell className="font-body">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'Admin' ? 'default' : 'secondary'}>{user.role}</Badge>
                    </TableCell>
                    <TableCell className="font-body">
                      {user.linkedCustomerId ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          Linked ({user.linkedCustomerId.substring(0,6)}...)
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not Linked</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => alert(`Link functionality for ${user.displayName} coming soon.`)}
                        // onClick={() => openLinkUserDialog(user)}
                        disabled // Disabled until dialog is implemented
                        title="Link to Customer Account"
                      >
                        <LinkIcon className="mr-1 h-3 w-3" /> Link
                      </Button>
                       {/* Simplified role change for mock - A real UI would use a Select dropdown */}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleRoleChange(user.id, user.role === 'Admin' ? 'Manager' : user.role === 'Manager' ? 'Departmental' : user.role === 'Departmental' ? 'Customer' : 'Admin')}
                        title="Cycle Mock Role (Dev)"
                      >
                        <Edit className="mr-1 h-3 w-3" /> Role
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleDeleteUser(user.id, user.displayName || user.email)}
                        title="Delete Mock User"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="font-body text-muted-foreground">No mock users found.</p>
          )}
          <Button 
            variant="secondary" 
            className="mt-4 font-body" 
            onClick={() => alert("Adding new mock users directly here is a placeholder. Real user signup is via the /signup page.")}
            disabled // Disabled as real signup is separate
          >
            Add New Mock User (Placeholder)
          </Button>
        </CardContent>
         <CardFooter>
            <Alert variant="default" className="bg-blue-50 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700 w-full">
                <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="font-headline text-blue-700 dark:text-blue-300">User & Role Management</AlertTitle>
                <AlertDescription className="text-blue-600 dark:text-blue-400 font-body">
                  This section currently displays **mock user data** for UI development and testing different views.
                  Actual Firebase user authentication and role management are handled separately.
                  For testing different UI views as Admin, use the "Switch Role (Dev)" tool in the user profile dropdown (bottom of the sidebar).
                </AlertDescription>
            </Alert>
        </CardFooter>
      </Card>
      
      {/* 
      {selectedUserForLinking && (
        <LinkUserToCustomerDialog
          isOpen={isLinkUserDialogOpen}
          setIsOpen={setIsLinkUserDialogOpen}
          user={selectedUserForLinking}
          onLinkUpdated={fetchUsers} // Re-fetch users after linking
        />
      )}
      */}
    </div>
  );
}
