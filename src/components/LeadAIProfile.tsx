import React from "react";

export type LeadProfile = {
  id:string; name?:string|null; company?:string|null; title?:string|null;
  email?:string|null; phone?:string|null; website?:string|null; score?:number|null;
  intent?:string|null; status?:string|null; source?:string|null; summary?:string|null;
};
type Props={lead:LeadProfile; onBack?:()=>void; onResearch?:()=>void; onEdit?:()=>void;};

export function LeadAIProfile({lead,onBack,onResearch,onEdit}:Props){
  const score=lead.score??0;
  return <section className="ai-profile">
    <div className="ai-profile-nav"><button className="ai-back" onClick={onBack}>← Leads</button><div><button className="ai-secondary" onClick={onEdit}>Edit</button><button className="ai-primary" onClick={onResearch}>✦ AI Research</button></div></div>
    <div className="ai-profile-hero">
      <div className="ai-avatar-xl">{(lead.name||"?").slice(0,1).toUpperCase()}</div>
      <div className="ai-profile-title"><span className="ai-kicker">Lead intelligence</span><h1>{lead.name||"Unnamed lead"}</h1><p>{lead.title||"Decision maker"}{lead.company?` · ${lead.company}`:""}</p><div className="ai-tags"><span>{lead.intent||"Unknown intent"}</span><span>{lead.status||"New"}</span><span>{lead.source||"Unknown source"}</span></div></div>
      <div className="ai-score-ring"><strong>{score}</strong><small>AI score</small></div>
    </div>
    <div className="ai-profile-grid">
      <article className="ai-panel"><h2>AI summary</h2><p>{lead.summary||"No AI summary yet. Run research to generate a concise buying-signal summary, company context and recommended next action."}</p><button className="ai-secondary" onClick={onResearch}>Generate intelligence</button></article>
      <article className="ai-panel"><h2>Contact</h2><dl><dt>Email</dt><dd>{lead.email||"—"}</dd><dt>Phone</dt><dd>{lead.phone||"—"}</dd><dt>Website</dt><dd>{lead.website||"—"}</dd></dl></article>
      <article className="ai-panel"><h2>Recommended next step</h2><div className="ai-next"><span>✦</span><div><strong>{score>=80?"Prioritize outreach":"Continue qualification"}</strong><p>{score>=80?"High-value signal detected. Review the AI summary and contact the lead.":"Run AI research to improve confidence before outreach."}</p></div></div></article>
    </div>
  </section>
}
