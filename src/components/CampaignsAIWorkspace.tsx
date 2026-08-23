import React, { useMemo, useState } from "react";

export type CampaignItem = {
  id: string; name?: string|null; status?: string|null; source?: string|null;
  leadsCount?: number|null; qualifiedCount?: number|null; lastRunAt?: string|null;
};
type Props = {
  campaigns: CampaignItem[];
  onOpen?: (campaign: CampaignItem)=>void;
  onRun?: (campaign: CampaignItem)=>void;
  onCreate?: ()=>void;
};

export function CampaignsAIWorkspace({campaigns,onOpen,onRun,onCreate}:Props){
  const [q,setQ]=useState(""); const [filter,setFilter]=useState("all");
  const list=useMemo(()=>campaigns.filter(c=>{
    const ok=filter==="all" || (c.status||"").toLowerCase()===filter;
    return ok && (!q || `${c.name||""} ${c.source||""}`.toLowerCase().includes(q.toLowerCase()));
  }),[campaigns,q,filter]);
  return <section className="ai-campaigns">
    <header className="ai-page-head"><div><span className="ai-kicker">AI acquisition engine</span><h1>Campaigns</h1><p>Build targeted lead pipelines and let the research engine do the heavy lifting.</p></div><button className="ai-primary" onClick={onCreate}>＋ New campaign</button></header>
    <div className="ai-campaign-toolbar"><label className="ai-search"><span>⌕</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search campaigns..." aria-label="Search campaigns"/></label><select value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filter campaigns"><option value="all">All status</option><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option></select></div>
    <div className="ai-campaign-grid">{list.map(c=><article className="ai-campaign-card" key={c.id}>
      <div className="ai-card-top"><span className={`ai-status ${(c.status||"").toLowerCase()}`}>{c.status||"Draft"}</span><button className="ai-icon-btn" onClick={()=>onOpen?.(c)} aria-label="Open campaign">•••</button></div>
      <h2>{c.name||"Untitled campaign"}</h2><p className="ai-muted">{c.source||"Multiple sources"}</p>
      <div className="ai-metrics"><div><strong>{c.leadsCount??0}</strong><small>Leads</small></div><div><strong>{c.qualifiedCount??0}</strong><small>Qualified</small></div></div>
      <div className="ai-card-foot"><span>{c.lastRunAt ? `Last run ${new Date(c.lastRunAt).toLocaleDateString()}` : "Not run yet"}</span><button className="ai-run" onClick={()=>onRun?.(c)}>Run research →</button></div>
    </article>)}</div>
    {!list.length && <div className="ai-empty"><div className="ai-empty-orb">✦</div><h2>No campaigns match</h2><p>Try another filter or create your first AI campaign.</p><button className="ai-secondary" onClick={onCreate}>Create campaign</button></div>}
  </section>
}
