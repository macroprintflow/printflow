
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Settings, Users, UserPlus, Edit3, Loader2, Trash2, KeyRound, Save } from "lucide-react"; // Added Save icon
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, type FormEvent } from "react";
import type { UserData, UserRole } from "@/lib/definitions"; // UserRole will be imported from definitions
import { getAllUsersMock, updateUserRoleMock, createNewUserMock, deleteUserMock } from "@/lib/actions/userActions"; // Mock actions

export default function SettingsPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("Customer");
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const [isEditRoleOpen, setIsEditRoleOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserData | null>(null);
  const [selectedNewRole, setSelectedNewRole] = useState<UserRole>("Customer");
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [selectedUserForDelete, setSelectedUserForDelete] = useState<UserData | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const fetchedUsers = await getAllUsersMock();
      setUsers(fetchedUsers);
    } catch (error) {
      toast({ title: "Error", description: "Could not load users.", variant: "destructive" });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserPassword) {
      toast({ title: "Missing Fields", description: "Please fill all required fields for new user.", variant: "destructive" });
      return;
    }
    setIsCreatingUser(true);
    const result = await createNewUserMock({ 
      displayName: newUserName, 
      email: newUserEmail, 
      password: newUserPassword, // Note: Storing plaintext password in mock is insecure. For demo only.
      role: newUserRole 
    });
    setIsCreatingUser(false);
    if (result.success) {
      toast({ title: "User Created", description: `User ${result.user?.displayName} created.` });
      fetchUsers();
      setIsCreateUserOpen(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("Customer");
    } else {
      toast({ title: "Creation Failed", description: result.message, variant: "destructive" });
    }
  };

  const openEditRoleDialog = (user: UserData) => {
    setSelectedUserForEdit(user);
    setSelectedNewRole(user.role);
    setIsEditRoleOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedUserForEdit) return;
    setIsUpdatingRole(true);
    const result = await updateUserRoleMock(selectedUserForEdit.id, selectedNewRole);
    setIsUpdatingRole(false);
    if (result.success) {
      toast({ title: "Role Updated", description: `Role for ${selectedUserForEdit.displayName} updated to ${selectedNewRole}.` });
      fetchUsers();
      setIsEditRoleOpen(false);
    } else {
      toast({ title: "Update Failed", description: result.message, variant: "destructive" });
    }
  };
  
  const openDeleteUserDialog = (user: UserData) => {
    setSelectedUserForDelete(user);
    setIsDeleteUserOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!selectedUserForDelete) return;
    setIsDeletingUser(true);
    const result = await deleteUserMock(selectedUserForDelete.id);
    setIsDeletingUser(false);
    if (result.success) {
      toast({ title: "User Deleted", description: `User ${selectedUserForDelete.displayName} has been deleted.` });
      fetchUsers();
      setIsDeleteUserOpen(false);
      setSelectedUserForDelete(null);
    } else {
      toast({ title: "Deletion Failed", description: result.message, variant: "destructive" });
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
            Configure your application preferences. User management below is a mock-up for demonstration.
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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-headline flex items-center">
              <Users className="mr-2 h-6 w-6 text-primary" /> User Management (Mock)
            </CardTitle>
            <CardDescription className="font-body">
              View, create, and manage user roles. (Simulated - no real backend integration)
            </CardDescription>
          </div>
          <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" /> Create New User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-headline">Create New Mock User</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4 py-2">
                <div>
                  <Label htmlFor="newUserName">Display Name</Label>
                  <Input id="newUserName" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="e.g., John Doe" />
                </div>
                <div>
                  <Label htmlFor="newUserEmail">Email</Label>
                  <Input id="newUserEmail" type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="e.g., john.doe@example.com" />
                </div>
                <div>
                  <Label htmlFor="newUserPassword">Password</Label>
                  <Input id="newUserPassword" type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Min. 6 characters" />
                </div>
                <div>
                  <Label htmlFor="newUserRole">Role</Label>
                  <Select value={newUserRole} onValueChange={(value) => setNewUserRole(value as UserRole)}>
                    <SelectTrigger id="newUserRole">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {(["Admin", "Manager", "Departmental", "Customer"] as UserRole[]).map(role => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline" disabled={isCreatingUser}>Cancel</Button></DialogClose>
                  <Button type="submit" disabled={isCreatingUser}>
                    {isCreatingUser ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Create User
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
              <p className="font-body text-muted-foreground">Loading users...</p>
            </div>
          ) : users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-headline">Display Name</TableHead>
                  <TableHead className="font-headline">Email</TableHead>
                  <TableHead className="font-headline">Role</TableHead>
                  <TableHead className="font-headline text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium font-body">{user.displayName}</TableCell>
                    <TableCell className="font-body text-sm">{user.email}</TableCell>
                    <TableCell className="font-body"><span className="px-2 py-1 text-xs font-semibold rounded-full bg-secondary text-secondary-foreground">{user.role}</span></TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditRoleDialog(user)} title="Edit Role">
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDeleteUserDialog(user)} title="Delete User" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground font-body text-center py-4">No mock users found. Create one to get started.</p>
          )}
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={isEditRoleOpen} onOpenChange={setIsEditRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-headline">Edit Role for {selectedUserForEdit?.displayName}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="editUserRole">New Role</Label>
            <Select value={selectedNewRole} onValueChange={(value) => setSelectedNewRole(value as UserRole)}>
              <SelectTrigger id="editUserRole">
                <SelectValue placeholder="Select new role" />
              </SelectTrigger>
              <SelectContent>
                {(["Admin", "Manager", "Departmental", "Customer"] as UserRole[]).map(role => (
                  <SelectItem key={role} value={role}>{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" disabled={isUpdatingRole}>Cancel</Button></DialogClose>
            <Button onClick={handleUpdateRole} disabled={isUpdatingRole}>
              {isUpdatingRole ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-headline">Delete User: {selectedUserForDelete?.displayName}?</DialogTitle>
            <DialogDescription className="font-body">
              Are you sure you want to delete the user "{selectedUserForDelete?.email}"? This action cannot be undone (for this mock setup).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={isDeletingUser}>Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={isDeletingUser}>
              {isDeletingUser ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
