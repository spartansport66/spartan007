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
import { ArrowLeft, Loader2, Edit, Trash2, UserCheck, UserX, PlusCircle, Eye, EyeOff } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, } from "@/components/ui/dialog";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import MultiSelect from '@/components/MultiSelect';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import UserTargetsManager from '@/components/UserTargetsManager';

const CREATE_USER_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/create-user";
const UPDATE_USER_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/update-user";
const DELETE_USER_EDGE_FUNCTION_URL = "https://hxftiocfihhdutciaisl.supabase.co/functions/v1/delete-user";

interface SalesTarget {
  id: string;
  sales_person_id: string;
  target_amount: number;
  target_month: string;
  created_at: string;
  updated_at: string;
}

interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  user_type: 'admin' | 'sales_person' | 'gate_keeper' | 'inventory_manager' | 'manager' | 'warehouse_keeper' | 'online_orders' | 'sales_hod';
  is_admin: boolean;
  raw_app_meta_data: { provider?: string; providers?: string[]; };
  banned_until: string | null;
  targets: SalesTarget[];
}

interface Dealer {
  id: string;
  name: string;
}

interface AuthUser {
  id: string;
  email?: string;
  banned_until?: string | null;
  raw_app_meta_data?: { provider?: string; providers?: string[]; } | null;
}

const userFormSchema = z.object({
  firstName: z.string().min(1, { message: 'First name is required.' }),
  lastName: z.string().optional(),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }).optional().or(z.literal('')),
  userType: z.enum(['admin', 'sales_person', 'gate_keeper', 'inventory_manager', 'manager', 'warehouse_keeper', 'online_orders', 'sales_hod'], { message: 'Please select a user type.' }),
  assignedDealerIds: z.array(z.string().uuid()).optional(),
});

const ManageUsers = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: sessionLoading, session } = useSession();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allDealers, setAllDealers] = useState<Dealer[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTargetDialogOpen, setIsTargetDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
  
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  
  const editForm = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      userType: 'sales_person',
      assignedDealerIds: [],
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
      assignedDealerIds: [],
    },
  });
  
  const fetchUsersAndDealers = useCallback(async () => {
    setLoadingData(true);
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`id, first_name, last_name, user_type, is_admin`)
        .neq('user_type', 'admin');
      
      if (profilesError) {
        showError('Failed to load users.');
        setUsers([]);
      } else {
        const userIds = profilesData.map(profile => profile.id);
        const { data: authUsersData } = await supabase.from('users').select('id, email, banned_until'); 
        const { data: targetsData } = await supabase.from('sales_targets').select('*').in('sales_person_id', userIds); 
        
        const formattedUsers: UserProfile[] = profilesData.map((profile: any) => {
          const authUser: AuthUser = authUsersData?.find(au => au.id === profile.id) || { id: profile.id };
          const userTargets: SalesTarget[] = (targetsData || [])
            .filter((target: any) => target.sales_person_id === profile.id)
            .map((target: any) => ({
              ...target,
              target_month: new Date(target.target_month).toISOString().split('T')[0],
            }));

          return {
            id: profile.id,
            email: authUser.email || 'N/A',
            first_name: profile.first_name,
            last_name: profile.last_name,
            user_type: profile.user_type,
            is_admin: profile.is_admin,
            banned_until: authUser.banned_until || null,
            raw_app_meta_data: authUser.raw_app_meta_data || {},
            targets: userTargets, 
          };
        });
        
        setUsers(formattedUsers);
      }
      
      const { data: dealersData } = await supabase.from('dealers').select('id, name');
      setAllDealers(dealersData || []);
    } catch (error) {
      console.error('ManageUsers: Error fetching data:', error);
      showError('Failed to load data.');
    } finally {
      setLoadingData(false);
    }
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
    if (isTargetDialogOpen && targetUser) {
      const updatedTargetUser = users.find(u => u.id === targetUser.id);
      if (updatedTargetUser) setTargetUser(updatedTargetUser);
    }
  }, [users, isTargetDialogOpen, targetUser?.id]);

  useEffect(() => {
    if (selectedUser) {
      if (selectedUser.user_type === 'sales_person') {
        supabase
          .from('dealer_sales_persons')
          .select('dealer_id')
          .eq('sales_person_id', selectedUser.id)
          .then(({ data }) => {
            editForm.reset({
              firstName: selectedUser.first_name || '',
              lastName: selectedUser.last_name || '',
              email: selectedUser.email,
              password: '',
              userType: selectedUser.user_type,
              assignedDealerIds: data?.map(item => item.dealer_id) || [],
            });
          });
      } else {
        editForm.reset({
          firstName: selectedUser.first_name || '',
          lastName: selectedUser.last_name || '',
          email: selectedUser.email,
          password: '',
          userType: selectedUser.user_type,
          assignedDealerIds: [],
        });
      }
    }
  }, [selectedUser, editForm]);

  const handleCreateUser = async (values: z.infer<typeof userFormSchema>) => {
    if (!session) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(CREATE_USER_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          first_name: values.firstName,
          last_name: values.lastName || null,
          user_type: values.userType,
        }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create user');
      
      showSuccess(`User ${values.email} created successfully!`);
      createForm.reset();
      setIsCreateDialogOpen(false);
      fetchUsersAndDealers();
    } catch (error: any) {
      showError(`Failed to create user: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (values: z.infer<typeof userFormSchema>) => {
    if (!selectedUser || !session) return;
    setIsSubmitting(true);
    try {
      const payload: any = {
        userId: selectedUser.id,
        email: values.email,
        first_name: values.firstName,
        last_name: values.lastName || null,
        user_type: values.userType,
      };
      
      if (values.password) payload.password = values.password;
      payload.assignedDealerIds = values.userType === 'sales_person' ? (values.assignedDealerIds || []) : [];
      
      const response = await fetch(UPDATE_USER_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update user');
      
      showSuccess(`User ${values.email} updated successfully!`);
      setIsEditDialogOpen(false);
      fetchUsersAndDealers();
    } catch (error: any) {
      showError(`Failed to update user: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleUserStatus = async (userToToggle: UserProfile) => {
    if (!session) return;
    setIsSubmitting(true);
    const newStatus = userToToggle.banned_until ? false : true;
    try {
      const response = await fetch(UPDATE_USER_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: userToToggle.id,
          ban_and_unverify: newStatus,
        }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to toggle user status');
      
      showSuccess(`User has been ${newStatus ? 'deactivated' : 'activated'}.`);
      fetchUsersAndDealers();
    } catch (error: any) {
      showError(`Failed to toggle user status: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!session) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(DELETE_USER_EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete user');
      
      showSuccess('User deleted successfully.');
      fetchUsersAndDealers();
    } catch (error: any) {
      showError(`Failed to delete user: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectAllDealers = () => {
    const allIds = allDealers.map(dealer => dealer.id);
    editForm.setValue('assignedDealerIds', allIds, { shouldValidate: true });
  };

  const dealerOptions = allDealers.map(dealer => ({ value: dealer.id, label: dealer.name }));

  if (sessionLoading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-lg text-gray-700 dark:text-gray-300">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-full">
        <Button variant="outline" onClick={() => navigate('/admin-dashboard')} className="mb-6 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Admin Dashboard
        </Button>
        
        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary">Manage Users</CardTitle>
            <CardDescription className="text-muted-foreground">
              View, edit, activate/deactivate non-admin users, and manage dealer assignments and monthly targets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end mb-4">
              <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4" /> Create New User
              </Button>
            </div>
            <div className="overflow-x-auto">
              {users.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No non-admin users found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted hover:bg-muted/90">
                      <TableHead className="text-muted-foreground">Name</TableHead>
                      <TableHead className="text-muted-foreground">User Type</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((userItem) => (
                      <TableRow key={userItem.id} className="hover:bg-accent/50">
                        <TableCell className="font-medium text-foreground">{userItem.first_name} {userItem.last_name}</TableCell>
                        <TableCell className="text-muted-foreground capitalize">{userItem.user_type.replace('_', ' ')}</TableCell>
                        <TableCell className="text-muted-foreground">{userItem.banned_until ? <span className="text-red-500">Inactive</span> : <span className="text-green-500">Active</span>}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => { setSelectedUser(userItem); setIsEditDialogOpen(true); }} title="Edit User"><Edit className="h-4 w-4" /></Button>
                            {userItem.user_type === 'sales_person' && (
                              <Button variant="ghost" size="icon" onClick={() => { setTargetUser(userItem); setIsTargetDialogOpen(true); }} title="Manage Monthly Targets"><span className="text-xs font-bold">₹</span></Button>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title={userItem.banned_until ? "Activate User" : "Deactivate User"} disabled={isSubmitting}>
                                  {userItem.banned_until ? <UserCheck className="h-4 w-4 text-green-500" /> : <UserX className="h-4 w-4 text-destructive" />}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>This action will {userItem.banned_until ? 'activate' : 'deactivate'} user {userItem.first_name} {userItem.last_name}.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleToggleUserStatus(userItem)} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Continue'}</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="Delete User" disabled={isSubmitting}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the user {userItem.first_name} {userItem.last_name} and all their associated data.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteUser(userItem.id)} disabled={isSubmitting}>
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
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
          </CardContent>
        </Card>
      </div>
      
      <MadeWithDyad />
      
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Create New User</DialogTitle><DialogDescription>Fill in the details to create a new user account.</DialogDescription></DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateUser)} className="grid gap-4 py-4">
              <FormField control={createForm.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={createForm.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name (Optional)</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={createForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="john.doe@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={createForm.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showCreatePassword ? "text" : "password"} placeholder="********" {...field} />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowCreatePassword(!showCreatePassword)}>
                        {showCreatePassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={createForm.control} name="userType" render={({ field }) => (
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
                      <SelectItem value="sales_hod">Sales HOD</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="gate_keeper">Gate Keeper</SelectItem>
                      <SelectItem value="inventory_manager">Inventory Manager</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="warehouse_keeper">Warehouse Keeper</SelectItem>
                      <SelectItem value="online_orders">Online Orders</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create User'}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {selectedUser && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader><DialogTitle>Edit User: {selectedUser.first_name} {selectedUser.last_name}</DialogTitle><DialogDescription>Make changes to the user's details and assignments.</DialogDescription></DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleUpdateUser)} className="grid gap-4 py-4">
                <FormField control={editForm.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={editForm.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={editForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={editForm.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password (leave blank to keep current)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showEditPassword ? "text" : "password"} placeholder="********" {...field} />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowEditPassword(!showEditPassword)}>
                          {showEditPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="userType" render={({ field }) => (
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
                        <SelectItem value="sales_hod">Sales HOD</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="gate_keeper">Gate Keeper</SelectItem>
                        <SelectItem value="inventory_manager">Inventory Manager</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="warehouse_keeper">Warehouse Keeper</SelectItem>
                        <SelectItem value="online_orders">Online Orders</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                {selectedUser.user_type === 'sales_person' && (
                  <div className="grid gap-4 mt-4">
                    <h3 className="text-lg font-semibold">Manage Assigned Dealers</h3>
                    <FormField control={editForm.control} name="assignedDealerIds" render={({ field }) => (
                      <FormItem><div className="flex justify-between items-center"><FormLabel>Assigned Dealers</FormLabel><Button type="button" variant="link" size="sm" onClick={handleSelectAllDealers} className="p-0 h-auto text-sm">Select All</Button></div><FormControl><MultiSelect options={dealerOptions} value={field.value || []} onChange={field.onChange} placeholder="Select dealers to assign" maxHeightClass="max-h-[200px]" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                )}
                <DialogFooter><Button type="submit" disabled={isSubmitting}>{isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save changes'}</Button></DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
      
      {targetUser && (
        <Dialog open={isTargetDialogOpen} onOpenChange={setIsTargetDialogOpen}>
          <DialogContent className="sm:max-w-[700px]"><DialogHeader><DialogTitle>Manage Targets for {targetUser.first_name} {targetUser.last_name}</DialogTitle><DialogDescription>Add, edit, or delete monthly sales targets for this sales person.</DialogDescription></DialogHeader><UserTargetsManager user={targetUser} onTargetsUpdated={fetchUsersAndDealers} /></DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ManageUsers;