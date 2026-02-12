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

  useEffect(() => {
    setLoading(true); // Start with loading true

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user?.id) {
        try {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('is_admin, user_type, must_reset_password')
            .eq('id', session.user.id)
            .single();

          if (error && error.code !== 'PGRST116') {
            throw error;
          }

          if (profile) {
            setIsAdmin(profile.is_admin === true);
            setUserType(profile.user_type as any);
            setMustResetPassword(profile.must_reset_password === true);
          } else {
            // No profile found, reset states
            setIsAdmin(false);
            setUserType(null);
            setMustResetPassword(false);
          }
        } catch (e: any) {
          console.error("Error fetching profile on auth change", e);
          showError("Failed to fetch user profile.");
          setIsAdmin(false);
          setUserType(null);
          setMustResetPassword(false);
        }
      } else {
        // No session, reset states
        setIsAdmin(false);
        setUserType(null);
        setMustResetPassword(false);
      }
      setLoading(false); // Set loading to false after everything is done
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