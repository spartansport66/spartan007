export interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
  enrollment_number: string;
  date_of_admission: string;
}

export interface Payment {
  id: string;
  student_id: string;
  student_name: string; // For display purposes
  amount: number;
  payment_date: string;
  payment_method: 'Cash' | 'Cheque' | 'UPI' | 'Bank Transfer';
  cheque_number?: string;
  upi_transaction_id?: string;
  bank_transaction_id?: string;
}