CREATE TYPE payment_category AS ENUM ('advance', 'partial', 'full');

ALTER TABLE payments 
ADD COLUMN category payment_category DEFAULT 'partial';
