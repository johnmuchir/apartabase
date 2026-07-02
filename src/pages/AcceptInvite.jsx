import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Lock } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function AcceptInvite() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [tokenError, setTokenError] = useState(false);

  // Supabase puts the token in the URL hash when following an invite link
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes('access_token') && !hash.includes('type=invite') && !hash.includes('type=recovery')) {
      // No token present — maybe already processed or direct visit
      const params = new URLSearchParams(hash.replace('#', ''));
      if (!params.get('access_token')) {
        setTokenError(true);
      }
    }
  }, []);

  const handleSetPassword = async (e) => {
    e.preventDefault();
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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: 'Password set! Welcome to ApartaBase.' });
      navigate('/', { replace: true });
    } catch (err) {
      toast({
        title: 'Error setting password',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (tokenError) {
    return (
      <AuthLayout icon={Lock} title="Invalid Link" subtitle="This invitation link is invalid or has already been used.">
        <div className="text-center space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Please contact your agent for a new invitation.
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
      title="Set Your Password"
      subtitle="You've been invited to ApartaBase. Set a password to activate your account."
    >
      <form onSubmit={handleSetPassword} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
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
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type="password"
            placeholder="Repeat your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" className="w-full h-11" disabled={loading}>
          {loading ? 'Activating…' : 'Activate Account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
