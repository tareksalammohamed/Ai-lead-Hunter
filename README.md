# AI Lead Hunter

This project now uses Supabase for authenticated persistence. The database migrations and Edge Function are under `supabase/`.

Run `npm install`, verify `.env`, then run `npm run dev`. The first account created after the migration is bootstrapped as `SUPER_ADMIN`; later accounts are regular `USER` accounts.
