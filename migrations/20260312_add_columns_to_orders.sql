-- Migration to add new columns to the orders table

-- Add 'delivery_location' column with a default value
ALTER TABLE orders
ADD COLUMN delivery_location VARCHAR(50) DEFAULT 'door deliver';

-- Update existing rows to set the default value
UPDATE orders
SET delivery_location = 'door deliver';

-- Alter the column to enforce NOT NULL constraint
ALTER TABLE orders
ALTER COLUMN delivery_location SET NOT NULL;

-- Add 'transport_name' column
ALTER TABLE orders
ADD COLUMN transport_name VARCHAR(100);

-- Add 'booking_destination' column
ALTER TABLE orders
ADD COLUMN booking_destination VARCHAR(200);

-- Add 'date_of_dispatch' column
ALTER TABLE orders
ADD COLUMN date_of_dispatch DATE;

-- Remove default value for 'delivery_location' column
ALTER TABLE orders
ALTER COLUMN delivery_location DROP DEFAULT;

-- Ensure 'delivery_location' column allows NULL values
ALTER TABLE orders
ALTER COLUMN delivery_location DROP NOT NULL;