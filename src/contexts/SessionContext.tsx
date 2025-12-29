"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
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
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        switch (event) {
          case 'SIGNED_IN':
            setSession(currentSession);
            setUser(currentSession?.user || null);
            if (toastId) dismissToast(toastId);
            navigate('/dashboard');
            break;
          case 'SIGNED_OUT':
            setSession(null);
            setUser(null);
            if (toastId) dismissToast(toastId);
            navigate('/login');
            break;
          case 'INITIAL_SESSION':
            setSession(currentSession);
            setUser(currentSession?.user || null);
            if (currentSession) {
              navigate('/dashboard');
            } else {
              navigate('/login');
            }
            break;
          case 'USER_UPDATED':
            setUser(currentSession?.user || null);
            break;
          case 'PASSWORD_RECOVERY':
            showLoading('Password recovery initiated. Check your email.');
            break;
          case 'TOKEN_REFRESHED':
            // Handle token refreshed event if needed, otherwise no action
            break;
          default:
            // Fallback for any unhandled events or future events
            console.warn('Unhandled auth event:', event);
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