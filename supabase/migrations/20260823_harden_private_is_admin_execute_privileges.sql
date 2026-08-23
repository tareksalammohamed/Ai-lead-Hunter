-- Security hardening: private.is_admin must not be executable by PUBLIC.
revoke execute on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;
