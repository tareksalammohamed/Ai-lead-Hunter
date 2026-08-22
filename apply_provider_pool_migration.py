import json
from pathlib import Path
sql = Path('/home/ubuntu/github-sync/supabase/migrations/20260821152000_add_provider_pool.sql').read_text()
Path('/home/ubuntu/github-sync/provider_pool_migration_input.json').write_text(json.dumps({'project_id':'hbpjkomkbtpiciioqggn','name':'add_provider_pool','query':sql}, ensure_ascii=False))
