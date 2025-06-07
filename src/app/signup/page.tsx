
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRY_CODES, type CountryCode } from '@/lib/definitions';

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
  
  const [selectedCountryDialCode, setSelectedCountryDialCode] = useState<string>(COUNTRY_CODES.find(c => c.code === 'IN')?.dialCode || '+91');
  const [phoneNumber, setPhoneNumber] = useState(''); // Stores only the local part of the number
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        try {
            window.recaptchaVerifier.clear();
            console.log("Signup Page: RecaptchaVerifier cleared on unmount.");
        } catch (error) {
            console.error("Signup Page: Error clearing RecaptchaVerifier on unmount:", error);
        }
      }
    };
  }, []);

  const setupRecaptcha = () => {
    if (!auth) {
        console.error("Firebase auth object is not available for reCAPTCHA setup on signup page.");
        toast({ title: "Authentication Error", description: "Firebase auth service is not ready. Please refresh.", variant: "destructive" });
        return null;
    }
    if (!recaptchaContainerRef.current) {
      console.error("reCAPTCHA container ref not found during setup on signup page.");
      toast({ title: "Error", description: "reCAPTCHA UI element not ready. Please refresh page or try again.", variant: "destructive" });
      return null;
    }

    try {
      if (window.recaptchaVerifier) {
        console.log("Signup Page: Clearing existing RecaptchaVerifier instance.");
        window.recaptchaVerifier.clear(); 
      }
      console.log("Signup Page: Initializing new RecaptchaVerifier instance for element:", recaptchaContainerRef.current);
      window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
        size: 'invisible',
        'callback': (response: any) => {
          console.log("Signup Page: reCAPTCHA solved by verifier callback. Response:", response);
        },
        'expired-callback': () => {
          console.log("Signup Page: reCAPTCHA expired via callback.");
          toast({ title: "reCAPTCHA Expired", description: "Please try sending OTP again.", variant: "destructive" });
        }
      });
      console.log("Signup Page: RecaptchaVerifier initialized successfully.");
      return window.recaptchaVerifier;
    } catch (error: any) {
        console.error("Signup Page: Critical Error initializing RecaptchaVerifier:", error);
        let userMessage = "Failed to initialize reCAPTCHA. Please check console for details.";
        if (error.code === 'auth/network-request-failed') {
            userMessage = "Network error during reCAPTCHA setup. Check connection and Firebase/Google Cloud domain whitelisting.";
        } else if (error.code === 'auth/internal-error' && error.message?.includes("reCAPTCHA")) {
            userMessage = "reCAPTCHA internal error. Ensure your domain is authorized in Google Cloud Console for the reCAPTCHA key.";
        } else if (error.code === 'auth/argument-error') {
            userMessage = "reCAPTCHA setup argument error. This might be an issue with the container element or auth instance."
        }
        
        toast({ title: "reCAPTCHA Setup Error", description: userMessage, variant: "destructive", duration: 8000 });
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

    if (!otpSent) { 
      const recaptchaVerifier = setupRecaptcha();
      if (!recaptchaVerifier) {
          setIsLoading(false);
          console.log("Signup Page: OTP Send - reCAPTCHA verifier setup failed. Aborting OTP send.");
          return;
      }
      
      const fullPhoneNumber = selectedCountryDialCode + phoneNumber;
      if (!/^\+[1-9]\d{1,14}$/.test(fullPhoneNumber)) {
        toast({ title: "Invalid Phone Number", description: "Please enter a valid phone number after selecting country code.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      console.log(`Signup Page: Attempting to send OTP to ${fullPhoneNumber}`);
      try {
        window.confirmationResult = await signInWithPhoneNumber(auth, fullPhoneNumber, recaptchaVerifier);
        setOtpSent(true);
        toast({ title: 'OTP Sent', description: `An OTP has been sent to ${fullPhoneNumber}.` });
        console.log("Signup Page: OTP Sent, confirmationResult stored.");
      } catch (error: any) {
        console.error("Signup Page: Error sending OTP:", error);
        let errorDesc = "Could not send OTP. " + (error.message || "Please try again.");
        if (error.code === 'auth/invalid-phone-number') {
            errorDesc = "The phone number provided is not valid.";
        } else if (error.code === 'auth/too-many-requests') {
            errorDesc = "Too many requests. Please try again later.";
        } else if (error.code === 'auth/captcha-check-failed' || error.message?.includes("reCAPTCHA")) {
            errorDesc = "reCAPTCHA verification failed. Ensure your domain is authorized for reCAPTCHA in Google Cloud Console and Firebase project billing is active.";
        } else if (error.code === 'auth/missing-phone-number') {
            errorDesc = "Phone number is missing. Please enter your phone number.";
        } else if (error.message?.toLowerCase().includes("missing or insufficient permissions") || error.message?.toLowerCase().includes("billing")) {
            errorDesc = "Failed to send OTP. This might be due to project billing not being enabled or insufficient permissions. Please check your Firebase project settings.";
        }
        
        toast({ title: 'Failed to Send OTP', description: errorDesc, variant: 'destructive', duration: 8000 });
        if (window.recaptchaVerifier) {
            try {
                window.recaptchaVerifier.clear();
                console.log("Signup Page: RecaptchaVerifier cleared after OTP send error.");
            } catch (clearError) {
                console.warn("Signup Page: Could not clear reCAPTCHA after OTP send error:", clearError);
            }
        }
      } finally {
        setIsLoading(false);
      }
    } else { 
      if (!window.confirmationResult) {
        console.error("Signup Page: OTP Verify - confirmationResult is missing.");
        toast({ title: "Error", description: "Verification process issue. Please try sending OTP again.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      if (otp.length !== 6) {
        toast({ title: "Invalid OTP", description: "OTP must be 6 digits.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      console.log(`Signup Page: Attempting to verify OTP ${otp}`);
      try {
        const userCredential = await window.confirmationResult.confirm(otp);
        console.log("Signup Page: OTP Verify - Successfully verified.");
        if (userCredential.user && displayName.trim() !== '') {
          try {
            await updateProfile(userCredential.user as User, { displayName: displayName.trim() });
            console.log("Signup Page: OTP Verify - Display name updated.");
          } catch (profileError: any) {
            console.error("Signup Page: Profile update error after phone signup:", profileError);
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
        console.error("Signup Page: Error verifying OTP:", error);
        let errorDesc = "Could not verify OTP. " + (error.message || "Incorrect OTP or an error occurred.");
        if (error.code === 'auth/invalid-verification-code') {
            errorDesc = "The OTP entered is incorrect. Please try again.";
        } else if (error.code === 'auth/code-expired') {
            errorDesc = "The OTP has expired. Please request a new one.";
        }
        toast({ title: 'OTP Verification Failed', description: errorDesc, variant: 'destructive' });
      } finally {
         setIsLoading(false);
      }
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div ref={recaptchaContainerRef}></div> 
      <div className="mb-8">
        <AppLogo />
      </div>
      <Card className="w-full max-w-md shadow-2xl">
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
                    placeholder="Enter your email here"
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
                  <Label htmlFor="phoneNumberField">Phone Number</Label>
                  <div className="flex gap-2">
                    <Select
                      value={selectedCountryDialCode}
                      onValueChange={setSelectedCountryDialCode}
                      disabled={otpSent}
                    >
                      <SelectTrigger className="w-[150px] font-body">
                        <SelectValue placeholder="Country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRY_CODES.map((country) => (
                          <SelectItem key={country.code} value={country.dialCode} className="font-body">
                            {country.name} ({country.dialCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="phoneNumberField"
                      type="tel"
                      placeholder="Enter phone number"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                      className="font-body flex-1"
                      disabled={otpSent}
                    />
                  </div>
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
                    <Button variant="link" onClick={() => { 
                        setOtpSent(false); 
                        setOtp(''); 
                        if (window.recaptchaVerifier) { 
                            try { 
                                window.recaptchaVerifier.clear(); 
                                console.log("Signup Page: RecaptchaVerifier cleared on number change/resend request.");
                            } catch (e) { 
                                console.warn("Signup Page: Error clearing verifier on change number/resend:", e);
                            } 
                        } 
                    }} disabled={isLoading} className="w-full text-sm font-body">
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

