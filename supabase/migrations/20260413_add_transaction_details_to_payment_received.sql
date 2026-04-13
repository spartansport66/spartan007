-- Add transaction details columns to payment_received table
ALTER TABLE payment_received
ADD COLUMN transaction_reference VARCHAR(100),
ADD COLUMN transaction_notes TEXT;

-- Add comment for clarity
COMMENT ON COLUMN payment_received.transaction_reference IS 'Cheque number, UPI transaction ID, or other transaction reference';
COMMENT ON COLUMN payment_received.transaction_notes IS 'Additional notes about the transaction';
