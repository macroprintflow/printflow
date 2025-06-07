
"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase/clientApp";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { UserCircle, Save, Mail, KeyRound, Loader2, Image as ImageIcon } from "lucide-react"; // Added ImageIcon

export default function ProfilePage() {
  const { user, setUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [email, setEmail] = useState(""); // For display primarily

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingAuth, setIsSavingAuth] = useState(false); // For future email/password

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setPhotoURL(user.photoURL || "");
      setEmail(user.email || "Not available");
    }
  }, [user]);

  const handleProfileUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Error", description: "No user logged in.", variant: "destructive" });
      return;
    }
    if (!auth.currentUser) {
       toast({ title: "Error", description: "User session not found. Please re-login.", variant: "destructive" });
       return;
    }

    setIsSavingProfile(true);
    try {
      await updateProfile(auth.currentUser, {
        displayName: displayName,
        photoURL: photoURL,
      });

      // Update user in AuthContext to reflect changes immediately
      if (setUser) {
        setUser(prevUser => prevUser ? { ...prevUser, displayName, photoURL } : null);
      }
      
      toast({
        title: "Profile Updated",
        description: "Your display name and photo URL have been updated.",
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
  
  const userInitial = displayName ? displayName.charAt(0).toUpperCase() : (email ? email.charAt(0).toUpperCase() : "U");


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
              <AvatarImage src={photoURL || `https://placehold.co/100x100.png?text=${userInitial}`} alt={displayName || "User"} data-ai-hint="user avatar" />
              <AvatarFallback>{userInitial}</AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-semibold font-headline">{displayName || "User"}</h2>
              <p className="text-muted-foreground font-body">{email}</p>
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
            <div>
              <Label htmlFor="photoURL" className="font-body">Photo URL</Label>
              <Input
                id="photoURL"
                type="url"
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                placeholder="https://example.com/your-photo.jpg"
                className="font-body"
              />
               <p className="text-xs text-muted-foreground mt-1">Enter a URL to an image. (Direct upload coming soon)</p>
            </div>
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
                <Label htmlFor="currentEmail" className="font-body">Current Email</Label>
                <Input id="currentEmail" type="email" value={email} disabled className="font-body bg-muted/50"/>
             </div>
            <Button variant="outline" disabled className="font-body w-full sm:w-auto">
                <Mail className="mr-2 h-4 w-4" /> Update Email (Coming Soon)
            </Button>
            <Button variant="outline" disabled className="font-body w-full sm:w-auto">
                <KeyRound className="mr-2 h-4 w-4" /> Change Password (Coming Soon)
            </Button>
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
