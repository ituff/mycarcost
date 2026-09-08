-- Migration 0007: note field on periodic expenses
ALTER TABLE periodic_expenses ADD COLUMN note TEXT;
