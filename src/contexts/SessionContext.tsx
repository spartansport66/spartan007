"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { showLoading, dismissToast, showError } from '@/utils/toast';

interface SessionContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let toastId: string | undefined;

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (event === 'SIGNED_IN') {
          setSession(currentSession);
          setUser(currentSession?.user || null);
          if (toastId) dismissToast(toastId);
          navigate('/dashboard');
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          if (toastId) dismissToast(toastId);
          navigate('/login');
        } else if (event === 'INITIAL_SESSION') {
          setSession(currentSession);
          setUser(currentSession?.user || null);
          if (currentSession) {
            navigate('/dashboard');
          } else {
            navigate('/login');
          }
        } else if (event === 'USER_UPDATED') {
          setUser(currentSession?.user || null);
        } else if (event === 'PASSWORD_RECOVERY') {
          showLoading('Password recovery initiated. Check your email.');
        } else if (event === 'MFA_CHALLENGE_VERIFIED') {
          // Handle MFA challenge verified
        } else if (event === 'MFA_CHALLENGE_REJECTED') {
          showError('MFA challenge rejected.');
        } else if (event === 'MFA_VERIFY') {
          // Handle MFA verification
        } else if (event === 'MFA_CHALLENGE') {
          // Handle MFA challenge
        } else if (event === 'SUPABASE_AUTH_ERRORS') {
          showError('Authentication error occurred.');
        }
        setLoading(false);
      }
    );

    // Initial session check
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user || null);
      setLoading(false);
      if (initialSession) {
        navigate('/dashboard');
      } else {
        navigate('/login');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
      if (toastId) dismissToast(toastId);
    };
  }, [navigate]);

  return (
    <SessionContext.Provider value={{ session, user, loading }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};