"use client";

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { showSuccess, showError } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { ArrowLeft, Edit, Trash2, PlusCircle, Loader2 } from 'lucide-react';
import { students as initialStudents } from '@/data/students';
import { Student } from '@/types';

const studentSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  phone: z.string().min(10, { message: 'Phone number must be at least 10 digits.' }),
  enrollment_number: z.string().min(1, { message: 'Enrollment number is required.' }),
  date_of_admission: z.string().min(1, { message: 'Date of admission is required.' }),
});

const StudentManagement = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof studentSchema>>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      enrollment_number: '',
      date_of_admission: '',
    },
  });

  useEffect(() => {
    if (editingStudent) {
      form.reset(editingStudent);
    } else {
      form.reset({
        name: '',
        email: '',
        phone: '',
        enrollment_number: '',
        date_of_admission: '',
      });
    }
  }, [editingStudent, form]);

  const handleAddClick = () => {
    setEditingStudent(null);
    setIsDialogOpen(true);
  };

  const handleEditClick = (student: Student) => {
    setEditingStudent(student);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (studentId: string) => {
    setStudents(students.filter(s => s.id !== studentId));
    showSuccess('Student deleted successfully!');
  };

  const onSubmit = (values: z.infer<typeof studentSchema>) => {
    setIsSubmitting(true);
    // Simulate async operation
    setTimeout(() => {
      if (editingStudent) {
        // Update existing student
        setStudents(students.map(s => s.id === editingStudent.id ? { ...s, ...values } : s));
        showSuccess('Student updated successfully!');
      } else {
        // Add new student
        const newStudent: Student = {
          id: (students.length + 1).toString(), // Simple ID generation for mock data
          ...values,
        };
        setStudents([...students, newStudent]);
        showSuccess('Student added successfully!');
      }
      setIsSubmitting(false);
      setIsDialogOpen(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <Button variant="outline" onClick={() => navigate('/admin-dashboard')} className="mb-6 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Admin Dashboard
        </Button>

        <Card className="bg-card text-card-foreground shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary">Student Management</CardTitle>
            <CardDescription className="text-muted-foreground">
              View, add, edit, or delete student records.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end mb-4">
              <Button onClick={handleAddClick} className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4" /> Add New Student
              </Button>
            </div>
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Enrollment No.</TableHead>
                    <TableHead>Admission Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell>{student.name}</TableCell>
                      <TableCell>{student.email}</TableCell>
                      <TableCell>{student.phone}</TableCell>
                      <TableCell>{student.enrollment_number}</TableCell>
                      <TableCell>{student.date_of_admission}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEditClick(student)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the student record for {student.name}.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteClick(student.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
      <MadeWithDyad />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingStudent ? 'Edit Student' : 'Add New Student'}</DialogTitle>
            <DialogDescription>
              {editingStudent ? 'Update the student details below.' : 'Fill in the details for the new student.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" placeholder="john.doe@example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl><Input type="tel" placeholder="123-456-7890" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="enrollment_number" render={({ field }) => (
                <FormItem>
                  <FormLabel>Enrollment Number</FormLabel>
                  <FormControl><Input placeholder="ENR126" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="date_of_admission" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Admission</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingStudent ? 'Save Changes' : 'Add Student')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentManagement;