# Security

- Provider API keys use a dedicated `AI_PROVIDER_ENCRYPTION_KEY`; never reuse `SUPABASE_SERVICE_ROLE_KEY`.
- Trusted browser origins are configured with `ALLOWED_ORIGINS`.
- Never put service-role, provider, or encryption secrets in `VITE_*`, Git, or the Android bundle.
- Existing legacy provider ciphertext can be read during migration; saving the key writes versioned `v2.` AES-GCM ciphertext using the dedicated key.
- `audit_logs` is append-only for normal authenticated users.
- `lead_duplicates` enforces ownership of both linked leads.
- CI runs typecheck, lint, build, and Gitleaks.
