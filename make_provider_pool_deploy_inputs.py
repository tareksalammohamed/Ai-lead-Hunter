import json
from pathlib import Path
base = Path('/home/ubuntu/github-sync/supabase/functions')
for name, files in {'admin-provider-secrets':['index.ts'], 'ai-orchestrator':['index.ts','adapters.ts']}.items():
    payload = {'project_id':'hbpjkomkbtpiciioqggn','name':name,'entrypoint_path':'index.ts','verify_jwt':True,'files':[{'name':f,'content':(base/name/f).read_text()} for f in files]}
    Path(f'/home/ubuntu/github-sync/deploy_{name}.json').write_text(json.dumps(payload, ensure_ascii=False))
