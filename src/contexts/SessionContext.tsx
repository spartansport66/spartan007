"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

interface SessionContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  userType: 'admin' | 'sales_person' | 'gate_keeper' | 'inventory_manager' | 'manager' | 'super_admin' | 'warehouse_keeper' | null;
  mustResetPassword: boolean; // Added mustResetPassword
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userType, setUserType] = useState<'admin' | 'sales_person' | 'gate_keeper' | 'inventory_manager' | 'manager' | 'super_admin' | 'warehouse_keeper' | null>(null);
  const [mustResetPassword, setMustResetPassword] = useState(false); // Initialize mustResetPassword

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('user_type, must_reset_password')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        throw error;
      }

      if (profile) {
        const isAdminUser = profile.user_type === 'admin';
        setIsAdmin(isAdminUser);
        setUserType(profile.user_type as SessionContextType['userType']);
        setMustResetPassword(profile.must_reset_password === true);
      } else {
        // No profile found for this user
        setIsAdmin(false);
        setUserType(null);
        setMustResetPassword(false);
      }
    } catch (error: any) {
      console.error('SessionContext: Error fetching profile:', error.message);
      showError(`Error fetching user profile: ${error.message}`);
      setIsAdmin(false);
      setUserType(null);
      setMustResetPassword(false);
    }
  };

  useEffect(() => {
    const initializeSession = async () => {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession);
        setUser(initialSession?.user || null);
        
        if (initialSession?.user?.id) {
          await fetchProfile(initialSession.user.id);
        }
      } catch (error) {
        console.error('SessionContext: Error checking session:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user || null);
      
      if (session?.user?.id) {
        await fetchProfile(session.user.id);
      } else {
        setIsAdmin(false);
        setUserType(null);
        setMustResetPassword(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <SessionContext.Provider value={{ session, user, loading, isAdmin, userType, mustResetPassword }}>
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