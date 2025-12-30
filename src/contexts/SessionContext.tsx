"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast'; // Removed showLoading and dismissToast as they are not directly used here

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
  const [loading, setLoading] = useState(true); // Start as true
  const [isAdmin, setIsAdmin] = useState(false);
  const [userType, setUserType] = useState<string | null>(null);

  // This function now only updates session/user/profile data, not the overall loading state
  const updateSessionAndProfileStates = async (currentSession: Session | null) => {
    console.log('SessionContext: updateSessionAndProfileStates started.');
    setSession(currentSession);
    setUser(currentSession?.user || null);

    // Reset profile states before fetching new ones
    let newIsAdmin = false;
    let newUserType: string | null = null;

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
        newIsAdmin = data?.is_admin || false;
        newUserType = data?.user_type || 'sales_person';
      }
    }

    // Only update state if values are actually different to prevent unnecessary re-renders
    if (newIsAdmin !== isAdmin) {
      setIsAdmin(newIsAdmin);
    }
    if (newUserType !== userType) {
      setUserType(newUserType);
    }
    console.log('SessionContext: updateSessionAndProfileStates completed.');
  };

  useEffect(() => {
    console.log('SessionContextProvider: useEffect for auth state change listener mounted.');
    // No need to setLoading(true) here, it's already true initially.

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        console.log('SessionContext: Auth event received:', event, 'Session:', currentSession);
        try {
          if (event === 'SIGNED_OUT') {
            setSession(null);
            setUser(null);
            setIsAdmin(false);
            setUserType(null);
            setLoading(false); // Explicitly set false on sign out
            console.log('SessionContext: SIGNED_OUT event processed. Loading set to false.');
          } else {
            await updateSessionAndProfileStates(currentSession);
            setLoading(false); // Set loading to false after processing session and profile
            console.log('SessionContext: Auth event processed. Loading set to false.');
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
      await updateSessionAndProfileStates(initialSession);
      setLoading(false); // Set loading to false after initial session and profile are processed
      console.log('SessionContext: Initial getSession completed. Loading set to false.');
    }).catch(error => {
      console.error('SessionContext: Error during initial getSession promise:', error);
      showError(`Failed to load session: ${error.message}`);
      setLoading(false); // Ensure loading is false even on error
    });

    return () => {
      console.log('SessionContext: Cleaning up auth state change listener.');
      authListener.subscription.unsubscribe();
    };
  }, []); // Empty dependency array ensures this effect runs only once on mount.

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