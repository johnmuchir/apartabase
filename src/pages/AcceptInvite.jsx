import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { entities } from '@/api/supabaseClient';
import { Lock, Loader2 } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

export default function AcceptInvite() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const emailParam = searchParams.get('email');
  const tokenParam = searchParams.get('token');

  const [invitation, setInvitation] = useState(null);
  const [checkingInvite, setCheckingInvite] = useState(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  // Validate the database invitation
  useEffect(() => {
    async function checkInvite() {
      if (!emailParam || !tokenParam) {
        setCheckingInvite(false);
        return;
      }
      try {
        const results = await entities.Invitation.filter({
          email: emailParam,
          token: tokenParam,
          status: 'pending'
        });
        
        if (results && results.length > 0) {
          setInvitation(results[0]);
        }
      } catch (err) {
        console.error('Error verifying invitation:', err);
      } finally {
        setCheckingInvite(false);
      }
    }
    checkInvite();
  }, [emailParam, tokenParam]);

  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (!invitation) return;
    if (password !== confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (password.length < 8) {
      toast({ title: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      // 1. Sign up the user (with custom role and name in metadata)
      const { data, error } = await supabase.auth.signUp({
        email: invitation.email,
        password: password,
        options: {
          data: {
            full_name: invitation.full_name,
            role: invitation.role
          }
        }
      });
      if (error) throw error;

      // 2. Mark the invitation as accepted
      await entities.Invitation.update(invitation.id, { status: 'accepted' });

      // 3. Sign out auto-logged-in session to force them to sign in manually on /login
      await supabase.auth.signOut();

      toast({ title: 'Account activated successfully! Please sign in.' });
      navigate('/login', { replace: true });
    } catch (err) {
      toast({
        title: 'Activation failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingInvite) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invitation) {
    return (
      <AuthLayout icon={Lock} title="Invalid Link" subtitle="This invitation link is invalid, expired, or has already been used.">
        <div className="text-center space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Please contact the administrator or agent for a new invitation link.
          </p>
          <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
            Go to Login
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={Lock}
      title="Create Your Account"
      subtitle={`Welcome, ${invitation.full_name}. Create a password to register as a ${invitation.role}.`}
    >
      <form onSubmit={handleSetPassword} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="new-password">Password</Label>
          <Input
            id="new-password"
            type="password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm Password</Label>
          <Input
            id="confirm-password"
            type="password"
            placeholder="Confirm your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" className="w-full h-11" disabled={loading}>
          {loading ? 'Activating Account…' : 'Register Account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
