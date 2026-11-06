-- Custom SQL migration file, put your code below! --
-- pgvector adds the vector type and distance operators. It must exist before
-- any table uses a vector column, so it is the very first migration.
CREATE EXTENSION IF NOT EXISTS vector;
