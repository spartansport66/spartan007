"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

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

  const prevUserIdRef = useRef<string | undefined>(undefined);
  const prevSessionIdRef = useRef<string | undefined>(undefined);

  const updateSessionAndProfileStates = async (currentSession: Session | null) => {
    console.log('SessionContext: updateSessionAndProfileStates started. Current session:', currentSession);
    setLoading(true); // Set loading to true at the start of processing a new session/user

    const newUserId = currentSession?.user?.id;
    const newSessionId = currentSession?.access_token;

    // Only update session if it's actually new or changed
    if (newSessionId !== prevSessionIdRef.current) {
      setSession(currentSession);
      prevSessionIdRef.current = newSessionId;
      console.log('SessionContext: Session updated to:', currentSession);
    }

    // Only update user and fetch profile if user ID has changed
    if (newUserId !== prevUserIdRef.current) {
      setUser(currentSession?.user || null);
      prevUserIdRef.current = newUserId;
      console.log('SessionContext: User updated to:', currentSession?.user);

      let fetchedIsAdmin = false;
      let fetchedUserType: string | null = null;

      if (currentSession?.user) {
        console.log('SessionContext: Attempting to fetch user profile for ID:', currentSession.user.id);
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('is_admin, user_type')
            .eq('id', currentSession.user.id);

          if (error) {
            console.error('SessionContext: Error fetching user profile:', error.message);
            showError(`Failed to load user profile: ${error.message}`);
          } else if (data && data.length > 0) {
            console.log('SessionContext: User profile fetched successfully:', data[0]);
            fetchedIsAdmin = data[0].is_admin || false;
            fetchedUserType = data[0].user_type || 'sales_person';
          } else {
            console.warn('SessionContext: No user profile found for ID:', currentSession.user.id, 'Data was empty or null.');
            showError('No user profile found. Please ensure your account has a profile.');
          }
        } catch (profileFetchError: any) {
          console.error('SessionContext: Caught error during profile fetch:', profileFetchError.message);
          showError(`An unexpected error occurred while fetching your profile: ${profileFetchError.message}`);
        }
      }
      setIsAdmin(fetchedIsAdmin);
      setUserType(fetchedUserType);
      console.log('SessionContext: isAdmin set to', fetchedIsAdmin, 'userType set to', fetchedUserType);
    } else {
      console.log('SessionContext: User ID and Session ID are unchanged. Skipping profile fetch and state updates.');
    }
    // IMPORTANT: Set loading to false ONLY after all profile data is resolved
    setLoading(false);
    console.log('SessionContext: updateSessionAndProfileStates completed. setLoading(false). Final state: loading:', false, 'isAdmin:', isAdmin, 'userType:', userType);
  };

  useEffect(() => {
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
            prevUserIdRef.current = undefined;
            prevSessionIdRef.current = undefined;
            console.log('SessionContext: SIGNED_OUT event processed. Setting loading to false.');
            setLoading(false); // Ensure loading is false on sign out
          } else {
            await updateSessionAndProfileStates(currentSession);
          }
        } catch (error: any) {
          console.error('SessionContext: Error in onAuthStateChange handler:', error);
          showError(`Authentication error: ${error.message}`);
          setLoading(false); // Ensure loading is false even on error
        }
      }
    );

    console.log('SessionContext: Calling supabase.auth.getSession()...');
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      console.log('SessionContext: getSession promise resolved. Initial session:', initialSession);
      await updateSessionAndProfileStates(initialSession);
    }).catch(error => {
      console.error('SessionContext: Error during initial getSession promise:', error);
      showError(`Failed to load session: ${error.message}`);
      setLoading(false); // Ensure loading is false even on error
    });

    return () => {
      console.log('SessionContext: Cleaning up auth state change listener.');
      authListener.subscription.unsubscribe();
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