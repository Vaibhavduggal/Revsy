-- Supabase SQL Schema for RevSy
-- Run this in the Supabase SQL Editor after creating your project

-- Businesses table
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  google_review_link TEXT DEFAULT '',
  feedback_link TEXT DEFAULT '',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  description TEXT DEFAULT '',
  message_template TEXT DEFAULT '',
  delay_seconds INTEGER DEFAULT 7200,
  demo_mode BOOLEAN DEFAULT false,
  subscription_status TEXT DEFAULT 'trial',
  reviews_received INTEGER DEFAULT 0,
  google_place_id TEXT DEFAULT '',
  bsp_name TEXT DEFAULT '',
  phone_number_id TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  custom_message TEXT DEFAULT '',
  stage TEXT DEFAULT 'to_send',
  sentiment TEXT,
  complaint TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  last_request_at TIMESTAMPTZ,
  last_request_status TEXT,
  reacted_at TIMESTAMPTZ,
  reviewed_google_at TIMESTAMPTZ
);

-- Requests table
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT DEFAULT '',
  status TEXT DEFAULT 'Scheduled',
  reaction TEXT,
  feedback_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id TEXT,
  customer_name TEXT,
  rating INTEGER DEFAULT 5,
  request_id TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  from_google BOOLEAN DEFAULT false,
  sentiment TEXT
);

-- Feedback table (private, never shown on Google)
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  complaint TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ
);

-- Pending sends (message queue)
CREATE TABLE IF NOT EXISTS pending_sends (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Activities feed
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  customer_name TEXT,
  phone TEXT,
  message TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tokens (auth sessions)
CREATE TABLE IF NOT EXISTS tokens (
  token TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_requests_business ON requests(business_id);
CREATE INDEX IF NOT EXISTS idx_requests_customer ON requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_business ON reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_feedback_business ON feedback(business_id);
CREATE INDEX IF NOT EXISTS idx_pending_sends_status ON pending_sends(status, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_activities_business ON activities(business_id);

-- Seed demo data
INSERT INTO businesses (id, name, owner_email, password, google_review_link, feedback_link, address, phone, description, message_template, delay_seconds, demo_mode, subscription_status, reviews_received, created_at)
VALUES
  ('biz_1', 'Smash Bros', 'owner@business.com', '$2a$10$placeholder', 'https://g.page/smash-bros-ludhiana/review', 'https://smashbros.example.com/feedback/private', 'SCF 29 F, Bhai Randhir Singh Nagar, Ludhiana, Punjab 141012', '098143 05932', 'Smash Bros is a modern smash burger restaurant.', 'Hi [customer name], thank you for visiting [business name]! We''d love to hear about your experience. It only takes 30 seconds: [google review link]', 7200, false, 'trial', 0, now()),
  ('admin_1', 'ReviewBot Admin', 'admin@reviewbot.com', '$2a$10$placeholder', '', '', '', '', 'Platform administrator', 'Hi [customer name], thank you for visiting [business name]!', 7200, false, 'active', 0, now());
