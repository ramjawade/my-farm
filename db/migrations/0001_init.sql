-- Postgres initialization migration
-- Creates core schema for MyFarm application
-- Source: db/schema.ts

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tables

CREATE TABLE farmer (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  location text,
  experience text,
  crops_interested text[],
  user_role text,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  deleted_at timestamp with time zone
);

CREATE TABLE land (
  id uuid PRIMARY KEY,
  farmer_id uuid NOT NULL REFERENCES farmer(id),
  name text NOT NULL,
  total_area numeric,
  area_unit text,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  deleted_at timestamp with time zone
);

CREATE TABLE land_point (
  id uuid PRIMARY KEY,
  land_id uuid NOT NULL REFERENCES land(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL
);

CREATE TABLE crop (
  id uuid PRIMARY KEY,
  farmer_id uuid NOT NULL REFERENCES farmer(id),
  land_id uuid NOT NULL REFERENCES land(id),
  name text NOT NULL,
  variety text,
  sowing_date date,
  expected_harvest_date date,
  area numeric,
  area_unit text,
  status text,
  notes text,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  deleted_at timestamp with time zone
);

CREATE TABLE activity (
  id uuid PRIMARY KEY,
  farmer_id uuid NOT NULL REFERENCES farmer(id),
  activity_type_id uuid NOT NULL,
  crop_id uuid REFERENCES crop(id),
  land_id uuid REFERENCES land(id),
  parent_activity_id uuid REFERENCES activity(id),
  custom_activity_name text,
  date date,
  season text,
  status text NOT NULL,
  notes text,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL,
  deleted_at timestamp with time zone
);

CREATE TABLE activity_expense (
  id uuid PRIMARY KEY,
  activity_id uuid NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
  expense_type text,
  amount numeric NOT NULL,
  currency text,
  description text,
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone NOT NULL
);

CREATE TABLE activity_attachment (
  id uuid PRIMARY KEY,
  activity_id uuid NOT NULL REFERENCES activity(id) ON DELETE CASCADE,
  filename text NOT NULL,
  mime_type text NOT NULL,
  data_uri text NOT NULL,
  created_at timestamp with time zone NOT NULL
);

CREATE TABLE weather_snapshot (
  id uuid PRIMARY KEY,
  farmer_id uuid NOT NULL REFERENCES farmer(id),
  location text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  date date NOT NULL,
  temperature numeric,
  humidity numeric,
  pressure numeric,
  wind_speed numeric,
  wind_direction text,
  precipitation numeric,
  description text,
  created_at timestamp with time zone NOT NULL
);

CREATE TABLE weather_forecast_day (
  id uuid PRIMARY KEY,
  farmer_id uuid NOT NULL REFERENCES farmer(id),
  location text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  date date NOT NULL,
  forecast_date date NOT NULL,
  min_temperature numeric,
  max_temperature numeric,
  precipitation_probability numeric,
  expected_precipitation numeric,
  humidity numeric,
  wind_speed numeric,
  description text,
  created_at timestamp with time zone NOT NULL
);

CREATE TABLE weather_alert (
  id uuid PRIMARY KEY,
  farmer_id uuid NOT NULL REFERENCES farmer(id),
  location text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  alert_type text NOT NULL,
  severity text,
  date date NOT NULL,
  description text,
  recommendation text,
  created_at timestamp with time zone NOT NULL
);

-- Indexes

CREATE INDEX idx_land_farmer_id ON land(farmer_id);
CREATE INDEX idx_land_point_land_id ON land_point(land_id);
CREATE INDEX idx_crop_farmer_id ON crop(farmer_id);
CREATE INDEX idx_crop_land_id ON crop(land_id);
CREATE INDEX idx_activity_farmer_id ON activity(farmer_id);
CREATE INDEX idx_activity_crop_id ON activity(crop_id);
CREATE INDEX idx_activity_land_id ON activity(land_id);
CREATE INDEX idx_activity_parent_id ON activity(parent_activity_id);
CREATE INDEX idx_activity_date ON activity(date);
CREATE INDEX idx_activity_status ON activity(status);
CREATE INDEX idx_activity_expense_activity_id ON activity_expense(activity_id);
CREATE INDEX idx_activity_attachment_activity_id ON activity_attachment(activity_id);
CREATE INDEX idx_weather_snapshot_farmer_id ON weather_snapshot(farmer_id);
CREATE INDEX idx_weather_snapshot_date ON weather_snapshot(date);
CREATE INDEX idx_weather_forecast_farmer_id ON weather_forecast_day(farmer_id);
CREATE INDEX idx_weather_forecast_date ON weather_forecast_day(forecast_date);
CREATE INDEX idx_weather_alert_farmer_id ON weather_alert(farmer_id);
CREATE INDEX idx_weather_alert_date ON weather_alert(date);
CREATE INDEX idx_weather_alert_type ON weather_alert(alert_type);
