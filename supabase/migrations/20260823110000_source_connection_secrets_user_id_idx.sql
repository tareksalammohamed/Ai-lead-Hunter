-- Cover the foreign key used to scope source connection secrets by owner.
create index if not exists source_connection_secrets_user_id_idx
  on public.source_connection_secrets (user_id);
