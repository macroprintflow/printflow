
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Settings, AlertTriangle, Users, Link2 as LinkIcon, Trash2, Edit, UserPlus } from "lucide-react"; 
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import type { UserData, UserRole } from "@/lib/definitions";
import { getAllUsersMock, updateUserRoleMock, deleteUserMock, createNewUserMock } from "@/lib/actions/userActions"; // Added createNewUserMock
import { useToast } from "@/hooks/use-toast";
import { LinkUserToCustomerDialog } from "@/components/settings/LinkUserToCustomerDialog"; 

export default function SettingsPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLinkUserDialogOpen, setIsLinkUserDialogOpen] = useState(false);
  const [selectedUserForLinking, setSelectedUserForLinking] = useState<UserData | null>(null);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const result = await updateUserRoleMock(userId, newRole);
    if (result.success) {
      toast({ title: "Mock Role Updated", description: result.message });
      fetchUsers(); 
    } else {
      toast({ title: "Error", description: result.message || "Failed to update mock role.", variant: "destructive" });
    }
  };
  
  const handleDeleteUser = async (userId: string, userName: string) => {
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

  const openLinkUserDialog = (user: UserData) => {
    setSelectedUserForLinking(user);
    setIsLinkUserDialogOpen(true);
  };

  const handleAddMockUser = async () => {
    const email = prompt("Enter email for the new mock user:");
    if (!email) return;

    const displayName = prompt("Enter display name for the mock user (optional):") || "";
    
    const roleInput = prompt("Enter role (Admin, Manager, Departmental, Customer):");
    if (!roleInput || !['Admin', 'Manager', 'Departmental', 'Customer'].includes(roleInput)) {
      toast({ title: "Invalid Role", description: "Please enter a valid role.", variant: "destructive" });
      return;
    }
    const role = roleInput as UserRole;

    const result = await createNewUserMock({ email, displayName, role });
    if (result.success) {
      toast({ title: "Mock User Added", description: result.message });
      fetchUsers();
    } else {
      toast({ title: "Error", description: result.message || "Failed to add mock user.", variant: "destructive" });
    }
  };

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
            View and manage entries in the **mock user list**. This list is for UI demonstration and testing roles.
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
                          Linked ({user.linkedCustomerId.substring(0,8)}...)
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not Linked</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => openLinkUserDialog(user)}
                        title="Link to Customer Account"
                      >
                        <LinkIcon className="mr-1 h-3 w-3" /> Link
                      </Button>
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
            onClick={handleAddMockUser}
          >
            <UserPlus className="mr-2 h-4 w-4" /> Add User to Mock List
          </Button>
        </CardContent>
         <CardFooter>
            <Alert variant="default" className="bg-blue-50 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700 w-full">
                <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <AlertTitle className="font-headline text-blue-700 dark:text-blue-300">Important Note on User Management</AlertTitle>
                <AlertDescription className="text-blue-600 dark:text-blue-400 font-body">
                  This "Mock User Management" section displays and manages a **local, in-memory list of mock users**.
                  It is intended for UI development, testing different roles, and demonstrating features like linking users to customers.
                  <br />- Users created via the main <strong>Signup page</strong> are actual Firebase Authentication users but will <strong>not automatically appear</strong> in this mock list.
                  <br />- Users created in the <strong>Firebase Console</strong> are also real Firebase Auth users and will <strong>not automatically appear</strong> here.
                  <br />- To test with representations of real users in this mock list (e.g., for linking to customers), you can use the "Add User to Mock List" button above to manually create corresponding entries. These manual additions are only to this mock list and do not affect real Firebase Auth users.
                  <br />- For switching your *own* view for testing roles like Admin, use the "Switch Role (Dev)" tool in the user profile dropdown (bottom of the sidebar if you are logged in as the designated admin).
                </AlertDescription>
            </Alert>
        </CardFooter>
      </Card>
      
      {selectedUserForLinking && (
        <LinkUserToCustomerDialog
          isOpen={isLinkUserDialogOpen}
          setIsOpen={setIsLinkUserDialogOpen}
          user={selectedUserForLinking}
          onLinkUpdated={fetchUsers} 
        />
      )}
    </div>
  );
}
