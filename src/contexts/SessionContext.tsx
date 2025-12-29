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
  isAdmin: boolean;
  userType: string | null; // Added userType to the context type
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userType, setUserType] = useState<string | null>(null); // Added userType state
  const navigate = useNavigate();

  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin, user_type') // Fetch user_type as well
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error.message);
      setIsAdmin(false);
      setUserType(null);
    } else {
      setIsAdmin(data?.is_admin || false);
      setUserType(data?.user_type || 'sales_person'); // Default to 'sales_person'
    }
  };

  useEffect(() => {
    let toastId: string | undefined;

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        switch (event) {
          case 'SIGNED_IN':
            setSession(currentSession);
            setUser(currentSession?.user || null);
            if (currentSession?.user) {
              await fetchUserProfile(currentSession.user.id);
            }
            if (toastId) dismissToast(toastId);
            break;
          case 'SIGNED_OUT':
            setSession(null);
            setUser(null);
            setIsAdmin(false);
            setUserType(null); // Reset userType on sign out
            if (toastId) dismissToast(toastId);
            navigate('/login');
            break;
          case 'INITIAL_SESSION':
            setSession(currentSession);
            setUser(currentSession?.user || null);
            if (currentSession?.user) {
              await fetchUserProfile(currentSession.user.id);
            }
            break;
          case 'USER_UPDATED':
            setUser(currentSession?.user || null);
            if (currentSession?.user) {
              await fetchUserProfile(currentSession.user.id);
            }
            break;
          case 'PASSWORD_RECOVERY':
            showLoading('Password recovery initiated. Check your email.');
            break;
          case 'TOKEN_REFRESHED':
            break;
          default:
            console.warn('Unhandled auth event:', event);
        }
        setLoading(false);
      }
    );

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user || null);
      if (initialSession?.user) {
        await fetchUserProfile(initialSession.user.id);
      }
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
      if (toastId) dismissToast(toastId);
    };
  }, [navigate]);

  return (
    <SessionContext.Provider value={{ session, user, loading, isAdmin, userType }}>
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