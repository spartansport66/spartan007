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
    console.log('SessionContext: updateSessionAndProfileStates started.');

    const newUserId = currentSession?.user?.id;
    const newSessionId = currentSession?.access_token;

    if (newSessionId !== prevSessionIdRef.current) {
      setSession(currentSession);
      prevSessionIdRef.current = newSessionId;
      console.log('SessionContext: Session updated.');
    }

    if (newUserId !== prevUserIdRef.current) {
      setUser(currentSession?.user || null);
      prevUserIdRef.current = newUserId;
      console.log('SessionContext: User updated.');

      let fetchedIsAdmin = false;
      let fetchedUserType: string | null = null;

      if (currentSession?.user) {
        console.log('SessionContext: Attempting to fetch user profile for ID:', currentSession.user.id);
        try {
          // Removed the problematic test query on products table.
          // The primary goal here is to fetch the user's profile for role determination.

          console.log('SessionContext: Before Supabase profile query.');
          const { data, error } = await supabase
            .from('profiles')
            .select('is_admin, user_type')
            .eq('id', currentSession.user.id);
          console.log('SessionContext: After Supabase profile query. Raw data:', data, 'Raw error:', error);

          if (error) {
            console.error('SessionContext: Error fetching user profile:', error.message);
            showError(`Failed to load user profile: ${error.message}`);
          } else if (data === null || data === undefined || data.length === 0) {
            console.warn('SessionContext: No user profile found for ID:', currentSession.user.id, 'Data was empty or null.');
            showError('No user profile found. Please ensure your account has a profile.');
          } else {
            console.log('SessionContext: User profile fetched successfully:', data[0]);
            fetchedIsAdmin = data[0].is_admin || false;
            fetchedUserType = data[0].user_type || 'sales_person';
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
    console.log('SessionContext: updateSessionAndProfileStates completed.');
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
            setLoading(false);
          } else {
            await updateSessionAndProfileStates(currentSession);
            console.log('SessionContext: Auth event processed. Setting loading to false AFTER profile update.');
            setLoading(false);
          }
        } catch (error: any) {
          console.error('SessionContext: Error in onAuthStateChange handler:', error);
          showError(`Authentication error: ${error.message}`);
          console.log('SessionContext: Auth event error. Setting loading to false.');
          setLoading(false);
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
    }).finally(() => {
      setLoading(false);
      console.log('SessionContext: Initial getSession completed. Loading set to false in finally block.');
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