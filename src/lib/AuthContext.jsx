import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Error fetching user profile:", err);
      return null;
    }
  }, []);

  const initAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        if (typeof window !== 'undefined' && (localStorage.getItem('demo_role') || localStorage.getItem('demo_user'))) {
          const role = localStorage.getItem('demo_role') || 'tenant';
          const savedUser = localStorage.getItem('demo_user');
          const mockProfile = savedUser ? JSON.parse(savedUser) : {
            id: session.user.id,
            email: session.user.email,
            full_name: session.user.user_metadata?.full_name || `Demo ${role.charAt(0).toUpperCase() + role.slice(1)}`,
            role: role,
            phone: '+254 700 000000'
          };
          setUser(session.user);
          setProfile(mockProfile);
        } else {
          const p = await fetchProfile(session.user.id);
          setUser(session.user);
          setProfile(p);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
    } finally {
      setIsLoadingAuth(false);
    }
  }, [fetchProfile]);

  useEffect(() => {
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          if (typeof window !== 'undefined' && (localStorage.getItem('demo_role') || localStorage.getItem('demo_user'))) {
            const role = localStorage.getItem('demo_role') || 'tenant';
            const savedUser = localStorage.getItem('demo_user');
            const mockProfile = savedUser ? JSON.parse(savedUser) : {
              id: session.user.id,
              email: session.user.email,
              full_name: session.user.user_metadata?.full_name || `Demo ${role.charAt(0).toUpperCase() + role.slice(1)}`,
              role: role,
              phone: '+254 700 000000'
            };
            setUser(session.user);
            setProfile(mockProfile);
          } else {
            const p = await fetchProfile(session.user.id);
            setUser(session.user);
            setProfile(p);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
      }
      setIsLoadingAuth(false);
    });

    return () => subscription.unsubscribe();
  }, [initAuth, fetchProfile]);

  const signOut = async () => {
    localStorage.removeItem('demo_role');
    localStorage.removeItem('demo_user');
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  // Demo mode bypass — read demo_role from localStorage
  const demoRole = typeof window !== 'undefined' ? localStorage.getItem('demo_role') : null;

  const isAuthenticated = demoRole ? true : !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAuthenticated,
        isLoadingAuth,
        demoRole,
        signOut,
        resetPassword,
        refetchProfile: () => fetchProfile(user?.id).then(setProfile),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
