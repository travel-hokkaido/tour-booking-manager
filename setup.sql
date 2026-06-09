-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- 1. Create tables
CREATE TABLE groups (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  start_date DATE,
  end_date DATE,
  pax INTEGER DEFAULT 1,
  memo TEXT DEFAULT '',
  drive_link TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE items (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT REFERENCES groups(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'hotel',
  venue TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  pax INTEGER DEFAULT 1,
  price TEXT DEFAULT '',
  commission TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  memo TEXT DEFAULT '',
  invoice_link TEXT DEFAULT '',
  room_type TEXT DEFAULT '',
  room_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (open access - anyone with the link can read/write)
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on groups" ON groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on items" ON items FOR ALL USING (true) WITH CHECK (true);

-- 3. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE groups;
ALTER PUBLICATION supabase_realtime ADD TABLE items;
