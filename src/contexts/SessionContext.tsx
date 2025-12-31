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

  // Helper function to fetch and set profile data
  const fetchAndSetProfile = async (userId: string | undefined) => {
    let fetchedIsAdmin = false;
    let fetchedUserType: string | null = null;

    if (userId) {
      console.log('SessionContext: Fetching user profile for ID:', userId);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_admin, user_type')
          .eq('id', userId);

        if (error) {
          console.error('SessionContext: Error fetching user profile:', error.message);
          showError(`Failed to load user profile: ${error.message}`);
        } else if (data && data.length > 0) {
          fetchedIsAdmin = data[0].is_admin || false;
          fetchedUserType = data[0].user_type || 'sales_person';
          console.log('SessionContext: User profile fetched successfully:', data[0]);
        } else {
          console.warn('SessionContext: No user profile found for ID:', userId, 'Data was empty or null.');
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
  };

  useEffect(() => {
    console.log('SessionContextProvider: useEffect for auth state change listener mounted.');

    const handleSessionChange = async (event: AuthChangeEvent, currentSession: Session | null) => {
      console.log('SessionContext: Auth event received:', event, 'Session:', currentSession);
      setLoading(true); // Start loading for any auth change event

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        setUserType(null);
        prevUserIdRef.current = undefined;
        prevSessionIdRef.current = undefined;
        console.log('SessionContext: SIGNED_OUT event processed.');
      } else {
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
          await fetchAndSetProfile(newUserId); // Fetch profile for new user
        } else {
          console.log('SessionContext: User ID unchanged. Skipping profile fetch.');
          // If user ID is unchanged, but session might have refreshed, ensure isAdmin/userType are still correct
          // This might be redundant if profile is always fetched on user change, but good for robustness.
          if (currentSession?.user) {
            await fetchAndSetProfile(currentSession.user.id);
          } else {
            setIsAdmin(false);
            setUserType(null);
          }
        }
      }
      setLoading(false); // End loading after all state updates
      console.log('SessionContext: Auth event processed. setLoading(false).');
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(handleSessionChange);

    console.log('SessionContext: Calling supabase.auth.getSession()...');
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      console.log('SessionContext: getSession promise resolved. Initial session:', initialSession);
      setLoading(true); // Start loading for initial session fetch
      setSession(initialSession);
      setUser(initialSession?.user || null);
      prevSessionIdRef.current = initialSession?.access_token;
      prevUserIdRef.current = initialSession?.user?.id;

      await fetchAndSetProfile(initialSession?.user?.id); // Fetch profile for initial user
      setLoading(false); // End loading after initial session and profile are set
      console.log('SessionContext: Initial getSession processed. setLoading(false).');
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