"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createUser } from "@/app/admin/users/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/use-toast";

const initialState = {
  message: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating User..." : "Create User"}
    </Button>
  );
}

export default function CreateUserPage() {
  const [state, formAction] = useFormState(createUser, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.message) {
      if (state.message.includes("successfully")) {
        toast({
          title: "Success",
          description: state.message,
        });
        formRef.current?.reset(); // Reset form on success
      } else {
        toast({
          title: "Error",
          description: state.message,
          variant: "destructive",
        });
      }
    }
  }, [state, toast]);

  return (
    <div className="container mx-auto p-4 flex justify-center items-center min-h-screen">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Create New User</CardTitle>
          <CardDescription>Fill in the details to create a new user account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input id="first_name" name="first_name" placeholder="John" required />
              {state?.errors?.first_name && <p className="text-red-500 text-sm">{state.errors.first_name[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name (Optional)</Label>
              <Input id="last_name" name="last_name" placeholder="Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="user@example.com" required />
              {state?.errors?.email && <p className="text-red-500 text-sm">{state.errors.email[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
              {state?.errors?.password && <p className="text-red-500 text-sm">{state.errors.password[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">User Type</Label>
              <Select name="role" required defaultValue="sales_person">
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales_person">Sales Person</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="gate_keeper">Gate Keeper</SelectItem>
                  <SelectItem value="inventory_manager">Inventory Manager</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
              {state?.errors?.role && <p className="text-red-500 text-sm">{state.errors.role[0]}</p>}
            </div>
            <SubmitButton />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}