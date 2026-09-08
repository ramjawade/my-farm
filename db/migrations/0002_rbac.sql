-- RBAC schema migration (PROPOSED - not yet implemented)
-- This migration is kept separate as RBAC is planned but not yet wired
-- User role is currently a free-text field; this schema defines the
-- future RBAC structure to avoid ad-hoc role checking in code.
-- Source: db/schema.ts (proposed entities)

-- NOTE: This migration is NOT applied by default. It represents the
-- future state when RBAC is integrated into the application.

-- Tables

CREATE TABLE role (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone NOT NULL
);

CREATE TABLE farmer_role (
  id uuid PRIMARY KEY,
  farmer_id uuid NOT NULL REFERENCES farmer(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES role(id),
  created_at timestamp with time zone NOT NULL,
  UNIQUE(farmer_id, role_id)
);

CREATE TABLE module (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone NOT NULL
);

CREATE TABLE role_module (
  id uuid PRIMARY KEY,
  role_id uuid NOT NULL REFERENCES role(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES module(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL,
  UNIQUE(role_id, module_id)
);

-- Indexes

CREATE INDEX idx_farmer_role_farmer_id ON farmer_role(farmer_id);
CREATE INDEX idx_farmer_role_role_id ON farmer_role(role_id);
CREATE INDEX idx_role_module_role_id ON role_module(role_id);
CREATE INDEX idx_role_module_module_id ON role_module(module_id);

-- Seed data (optional - uncomment to bootstrap roles)
/*
INSERT INTO role (id, name, description, created_at) VALUES
  (uuid_generate_v4(), 'admin', 'Full access to all features', now()),
  (uuid_generate_v4(), 'farmer', 'Standard farmer access', now()),
  (uuid_generate_v4(), 'agronomist', 'Agricultural advisory role', now());

INSERT INTO module (id, name, description, created_at) VALUES
  (uuid_generate_v4(), 'activities', 'Activity tracking and management', now()),
  (uuid_generate_v4(), 'crops', 'Crop planning and management', now()),
  (uuid_generate_v4(), 'weather', 'Weather data and alerts', now()),
  (uuid_generate_v4(), 'expenses', 'Cost and expense tracking', now()),
  (uuid_generate_v4(), 'reports', 'Analytics and reporting', now());
*/
