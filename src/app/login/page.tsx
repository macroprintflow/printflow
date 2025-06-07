
"use client";

import { useState, type FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '@/lib/firebase/clientApp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LogIn, Loader2, Eye, EyeOff } from 'lucide-react';
import AppLogo from '@/components/AppLogo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleEmailLogin = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: 'Login Successful', description: 'Welcome back!' });
      router.push('/dashboard');
    } catch (error: any)      {
      console.error("Email Login error:", error);
      toast({
        title: 'Login Failed',
        description: error.message || 'Please check your credentials and try again.',
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
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-center">Welcome Back</CardTitle>
          <CardDescription className="font-body text-center">
            Sign in to your Macro PrintFlow account using your email and password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <form onSubmit={handleEmailLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="emailField">Email</Label>
              <Input
                id="emailField"
                type="email"
                placeholder="Enter your email here"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="font-body"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordField">Password</Label>
              <div className="relative">
                <Input
                  id="passwordField"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="font-body pr-10"
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
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
              {isLoading ? 'Signing In...' : 'Sign In with Email'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex-col items-center text-sm text-muted-foreground pt-6 space-y-2">
            <Link href="/signup" className="font-body text-primary hover:underline">
              Don't have an account? Sign Up
            </Link>
            <div className="text-xs text-center">
              <p>For demo, use "kuvamsharma@printflow.app" / password123</p>
            </div>
        </CardFooter>
      </Card>
    </div>
  );
}
