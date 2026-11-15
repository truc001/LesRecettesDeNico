-- Schéma Neon (Postgres) du carnet. Idempotent : « npm run db:migrate » le rejoue sans risque.
-- Les mêmes bornes sont vérifiées par lib/recipe-input.ts avant chaque écriture ;
-- les contraintes ci-dessous les garantissent aussi pour une écriture directe en SQL.

-- Texte sans balises, caractères de contrôle invisibles ni protocole exécutable.
create or replace function safe_text(value text) returns boolean
  language sql immutable
  return value !~ '[<>`\u0001-\u0009\u000B-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿]'
    and value !~* '(javascript|vbscript|data)\s*:';

create table if not exists recipes (
  id text primary key check (id ~ '^[a-zA-Z0-9_-]{1,128}$'),
  title text not null check (char_length(title) between 1 and 200 and safe_text(title)),
  category text not null check (char_length(category) between 1 and 80 and safe_text(category)),
  description text not null check (char_length(description) between 1 and 1000 and safe_text(description)),
  duration text not null check (char_length(duration) between 1 and 80 and safe_text(duration)),
  servings text not null check (char_length(servings) between 1 and 80 and safe_text(servings)),
  emoji text not null check (char_length(emoji) between 1 and 16 and safe_text(emoji)),
  ingredients text not null default '' check (char_length(ingredients) <= 4000 and safe_text(ingredients)),
  steps text not null default '' check (char_length(steps) <= 4000 and safe_text(steps)),
  contributor text check (char_length(contributor) <= 60 and safe_text(contributor)),
  tag text check (char_length(tag) <= 40 and safe_text(tag)),
  source_id text check (char_length(source_id) between 1 and 128 and safe_text(source_id)),
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

-- Propositions en attente. Une proposition validée devient une recette, une refusée
-- est supprimée : dans les deux cas elle quitte cette table.
create table if not exists recipe_submissions (
  id text primary key check (id ~ '^[a-zA-Z0-9_-]{1,128}$'),
  title text not null check (char_length(title) between 3 and 200 and safe_text(title)),
  category text not null check (char_length(category) between 1 and 80 and safe_text(category)),
  description text not null check (char_length(description) between 1 and 1000 and safe_text(description)),
  duration text not null check (char_length(duration) between 1 and 80 and safe_text(duration)),
  servings text not null check (char_length(servings) between 1 and 80 and safe_text(servings)),
  emoji text not null check (char_length(emoji) between 1 and 16 and safe_text(emoji)),
  ingredients text not null check (char_length(ingredients) between 3 and 4000 and safe_text(ingredients)),
  steps text not null check (char_length(steps) between 3 and 4000 and safe_text(steps)),
  contributor text not null default '' check (char_length(contributor) <= 60 and safe_text(contributor)),
  submitter_uid text not null check (char_length(submitter_uid) between 1 and 128),
  created_at timestamptz not null default now()
);

-- Compteur des propositions de chaque compte Google : 5 par fenêtre de 24 heures.
create table if not exists submission_limits (
  submitter_uid text primary key check (char_length(submitter_uid) between 1 and 128),
  window_start timestamptz not null,
  count integer not null check (count between 1 and 5),
  last_at timestamptz not null
);
