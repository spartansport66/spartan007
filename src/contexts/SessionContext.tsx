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
  userType: string | null;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log('SessionContextProvider: Component rendering.');
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userType, setUserType] = useState<string | null>(null);
  const navigate = useNavigate();

  const loadSessionAndProfile = async (currentSession: Session | null) => {
    setSession(currentSession);
    setUser(currentSession?.user || null);
    setIsAdmin(false); // Reset before fetching
    setUserType(null); // Reset before fetching

    if (currentSession?.user) {
      console.log('SessionContext: Attempting to fetch user profile for ID:', currentSession.user.id);
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin, user_type')
        .eq('id', currentSession.user.id)
        .single();

      if (error) {
        console.error('SessionContext: Error fetching user profile:', error.message);
        showError(`Failed to load user profile: ${error.message}`);
      } else {
        console.log('SessionContext: User profile fetched successfully:', data);
        setIsAdmin(data?.is_admin || false);
        setUserType(data?.user_type || 'sales_person');
      }
    }
    setLoading(false); // Set loading to false only after session and profile are processed
    console.log('SessionContext: loadSessionAndProfile completed. Loading set to false.');
  };

  useEffect(() => {
    let toastId: string | undefined;
    console.log('SessionContextProvider: useEffect for auth state change listener mounted.');

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        console.log('SessionContext: Auth event received:', event, 'Session:', currentSession);
        try {
          if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setIsAdmin(false);
            setUserType(null);
            setLoading(false); // Ensure loading is false on sign out
            if (toastId) dismissToast(toastId);
            console.log('SessionContext: SIGNED_OUT event processed. Loading set to false.');
          } else if (currentSession) {
            await loadSessionAndProfile(currentSession);
            if (toastId) dismissToast(toastId);
          } else {
            // For events like INITIAL_SESSION where currentSession might be null (no user)
            setSession(null);
            setUser(null);
            setIsAdmin(false);
            setUserType(null);
            setLoading(false);
            console.log('SessionContext: Auth event with no session. Loading set to false.');
          }
        } catch (error: any) {
          console.error('SessionContext: Error in onAuthStateChange handler:', error);
          showError(`Authentication error: ${error.message}`);
          setLoading(false); // Ensure loading is false even on error
        }
      }
    );

    // Initial session check
    console.log('SessionContext: Performing initial getSession check.');
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      console.log('SessionContext: Initial getSession result:', initialSession);
      await loadSessionAndProfile(initialSession);
    }).catch(error => {
      console.error('SessionContext: Error during initial getSession promise:', error);
      showError(`Failed to load session: ${error.message}`);
      setLoading(false); // Ensure loading is false even on error
    });

    return () => {
      console.log('SessionContext: Cleaning up auth state change listener.');
      authListener.subscription.unsubscribe();
      if (toastId) dismissToast(toastId);
    };
  }, []);

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