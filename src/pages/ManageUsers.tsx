"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { showSuccess, showError } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Loader2, Edit, Trash2, UserCheck, UserX, PlusCircle } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// IMPORTANT: Replace with the actual URL of your deployed Edge Function
const CREATE_USER_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/create-user";
const UPDATE_USER_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/update-user";

interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  user_type: 'admin' | 'sales_person';
  is_admin: boolean;
  raw_app_meta_data: {
    provider?: string;
    providers?: string[];
  };
  banned_until: string | null;
}

interface Dealer {
  id: string;
  name: string;
  sales_person_id: string | null;
}

const userFormSchema = z.object({
  firstName: z.string().min(1, { message: 'First name is required.' }),
  lastName: z.string().min(1, { message: 'Last name is required.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }).optional().or(z.literal('')),
  userType: z.enum(['admin', 'sales_person'], { message: 'Please select a user type.' }),
});

const ManageUsers = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: sessionLoading } = useSession();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [assignedDealerIds, setAssignedDealerIds] = useState<string[]>([]);

  const editForm = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      userType: 'sales_person',
    },
  });

  const createForm = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      userType: 'sales_person',
    },
  });

  const fetchUsersAndDealers = useCallback(async () => {
    setLoadingData(true);
    const { data: usersData, error: usersError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, user_type, is_admin, auth_users(email, banned_until, raw_app_meta_data)');

    if (usersError) {
      console.error('Error fetching users:', usersError.message);
      showError('Failed to load users.');
      setUsers([]);
    } else {
      const formattedUsers: UserProfile[] = usersData.map((profile: any) => ({
        id: profile.id,
        email: profile.auth_users?.email || 'N/A',
        first_name: profile.first_name,
        last_name: profile.last_name,
        user_type: profile.user_type,
        is_admin: profile.is_admin,
        banned_until: profile.auth_users?.banned_until,
        raw_app_meta_data: profile.auth_users?.raw_app_meta_data || {},
      }));
      setUsers(formattedUsers);
    }

    const { data: dealersData, error: dealersError } = await supabase
      .from('dealers')
      .select('id, name, sales_person_id');

    if (dealersError) {
      console.error('Error fetching dealers:', dealersError.message);
      showError('Failed to load dealers.');
      setDealers([]);
    } else {
      setDealers(dealersData || []);
    }

    setLoadingData(false);
  }, []);

  useEffect(() => {
    if (!sessionLoading) {
      if (!isAdmin) {
        showError('Access Denied: You must be an administrator to view this page.');
        navigate('/dashboard');
      } else {
        fetchUsersAndDealers();
      }
    }
  }, [sessionLoading, isAdmin, navigate, fetchUsersAndDealers]);

  useEffect(() => {
    if (selectedUser) {
      editForm.reset({
        firstName: selectedUser.first_name || '',
        lastName: selectedUser.last_name || '',
        email: selectedUser.email,
        password: '', // Password should always be empty for security
        userType: selectedUser.user_type,
      });
      if (selectedUser.user_type === 'sales_person') {
        setAssignedDealerIds(dealers.filter(d => d.sales_person_id === selectedUser.id).map(d => d.id));
      } else {
        setAssignedDealerIds([]);
      }
    }
  }, [selectedUser, editForm, dealers]);

  const handleCreateUser = async (values: z.infer<typeof userFormSchema>) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(CREATE_USER_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          first_name: values.firstName,
          last_name: values.lastName,
          user_type: values.userType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      showSuccess(`User ${values.email} created successfully as ${values.userType}!`);
      createForm.reset();
      setIsCreateDialogOpen(false);
      fetchUsersAndDealers(); // Refresh user list
    } catch (error: any) {
      console.error('Error creating user:', error);
      showError(`Failed to create user: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (values: z.infer<typeof userFormSchema>) => {
    if (!selectedUser) return;
    setIsSubmitting(true);

    try {
      const payload: any = {
        userId: selectedUser.id,
        email: values.email,
        first_name: values.firstName,
        last_name: values.lastName,
        user_type: values.userType,
      };

      if (values.password) {
        payload.password = values.password;
      }

      if (values.userType === 'sales_person') {
        payload.assignedDealerIds = assignedDealerIds;
      } else {
        // If user type is not sales_person, ensure no dealers are assigned
        payload.assignedDealerIds = [];
      }

      const response = await fetch(UPDATE_USER_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      showSuccess(`User ${values.email} updated successfully!`);
      setIsEditDialogOpen(false);
      fetchUsersAndDealers(); // Refresh user list
    } catch (error: any) {
      console.error('Error updating user:', error);
      showError(`Failed to update user: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleUserStatus = async (userToToggle: UserProfile) => {
    setIsSubmitting(true);
    const newStatus = userToToggle.banned_until ? false : true; // true to ban, false to unban
    try {
      const payload = {
        userId: userToToggle.id,
        ban_and_unverify: newStatus,
      };

      const response = await fetch(UPDATE_USER_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to toggle user status');
      }

      showSuccess(`User ${userToToggle.email} has been ${newStatus ? 'deactivated' : 'activated'}.`);
      fetchUsersAndDealers(); // Refresh user list
    } catch (error: any) {
      console.error('Error toggling user status:', error);
      showError(`Failed to toggle user status: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddDealerToUser = (dealerId: string) => {
    setAssignedDealerIds(prev => [...prev, dealerId]);
  };

  const handleRemoveDealerFromUser = (dealerId: string) => {
    setAssignedDealerIds(prev => prev.filter(id => id !== dealerId));
  };

  if (sessionLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading user management panel...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Should be redirected by useEffect
  }

  const availableDealers = dealers.filter(d => !assignedDealerIds.includes(d.id) && d.sales_person_id !== selectedUser?.id);
  const currentAssignedDealers = dealers.filter(d => assignedDealerIds.includes(d.id));

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-full">
        <Button variant="outline" onClick={() => navigate('/admin-dashboard')} className="mb-6 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Admin Dashboard
        </Button>

        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary">Manage Users</CardTitle>
            <CardDescription className="text-muted-foreground">View, edit, activate/deactivate users, and manage dealer assignments.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {users.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No users found. Create a new user to get started!</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted/90">
                      <TableHead className="text-muted-foreground">Name</TableHead>
                      <TableHead className="text-muted-foreground">Email</TableHead>
                      <TableHead className="text-muted-foreground">User Type</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((userItem) => (
                      <TableRow key={userItem.id} className="hover:bg-accent/50">
                        <TableCell className="font-medium text-foreground">{userItem.first_name} {userItem.last_name}</TableCell>
                        <TableCell className="text-muted-foreground">{userItem.email}</TableCell>
                        <TableCell className="text-muted-foreground">{userItem.user_type}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {userItem.banned_until ? (
                            <span className="text-red-500">Inactive</span>
                          ) : (
                            <span className="text-green-500">Active</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => { setSelectedUser(userItem); setIsEditDialogOpen(true); }} title="Edit User">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title={userItem.banned_until ? "Activate User" : "Deactivate User"} disabled={isSubmitting}>
                                  {userItem.banned_until ? <UserCheck className="h-4 w-4 text-green-500" /> : <UserX className="h-4 w-4 text-destructive" />}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action will {userItem.banned_until ? 'activate' : 'deactivate'} user {userItem.email}.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleToggleUserStatus(userItem)} disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Continue'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <div className="mt-6 text-right">
              <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <PlusCircle className="h-4 w-4 mr-2" /> Create New User
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Fill in the details to create a new user account.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateUser)} className="grid gap-4 py-4">
              <FormField
                control={createForm.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john.doe@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="********" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="userType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a user type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="sales_person">Sales Person</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create User'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      {selectedUser && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Edit User: {selectedUser.email}</DialogTitle>
              <DialogDescription>
                Make changes to the user's details and assignments.
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleUpdateUser)} className="grid gap-4 py-4">
                <FormField
                  control={editForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password (leave blank to keep current)</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="********" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="userType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>User Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a user type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="sales_person">Sales Person</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {editForm.watch('userType') === 'sales_person' && (
                  <div className="grid gap-4 mt-4">
                    <h3 className="text-lg font-semibold">Manage Assigned Dealers</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="p-4">
                        <CardTitle className="text-md mb-2">Assigned Dealers</CardTitle>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {currentAssignedDealers.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No dealers assigned.</p>
                          ) : (
                            currentAssignedDealers.map(dealer => (
                              <div key={dealer.id} className="flex items-center justify-between p-2 border rounded-md">
                                <span>{dealer.name}</span>
                                <Button variant="destructive" size="sm" onClick={() => handleRemoveDealerFromUser(dealer.id)}>Remove</Button>
                              </div>
                            ))
                          )}
                        </div>
                      </Card>
                      <Card className="p-4">
                        <CardTitle className="text-md mb-2">Available Dealers</CardTitle>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {availableDealers.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No available dealers.</p>
                          ) : (
                            availableDealers.map(dealer => (
                              <div key={dealer.id} className="flex items-center justify-between p-2 border rounded-md">
                                <span>{dealer.name}</span>
                                <Button variant="secondary" size="sm" onClick={() => handleAddDealerToUser(dealer.id)}>Add</Button>
                              </div>
                            ))
                          )}
                        </div>
                      </Card>
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save changes'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ManageUsers;