
"use client";

import { useState, type FormEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  signInWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  GoogleAuthProvider, 
  signInWithPopup 
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
import { Separator } from '@/components/ui/separator';

// Google Icon SVG
const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    <path d="M1 1h22v22H1z" fill="none"/>
  </svg>
);


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
  
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('IN'); 
  const [phoneNumber, setPhoneNumber] = useState(''); 
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        try {
            window.recaptchaVerifier.clear();
            console.log("LoginPage: RecaptchaVerifier cleared on unmount.");
        } catch (error) {
            console.error("LoginPage: Error clearing RecaptchaVerifier on unmount:", error);
        }
      }
    };
  }, []);

  const setupRecaptcha = () => {
    console.log("LoginPage: setupRecaptcha called.");
    if (!auth) {
        console.error("LoginPage: Firebase auth object is not available for reCAPTCHA setup.");
        toast({ title: "Authentication Error", description: "Firebase auth service is not ready. Please refresh.", variant: "destructive" });
        return null;
    }
    if (!recaptchaContainerRef.current) {
      console.error("LoginPage: reCAPTCHA container ref not found during setup.");
      toast({ title: "Error", description: "reCAPTCHA UI element not ready. Please refresh page or try again.", variant: "destructive" });
      return null;
    }

    try {
      if (window.recaptchaVerifier) {
        console.log("LoginPage: Clearing existing RecaptchaVerifier instance before creating a new one.");
        window.recaptchaVerifier.clear(); 
      }
      console.log("LoginPage: Attempting to create new RecaptchaVerifier instance for element:", recaptchaContainerRef.current);
      window.recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
        size: 'invisible',
        callback: (response: any) => { // Changed from 'callback'
          console.log("LoginPage: reCAPTCHA solved (callback). Response:", response);
        },
        'expired-callback': () => {
          console.warn("LoginPage: reCAPTCHA expired (expired-callback).");
          toast({ title: "reCAPTCHA Expired", description: "Please try sending OTP again.", variant: "destructive" });
        }
      });
      console.log("LoginPage: RecaptchaVerifier instance CREATED successfully.");
      return window.recaptchaVerifier;
    } catch (error: any) {
        console.error("LoginPage: CRITICAL ERROR during new RecaptchaVerifier():", error);
        let userMessage = `Failed to initialize reCAPTCHA (Code: ${error.code || 'N/A'}). Please ensure your exact hosting domain is authorized in Google Cloud for the reCAPTCHA key and your Firebase project has billing enabled for Phone Auth. Common issues include network errors, misconfigured API keys, or unauthorized domains. Check the browser console for more details. Original Error: ${error.message}`;
        if (error.code === 'auth/network-request-failed') {
            userMessage = "Network error during reCAPTCHA setup. Check internet connection and Firebase/Google Cloud domain whitelisting.";
        } else if (error.code === 'auth/internal-error' && error.message?.includes("reCAPTCHA")) {
            userMessage = "reCAPTCHA internal error. Ensure your exact hosting domain (e.g. your-project.web.app or custom domain) is authorized in Google Cloud Console for the reCAPTCHA key. Also, check if your Firebase project has billing enabled (Blaze plan), as Phone Auth requires it.";
        } else if (error.code === 'auth/argument-error') {
            userMessage = "reCAPTCHA setup argument error. This might be an issue with the container element or auth instance."
        } else if (error.code === 'auth/captcha-check-failed') {
            userMessage = `reCAPTCHA check failed. Error: ${error.message}. This usually means the domain your app is running on (check browser URL bar) is not whitelisted in your reCAPTCHA key settings in Google Cloud Console.`;
        }
        toast({ title: "reCAPTCHA Setup Error", description: userMessage, variant: "destructive", duration: 15000 });
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
    console.log(`LoginPage: handlePhoneLogin called. otpSent: ${otpSent}`);

    if (!otpSent) { 
      console.log("LoginPage: OTP not sent yet, proceeding to send OTP.");
      const recaptchaVerifier = setupRecaptcha();
      if (!recaptchaVerifier) {
          console.error("LoginPage: OTP Send - reCAPTCHA verifier setup failed or returned null. Aborting OTP send.");
          setIsLoading(false);
          return;
      }
      
      const country = COUNTRY_CODES.find(c => c.code === selectedCountryCode);
      if (!country) {
        toast({ title: "Country Code Error", description: "Selected country code is invalid.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      const fullPhoneNumber = country.dialCode + phoneNumber;

      if (!/^\+[1-9]\d{1,14}$/.test(fullPhoneNumber)) {
        toast({ title: "Invalid Phone Number", description: "Please enter a valid phone number after selecting country code.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      console.log(`LoginPage: Attempting signInWithPhoneNumber with ${fullPhoneNumber} and appVerifier:`, recaptchaVerifier);
      try {
        window.loginConfirmationResult = await signInWithPhoneNumber(auth, fullPhoneNumber, recaptchaVerifier);
        setOtpSent(true);
        toast({ title: 'OTP sent', description: `An OTP has been sent to ${fullPhoneNumber}.` });
        console.log("LoginPage: OTP Sent, loginConfirmationResult stored:", window.loginConfirmationResult);
      } catch (error: any) {
        console.error(`LoginPage: Error during signInWithPhoneNumber for ${fullPhoneNumber}:`, error);
        let errorDesc = `Could not send OTP. Error Code: ${error.code || 'UNKNOWN_ERROR'}. Message: ${error.message || "Please try again."}`;
        if (error.code === 'auth/invalid-phone-number') {
            errorDesc = "The phone number provided is not valid.";
        } else if (error.code === 'auth/too-many-requests') {
            errorDesc = "Too many requests for this number. Please try again later.";
        } else if (error.code === 'auth/captcha-check-failed' || error.message?.includes("reCAPTCHA") || error.message?.includes("domain")) {
            errorDesc = `reCAPTCHA verification failed. Error: ${error.message}. Ensure your exact hosting domain (e.g., your-project.web.app, localhost if testing locally with custom keys, or your App Hosting domain) is authorized in Google Cloud Console for the reCAPTCHA key. Also, check that 'Identity Toolkit API' and 'Firebase Installations API' are enabled in Google Cloud, and that your Firebase project has billing enabled (Blaze plan).`;
        } else if (error.code === 'auth/missing-phone-number') {
            errorDesc = "Phone number is missing. Please enter your phone number.";
        } else if (error.message?.toLowerCase().includes("missing or insufficient permissions") || error.message?.toLowerCase().includes("billing")) {
            errorDesc = "Failed to send OTP. This might be due to project billing not being enabled or insufficient permissions. Please check your Firebase project settings (Blaze plan required) and enabled APIs (Identity Toolkit, Firebase Installations).";
        } else if (error.code === 'auth/network-request-failed') {
            errorDesc = "Network error while trying to send OTP. Please check your internet connection.";
        }
        toast({ title: 'Failed to Send OTP', description: errorDesc, variant: 'destructive', duration: 15000 });
        if (window.recaptchaVerifier) {
            try { window.recaptchaVerifier.clear(); console.log("LoginPage: RecaptchaVerifier cleared after signInWithPhoneNumber error."); } catch(e) { console.warn("LoginPage: Error clearing verifier post signInWithPhoneNumber error", e); }
        }
      } finally {
        setIsLoading(false);
      }
    } else { 
      console.log("LoginPage: OTP already sent, proceeding to verify OTP.");
      if (!window.loginConfirmationResult) {
        console.error("LoginPage: OTP Verify - loginConfirmationResult is missing.");
        toast({ title: "Error", description: "Verification process issue. Please try sending OTP again.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      if (otp.length !== 6) {
        toast({ title: "Invalid OTP", description: "OTP must be 6 digits.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      console.log(`LoginPage: Attempting to verify OTP: "${otp}"`);
      try {
        const result = await window.loginConfirmationResult.confirm(otp);
        console.log("LoginPage: User signed in successfully with phone.", result.user);
        toast({ title: 'Phone Login Successful', description: 'Welcome back!' });
        router.push('/dashboard');
      } catch (error: any) {
        console.error("LoginPage: Invalid OTP or error during confirmation:", error);
        let errorDesc = `Could not verify OTP. Error Code: ${error.code || 'UNKNOWN_ERROR'}. Message: ${error.message || "Incorrect OTP or an error occurred."}`;
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

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      toast({ title: 'Google Sign-In Successful', description: 'Welcome!' });
      router.push('/dashboard');
    } catch (error: any) {
      console.error("Google Sign-In error:", error);
      let errorMessage = `Could not sign in with Google. Error: ${error.code || 'UNKNOWN_ERROR'}. ${error.message || "Please try again."}`;
      if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'An account already exists with the same email address but different sign-in credentials. Try signing in using the original method.';
      } else if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = 'Google Sign-In popup was closed before completion.';
      }
      toast({
        title: 'Google Sign-In Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  const selectedCountryInfo = COUNTRY_CODES.find(c => c.code === selectedCountryCode);

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
        <CardContent className="space-y-4">
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
                <Button type="submit" className="w-full font-body" disabled={isLoading || isGoogleLoading}>
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
                      value={selectedCountryCode}
                      onValueChange={setSelectedCountryCode}
                      disabled={otpSent || isLoading || isGoogleLoading}
                    >
                      <SelectTrigger className="w-[140px] font-body">
                        <SelectValue>
                          {selectedCountryInfo ? `${selectedCountryInfo.code} (${selectedCountryInfo.dialCode})` : "Country"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRY_CODES.map((country) => (
                          <SelectItem key={country.code} value={country.code} className="font-body">
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
                      disabled={otpSent || isLoading || isGoogleLoading}
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
                      disabled={isLoading || isGoogleLoading}
                    />
                  </div>
                )}
                <Button type="submit" className="w-full font-body" disabled={isLoading || isGoogleLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (otpSent ? <KeyRound className="mr-2 h-4 w-4" /> : <Smartphone className="mr-2 h-4 w-4" />)}
                  {isLoading ? (otpSent ? 'Verifying...' : 'Sending OTP...') : (otpSent ? 'Verify OTP & Login' : 'Send OTP')}
                </Button>
                {otpSent && (
                    <Button variant="link" onClick={() => { 
                        setOtpSent(false); 
                        setOtp(''); 
                        if (window.recaptchaVerifier) { 
                            try { window.recaptchaVerifier.clear(); console.log("LoginPage: RecaptchaVerifier cleared on change number/resend request."); } catch (e) { console.warn("LoginPage: Error clearing verifier on change number/resend:", e); } 
                        } 
                    }} disabled={isLoading || isGoogleLoading} className="w-full text-sm font-body">
                        Change Phone Number or Resend OTP
                    </Button>
                )}
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative my-4">
            <Separator />
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
                <span className="bg-card px-2 text-xs text-muted-foreground font-body">OR CONTINUE WITH</span>
            </div>
          </div>

          <Button variant="outline" className="w-full font-body" onClick={handleGoogleSignIn} disabled={isLoading || isGoogleLoading}>
            {isGoogleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
            {isGoogleLoading ? 'Signing In...' : 'Sign In with Google'}
          </Button>

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
