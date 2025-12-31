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

  // Helper function to fetch and return profile data with retries
  const fetchProfileData = async (userId: string | undefined, retries = 3): Promise<{ isAdmin: boolean; userType: string | null }> => {
    let fetchedIsAdmin = false;
    let fetchedUserType: string | null = null;

    if (userId) {
      console.log('SessionContext: Fetching user profile for ID:', userId);
      
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('is_admin, user_type')
            .eq('id', userId)
            .single();

          if (error) {
            console.error(`SessionContext: Error fetching user profile (attempt ${attempt}):`, error.message);
            if (attempt === retries) {
              showError(`Failed to load user profile after ${retries} attempts: ${error.message}`);
            }
          } else if (data) {
            fetchedIsAdmin = data.is_admin || false;
            fetchedUserType = data.user_type || 'sales_person';
            console.log('SessionContext: User profile fetched successfully:', data);
            break; // Success, exit retry loop
          } else {
            console.warn(`SessionContext: No user profile found for ID: ${userId} (attempt ${attempt})`);
            if (attempt === retries) {
              showError('No user profile found. Please ensure your account has a profile.');
            }
          }
        } catch (profileFetchError: any) {
          console.error(`SessionContext: Caught error during profile fetch (attempt ${attempt}):`, profileFetchError.message);
          if (attempt === retries) {
            showError(`An unexpected error occurred while fetching your profile: ${profileFetchError.message}`);
          }
        }
        
        // Wait before retrying (except on last attempt)
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
      }
    }

    console.log('SessionContext: Profile data fetched: isAdmin', fetchedIsAdmin, 'userType', fetchedUserType);
    return { isAdmin: fetchedIsAdmin, userType: fetchedUserType };
  };

  useEffect(() => {
    console.log('SessionContextProvider: useEffect for auth state change listener mounted.');
    
    const handleSessionChange = async (event: AuthChangeEvent, currentSession: Session | null) => {
      console.log('SessionContext: Auth event received:', event, 'Session:', currentSession);
      
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
        let profileData = { isAdmin: false, userType: null };

        if (newSessionId !== prevSessionIdRef.current) {
          setSession(currentSession);
          prevSessionIdRef.current = newSessionId;
          console.log('SessionContext: Session updated.');
        }

        if (newUserId !== prevUserIdRef.current) {
          setUser(currentSession?.user || null);
          prevUserIdRef.current = newUserId;
          console.log('SessionContext: User updated.');
          profileData = await fetchProfileData(newUserId); // Await profile data
        } else if (currentSession?.user) {
          // If user ID is unchanged but session might have refreshed, re-fetch profile to ensure up-to-date roles
          console.log('SessionContext: User ID unchanged, re-fetching profile for robustness.');
          profileData = await fetchProfileData(currentSession.user.id);
        } else {
          console.log('SessionContext: No user in session, resetting profile states.');
        }

        setIsAdmin(profileData.isAdmin);
        setUserType(profileData.userType);
        console.log('SessionContext: Final state update in handleSessionChange: isAdmin', profileData.isAdmin, 'userType', profileData.userType);
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(handleSessionChange);

    console.log('SessionContext: Calling supabase.auth.getSession()...');
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      console.log('SessionContext: getSession promise resolved. Initial session:', initialSession);
      setSession(initialSession);
      setUser(initialSession?.user || null);
      prevSessionIdRef.current = initialSession?.access_token;
      prevUserIdRef.current = initialSession?.user?.id;

      const profileData = await fetchProfileData(initialSession?.user?.id); // Await profile data
      setIsAdmin(profileData.isAdmin);
      setUserType(profileData.userType);
      console.log('SessionContext: Initial getSession processed. Final state: isAdmin', profileData.isAdmin, 'userType', profileData.userType);
      setLoading(false); // Only set loading to false after everything is processed
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
  }, []); // Dependencies are empty, so it runs once on mount

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