
"use client";

import { useState, type FormEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  createUserWithEmailAndPassword, 
  updateProfile, 
  type User,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult
} from 'firebase/auth';
import { auth } from '@/lib/firebase/clientApp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2, Eye, EyeOff, Smartphone, KeyRound } from 'lucide-react';
import AppLogo from '@/components/AppLogo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    confirmationResult?: ConfirmationResult;
  }
}

export default function SignupPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Cleanup reCAPTCHA on unmount
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
      }
    };
  }, []);

  const setupRecaptcha = () => {
    if (!recaptchaContainerRef.current) {
      console.error("reCAPTCHA container not found");
      toast({ title: "Error", description: "reCAPTCHA setup failed. Please refresh.", variant: "destructive" });
      return null;
    }
    // Ensure it's only initialized once, or clear previous if re-initializing
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
    }
    try {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
        size: 'invisible', // Use invisible reCAPTCHA
        'callback': (response: any) => {
          // reCAPTCHA solved, allow signInWithPhoneNumber.
          console.log("reCAPTCHA solved:", response);
        },
        'expired-callback': () => {
          // Response expired. Ask user to solve reCAPTCHA again.
          toast({ title: "reCAPTCHA Expired", description: "Please try sending OTP again.", variant: "destructive" });
        }
      });
      return window.recaptchaVerifier;
    } catch (error) {
        console.error("Error initializing RecaptchaVerifier:", error);
        toast({ title: "reCAPTCHA Error", description: "Failed to initialize reCAPTCHA. Ensure it's configured correctly in Firebase and your .env file.", variant: "destructive" });
        return null;
    }
  };


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
      let errorMessage = error.message || 'Please try again.';
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

  const handlePhoneSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    if (!otpSent) { // Send OTP
      const recaptchaVerifier = setupRecaptcha();
      if (!recaptchaVerifier) {
          setIsLoading(false);
          return;
      }
      
      // Add '+' if not present and ensure it's a valid E.164 format (basic check)
      const formattedPhoneNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
      if (!/^\+[1-9]\d{1,14}$/.test(formattedPhoneNumber)) {
        toast({ title: "Invalid Phone Number", description: "Please enter a valid phone number with country code (e.g., +91XXXXXXXXXX).", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      try {
        window.confirmationResult = await signInWithPhoneNumber(auth, formattedPhoneNumber, recaptchaVerifier);
        setOtpSent(true);
        toast({ title: 'OTP Sent', description: `An OTP has been sent to ${formattedPhoneNumber}.` });
      } catch (error: any) {
        console.error("Error sending OTP:", error);
        toast({ title: 'Failed to Send OTP', description: error.message || "Please try again.", variant: 'destructive' });
        if (window.recaptchaVerifier) window.recaptchaVerifier.render().then(widgetId => window.recaptchaVerifier?.clear());
      }
    } else { // Verify OTP
      if (!window.confirmationResult) {
        toast({ title: "Error", description: "Verification process issue. Please try sending OTP again.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      if (otp.length !== 6) {
        toast({ title: "Invalid OTP", description: "OTP must be 6 digits.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      try {
        const userCredential = await window.confirmationResult.confirm(otp);
        if (userCredential.user && displayName.trim() !== '') {
          try {
            await updateProfile(userCredential.user as User, { displayName: displayName.trim() });
          } catch (profileError: any) {
            console.error("Profile update error:", profileError);
             toast({
                title: 'Profile Update Skipped',
                description: 'Could not set display name, but account was created with phone. You can set it in your profile.',
                variant: 'default', 
            });
          }
        }
        toast({ title: 'Phone Signup Successful', description: 'Your account has been created!' });
        router.push('/dashboard');
      } catch (error: any) {
        console.error("Error verifying OTP:", error);
        toast({ title: 'OTP Verification Failed', description: error.message || "Incorrect OTP or an error occurred.", variant: 'destructive' });
      }
    }
    setIsLoading(false);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div ref={recaptchaContainerRef}></div> {/* Container for invisible reCAPTCHA */}
      <div className="mb-8">
        <AppLogo />
      </div>
      <Card className="w-full max-w-md shadow-2xl"> {/* Increased max-w for tabs */}
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-center">Create Account</CardTitle>
          <CardDescription className="font-body text-center">
            Join Macro PrintFlow to manage your print jobs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email" className="font-body">Sign up with Email</TabsTrigger>
              <TabsTrigger value="phone" className="font-body">Sign up with Phone</TabsTrigger>
            </TabsList>
            <TabsContent value="email">
              <form onSubmit={handleEmailSubmit} className="space-y-6 pt-4">
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
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="font-body"
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
            </TabsContent>
            <TabsContent value="phone">
              <form onSubmit={handlePhoneSubmit} className="space-y-6 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="displayNamePhone">Display Name (Optional)</Label>
                  <Input
                    id="displayNamePhone"
                    type="text"
                    placeholder="Your Name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="font-body"
                    disabled={otpSent}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number (with country code)</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="+91XXXXXXXXXX"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                    className="font-body"
                    disabled={otpSent}
                  />
                </div>
                {otpSent && (
                  <div className="space-y-2">
                    <Label htmlFor="otp">Enter OTP</Label>
                    <Input
                      id="otp"
                      type="text" 
                      inputMode="numeric"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                      maxLength={6}
                      className="font-body"
                    />
                  </div>
                )}
                <Button type="submit" className="w-full font-body" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (otpSent ? <KeyRound className="mr-2 h-4 w-4" /> : <Smartphone className="mr-2 h-4 w-4" />)}
                  {isLoading ? (otpSent ? 'Verifying...' : 'Sending OTP...') : (otpSent ? 'Verify OTP & Sign Up' : 'Send OTP')}
                </Button>
                {otpSent && (
                    <Button variant="link" onClick={() => { setOtpSent(false); setOtp(''); if (window.recaptchaVerifier) window.recaptchaVerifier.clear(); }} disabled={isLoading} className="w-full text-sm font-body">
                        Change Phone Number or Resend OTP
                    </Button>
                )}
              </form>
            </TabsContent>
          </Tabs>
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
