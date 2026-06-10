'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sun, Lock, Mail } from 'lucide-react';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      router.push('/dashboard');
    } catch (err: any) {
      let msg = err.message;
      if (msg.includes('auth/invalid-credential')) {
        msg = 'Incorrect email or password. Please try again.';
      } else if (msg.includes('auth/email-already-in-use')) {
        msg = 'This email is already registered. Try signing in instead.';
      } else if (msg.includes('auth/weak-password')) {
        msg = 'Password must be at least 6 characters.';
      } else if (msg.includes('auth/invalid-email')) {
        msg = 'Please enter a valid email address.';
      } else if (msg.includes('auth/too-many-requests')) {
        msg = 'Too many attempts. Please wait a moment and try again.';
      }
      setError(msg);
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 sm:p-8 relative overflow-hidden page-transition">
      {/* Background Gradients */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-neon-blue/5 blur-[120px] rounded-full -mr-32 -mt-32 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-neon-green/5 blur-[100px] rounded-full -ml-32 -mb-32 pointer-events-none" />

      <Link href="/" className="absolute top-8 left-8 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all flex items-center gap-2">
        ← Back to Home
      </Link>

      <div className="w-full max-w-md glass rounded-3xl border border-white/5 relative overflow-hidden shadow-2xl p-8 sm:p-10 space-y-6 z-10">
        {/* Logo Header */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center text-neon-blue glow-blue">
            <Sun className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isLogin ? 'Sign in to access your HelioVision dashboard' : 'Start analyzing your solar potential today'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          {error && (
            <div className="p-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-2xl text-center">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-foreground/80">Email</Label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="pl-11 py-6 rounded-2xl bg-white/5 border-white/10 focus:border-neon-blue/40 focus:ring-1 focus:ring-neon-blue/40 placeholder:text-muted-foreground/40 text-sm transition-all"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium text-foreground/80">Password</Label>
              {isLogin && (
                <Link href="#" className="text-xs text-muted-foreground hover:text-neon-blue transition-colors">
                  Forgot password?
                </Link>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-11 py-6 rounded-2xl bg-white/5 border-white/10 focus:border-neon-blue/40 focus:ring-1 focus:ring-neon-blue/40 placeholder:text-muted-foreground/40 text-sm transition-all"
              />
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full mt-2 py-6 rounded-2xl bg-neon-blue text-background text-sm font-bold glow-blue hover:bg-neon-blue/90 transition-all"
          >
            {isLogin ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <div className="relative z-10">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/5" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[#0b0f19] px-3 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <Button 
          variant="outline" 
          type="button" 
          className="w-full py-6 rounded-2xl glass border border-white/10 text-sm font-medium text-foreground hover:border-neon-blue/30 transition-all flex items-center justify-center gap-3 z-10 relative" 
          onClick={handleGoogleSignIn}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </Button>

        <p className="text-center text-sm text-muted-foreground z-10 relative">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-neon-blue hover:underline font-semibold transition-colors"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
