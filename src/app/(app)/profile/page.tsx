
"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile, EmailAuthProvider, reauthenticateWithCredential, updateEmail, updatePassword } from "firebase/auth";
import { auth } from "@/lib/firebase/clientApp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UserCircle, Save, Mail, KeyRound, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";

export default function ProfilePage() {
  const { user, setUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [currentEmail, setCurrentEmail] = useState(""); // For display primarily

  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // State for Update Email Dialog
  const [isUpdateEmailOpen, setIsUpdateEmailOpen] = useState(false);
  const [currentPasswordForEmail, setCurrentPasswordForEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  // State for Change Password Dialog
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currentPasswordForPassword, setCurrentPasswordForPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);


  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setCurrentEmail(user.email || "Not available");
    }
  }, [user]);

  const handleProfileUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !auth.currentUser) {
      toast({ title: "Error", description: "User session not found. Please re-login.", variant: "destructive" });
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateProfile(auth.currentUser, {
        displayName: displayName,
        // photoURL is no longer updated here
      });

      if (setUser) {
        // Update local user state; photoURL remains as is from Firebase (or null)
        setUser(prevUser => prevUser ? { ...prevUser, displayName: displayName } : null);
      }
      
      toast({
        title: "Profile Updated",
        description: "Your display name has been updated.",
      });
    } catch (error: any) {
      console.error("Profile update error:", error);
      toast({
        title: "Update Failed",
        description: error.message || "Could not update profile.",
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };
  
  const handleEmailUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !auth.currentUser) {
      toast({ title: "Error", description: "User session not found.", variant: "destructive" });
      return;
    }
    if (!newEmail.trim()) {
      toast({ title: "Validation Error", description: "New email cannot be empty.", variant: "destructive" });
      return;
    }
    if (!currentPasswordForEmail) {
      toast({ title: "Validation Error", description: "Current password is required.", variant: "destructive" });
      return;
    }

    setIsUpdatingEmail(true);
    try {
      const credential = EmailAuthProvider.credential(user.email!, currentPasswordForEmail);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updateEmail(auth.currentUser, newEmail);

      if (setUser) {
          setUser(prevUser => prevUser ? { ...prevUser, email: newEmail } : null);
      }
      setCurrentEmail(newEmail); // Update displayed email
      setNewEmail("");
      setCurrentPasswordForEmail("");
      setIsUpdateEmailOpen(false);
      toast({ title: "Email Updated", description: "Your email address has been successfully updated. You may need to re-login with your new email." });
    } catch (error: any) {
      console.error("Email update error:", error);
      let errorMessage = "Could not update email. ";
      if (error.code === 'auth/wrong-password') {
        errorMessage += "Incorrect current password.";
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage += "This email address is already in use.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage += "The new email address is not valid.";
      } else {
        errorMessage += error.message || "Please try again.";
      }
      toast({ title: "Email Update Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !auth.currentUser) {
      toast({ title: "Error", description: "User session not found.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({ title: "Password Mismatch", description: "New passwords do not match.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Weak Password", description: "Password should be at least 6 characters.", variant: "destructive" });
      return;
    }
     if (!currentPasswordForPassword) {
      toast({ title: "Validation Error", description: "Current password is required.", variant: "destructive" });
      return;
    }

    setIsChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email!, currentPasswordForPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);

      setNewPassword("");
      setConfirmNewPassword("");
      setCurrentPasswordForPassword("");
      setIsChangePasswordOpen(false);
      toast({ title: "Password Changed", description: "Your password has been successfully updated." });
    } catch (error: any) {
      console.error("Password change error:", error);
      let errorMessage = "Could not change password. ";
       if (error.code === 'auth/wrong-password') {
        errorMessage += "Incorrect current password.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage += "The new password is too weak.";
      }
      else {
        errorMessage += error.message || "Please try again.";
      }
      toast({ title: "Password Change Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const userInitial = displayName ? displayName.charAt(0).toUpperCase() : (currentEmail ? currentEmail.charAt(0).toUpperCase() : "U");

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 font-body">Loading profile...</p>
      </div>
    );
  }

  if (!user) {
    return (
       <Card>
        <CardHeader>
            <CardTitle className="font-headline flex items-center">
                <UserCircle className="mr-2 h-6 w-6 text-primary" /> User Profile
            </CardTitle>
        </CardHeader>
        <CardContent>
            <p className="font-body text-center text-muted-foreground">Please log in to view your profile.</p>
        </CardContent>
       </Card>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline flex items-center text-xl">
            <UserCircle className="mr-3 h-7 w-7 text-primary" /> Your Profile
          </CardTitle>
          <CardDescription className="font-body">
            View and update your personal information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-4">
            <Avatar className="h-20 w-20 border-2 border-primary">
              {/* AvatarImage is removed, only AvatarFallback will be used */}
              <AvatarFallback>{userInitial}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-semibold font-headline">{displayName || "User"}</h2>
              <p className="text-muted-foreground font-body">{currentEmail}</p>
            </div>
          </div>

          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <Label htmlFor="displayName" className="font-body">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your full name"
                className="font-body"
              />
            </div>
            {/* Photo URL input field is removed */}
            <Button type="submit" className="font-body" disabled={isSavingProfile}>
              {isSavingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSavingProfile ? "Saving..." : "Save Profile Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader>
            <CardTitle className="font-headline flex items-center text-lg">
                <KeyRound className="mr-2 h-5 w-5 text-muted-foreground" /> Account Security
            </CardTitle>
            <CardDescription className="font-body">
                Manage your email and password. These actions may require you to re-enter your current password.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
             <div>
                <Label htmlFor="currentEmailDisplay" className="font-body">Current Email</Label>
                <Input id="currentEmailDisplay" type="email" value={currentEmail} disabled className="font-body bg-muted/50"/>
             </div>
            
            <Dialog open={isUpdateEmailOpen} onOpenChange={setIsUpdateEmailOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="font-body w-full sm:w-auto">
                        <Mail className="mr-2 h-4 w-4" /> Update Email
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-headline">Update Your Email</DialogTitle>
                        <DialogDescription className="font-body">
                            To change your email address, please re-enter your current password and provide the new email.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEmailUpdate} className="space-y-4 py-4">
                        <div>
                            <Label htmlFor="currentPasswordForEmail">Current Password</Label>
                            <Input 
                                id="currentPasswordForEmail" 
                                type="password" 
                                value={currentPasswordForEmail} 
                                onChange={(e) => setCurrentPasswordForEmail(e.target.value)} 
                                required 
                                className="font-body"
                            />
                        </div>
                        <div>
                            <Label htmlFor="newEmail">New Email Address</Label>
                            <Input 
                                id="newEmail" 
                                type="email" 
                                value={newEmail} 
                                onChange={(e) => setNewEmail(e.target.value)} 
                                required 
                                className="font-body"
                            />
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={isUpdatingEmail}>Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isUpdatingEmail}>
                                {isUpdatingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} 
                                Update Email
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="font-body w-full sm:w-auto">
                        <KeyRound className="mr-2 h-4 w-4" /> Change Password
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-headline">Change Your Password</DialogTitle>
                        <DialogDescription className="font-body">
                            To change your password, please re-enter your current password and provide a new password.
                        </DialogDescription>
                    </DialogHeader>
                     <form onSubmit={handlePasswordChange} className="space-y-4 py-4">
                        <div>
                            <Label htmlFor="currentPasswordForPassword">Current Password</Label>
                            <Input 
                                id="currentPasswordForPassword" 
                                type="password" 
                                value={currentPasswordForPassword} 
                                onChange={(e) => setCurrentPasswordForPassword(e.target.value)} 
                                required 
                                className="font-body"
                            />
                        </div>
                        <div>
                            <Label htmlFor="newPassword">New Password</Label>
                            <Input 
                                id="newPassword" 
                                type="password" 
                                value={newPassword} 
                                onChange={(e) => setNewPassword(e.target.value)} 
                                required 
                                className="font-body"
                            />
                        </div>
                         <div>
                            <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                            <Input 
                                id="confirmNewPassword" 
                                type="password" 
                                value={confirmNewPassword} 
                                onChange={(e) => setConfirmNewPassword(e.target.value)} 
                                required 
                                className="font-body"
                            />
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={isChangingPassword}>Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isChangingPassword}>
                                {isChangingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} 
                                Change Password
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </CardContent>
        <CardFooter>
            <p className="text-xs text-muted-foreground font-body">
                For security reasons, changing your email or password will require re-authentication.
            </p>
        </CardFooter>
      </Card>
    </div>
  );
}
    