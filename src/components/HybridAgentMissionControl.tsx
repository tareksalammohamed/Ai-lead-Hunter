import React, { useMemo, useState } from "react";

export type ResearchJob = {
  id:string; title?:string|null; status?:string|null; progress?:number|null;
  sources?:number|null; leadsFound?:number|null; hotLeads?:number|null;
  duration?:string|null; currentStep?:string|null; campaign?:string|null;
};

type Props={
  jobs:ResearchJob[];
  onRun?:()=>void; onPause?:(job:ResearchJob)=>void; onResume?:(job:ResearchJob)=>void;
  onRetry?:(job:ResearchJob)=>void; onStop?:(job:ResearchJob)=>void;
  onOpenJob?:(job:ResearchJob)=>void;
};

const steps=["Planning","Searching","Enriching","Scoring","Verifying"];
const norm=(v?:string|null)=>(v||"").toLowerCase();

export function HybridAgentMissionControl({jobs,onRun,onPause,onResume,onRetry,onStop,onOpenJob}:Props){
  const [activeId,setActiveId]=useState(jobs[0]?.id||"");
  const [message,setMessage]=useState("");
  const active=useMemo(()=>jobs.find(j=>j.id===activeId)||jobs[0], [jobs,activeId]);
  const progress=Math.max(0,Math.min(100,active?.progress??0));
  const current=(active?.currentStep||"Planning").toLowerCase();
  const currentIndex=Math.max(0,steps.findIndex(s=>s.toLowerCase()===current));

  const send=()=>{ if(!message.trim())return; setMessage(""); };

  return <section className="hm-agent">
    <header className="hm-head">
      <div><span className="hm-kicker">AI research control center</span><h1>Agent Mission Control</h1><p>Monitor execution, inspect decisions and intervene without losing the research checkpoint.</p></div>
      <button className="hm-primary" onClick={onRun}>✦ New mission</button>
    </header>

    <div className="hm-layout">
      <aside className="hm-jobs">
        <div className="hm-section-title"><strong>Missions</strong><span>{jobs.length}</span></div>
        {jobs.map(job=><button key={job.id} className={`hm-job ${active?.id===job.id?"active":""}`} onClick={()=>setActiveId(job.id)}>
          <span className={`hm-dot ${norm(job.status)}`}></span>
          <span><strong>{job.title||"Research mission"}</strong><small>{job.campaign||"No campaign"} · {job.status||"Queued"}</small></span>
          <b>{job.progress??0}%</b>
        </button>)}
        {!jobs.length&&<div className="hm-mini-empty">No active missions.<button onClick={onRun}>Start one</button></div>}
      </aside>

      <main className="hm-main">
        {active ? <>
          <div className="hm-mission-head"><div><span className={`hm-state ${norm(active.status)}`}>● {active.status||"Running"}</span><h2>{active.title||"Research mission"}</h2><p>{active.campaign||"AI Lead Research"}</p></div><div className="hm-controls">
            {norm(active.status)==="running"&&<button onClick={()=>onPause?.(active)}>Pause</button>}
            {norm(active.status)==="paused"&&<button onClick={()=>onResume?.(active)}>Resume</button>}
            {norm(active.status)==="failed"&&<button onClick={()=>onRetry?.(active)}>Retry</button>}
            <button className="danger" onClick={()=>onStop?.(active)}>Stop</button>
          </div></div>

          <div className="hm-progress"><div><strong>{progress}%</strong><span>{active.currentStep||"Planning"} in progress</span></div><div className="hm-bar"><i style={{width:`${progress}%`}}/></div></div>

          <div className="hm-steps">{steps.map((step,i)=><div className={`hm-step ${i<currentIndex?"done":i===currentIndex?"current":""}`} key={step}><span>{i<currentIndex?"✓":i+1}</span><small>{step}</small></div>)}</div>

          <div className="hm-chat">
            <div className="hm-chat-head"><strong>Agent conversation</strong><span>Live context</span></div>
            <div className="hm-message agent"><span className="hm-orb">✦</span><div><strong>Agent</strong><p>I'm working through the research plan. You can ask me to narrow the ICP, prioritize a source, explain a lead score, or retry a failed step.</p></div></div>
            <div className="hm-tool"><span>⚡</span><div><strong>{active.currentStep||"Research"} tool</strong><p>Checkpoint preserved · {active.sources??0} sources scanned · {active.leadsFound??0} leads discovered</p></div></div>
            <div className="hm-composer"><input value={message} onChange={e=>setMessage(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Tell the agent what to do next..." aria-label="Message AI agent"/><button onClick={send}>Send</button></div>
          </div>
        </> : <div className="hm-empty"><span>✦</span><h2>Ready for a mission</h2><p>Start an AI research mission to discover and qualify leads.</p><button className="hm-primary" onClick={onRun}>Start mission</button></div>}
      </main>

      {active&&<aside className="hm-insights">
        <div className="hm-section-title"><strong>Live insights</strong><span>AI</span></div>
        <div className="hm-stat"><strong>{active.sources??0}</strong><small>Sources scanned</small></div>
        <div className="hm-stat"><strong>{active.leadsFound??0}</strong><small>Leads discovered</small></div>
        <div className="hm-stat accent"><strong>{active.hotLeads??0}</strong><small>High-intent leads</small></div>
        <div className="hm-stat"><strong>{active.duration||"—"}</strong><small>Duration</small></div>
        <button className="hm-secondary" onClick={()=>onOpenJob?.(active)}>Open full research job →</button>
      </aside>}
    </div>
  </section>
}
