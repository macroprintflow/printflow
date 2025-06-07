
"use client";

import { useState, type FormEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  signInWithEmailAndPassword,
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
import { LogIn, Loader2, Smartphone, KeyRound, Eye, EyeOff } from 'lucide-react';
import AppLogo from '@/components/AppLogo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRY_CODES, type CountryCode } from '@/lib/definitions';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    loginConfirmationResult?: ConfirmationResult; 
  }
}

export default function LoginPage() {
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
        } catch (error) {
            console.error("Error clearing RecaptchaVerifier on login page unmount:", error);
        }
      }
    };
  }, []);

  const setupRecaptcha = () => {
    if (!auth) {
        console.error("Firebase auth object is not available for reCAPTCHA setup on login page.");
        toast({ title: "Authentication Error", description: "Firebase auth service is not ready. Please refresh.", variant: "destructive" });
        return null;
    }
    if (!recaptchaContainerRef.current) {
      console.error("reCAPTCHA container ref not found during setup on login page.");
      toast({ title: "Error", description: "reCAPTCHA UI element not ready. Please refresh page or try again.", variant: "destructive" });
      return null;
    }

    try {
      if (window.recaptchaVerifier) {
        console.log("Login Page: Clearing existing RecaptchaVerifier instance.");
        window.recaptchaVerifier.clear(); 
      }
      console.log("Login Page: Initializing new RecaptchaVerifier instance for element:", recaptchaContainerRef.current);
      window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
        size: 'invisible',
        'callback': (response: any) => {
          console.log("Login Page: reCAPTCHA solved by verifier callback. Response:", response);
        },
        'expired-callback': () => {
          console.log("Login Page: reCAPTCHA expired via callback.");
          toast({ title: "reCAPTCHA Expired", description: "Please try sending OTP again.", variant: "destructive" });
        }
      });
      console.log("Login Page: RecaptchaVerifier initialized successfully.");
      return window.recaptchaVerifier;
    } catch (error: any) {
        console.error("Login Page: Critical Error initializing RecaptchaVerifier:", error);
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

  const handleEmailLogin = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: 'Login Successful', description: 'Welcome back!' });
      router.push('/dashboard');
    } catch (error: any) {
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
  
  const handlePhoneLogin = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    if (!otpSent) { 
      const recaptchaVerifier = setupRecaptcha();
      if (!recaptchaVerifier) {
          setIsLoading(false);
          return;
      }
      
      const fullPhoneNumber = selectedCountryDialCode + phoneNumber;
      if (!/^\+[1-9]\d{1,14}$/.test(fullPhoneNumber)) {
        toast({ title: "Invalid Phone Number", description: "Please enter a valid phone number after selecting country code.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      console.log(`Login Page: Attempting to send OTP to ${fullPhoneNumber}`);
      try {
        window.loginConfirmationResult = await signInWithPhoneNumber(auth, fullPhoneNumber, recaptchaVerifier);
        setOtpSent(true);
        toast({ title: 'OTP Sent', description: `An OTP has been sent to ${fullPhoneNumber}.` });
        console.log("Login Page: OTP Sent, loginConfirmationResult stored.");
      } catch (error: any) {
        console.error("Login Page: Error sending OTP:", error);
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
        if (window.recaptchaVerifier) window.recaptchaVerifier.clear();
      } finally {
        setIsLoading(false);
      }
    } else { 
      if (!window.loginConfirmationResult) {
        toast({ title: "Error", description: "Verification process issue. Please try sending OTP again.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      if (otp.length !== 6) {
        toast({ title: "Invalid OTP", description: "OTP must be 6 digits.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      console.log(`Login Page: Attempting to verify OTP ${otp}`);
      try {
        await window.loginConfirmationResult.confirm(otp);
        toast({ title: 'Phone Login Successful', description: 'Welcome back!' });
        router.push('/dashboard');
      } catch (error: any) {
        console.error("Login Page: Error verifying OTP:", error);
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
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader>
          <CardTitle className="font-headline text-2xl text-center">Welcome Back</CardTitle>
          <CardDescription className="font-body text-center">
            Sign in to your Macro PrintFlow account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email" className="font-body">Email</TabsTrigger>
              <TabsTrigger value="phone" className="font-body">Phone</TabsTrigger>
            </TabsList>
            <TabsContent value="email">
              <form onSubmit={handleEmailLogin} className="space-y-6 pt-4">
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
            </TabsContent>
            <TabsContent value="phone">
              <form onSubmit={handlePhoneLogin} className="space-y-6 pt-4">
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
                  {isLoading ? (otpSent ? 'Verifying...' : 'Sending OTP...') : (otpSent ? 'Verify OTP & Login' : 'Send OTP')}
                </Button>
                {otpSent && (
                    <Button variant="link" onClick={() => { 
                        setOtpSent(false); 
                        setOtp(''); 
                        if (window.recaptchaVerifier) { 
                            try { window.recaptchaVerifier.clear(); } catch (e) { console.warn("Login Page: Error clearing verifier on change number/resend:", e); } 
                        } 
                    }} disabled={isLoading} className="w-full text-sm font-body">
                        Change Phone Number or Resend OTP
                    </Button>
                )}
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex-col items-center text-sm text-muted-foreground pt-6 space-y-2">
            <Link href="/signup" className="font-body text-primary hover:underline">
              Don't have an account? Sign Up
            </Link>
            <div className="text-xs text-center">
              <p>For demo, use credentials from Firebase Console.</p>
              <p>(e.g., Enter your email here / password123)</p>
            </div>
        </CardFooter>
      </Card>
    </div>
  );
}

    
