
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  type User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/clientApp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2, Eye, EyeOff } from 'lucide-react';
import AppLogo from '@/components/AppLogo';

export default function SignupPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleEmailSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      if (userCredential.user && displayName.trim() !== '') {
        try {
          await updateProfile(userCredential.user as User, { displayName: displayName.trim() });
        } catch (profileError: any) {
            console.error("Profile update error:", profileError);
            toast({
                title: 'Profile Update Skipped',
                description: 'Could not set display name, but account was created. You can set it in your profile.',
                variant: 'default', 
            });
        }
      }

      toast({ title: 'Signup Successful', description: 'Your account has been created with email!' });
      router.push('/dashboard'); 
    } catch (error: any) {
      console.error("Email Signup error:", error);
      let errorMessage = \`Error: \${error.code || 'UNKNOWN_ERROR'}. \${error.message || 'Please try again.'}\`;
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email address is already in use. Try logging in or use a different email.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'The password is too weak. Please choose a stronger password.';
      }
      toast({
        title: 'Email Signup Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8">
        <AppLogo />
      </div>
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-center">Create Account</CardTitle>
          <CardDescription className="font-body text-center">
            Join Macro PrintFlow using your email and password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <form onSubmit={handleEmailSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="displayNameEmail">Display Name (Optional)</Label>
              <Input
                id="displayNameEmail"
                type="text"
                placeholder="Your Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="font-body"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email here"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="font-body"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Choose a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6} 
                  className="font-body pr-10" 
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={togglePasswordVisibility}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full font-body" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              {isLoading ? 'Creating Account...' : 'Sign Up with Email'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center text-sm pt-4">
          <Link href="/login" className="font-body text-primary hover:underline">
            Already have an account? Sign In
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
