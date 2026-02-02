"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/contexts/SessionContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminDashboard() {
  const { isAdmin, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/');
    }
  }, [isAdmin, loading, router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAdmin) {
    return <div>Access Denied</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Manage Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p>View and manage all users in the system.</p>
            <Link href="/admin/users" passHref>
              <Button className="mt-2">Go to Users</Button>
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>System Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Configure system-wide settings and preferences.</p>
            <Button className="mt-2" disabled>Go to Settings</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Create a New User</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Add a new user to the system.</p>
            <Link href="/admin/users/new" passHref>
              <Button className="mt-2">Create New User</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}