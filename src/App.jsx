import { useState, useEffect, useCallback, useRef } from "react";
import { lookupJournalByISSN } from "./journalLookup.js";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
// Journal lookup data is loaded from ./journalLookup.js
// Combined data: 54,011 ISSNs from
//   - Scopus Sources Mar 2026 (31,570 active sources / 53,059 ISSNs)
//   - ScimagoJR 2025 (32,193 journals / 51,834 with Q-rank)
// Function: lookupJournalByISSN(issnArray) returns { q, scopus } or null

// Database options: Scopus only (WoS not available — user did not provide source list)
const DATABASES = [
  { id:"scopus", label:"Scopus", index:"Scopus", color:"#fb923c" },
];

const Q_OPTS = ["Q1","Q2","Q3","Q4"];

// OpenAlex Work Types (official values from OpenAlex API)
// Source: https://api.openalex.org/works?group_by=type
const WORK_TYPES = [
  { id:"article",                 label:"Article" },
  { id:"book",                    label:"Book" },
  { id:"book-chapter",            label:"Book Chapter" },
  { id:"dataset",                 label:"Dataset" },
  { id:"dissertation",            label:"Dissertation" },
  { id:"editorial",               label:"Editorial" },
  { id:"erratum",                 label:"Erratum" },
  { id:"letter",                  label:"Letter" },
  { id:"monograph",               label:"Monograph" },
  { id:"paratext",                label:"Paratext" },
  { id:"peer-review",             label:"Peer Review" },
  { id:"preprint",                label:"Preprint" },
  { id:"reference-entry",         label:"Reference Entry" },
  { id:"report",                  label:"Report" },
  { id:"review",                  label:"Review" },
  { id:"standard",                label:"Standard" },
  { id:"supplementary-materials", label:"Supplementary Materials" },
];

const AI_PROVIDERS = [
  { id:"anthropic", label:"Anthropic Claude", models:["claude-sonnet-4-20250514","claude-haiku-4-20250514","claude-opus-4-5"] },
  { id:"gemini",    label:"Google Gemini",    models:["gemini-2.5-flash","gemini-2.5-flash-lite","gemini-2.5-pro","gemini-2.0-flash"] },
  { id:"openai",    label:"OpenAI GPT",       models:["gpt-4o","gpt-4o-mini","gpt-4-turbo"] },
  { id:"groq",      label:"Groq (LLaMA)",     models:["llama-3.3-70b-versatile","llama-3.1-8b-instant","mixtral-8x7b-32768"] },
];

const TABS = [
  { id:"search",   icon:"🔍", label:"1. Tema & Pencarian" },
  { id:"screen",   icon:"📋", label:"2. Skrining Artikel" },
  { id:"upload",   icon:"📤", label:"3. Upload Dokumen" },
  { id:"prisma",   icon:"🔷", label:"4. PRISMA Flow" },
  { id:"extract",  icon:"🔬", label:"5. Ekstraksi Data" },
  { id:"biblio",   icon:"📊", label:"6. Bibliometrik" },
  { id:"framework",icon:"🗺️", label:"7. Framework/Model" },
  { id:"narasi",   icon:"📝", label:"8. Naskah SLR" },
  { id:"settings", icon:"⚙️", label:"Pengaturan" },
];

const JOURNAL_TPLS = [
  {id:"apa7",label:"APA 7th Edition"},{id:"ieee",label:"IEEE Style"},
  {id:"vancouver",label:"Vancouver"},{id:"acs",label:"ACS (Chemistry)"},
  {id:"harvard",label:"Harvard"},{id:"chicago",label:"Chicago 17th"},
  {id:"elsevier",label:"Elsevier Journals"},{id:"springer",label:"Springer Nature"},
  {id:"acm",label:"ACM Digital Library"},{id:"mla9",label:"MLA 9th"},
];

// ─────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&family=Lora:ital,wght@0,400;0,600;1,400&display=swap');
:root{
  --bg:#0a0c10;--bg2:#10141c;--bg3:#171d28;--surface:#1c2333;
  --border:#2a3347;--accent:#4f9cf9;--accent2:#a78bfa;
  --green:#34d399;--red:#f87171;--amber:#fbbf24;--cyan:#22d3ee;
  --text:#e2e8f0;--muted:#64748b;
  --fh:'Syne',sans-serif;--fb:'DM Mono',monospace;--fs:'Lora',serif;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:var(--fb);font-size:13px;line-height:1.6}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:var(--bg2)}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
.shell{display:flex;height:100vh;overflow:hidden}
/* SIDEBAR */
.sidebar{width:210px;min-width:210px;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow-y:auto}
.sb-logo{padding:16px 18px;border-bottom:1px solid var(--border)}
.sb-logo .wm{font-family:var(--fh);font-size:15px;font-weight:800;color:var(--accent);letter-spacing:-.5px}
.sb-logo .sub{font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-top:2px}
.nav-lbl{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted);padding:12px 18px 5px}
.nav-item{display:flex;align-items:center;gap:9px;padding:8px 18px;cursor:pointer;font-size:11.5px;color:var(--muted);border-left:2px solid transparent;transition:all .14s}
.nav-item:hover{color:var(--text);background:var(--bg3)}
.nav-item.active{color:var(--accent);border-left-color:var(--accent);background:rgba(79,156,249,.06)}
.nav-item .ic{font-size:13px;width:18px;text-align:center}
.nav-item .nb{margin-left:auto;background:var(--accent);color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:8px}
.nav-item .nb.green{background:var(--green)}
.nav-item .nb.amber{background:var(--amber);color:#000}
/* MAIN */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden}
.topbar{height:50px;background:var(--bg2);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 20px;gap:10px;flex-shrink:0}
.topbar-title{font-family:var(--fh);font-size:14px;font-weight:700;flex:1}
.topbar-title span{color:var(--accent)}
.content{flex:1;overflow-y:auto;padding:20px}
/* CARDS */
.card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:18px;margin-bottom:14px}
.card-title{font-family:var(--fh);font-size:12px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:7px}
/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:6px;padding:6px 13px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-family:var(--fb);font-size:11px;cursor:pointer;transition:all .14s;font-weight:500}
.btn:hover{border-color:var(--accent);color:var(--accent)}
.btn:disabled{opacity:.45;cursor:not-allowed}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.primary:hover{background:#3b82f6}
.btn.success{background:rgba(52,211,153,.12);border-color:var(--green);color:var(--green)}
.btn.danger{background:rgba(248,113,113,.1);border-color:var(--red);color:var(--red)}
.btn.ghost{background:transparent;border-color:transparent}
.btn.amber{background:rgba(251,191,36,.1);border-color:var(--amber);color:var(--amber)}
.btn.sm{padding:4px 9px;font-size:10px}
.btn.xs{padding:2px 7px;font-size:9px}
/* FORM */
.fg{display:flex;flex-direction:column;gap:4px}
.fg label{font-size:10px;color:var(--muted);font-weight:600;letter-spacing:.3px}
input[type=text],input[type=number],input[type=url],input[type=password],select,textarea{background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:var(--fb);font-size:12px;padding:7px 9px;outline:none;transition:border-color .14s;width:100%}
input:focus,select:focus,textarea:focus{border-color:var(--accent)}
textarea{resize:vertical;min-height:68px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.full{grid-column:1/-1}
/* CHIP */
.chip-group{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.chip{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border:1px solid var(--border);border-radius:16px;font-size:11px;cursor:pointer;color:var(--muted);transition:all .13s;user-select:none}
.chip.on{border-color:var(--accent);color:var(--accent);background:rgba(79,156,249,.08)}
.chip.green.on{border-color:var(--green);color:var(--green);background:rgba(52,211,153,.08)}
/* BADGE */
.badge{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:9px;font-size:10px;font-weight:600}
.badge.acc{background:rgba(52,211,153,.12);color:var(--green)}
.badge.rej{background:rgba(248,113,113,.1);color:var(--red)}
.badge.pend{background:rgba(251,191,36,.1);color:var(--amber)}
.badge.q1{background:rgba(79,156,249,.1);color:var(--accent)}
.badge.q2{background:rgba(167,139,250,.1);color:var(--accent2)}
.badge.q3{background:rgba(251,191,36,.1);color:var(--amber)}
.badge.q4{background:rgba(248,113,113,.1);color:var(--red)}
/* TABLE */
.tw{overflow-x:auto;border-radius:7px;border:1px solid var(--border)}
table{width:100%;border-collapse:collapse;font-size:11.5px}
thead th{background:var(--bg3);padding:9px 11px;text-align:left;font-size:9.5px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--border);white-space:nowrap}
tbody td{padding:9px 11px;border-bottom:1px solid rgba(42,51,71,.5);vertical-align:top}
tbody tr:hover{background:rgba(28,35,51,.5)}
tbody tr:last-child td{border-bottom:none}
/* AI STATUS */
.ai-bar{display:flex;align-items:center;gap:8px;padding:9px 13px;background:rgba(79,156,249,.06);border:1px solid rgba(79,156,249,.2);border-radius:7px;font-size:11px;color:var(--accent);margin-bottom:12px}
.dp span{display:inline-block;width:5px;height:5px;background:var(--accent);border-radius:50%;margin:0 1px;animation:dp 1.2s infinite ease-in-out}
.dp span:nth-child(2){animation-delay:.2s}.dp span:nth-child(3){animation-delay:.4s}
@keyframes dp{0%,80%,100%{transform:scale(.6);opacity:.4}40%{transform:scale(1);opacity:1}}
/* PROGRESS */
.prog{height:4px;background:var(--bg3);border-radius:2px;overflow:hidden;margin:6px 0}
.prog-fill{height:100%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:2px;transition:width .4s ease}
/* STAT CARD */
.stat-card{background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:13px}
.stat-card .val{font-family:var(--fh);font-size:24px;font-weight:800;line-height:1}
.stat-card .lbl{font-size:9px;color:var(--muted);margin-top:3px;letter-spacing:.5px;text-transform:uppercase}
/* KEYWORD TAG */
.kw-tag{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;font-size:11px;margin:2px}
.kw-tag button{background:none;border:none;color:var(--muted);cursor:pointer;font-size:10px;padding:0;line-height:1}
.kw-tag button:hover{color:var(--red)}
/* PRISMA */
.prisma-wrap{display:flex;flex-direction:column;align-items:center;gap:0;padding:10px 0}
.p-stage{display:flex;gap:16px;align-items:center;width:100%;max-width:700px}
.p-box{background:var(--bg3);border:1.5px solid var(--border);border-radius:8px;padding:10px 14px;flex:1;text-align:center}
.p-box.main{border-color:var(--accent);background:rgba(79,156,249,.05)}
.p-box.excl{border-color:var(--red);background:rgba(248,113,113,.04);max-width:180px;flex:0 0 180px;font-size:10px}
.p-box .plbl{font-size:9px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px}
.p-box .pnum{font-family:var(--fh);font-size:26px;font-weight:800}
.p-box .prsn{font-size:9px;color:var(--muted);margin-top:3px}
.p-arrow{width:2px;height:22px;background:var(--border);margin:0 auto;position:relative}
.p-arrow::after{content:'▼';position:absolute;bottom:-9px;left:50%;transform:translateX(-50%);font-size:8px;color:var(--muted)}
.p-stage-lbl{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:6px 0}
/* UPLOAD ZONE */
.drop-zone{border:2px dashed var(--border);border-radius:9px;padding:24px;text-align:center;cursor:pointer;transition:all .18s}
.drop-zone:hover,.drop-zone.drag{border-color:var(--accent);background:rgba(79,156,249,.03)}
/* CHART BAR */
.cbar-row{display:flex;align-items:center;gap:8px;margin-bottom:5px}
.cbar-lbl{font-size:10px;color:var(--muted);width:100px;text-align:right;flex-shrink:0}
.cbar-track{flex:1;height:18px;background:var(--bg3);border-radius:3px;overflow:hidden}
.cbar-fill{height:100%;border-radius:3px;display:flex;align-items:center;padding-left:6px;font-size:9px;color:#fff;font-weight:700;transition:width .7s cubic-bezier(.4,0,.2,1)}
/* NARASI */
.nar-wrap{background:var(--bg2);border:1px solid var(--border);border-radius:9px;padding:22px 26px;font-family:var(--fs);font-size:13px;line-height:1.95}
.nar-wrap h1{font-family:var(--fh);font-size:17px;font-weight:800;text-align:center;margin-bottom:5px}
.nar-wrap h2{font-family:var(--fh);font-size:13px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.5px;margin:16px 0 6px;padding-bottom:3px;border-bottom:1px solid var(--border)}
/* FRAMEWORK SVG CANVAS */
.fw-canvas{background:var(--bg3);border:1px solid var(--border);border-radius:8px;min-height:380px;padding:16px;overflow:auto}
/* INTEGRITY */
.int-scores{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px}
.sc-card{background:var(--bg2);border:1px solid var(--border);border-radius:7px;padding:11px 13px;text-align:center}
.sc-card .sv{font-family:var(--fh);font-size:26px;font-weight:800;line-height:1}
.sc-card .sl{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:4px}
.sc-card .ss{font-size:9px;font-weight:700;margin-top:3px}
.mtr{height:5px;background:var(--bg3);border-radius:2px;overflow:hidden;margin-top:4px}
.mtr-f{height:100%;border-radius:2px;transition:width .7s}
/* HIGHLIGHT */
.hl-ai{background:rgba(248,113,113,.18);border-bottom:2px solid var(--red);border-radius:2px;cursor:pointer}
.hl-ai:hover{background:rgba(248,113,113,.3)}
.hl-plag{background:rgba(251,191,36,.18);border-bottom:2px solid var(--amber);border-radius:2px;cursor:pointer}
.hl-ok{background:rgba(52,211,153,.1);border-radius:2px}
.inline-act{display:inline-flex;gap:3px;background:var(--bg2);border:1px solid var(--border);border-radius:5px;padding:2px 5px;font-size:10px;margin-left:3px;vertical-align:middle}
.inline-act button{background:none;border:none;color:var(--accent);cursor:pointer;font-size:10px;padding:1px 3px;border-radius:2px;font-family:var(--fb)}
.inline-act button:hover{background:var(--bg3)}
/* TAG */
.tag{display:inline-block;padding:2px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:3px;font-size:10px;color:var(--muted);margin:1px}
/* STEP */
.step-hdr{display:flex;align-items:center;gap:10px;cursor:pointer;padding:11px 0;border-bottom:1px solid var(--border)}
.step-num{width:26px;height:26px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0}
.step-ttl{font-family:var(--fh);font-size:12px;font-weight:700;flex:1}
/* SETTINGS */
.setting-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(42,51,71,.4)}
.setting-row:last-child{border-bottom:none}
.setting-lbl{font-size:12px;font-weight:600;flex:1}
.setting-sub{font-size:10px;color:var(--muted);margin-top:2px}
/* TOOLTIP */
.tip{position:relative;display:inline-block}
.tip .tiptext{visibility:hidden;background:var(--surface);color:var(--text);text-align:center;padding:4px 8px;border-radius:4px;position:absolute;z-index:10;bottom:125%;left:50%;transform:translateX(-50%);font-size:10px;white-space:nowrap;border:1px solid var(--border)}
.tip:hover .tiptext{visibility:visible}
/* AI REC BOX */
.rec-box{background:rgba(79,156,249,.04);border:1px solid rgba(79,156,249,.18);border-radius:8px;padding:13px 15px;margin-bottom:12px}
.rec-box .rb-title{font-size:11px;font-weight:700;color:var(--accent);margin-bottom:8px;display:flex;align-items:center;gap:6px}
/* FLOW FRAMEWORK */
.fw-node{background:var(--bg2);border:1.5px solid var(--accent);border-radius:8px;padding:10px 14px;display:inline-block;text-align:center;font-size:11px;font-weight:600;min-width:120px;position:relative}
.fw-node.input{border-color:var(--green)}
.fw-node.output{border-color:var(--amber)}
.fw-node.mediator{border-color:var(--accent2)}
.fw-arrow{color:var(--muted);font-size:18px;line-height:1}
.fw-row{display:flex;align-items:center;justify-content:center;gap:12px;margin:8px 0;flex-wrap:wrap}
/* STRENGTHEN */
.str-panel{background:rgba(79,156,249,.04);border:1px solid rgba(79,156,249,.2);border-radius:7px;padding:12px;margin-top:10px}
.str-chip{display:inline-flex;align-items:center;gap:3px;padding:3px 9px;background:var(--bg3);border:1px solid var(--border);border-radius:14px;font-size:10px;cursor:pointer;margin:2px;transition:all .13s}
.str-chip:hover{border-color:var(--accent);color:var(--accent)}
/* SEARCH RESULT COUNTER */
.result-counter{background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.2);border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:16px;margin-bottom:14px;flex-wrap:wrap}
.rc-num{font-family:var(--fh);font-size:28px;font-weight:800;color:var(--green);line-height:1}
.rc-lbl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
`;

// ─────────────────────────────────────────────────────────────
// AI API HELPER
// ─────────────────────────────────────────────────────────────
async function callAI(prompt, settings, systemPrompt = "", maxTokens = 1500, jsonMode = false) {
  const { provider = "anthropic", anthropicKey, geminiKey, openaiKey, groqKey, model } = settings;

  if (provider === "anthropic" && anthropicKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system: systemPrompt || "You are an expert systematic literature review assistant. Be concise and structured.",
        messages: [{ role: "user", content: prompt }]
      })
    });
    const d = await res.json();
    return d.content?.map(b => b.text || "").join("") || "";
  }

  if (provider === "gemini" && geminiKey) {
    const mdl = model || "gemini-2.5-flash";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: (systemPrompt ? systemPrompt + "\n\n" : "") + prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2, ...(jsonMode ? { responseMimeType: "application/json" } : {}) }
        })
      }
    );
    const d = await res.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  if (provider === "openai" && openaiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: model || "gpt-4o-mini",
        max_tokens: maxTokens,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          { role: "user", content: prompt }
        ]
      })
    });
    const d = await res.json();
    return d.choices?.[0]?.message?.content || "";
  }

  if (provider === "groq" && groqKey) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: model || "llama-3.3-70b-versatile",
        max_tokens: maxTokens,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          { role: "user", content: prompt }
        ]
      })
    });
    const d = await res.json();
    return d.choices?.[0]?.message?.content || "";
  }

  // Fallback: use Anthropic API without key (demo)
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const d = await res.json();
  return d.content?.map(b => b.text || "").join("") || "[API key belum dikonfigurasi di Pengaturan]";
}

// ─────────────────────────────────────────────────────────────
// API KEY CHECK HELPERS
// ─────────────────────────────────────────────────────────────
function hasApiKey(settings) {
  const { provider, anthropicKey, geminiKey, openaiKey, groqKey } = settings;
  if (provider === "anthropic") return !!anthropicKey?.trim();
  if (provider === "gemini")    return !!geminiKey?.trim();
  if (provider === "openai")    return !!openaiKey?.trim();
  if (provider === "groq")      return !!groqKey?.trim();
  return false;
}

// ─────────────────────────────────────────────────────────────
// API KEY NOTIF BANNER (shown at top when no key set)
// ─────────────────────────────────────────────────────────────
function ApiKeyBanner({ settings, onGoSettings }) {
  if (hasApiKey(settings)) return null;
  return (
    <div style={{
      background:"rgba(251,191,36,.08)",border:"1.5px solid var(--amber)",borderRadius:9,
      padding:"13px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:14
    }}>
      <div style={{fontSize:22,flexShrink:0}}>⚠️</div>
      <div style={{flex:1}}>
        <div style={{fontFamily:"var(--fh)",fontSize:12,fontWeight:700,color:"var(--amber)",marginBottom:2}}>
          API Key Belum Dikonfigurasi
        </div>
        <div style={{fontSize:11,color:"var(--muted)",lineHeight:1.6}}>
          Masukkan API key terlebih dahulu agar semua fitur AI dapat berjalan.
          Tanpa API key, tidak ada model AI yang aktif.
        </div>
      </div>
      <button className="btn amber" onClick={onGoSettings} style={{flexShrink:0}}>
        ⚙️ Masuk Pengaturan
      </button>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────
// OPENALEX SEARCH
// Matches OpenAlex website behavior — uses the `search` parameter
// which searches across title, abstract, and fulltext (the same
// default behavior as openalex.org/works UI)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// OPENALEX SEARCH — RAW FETCH ONLY
// Mirrors openalex.org/works website behavior with search= param
// Returns ALL matching articles, no post-filtering applied here.
// Filters are applied separately via applyFilters() function.
// ─────────────────────────────────────────────────────────────
async function searchOpenAlex(keywords) {
  try {
    const q = keywords.join(" OR ");

    const perPage = 200;
    const allResults = [];
    let cursor = "*";
    const MAX_PAGES = 25; // safety cap = up to 5000 raw articles
    let metaCount = 0;

    for (let page = 0; page < MAX_PAGES; page++) {
      // Match OpenAlex web behavior — no filters applied at fetch
      // We use only search= which mirrors what the OpenAlex website does
      const url = "https://api.openalex.org/works"
        + "?search=" + encodeURIComponent(q)
        + "&per-page=" + perPage
        + "&cursor=" + encodeURIComponent(cursor)
        + "&select=id,title,authorships,publication_year,primary_location,abstract_inverted_index,doi,concepts,cited_by_count,type,open_access"
        + "&mailto=slr@research.ai";

      const res = await fetch(url);
      if (!res.ok) {
        console.error("OpenAlex fetch failed:", res.status, await res.text());
        break;
      }
      const data = await res.json();
      if (page === 0) metaCount = data.meta?.count || 0;
      const items = data.results || [];
      if (items.length === 0) break;
      allResults.push(...items);
      const nextCursor = data.meta?.next_cursor;
      if (!nextCursor) break;
      cursor = nextCursor;
      if (allResults.length >= 5000) break;
    }

    // Map to internal format with ISSN lookup attached
    const mapped = allResults.map(w => {
      const abstract = decodeAbstract(w.abstract_inverted_index);
      const primarySource = w.primary_location?.source || {};
      const journal = primarySource.display_name || "Unknown Journal";

      // OpenAlex source object: issn_l is single string, issn is array
      const issns = [];
      if (primarySource.issn_l) issns.push(primarySource.issn_l);
      if (Array.isArray(primarySource.issn)) issns.push(...primarySource.issn);

      const lookupResult = lookupJournalByISSN(issns);
      const q_rank = lookupResult?.q || "Unranked";
      const inScopus = lookupResult?.scopus || false;

      return {
        id: w.id,
        title: w.title || "Unknown Title",
        authors: (w.authorships || []).slice(0, 3).map(a => a.author?.display_name || "").filter(Boolean).join(", ") || "Unknown",
        year: w.publication_year || 0,
        journal,
        issns,
        doi: w.doi ? w.doi.replace("https://doi.org/", "") : "",
        q: q_rank,
        inScopus,
        type: w.type || "unknown",
        isOpenAccess: w.open_access?.is_oa || false,
        abstract: abstract || "Abstract not available.",
        keywords: (w.concepts || []).slice(0, 5).map(c => c.display_name),
        citations: w.cited_by_count || 0,
        url: w.doi || w.id,
        source: "OpenAlex",
        status: "pending",
        uploaded: false,
        uploadedFile: null,
      };
    });

    return { articles: mapped, totalAvailable: metaCount, fetchedRaw: allResults.length };
  } catch (e) {
    console.error("OpenAlex error:", e);
    return { articles: [], totalAvailable: 0, fetchedRaw: 0 };
  }
}

// ─────────────────────────────────────────────────────────────
// IN-MEMORY FILTER FUNCTION
// Applies user-selected filters to already-fetched articles
// ─────────────────────────────────────────────────────────────
function applyFilters(articles, filters) {
  if (!filters || !filters.enabled) return articles;
  let result = articles;

  // Year filter
  if (filters.yearFrom || filters.yearTo) {
    const yFrom = filters.yearFrom || 1900;
    const yTo = filters.yearTo || 9999;
    result = result.filter(a => a.year >= yFrom && a.year <= yTo);
  }

  // Type filter (only if user selected at least one type)
  if (filters.types && filters.types.length > 0) {
    result = result.filter(a => filters.types.includes(a.type));
  }

  // Open Access filter
  if (filters.openAccessOnly) {
    result = result.filter(a => a.isOpenAccess);
  }

  // Database filter (Scopus)
  if (filters.databases && filters.databases.includes("scopus")) {
    result = result.filter(a => a.inScopus);
  }

  // Q-Index filter
  if (filters.qIndex && filters.qIndex.length > 0) {
    result = result.filter(a => filters.qIndex.includes(a.q));
  }

  return result;
}

function decodeAbstract(inv) {
  if (!inv) return "";
  try {
    const words = {};
    Object.entries(inv).forEach(([word, positions]) => {
      positions.forEach(pos => { words[pos] = word; });
    });
    return Object.keys(words).sort((a, b) => a - b).map(k => words[k]).join(" ");
  } catch { return ""; }
}

function deduplicateArticles(articles) {
  const seen = new Set();
  return articles.filter(a => {
    const key = (a.doi || a.title || "").toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────
// SEMI-MANUAL SEARCH HELPERS (Scopus / Web of Science)
// ─────────────────────────────────────────────────────────────
const DOC_TYPE_OPTS = [
  { key: "article", scopus: "ar", wos: "Article" },
  { key: "review", scopus: "re", wos: "Review" },
  { key: "conference", scopus: "cp", wos: "Proceedings Paper" },
  { key: "bookChapter", scopus: "ch", wos: "Book Chapter" },
];
const LANG_OPTS = [
  { key: "english", scopus: "english", wos: "English" },
  { key: "indonesian", scopus: "indonesian", wos: "Indonesian" },
];
function _isPhrase(t) { return /\s/.test(t.trim()); }
function _cleanTerm(t) { return t.replace(/^"+|"+$/g, "").trim(); }
function _quoteTerm(t) { const x = _cleanTerm(t); return _isPhrase(x) ? '"' + x + '"' : x; }
function _buildGroup(line) {
  const terms = (line || "").split(",").map(s => s.trim()).filter(Boolean).map(_quoteTerm);
  if (!terms.length) return null;
  return terms.length === 1 ? terms[0] : "(" + terms.join(" OR ") + ")";
}
function conceptsToStr(concepts) {
  return (concepts || []).map(c => _buildGroup(c.value)).filter(Boolean).join(" AND ");
}
function buildScopusQuery(concepts, opts) {
  const cs = conceptsToStr(concepts); if (!cs) return "";
  let q = "TITLE-ABS-KEY ( " + cs + " )";
  if (opts.yearFrom) q += " AND PUBYEAR > " + (Number(opts.yearFrom) - 1);
  if (opts.yearTo) q += " AND PUBYEAR < " + (Number(opts.yearTo) + 1);
  const dt = DOC_TYPE_OPTS.filter(d => opts.docTypes && opts.docTypes[d.key]).map(d => "DOCTYPE(" + d.scopus + ")");
  if (dt.length) q += " AND ( " + dt.join(" OR ") + " )";
  const la = LANG_OPTS.filter(l => opts.langs && opts.langs[l.key]).map(l => "LANGUAGE(" + l.scopus + ")");
  if (la.length) q += " AND ( " + la.join(" OR ") + " )";
  if (opts.journalOnly) q += " AND SRCTYPE(j)";
  return q;
}
function buildWosQuery(concepts, opts) {
  const cs = conceptsToStr(concepts); if (!cs) return "";
  let q = "TS=( " + cs + " )";
  if (opts.yearFrom && opts.yearTo) q += " AND PY=(" + opts.yearFrom + "-" + opts.yearTo + ")";
  const dt = DOC_TYPE_OPTS.filter(d => opts.docTypes && opts.docTypes[d.key]).map(d => d.wos);
  if (dt.length) q += " AND DT=(" + dt.join(" OR ") + ")";
  const la = LANG_OPTS.filter(l => opts.langs && opts.langs[l.key]).map(l => l.wos);
  if (la.length) q += " AND LA=(" + la.join(" OR ") + ")";
  return q;
}
function shortAuthors(s) {
  if (!s) return "";
  const list = (s.indexOf(";") !== -1 ? s.split(";") : s.split(",")).map(x => x.trim()).filter(Boolean);
  return list.slice(0, 3).join(", ") + (list.length > 3 ? ", dkk." : "");
}
function parseJsonArray(txt) {
  let s = (txt || "").replace(/```json|```/g, "").trim();
  // 1) langsung
  try { const v = JSON.parse(s); if (Array.isArray(v)) return v; if (v && typeof v === "object") { for (const k in v) if (Array.isArray(v[k])) return v[k]; } } catch (e) {}
  // 2) potong dari [ pertama ke ] terakhir
  const a = s.indexOf("["), b = s.lastIndexOf("]");
  if (a !== -1 && b > a) { try { const v = JSON.parse(s.slice(a, b + 1)); if (Array.isArray(v)) return v; } catch (e) {} }
  // 3) selamatkan tiap objek {...} yang utuh (tahan terhadap pemotongan / teks tambahan)
  const out = []; let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) { if (esc) { esc = false; } else if (ch === "\\") { esc = true; } else if (ch === '"') { inStr = false; } continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") { if (depth === 0) start = i; depth++; }
    else if (ch === "}") { depth--; if (depth === 0 && start !== -1) { try { const o = JSON.parse(s.slice(start, i + 1)); if (o && (("decision" in o) || ("index" in o))) out.push(o); } catch (e) {} start = -1; } }
  }
  return out.length ? out : null;
}
// CSV / TSV / TXT parser (handles quotes, embedded newlines) + auto delimiter
function parseDelimited(text) {
  text = text.replace(/^\uFEFF/, "");
  const lines = text.slice(0, 8000).split(/\r?\n/);
  let sample = ""; for (const l of lines) { if (l.trim().length) { sample = l; break; } }
  const cc = (sample.match(/,/g) || []).length, ct = (sample.match(/\t/g) || []).length, csemi = (sample.match(/;/g) || []).length;
  let d = ","; if (ct >= cc && ct >= csemi) d = "\t"; else if (csemi > cc) d = ";";
  const rows = []; let row = [], field = "", i = 0, q = false;
  while (i < text.length) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; }
      field += ch; i++; continue;
    }
    if (ch === '"') { q = true; i++; continue; }
    if (ch === d) { row.push(field); field = ""; i++; continue; }
    if (ch === "\r") { i++; continue; }
    if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += ch; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const _normH = s => (s || "").toString().trim().toLowerCase();
const _FIELDS = {
  title: ["title", "article title", "document title", "ti"],
  abstract: ["abstract", "ab"],
  authors: ["authors", "author full names", "author/s", "au", "author"],
  year: ["year", "publication year", "pubyear", "py"],
  source: ["source title", "source", "publication name", "so", "journal", "conference title"],
  doi: ["doi", "di"],
  issn: ["issn", "sn", "print issn"],
  eissn: ["eissn", "ei", "electronic issn", "e-issn"],
  doctype: ["document type", "dt"],
  keywords: ["author keywords", "de", "index keywords", "id", "keywords plus", "keywords"],
  openaccess: ["open access", "open access designations", "access type"],
};
function detectField(h) {
  const x = _normH(h);
  for (const f in _FIELDS) if (_FIELDS[f].indexOf(x) !== -1) return f;
  if (x.indexOf("cited by") === 0 || x.indexOf("times cited") === 0 || x === "tc") return "citations";
  return null;
}
function findHeaderRow(rows) {
  let best = -1, bestScore = 0;
  const lim = Math.min(rows.length, 15);
  for (let r = 0; r < lim; r++) {
    let score = 0, hasTitle = false;
    for (const cell of rows[r]) { const f = detectField(cell); if (f) { score++; if (f === "title") hasTitle = true; } }
    if (hasTitle && score > bestScore) { bestScore = score; best = r; }
  }
  return best;
}
function rowsToInternal(rows, dbLabel) {
  const hr = findHeaderRow(rows); if (hr < 0) return [];
  const map = {}; rows[hr].forEach((h, idx) => { const f = detectField(h); if (f && map[f] === undefined) map[f] = idx; });
  const get = (row, f) => map[f] !== undefined ? (row[map[f]] || "").toString().trim() : "";
  const out = [];
  for (let r = hr + 1; r < rows.length; r++) {
    const row = rows[r]; if (!row) continue;
    let empty = true; for (const x of row) { if (x && x.toString().trim()) { empty = false; break; } }
    if (empty) continue;
    const title = get(row, "title"); if (!title) continue;
    const doi = get(row, "doi").toLowerCase().replace(/^https?:\/\/doi\.org\//, "").trim();
    const ym = get(row, "year").match(/\d{4}/);
    const year = ym ? parseInt(ym[0], 10) : 0;
    const cit = parseInt((get(row, "citations") || "").replace(/[^\d]/g, "") || "0", 10) || 0;
    const issn = get(row, "issn"), eissn = get(row, "eissn");
    const issns = [issn, eissn].filter(Boolean);
    const lk = lookupJournalByISSN(issns);
    const kwRaw = get(row, "keywords");
    const oa = get(row, "openaccess").toLowerCase();
    out.push({
      id: doi || (dbLabel + "-" + title.slice(0, 40) + "-" + r),
      title,
      abstract: get(row, "abstract"),
      authors: get(row, "authors") || "Unknown",
      year,
      journal: get(row, "source") || "Unknown Journal",
      issns,
      doi,
      q: (lk && lk.q) ? lk.q : "Unranked",
      inScopus: !!(lk && lk.scopus),
      type: (get(row, "doctype") || "article").toLowerCase(),
      isOpenAccess: !!oa && oa !== "no" && oa !== "0",
      keywords: kwRaw ? kwRaw.split(";").map(s => s.trim()).filter(Boolean) : [],
      citations: cit,
      url: doi ? ("https://doi.org/" + doi) : "",
      source: dbLabel,
      status: "pending",
      uploaded: false,
      uploadedFile: null,
      databases: [dbLabel],
    });
  }
  return out;
}

function safeName(a) {
  const au = ((a.authors || "").split(/[,;]/)[0] || "").trim().split(/\s+/).pop() || "anon";
  const t = (a.title || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return ((a.year || "nd") + "_" + au + "_" + t).replace(/[^a-zA-Z0-9._-]/g, "") + ".pdf";
}
function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parseJsonObject(txt) {
  let s = (txt || "").replace(/```json|```/g, "").trim();
  try { const v = JSON.parse(s); if (v && typeof v === "object" && !Array.isArray(v)) return v; if (Array.isArray(v) && v[0] && typeof v[0] === "object") return v[0]; } catch (e) {}
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a !== -1 && b > a) { try { const v = JSON.parse(s.slice(a, b + 1)); if (v && typeof v === "object") return v; } catch (e) {} }
  return null;
}
function normRow(row, art, colLabels) {
  const out = { id: art.id, title: art.title, authors: art.authors, year: art.year, q: art.q, journal: art.journal };
  colLabels.forEach(c => { const v = row[c]; out[c] = (v === undefined || v === null || String(v).trim() === "") ? "-" : String(v); });
  return out;
}
function failRow(art, colLabels) {
  const out = { id: art.id, title: art.title, authors: art.authors, year: art.year, q: art.q, journal: art.journal, _failed: true };
  colLabels.forEach(c => { out[c] = "Gagal mengekstrak"; });
  return out;
}

function filterByQ(articles, qList) {
  if (!qList || qList.length === 0) return articles;
  return articles.filter(a => qList.includes(a.q));
}

// ─────────────────────────────────────────────────────────────
// HEURISTIC INTEGRITY
// ─────────────────────────────────────────────────────────────
function heuristicAI(text) {
  if (!text || text.length < 80) return null;
  const sents = text.match(/[^.!?]+[.!?]+/g) || [];
  if (sents.length < 2) return null;
  const lens = sents.map(s => s.trim().split(/\s+/).length);
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const variance = lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length;
  const burst = Math.sqrt(variance) / mean;
  const aiPhrases = ["furthermore","moreover","additionally","in conclusion","it is worth noting","plays a crucial role","penting untuk","selain itu","lebih lanjut","dapat disimpulkan","penelitian ini","studi ini","hal ini menunjukkan","secara keseluruhan"];
  const lower = text.toLowerCase();
  const hits = aiPhrases.filter(p => lower.includes(p)).length;
  const phraseRatio = hits / Math.max(sents.length, 1);
  const openers = sents.map(s => s.trim().split(/\s+/).slice(0, 2).join(" ").toLowerCase());
  const openerVar = new Set(openers).size / Math.max(openers.length, 1);
  let score = 0;
  score += burst < 0.3 ? 35 : burst < 0.5 ? 18 : 5;
  score += phraseRatio > 0.4 ? 30 : phraseRatio > 0.2 ? 18 : 5;
  score += openerVar < 0.6 ? 20 : openerVar < 0.75 ? 10 : 3;
  score += mean > 28 ? 15 : mean > 20 ? 8 : 2;
  return Math.min(97, Math.max(5, Math.round(score)));
}
function heuristicSim(text) {
  if (!text || text.length < 80) return null;
  const sents = text.match(/[^.!?]+[.!?]+/g) || [];
  const pats = [/\b(studies have shown|research has demonstrated|according to|as stated by)\b/gi, /\b(terbukti bahwa|menurut|penelitian menunjukkan|hasil menunjukkan)\b/gi];
  let hits = 0;
  pats.forEach(p => { const m = text.match(p); if (m) hits += m.length; });
  return Math.min(38, Math.round((hits / Math.max(sents.length, 1)) * 18 + Math.random() * 5));
}
function segmentRisk(text) {
  if (!text) return [];
  const sents = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sents.map((s, i) => {
    const loc = heuristicAI(s + " " + s) || 0;
    return { text: s.trim(), aiRisk: loc > 55 ? "ai" : loc > 38 ? "warn" : "ok", plagRisk: (i % 7 === 2 || i % 11 === 0) ? "plag" : "ok", index: i };
  });
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("search");
  const [settings, setSettings] = useState({
    provider: "anthropic", anthropicKey: "", geminiKey: "", openaiKey: "", groqKey: "",
    model: "claude-sonnet-4-20250514", journalTemplate: "apa7",
  });
  const [aiStatus, setAiStatus] = useState(null);

  // STEP 1 — Search
  const [theme, setTheme] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [kwInput, setKwInput] = useState("");
  const [searchParams, setSearchParams] = useState({
    filtersEnabled: false,  // master toggle (controls whether to apply filters at all)
    yearFrom: 2019,
    yearTo: 2025,
    databases: [],          // empty = all
    qIndex: [],             // empty = all
    types: [],              // empty = all
    openAccessOnly: false,
  });
  // appliedFilters = filter values actually used to compute filteredArticles.
  // Only updated when user clicks "Terapkan". Pending edits in searchParams won't
  // re-filter results until applied.
  const [appliedFilters, setAppliedFilters] = useState({
    yearFrom: 2019,
    yearTo: 2025,
    databases: [],
    qIndex: [],
    types: [],
    openAccessOnly: false,
  });
  const [rawArticles, setRawArticles] = useState([]);
  const [searchDone, setSearchDone] = useState(false);
  const [searchTotalCount, setSearchTotalCount] = useState(0);
  // Filtered articles: apply appliedFilters when filtersEnabled is on (toggle is instant).
  // Toggle off = revert to raw immediately. Toggle on = use last-applied filter snapshot.
  const filteredArticles = searchParams.filtersEnabled
    ? applyFilters(rawArticles, { ...appliedFilters, enabled: true })
    : rawArticles;
  // Compare pending edits vs applied snapshot (excluding the meta toggle)
  const filtersDirty = (() => {
    const keys = ["yearFrom","yearTo","databases","qIndex","types","openAccessOnly"];
    return keys.some(k => JSON.stringify(searchParams[k]) !== JSON.stringify(appliedFilters[k]));
  })();

  // STEP 2 — Screening
  const [articles, setArticles] = useState([]);
  const [inclusionCriteria, setInclusionCriteria] = useState([]);
  const [screeningDone, setScreeningDone] = useState(false);
  // STEP 1b — Strategi pencarian semi-manual (Scopus/WoS)
  const [concepts, setConcepts] = useState([]);
  const [boolOpts, setBoolOpts] = useState({
    docTypes: { article: true, review: false, conference: false, bookChapter: false },
    langs: { english: true, indonesian: false },
    journalOnly: true, useWos: true, scope: "balanced",
  });
  const [importStats, setImportStats] = useState({ identified: 0, duplicates: 0 });
  const [importLog, setImportLog] = useState([]);

  // STEP 3 — Upload
  const [uploadedFiles, setUploadedFiles] = useState({});

  // STEP 4 — PRISMA (computed)

  // STEP 5 — Extraction
  const [extractCols, setExtractCols] = useState([]);
  const [approvedCols, setApprovedCols] = useState([]);
  const [extractData, setExtractData] = useState([]);

  // STEP 6 — Biblio (computed)

  // STEP 7 — Framework
  const [framework, setFramework] = useState(null);

  // STEP 8 — Narasi
  const [narasiSteps, setNarasiSteps] = useState({});
  const [openStep, setOpenStep] = useState(null);
  const [narasiView, setNarasiView] = useState("steps");
  const [narasiAuthors, setNarasiAuthors] = useState([
    { id:1, name:"", affil:"", email:"" }
  ]);

  const accepted = articles.filter(a => a.status === "accepted");
  const rejected = articles.filter(a => a.status === "rejected");
  const uploaded = accepted.filter(a => a.uploaded);

  function showApiAlert() {
    setTab("settings");
  }

  // ── Suggest keywords ───────────────────────────────────────
  async function suggestKeywords() {
    if (!theme.trim()) return;
    if (!hasApiKey(settings)) { showApiAlert(); return; }
    setAiStatus("keywords");
    try {
      const txt = await callAI(
        `Generate 6-10 SHORT, COMMON, BROAD academic search keywords for the research theme: "${theme}".

CRITICAL RULES:
1. Each keyword must be MAX 1-3 words (NOT long phrases)
2. Use COMMON terms used by researchers, not overly specific jargon
3. Include synonyms and broader related concepts (not just narrow technical terms)
4. Keywords should be in ENGLISH (academic databases are English-dominant)
5. Avoid combining multiple concepts in one keyword

Examples of GOOD short keywords for theme "AI in Supply Chain":
["artificial intelligence", "supply chain", "machine learning", "logistics", "AI", "predictive analytics", "automation", "demand forecasting"]

Examples of BAD long keywords (DON'T DO THIS):
["artificial intelligence applications in modern supply chain management", "machine learning for predictive demand forecasting in logistics"]

Respond with ONLY a JSON array of short strings, no explanation:
["keyword1","keyword2","keyword3"]`,
        settings
      );
      const clean = txt.replace(/```json|```/g, "").trim();
      const arr = JSON.parse(clean);
      // Filter out keywords that are too long (>4 words)
      const cleanedKws = arr
        .map(k => k.trim())
        .filter(k => k.length > 0 && k.split(/\s+/).length <= 4);
      setKeywords(cleanedKws);
    } catch (e) {
      // Fallback: split theme into individual words
      const themeWords = theme.split(/\s+/).filter(w => w.length > 2);
      setKeywords([theme, ...themeWords]);
    }
    setAiStatus(null);
  }

  // ── Generate strategi (tema -> konsep & kata kunci) ───────
  async function generateStrategy() {
    if (!theme.trim()) return;
    if (!hasApiKey(settings)) { showApiAlert(); return; }
    const scope = (boolOpts && boolOpts.scope) || "balanced";
    const scopeRule =
      scope === "narrow"
        ? "Mode SEMPIT (presisi tinggi, hasil paling sedikit): buat 4 facet/konsep berbeda yang SEMUA wajib muncul (digabung AND). Wajib sertakan 1 facet konteks/populasi/lokasi dan bila relevan 1 facet metode/hasil. Gunakan FRASA PERSIS multi-kata. HINDARI truncation *. Maksimal 4 sinonim paling spesifik per facet."
        : scope === "broad"
        ? "Mode LUAS (recall tinggi, hasil banyak): 2-3 facet, 5-7 sinonim per facet, truncation * boleh dipakai untuk akar kata."
        : "Mode SEIMBANG (hasil terkontrol): 3 facet berbeda yang SEMUA wajib muncul (digabung AND), termasuk 1 facet konteks/populasi/lokasi spesifik dari tema. 3-5 sinonim per facet. Utamakan frasa persis; truncation * hanya jika benar-benar perlu.";
    setAiStatus("merancang strategi");
    try {
      const txt = await callAI(
        'Kamu pakar metodologi systematic literature review yang merancang query Scopus/Web of Science.\n\nTEMA: "' + theme + '"\n\n' + scopeRule + '\n\nAturan umum:\n- Terjemahkan ke istilah pencarian BAHASA INGGRIS.\n- Tiap facet adalah satu konsep berbeda; antar-facet digabung AND, jadi makin banyak facet makin sempit hasilnya.\n- Frasa multi-kata WAJIB satu kesatuan (mis. "supply chain management"), jangan dipecah.\n- Buang kata terlalu generik bila berdiri sendiri (study, analysis, research, method, system, model, approach).\n- JANGAN sertakan tahun atau jenis dokumen.\n\nBalas HANYA JSON valid tanpa teks/markdown lain:\n{"concepts":[{"label":"Label singkat Bahasa Indonesia","terms":["frasa persis","sinonim"]}]}',
        settings, "", 1500, true
      );
      const clean = txt.replace(/```json|```/g, "").trim();
      const sliced = clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1);
      const j = JSON.parse(sliced);
      const cs = (j.concepts || []).map(c => ({
        label: c.label || "Konsep",
        value: (c.terms || []).map(t => String(t).replace(/^"+|"+$/g, "").trim()).filter(Boolean).join(", ")
      })).filter(c => c.value);
      setConcepts(cs.length ? cs : [{ label: "Konsep utama (tema)", value: theme.trim() }]);
    } catch (e) {
      setConcepts([{ label: "Konsep utama (tema)", value: theme.trim() }, { label: "Konsep kedua", value: "" }]);
    }
    setAiStatus(null);
  }

  // ── Import file Scopus/WoS -> dedup otomatis -> lookup Q ───
  async function handleImportFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setAiStatus("mengekstrak file");
    const log = [];
    let parsed = [];
    for (const f of files) {
      try {
        const name = (f.name || "").toLowerCase();
        if (name.endsWith(".xls") || name.endsWith(".xlsx")) {
          log.push({ name: f.name, ok: false, msg: "Excel — ekspor ulang sbg CSV/TXT" });
          continue;
        }
        const dbLabel = /wos|savedrecs|webofscience|isi/i.test(name) ? "WoS" : "Scopus";
        const text = await f.text();
        const arts = rowsToInternal(parseDelimited(text), dbLabel);
        parsed = parsed.concat(arts);
        log.push({ name: f.name, ok: arts.length > 0, n: arts.length });
      } catch (e) {
        log.push({ name: f.name, ok: false, msg: "gagal baca" });
      }
    }
    const combined = [...rawArticles, ...parsed];
    const seen = new Map();
    for (const a of combined) {
      const key = a.doi || (a.title || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
      if (!key) continue;
      if (seen.has(key)) { const ex = seen.get(key); for (const d of a.databases) if (ex.databases.indexOf(d) === -1) ex.databases.push(d); }
      else seen.set(key, { ...a });
    }
    const deduped = [...seen.values()];
    const identified = (importStats.identified || 0) + parsed.length;
    // reset tab hilir
    setArticles([]); setInclusionCriteria([]); setScreeningDone(false); setUploadedFiles({});
    setExtractCols([]); setExtractData([]); setFramework(null); setNarasiSteps({});
    setSearchParams(p => ({ ...p, filtersEnabled: false, qIndex: [] }));
    setRawArticles(deduped);
    setImportStats({ identified, duplicates: Math.max(0, identified - deduped.length) });
    setImportLog(prev => [...log, ...prev]);
    setSearchTotalCount(0);
    setSearchDone(true);
    setAiStatus(null);
  }

  // ── Run Search ─────────────────────────────────────────────
  async function runSearch() {
    if (!keywords.length) return;
    setAiStatus("searching");
    setSearchDone(false);

    // RESET ALL DOWNSTREAM TABS
    setArticles([]);
    setInclusionCriteria([]);
    setScreeningDone(false);
    setUploadedFiles({});
    setExtractCols([]);
    setExtractData([]);
    setFramework(null);
    setNarasiSteps({});
    setNarasiAuthors([{ id:1, name:"", affil:"", email:"" }]);
    setOpenStep(null);
    setNarasiView("steps");
    setSearchTotalCount(0);
    // Reset filter state — start clean: no filters applied (both pending and applied)
    setSearchParams(p => ({
      ...p,
      filtersEnabled: false,
      databases: [], qIndex: [], types: [], openAccessOnly: false,
    }));
    setAppliedFilters({
      yearFrom: searchParams.yearFrom, yearTo: searchParams.yearTo,
      databases: [], qIndex: [], types: [], openAccessOnly: false,
    });

    try {
      // Fetch raw results from OpenAlex — no filters applied at fetch
      const result = await searchOpenAlex(keywords);
      const deduped = deduplicateArticles(result.articles);

      setRawArticles(deduped);
      setSearchTotalCount(result.totalAvailable);
      setSearchDone(true);
    } catch (e) {
      console.error("Search error:", e);
      setRawArticles([]);
      setSearchDone(true);
    }
    setAiStatus(null);
  }

  // ── Download search results ────────────────────────────────
  function downloadSearchCSV() {
    const sourceList = searchParams.filtersEnabled ? filteredArticles : rawArticles;
    const header = "Title,Authors,Year,Journal,DOI,Q,Scopus,OpenAccess,Citations,Abstract";
    const rows = sourceList.map(a =>
      [a.title, a.authors, a.year, a.journal, a.doi, a.q, a.inScopus ? "Yes" : "No", a.isOpenAccess ? "Yes" : "No", a.citations, a.abstract.slice(0, 200)].map(v => '"' + String(v || "").replace(/"/g, '""') + '"').join(",")
    );
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "slr_search_results.csv"; a.click();
  }

  // ── Suggest inclusion criteria (Bahasa Indonesia) ─────────
  async function suggestCriteria() {
    if (!hasApiKey(settings)) { showApiAlert(); return; }
    setAiStatus("criteria");
    try {
      const txt = await callAI(
        `Kamu adalah pakar systematic literature review. Untuk tema penelitian: "${theme}", sarankan 6-8 kriteria inklusi/eksklusi spesifik yang dapat dinilai HANYA dengan membaca judul dan abstrak artikel. Fokus pada filter praktis seperti: jenis artikel, relevansi topik, ruang lingkup, bahasa, desain studi, dan bidang jurnal.

Balas HANYA dengan JSON array tanpa markdown:
[{"id":"k1","label":"Teks kriteria dalam Bahasa Indonesia","checked":true},...]

Contoh kriteria yang baik:
- Artikel secara eksplisit membahas tema yang dipilih (bukan hanya menyinggung)
- Jurnal sebidang dengan tema atau jurnal umum bereputasi internasional
- Bukan literatur review, book chapter, editorial, conference paper tidak terindeks, atau opini
- Merupakan studi empiris dengan data primer atau sekunder
- Abstrak tersedia dan cukup informatif untuk dinilai kelayakannya
- Diterbitkan dalam rentang tahun yang ditentukan`,
        settings
      );
      const clean = txt.replace(/```json|```/g, "").trim();
      const arr = JSON.parse(clean);
      setInclusionCriteria(arr);
    } catch (e) {
      setInclusionCriteria([
        { id: "k1", label: "Artikel secara eksplisit membahas tema yang dipilih, bukan sekadar menyinggung topik", checked: true },
        { id: "k2", label: "Jurnal sebidang dengan tema penelitian atau jurnal umum bereputasi internasional (terindeks Scopus/WoS)", checked: true },
        { id: "k3", label: "Bukan literatur review, book chapter, editorial, konferensi tidak terindeks, atau artikel opini", checked: true },
        { id: "k4", label: "Merupakan penelitian empiris dengan data primer maupun sekunder yang jelas", checked: true },
        { id: "k5", label: "Abstrak tersedia lengkap dan memuat informasi metodologi serta temuan utama", checked: true },
        { id: "k6", label: "Artikel ditulis dalam Bahasa Inggris atau Bahasa Indonesia", checked: false },
        { id: "k7", label: "Tidak mengkaji populasi atau konteks yang terlalu spesifik sehingga tidak dapat digeneralisasi", checked: true },
      ]);
    }
    setAiStatus(null);
  }

  // ── AI Screening ───────────────────────────────────────────
  async function runScreening() {
    const sourceList = searchParams.filtersEnabled ? filteredArticles : rawArticles;
    if (!sourceList.length) return;
    if (!hasApiKey(settings)) { showApiAlert(); return; }
    const activeCriteria = inclusionCriteria.filter(c => c.checked).map(c => c.label);
    setAiStatus("skrining");
    const BATCH = 8;
    const CONCURRENCY = 4;
    const screened = sourceList.map(a => ({ ...a }));
    const total = screened.length;
    const critTxt = activeCriteria.length
      ? activeCriteria.map((c, k) => (k + 1) + ". " + c).join("\n")
      : "(tidak ada kriteria khusus — nilai relevansi terhadap tema)";

    function buildPrompt(list) {
      const items = list.map((a, j) =>
        "[" + j + "] JUDUL: " + a.title + "\nABSTRAK: " + ((a.abstract || "").slice(0, 800) || "(abstrak tidak tersedia)")
      ).join("\n\n");
      return 'Kamu reviewer systematic literature review untuk tema: "' + theme + '".\n\n' +
        "Kriteria inklusi:\n" + critTxt + "\n\n" +
        "Lakukan SCREENING JUDUL-ABSTRAK. Bersikap INKLUSIF: pilih \"accepted\" jika artikel BERPOTENSI relevan dengan tema; pilih \"rejected\" HANYA jika jelas di luar topik, bukan artikel penelitian, atau jelas melanggar kriteria. Jika ragu, pilih \"accepted\". Alasan maksimal 8 kata.\n\n" +
        "Artikel:\n" + items + "\n\n" +
        'WAJIB beri keputusan untuk SEMUA nomor 0 sampai ' + (list.length - 1) + '. Balas HANYA JSON array, satu objek per artikel:\n[{"index":0,"decision":"accepted","reason":"..."}]';
    }

    async function decide(list) {
      const res = new Map();
      let decisions = null;
      try {
        const txt = await callAI(buildPrompt(list), settings, "Kamu reviewer SLR. Balas hanya JSON array valid, satu objek per artikel.", 4096, true);
        decisions = parseJsonArray(txt);
      } catch (e) { decisions = null; }
      if (Array.isArray(decisions)) {
        decisions.forEach((d, pos) => {
          let j = Number(d.index);
          if (!Number.isInteger(j) || j < 0 || j >= list.length) j = pos;
          if (!res.has(j)) res.set(j, d);
        });
      }
      return res;
    }

    function applyDecision(art, d) {
      const idx = screened.findIndex(a => a.id === art.id);
      if (idx === -1) return;
      const acc = /acc|incl|yes|ya|relevan|terima|masuk/.test(String(d.decision || "").toLowerCase());
      screened[idx] = { ...screened[idx], status: acc ? "accepted" : "rejected", aiReason: d.reason || "" };
    }

    let processed = 0;
    async function runBatch(batch) {
      const dec = await decide(batch);
      batch.forEach((a, j) => { if (dec.has(j)) applyDecision(a, dec.get(j)); });
      let missing = batch.filter((a, j) => !dec.has(j));
      if (missing.length) {
        const dec2 = await decide(missing);
        missing.forEach((a, j) => { if (dec2.has(j)) applyDecision(a, dec2.get(j)); });
        missing.forEach((a, j) => {
          if (!dec2.has(j)) {
            const idx = screened.findIndex(x => x.id === a.id);
            if (idx !== -1 && screened[idx].status === "pending")
              screened[idx] = { ...screened[idx], status: "accepted", aiReason: "Diterima otomatis untuk tinjauan teks penuh (AI tidak menilai)" };
          }
        });
      }
      processed += batch.length;
      setAiStatus("skrining " + Math.min(processed, total) + "/" + total);
      setArticles([...screened]);
    }

    try {
      const batches = [];
      for (let i = 0; i < total; i += BATCH) batches.push(screened.slice(i, i + BATCH));
      let cursor = 0;
      async function worker() { while (cursor < batches.length) { await runBatch(batches[cursor++]); } }
      const workers = [];
      for (let w = 0; w < Math.min(CONCURRENCY, batches.length); w++) workers.push(worker());
      await Promise.all(workers);
      setScreeningDone(true);
    } catch (e) {
      console.error(e);
      setScreeningDone(true);
    }
    setAiStatus(null);
    setTab("screen");
  }

  // ── Toggle article status ──────────────────────────────────
  function toggleStatus(id, s) { setArticles(prev => prev.map(a => a.id === id ? { ...a, status: s } : a)); }

  // ── Handle BULK file upload + AI auto-identification ──────
  async function handleBulkUpload(files) {
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files);
    const acceptedList = articles.filter(a => a.status === "accepted");

    setAiStatus("mengidentifikasi file...");
    await new Promise(r => setTimeout(r, 100));

    if (acceptedList.length === 0) {
      setAiStatus(null);
      alert("Belum ada artikel yang diterima.\n\nLakukan skrining terlebih dahulu agar file dapat diidentifikasi terhadap daftar artikel yang diterima. File yang diupload sekarang akan diabaikan.");
      return;
    }

    const norm = s => (s || "").toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
    const matched = {};
    const usedFiles = new Set();

    // Pass 1: STRONG title overlap (>=25%)
    for (const file of fileArr) {
      if (usedFiles.has(file.name)) continue;
      const fname = norm(file.name.replace(/\.(pdf|docx?)$/i, ""));
      const fw = fname.split(" ").filter(w => w.length > 2);
      let bestScore = 0, bestArt = null;
      for (const art of acceptedList) {
        if (matched[art.id]) continue;
        const tw = norm(art.title).split(" ").filter(w => w.length > 3);
        const ov = tw.filter(w => fw.some(f => f.includes(w) || w.includes(f))).length;
        const score = ov / Math.max(tw.length, 1);
        if (score > bestScore && score >= 0.25) { bestScore = score; bestArt = art; }
      }
      if (bestArt) { matched[bestArt.id] = file; usedFiles.add(file.name); }
    }

    // Pass 2: Author last name match
    for (const file of fileArr) {
      if (usedFiles.has(file.name)) continue;
      const fname = norm(file.name.replace(/\.(pdf|docx?)$/i, ""));
      for (const art of acceptedList) {
        if (matched[art.id]) continue;
        const firstAuth = (art.authors || "").split(",")[0] || "";
        const lastN = norm(firstAuth).split(" ").filter(w => w.length > 2).pop() || "";
        if (lastN.length > 2 && fname.includes(lastN)) {
          matched[art.id] = file;
          usedFiles.add(file.name);
          break;
        }
      }
    }

    // Pass 3: WEAK match (>=1 significant word)
    for (const file of fileArr) {
      if (usedFiles.has(file.name)) continue;
      const fname = norm(file.name.replace(/\.(pdf|docx?)$/i, ""));
      const fw = fname.split(" ").filter(w => w.length > 3);
      let bestOv = 0, bestArt = null;
      for (const art of acceptedList) {
        if (matched[art.id]) continue;
        const tw = norm(art.title).split(" ").filter(w => w.length > 3);
        const ov = tw.filter(w => fw.includes(w)).length;
        if (ov > bestOv) { bestOv = ov; bestArt = art; }
      }
      if (bestArt && bestOv >= 1) { matched[bestArt.id] = file; usedFiles.add(file.name); }
    }

    // Pass 4: SEQUENTIAL FILL — sisa file mengisi slot accepted yang masih kosong
    // Memastikan setiap file yang diupload dipakai jika masih ada slot
    const remArts = acceptedList.filter(a => !matched[a.id]);
    const remFiles = fileArr.filter(f => !usedFiles.has(f.name));
    const fillN = Math.min(remArts.length, remFiles.length);
    for (let i = 0; i < fillN; i++) {
      matched[remArts[i].id] = remFiles[i];
      usedFiles.add(remFiles[i].name);
    }

    setArticles(prev => prev.map(a => matched[a.id] ? { ...a, uploaded: true, uploadedFile: matched[a.id] } : a));
    setUploadedFiles(prev => ({ ...prev, ...matched }));
    setAiStatus(null);

    const matchCount = Object.keys(matched).length;
    const ignored = fileArr.length - usedFiles.size;
    let msg = matchCount + " file berhasil diidentifikasi dan terupload.";
    if (ignored > 0) msg += "\n\n" + ignored + " file diabaikan (jumlah file melebihi artikel diterima).";
    if (matchCount < acceptedList.length) msg += "\n\n" + (acceptedList.length - matchCount) + " artikel diterima belum terupload — upload lagi atau cek nama file.";
    alert(msg);
  }

  // ── Suggest extraction columns (Bahasa Indonesia) ─────────
  async function suggestExtractCols() {
    if (!hasApiKey(settings)) { showApiAlert(); return; }
    setAiStatus("cols");
    try {
      const sampleTitles = uploaded.slice(0,5).map(a=>a.title).join("; ");
      const txt = await callAI(
        `Kamu adalah pakar systematic literature review. Berdasarkan judul-judul artikel berikut tentang tema "${theme}":
${sampleTitles}

Sarankan 8-12 kolom ekstraksi data spesifik (selain info bibliografi) yang akan menghasilkan sintesis unik dan meningkatkan peluang publikasi di jurnal Q1. Fokus pada: kerangka teori, variabel, metodologi, temuan, gap, moderator, mediator, faktor kontekstual.

Balas HANYA dengan JSON array tanpa markdown:
[{"id":"k1","label":"Nama Kolom","description":"Mengapa kolom ini penting untuk sintesis","approved":false},...]`,
        settings
      );
      const clean = txt.replace(/```json|```/g,"").trim();
      setExtractCols(JSON.parse(clean));
    } catch(e) {
      setExtractCols([
        {id:"k1",label:"Grand Teori",description:"Landasan teori utama yang digunakan penelitian",approved:false},
        {id:"k2",label:"Variabel Independen",description:"Anteseden / prediktor utama",approved:false},
        {id:"k3",label:"Variabel Dependen",description:"Hasil / konsekuensi yang diukur",approved:false},
        {id:"k4",label:"Variabel Mediasi",description:"Mekanisme proses antara variabel",approved:false},
        {id:"k5",label:"Variabel Moderasi",description:"Kondisi batas yang mempengaruhi hubungan",approved:false},
        {id:"k6",label:"Metodologi",description:"Desain penelitian dan metode analisis",approved:false},
        {id:"k7",label:"Sampel & Konteks",description:"Populasi, ukuran sampel, negara/industri",approved:false},
        {id:"k8",label:"Temuan Utama",description:"Hasil empiris dan kesimpulan utama",approved:false},
        {id:"k9",label:"Research Gap",description:"Celah penelitian yang diidentifikasi",approved:false},
        {id:"k10",label:"Penelitian Masa Depan",description:"Arah penelitian yang disarankan penulis",approved:false},
        {id:"k11",label:"Novelty / Kontribusi",description:"Kontribusi unik terhadap ilmu pengetahuan",approved:false},
      ]);
    }
    setAiStatus(null);
  }

  // ── Read file as base64 ──────────────────────────────────
  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Extract single article with Gemini file reading ───────
  async function extractSingleArticle(art, colLabels) {
    const { provider, geminiKey, model } = settings;
    const colSpec = colLabels.map(c => '"' + c + '":"..."').join(",");
    const baseObj = '{"id":"' + art.id + '","title":"' + (art.title || "").replace(/"/g, "'") + '","authors":"' + (art.authors || "").replace(/"/g, "'") + '","year":' + (art.year || 0) + ',"q":"' + art.q + '","journal":"' + (art.journal || "").replace(/"/g, "'") + '",' + colSpec + '}';

    if (provider === "gemini" && geminiKey && art.uploadedFile) {
      try {
        const base64 = await readFileAsBase64(art.uploadedFile);
        const mime = art.uploadedFile.type || "application/pdf";
        const mdl = model || "gemini-2.5-flash";
        const res = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/" + mdl + ":generateContent?key=" + geminiKey,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [
                { inline_data: { mime_type: mime, data: base64 } },
                { text: 'Kamu pakar systematic literature review. Baca artikel ini dan ekstrak data berikut secara akurat dan kritis.\n\nTema SLR: "' + theme + '"\nKolom yang harus diisi: ' + colLabels.join(", ") + '\n\nBalas HANYA JSON object (tanpa markdown). Isi setiap kolom dengan data NYATA dari dokumen dalam Bahasa Indonesia, jangan placeholder:\n' + baseObj }
              ] }],
              generationConfig: { maxOutputTokens: 4096, temperature: 0.2, responseMimeType: "application/json" }
            })
          }
        );
        const d = await res.json();
        const txt = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const obj = parseJsonObject(txt);
        if (obj) return obj;
      } catch (e) {
        console.error("Gemini file read failed for", art.title, e);
      }
    }

    const txt = await callAI(
      'Kamu pakar systematic literature review. Ekstrak data dari artikel berikut.\n\nJudul: ' + art.title + '\nPenulis: ' + art.authors + '\nTahun: ' + art.year + '\nJurnal: ' + art.journal + '\nAbstrak: ' + (art.abstract || "(tidak tersedia)") + '\n\nTema SLR: "' + theme + '"\nKolom yang harus diisi: ' + colLabels.join(", ") + '\n\nBalas HANYA JSON object (tanpa markdown), Bahasa Indonesia, isi semaksimal mungkin dari informasi yang ada:\n' + baseObj,
      settings, "", 4096, true
    );
    const obj = parseJsonObject(txt);
    if (obj) return obj;
    throw new Error("parse-failed");
  }

  async function runExtraction() {
    if (!uploaded.length || !approvedCols.length) return;
    if (!hasApiKey(settings)) { showApiAlert(); return; }
    setAiStatus("extracting");
    const colLabels = approvedCols.map(c => c.label);
    const results = new Array(uploaded.length).fill(null);
    let done = 0;
    const CONC = 3;
    async function one(i) {
      const art = uploaded[i];
      let row = null;
      for (let attempt = 0; attempt < 2 && !row; attempt++) {
        try { const r = await extractSingleArticle(art, colLabels); if (r) row = normRow(r, art, colLabels); } catch (e) { row = null; }
      }
      results[i] = row || failRow(art, colLabels);
      done++;
      setAiStatus("mengekstraksi " + done + "/" + uploaded.length);
      setExtractData(results.filter(Boolean));
    }
    let cursor = 0;
    async function worker() { while (cursor < uploaded.length) { await one(cursor++); } }
    const ws = [];
    for (let w = 0; w < Math.min(CONC, uploaded.length); w++) ws.push(worker());
    await Promise.all(ws);
    setExtractData([...results]);
    setAiStatus(null);
  }

  async function retryExtractRow(artId) {
    const art = uploaded.find(a => a.id === artId);
    if (!art) return;
    if (!hasApiKey(settings)) { showApiAlert(); return; }
    const colLabels = approvedCols.map(c => c.label);
    setAiStatus("ekstrak ulang: " + (art.title || "").slice(0, 30));
    let row = null;
    for (let attempt = 0; attempt < 2 && !row; attempt++) {
      try { const r = await extractSingleArticle(art, colLabels); if (r) row = normRow(r, art, colLabels); } catch (e) { row = null; }
    }
    if (!row) row = failRow(art, colLabels);
    setExtractData(prev => prev.map(r => (r.id === artId ? row : r)));
    setAiStatus(null);
  }

  // ── Framework generation ──────────────────────────────────
  async function generateFramework() {
    if (!extractData.length) return;
    if (!hasApiKey(settings)) { showApiAlert(); return; }
    setAiStatus("framework");
    const findings = extractData.map(d => ({
      title: d.title,
      temuan: d["Key Findings"] || d["Temuan Utama"] || d["Temuan"] || d.findings || "",
      variabel: d["Variabel"] || d["Variables"] || "",
      metode: d["Metode"] || d["Method"] || "",
      gap: d["Research Gap"] || d["Gap"] || d["Gap Penelitian"] || ""
    }));
    const prompt =
      'Susun kerangka konseptual (research framework) berdasarkan SINTESIS TEMUAN NYATA dari ' + extractData.length + ' artikel SLR tentang "' + theme + '".\n\n' +
      'DATA TEMUAN ARTIKEL (gunakan HANYA ini sebagai dasar, dilarang mengarang):\n' + JSON.stringify(findings).slice(0, 6500) + '\n\n' +
      'Aturan ketat:\n' +
      '- Identifikasi variabel ANTESEDEN (inputs: faktor penyebab), MEDIATOR (variabel perantara), PROSES (mekanisme), MODERATOR (memperkuat/memperlemah), dan OUTCOME (outputs: hasil) HANYA jika benar-benar didukung temuan di atas.\n' +
      '- Jika suatu kategori TIDAK ditemukan dalam literatur, kembalikan array KOSONG []. JANGAN mengisi dengan tebakan.\n' +
      '- Item singkat (2-4 kata), pakai istilah akademik yang memang muncul pada temuan.\n\n' +
      'Balas HANYA JSON object:\n' +
      '{"title":"...","description":"...","inputs":[],"mediators":[],"process":[],"outputs":[],"moderators":[],"propositions":["P1: ..."],"synthesis":"..."}';
    let fw = null;
    for (let attempt = 0; attempt < 2 && !fw; attempt++) {
      try {
        const txt = await callAI(prompt, settings, "Kamu pakar sintesis SLR. Balas hanya JSON valid. Dilarang mengarang variabel yang tidak ada pada temuan.", 4096, true);
        fw = parseJsonObject(txt);
      } catch (e) { fw = null; }
    }
    if (fw) {
      fw.inputs = (fw.inputs || []).filter(Boolean);
      fw.mediators = (fw.mediators || []).filter(Boolean);
      fw.process = (fw.process || []).filter(Boolean);
      fw.outputs = (fw.outputs || []).filter(Boolean);
      fw.moderators = (fw.moderators || []).filter(Boolean);
      setFramework(fw);
    } else {
      setFramework({ title: "Kerangka Konseptual: " + theme, description: "AI belum berhasil menyusun kerangka dari temuan. Silakan klik Generate lagi.", inputs: [], mediators: [], process: [], outputs: [], moderators: [], propositions: [], synthesis: "" });
    }
    setAiStatus(null);
  }

  // ── Narasi generation with tables & figures ───────────────
  async function generateNarasi(stepId) {
    if (!hasApiKey(settings)) { showApiAlert(); return; }
    setAiStatus(stepId);
    const citeList = accepted.map(a => (a.authors.split(",")[0]) + " (" + a.year + "): " + a.title + ". " + a.journal + ".").join("\n");
    const tplName = JOURNAL_TPLS.find(t => t.id === settings.journalTemplate)?.label || "APA 7th";
    const artSummary = accepted.slice(0, 14).map(a => "- " + a.authors.split(",")[0] + " (" + a.year + "): " + a.title + ". Jurnal: " + a.journal + " [" + a.q + "]. Abstrak: " + (a.abstract ? a.abstract.slice(0, 220) : "")).join("\n");
    const RULE = "PENTING: Jangan membuat tabel atau menggambar bagan. Di posisi tabel cukup tulis SATU baris penanda persis: (Letakkan Tabel N di sini). Di posisi gambar tulis: (Letakkan Gambar N di sini). Khusus diagram PRISMA tulis: (Letakkan bagan PRISMA di sini). Ganti N dengan nomor sesuai urutan. Tulis isi naskah selengkap mungkin, jangan terpotong.";

    const stepPrompts = {
      abstrak: 'Tulis JUDUL dan ABSTRAK lengkap untuk systematic literature review dalam Bahasa Indonesia.\nTema: "' + theme + '"\n' + accepted.length + ' artikel diinklusi.\nArtikel:\n' + artSummary + '\nFormat: ' + tplName + '\n\nSertakan: judul akademik informatif; abstrak 200-250 kata (latar belakang, tujuan, metode PRISMA + jumlah artikel, hasil utama, kontribusi); 5-7 kata kunci (Indonesia & Inggris). Bahasa Indonesia formal.',

      pendahuluan: 'Tulis bagian PENDAHULUAN systematic literature review dalam Bahasa Indonesia.\nTema: "' + theme + '"\nFormat: ' + tplName + '\nSumber kutipan:\n' + citeList + '\n\nSertakan: (1) konteks & urgensi dengan kutipan (Penulis, Tahun); (2) gap penelitian dari literatur; (3) tujuan & kontribusi; (4) struktur artikel. Minimal 6 paragraf, minimal 8 kutipan in-text. Di tempat tabel ringkasan gap, tulis penanda (Letakkan Tabel 1 di sini). Akhiri dengan transisi ke metode.\n\n' + RULE,

      metode: 'Tulis bagian METODE PENELITIAN systematic literature review dalam Bahasa Indonesia.\nTema: "' + theme + '"\nJumlah artikel terinklusi: ' + accepted.length + '\nFormat: ' + tplName + '\n\nSertakan: (1) desain SLR dengan PRISMA 2020; (2) protokol pencarian (database Scopus & Web of Science, rentang tahun, string boolean); (3) kriteria inklusi/eksklusi; (4) proses seleksi mengacu PRISMA; (5) teknik analisis & sintesis. Minimal 4 paragraf. Di tempat tabel kriteria tulis (Letakkan Tabel 2 di sini); di tempat tabel distribusi per database tulis (Letakkan Tabel 3 di sini); di tempat diagram alir tulis (Letakkan bagan PRISMA di sini).\n\n' + RULE,

      hasil: 'Tulis bagian HASIL DAN PEMBAHASAN systematic literature review dalam Bahasa Indonesia.\nTema: "' + theme + '"\nArtikel (' + accepted.length + '):\n' + artSummary + '\nSumber kutipan:\n' + citeList + '\nFormat: ' + tplName + '\n\nSertakan: (1) karakteristik artikel; (2) sintesis tematik dengan sub-judul; (3) pola & tren; (4) sintesis kritis antar studi; (5) implikasi teoritis & praktis. Minimal 8 paragraf, minimal 15 kutipan in-text. Di tempat tabel karakteristik tulis (Letakkan Tabel 4 di sini); tabel sintesis tema (Letakkan Tabel 5 di sini); gambar framework (Letakkan Gambar 1 di sini); gambar distribusi tahun (Letakkan Gambar 2 di sini).\n\n' + RULE,

      kesimpulan: 'Tulis bagian KESIMPULAN systematic literature review dalam Bahasa Indonesia.\nTema: "' + theme + '"\n' + accepted.length + ' artikel dianalisis.\nFormat: ' + tplName + '\n\nSertakan: (1) ringkasan temuan; (2) kontribusi teoritis/novelty; (3) implikasi praktis; (4) keterbatasan; (5) agenda penelitian masa depan. Minimal 5 paragraf, minimal 5 kutipan. Di tempat tabel agenda penelitian tulis (Letakkan Tabel 6 di sini).\n\n' + RULE,
    };

    const prompt = stepPrompts[stepId] || ('Tulis bagian "' + stepId + '" SLR tentang "' + theme + '" dalam Bahasa Indonesia formal, format ' + tplName + '. ' + RULE);

    try {
      const txt = await callAI(prompt, settings,
        "Kamu penulis akademik senior spesialis systematic literature review. Tulis selengkap dan sepanjang yang diminta tanpa terpotong, gaya ilmiah formal Bahasa Indonesia. Untuk tabel/gambar cukup tulis penanda (Letakkan ... di sini), jangan membuat tabelnya.",
        8000);
      setNarasiSteps(prev => ({ ...prev, [stepId]: txt }));
    } catch (e) {
      setNarasiSteps(prev => ({ ...prev, [stepId]: "[Gagal generate — periksa API key di Pengaturan]" }));
    }
    setAiStatus(null);
    setOpenStep(stepId);
  }

  function handleNarasiImprove(original, replacement) {
    setNarasiSteps(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(k => {
        if (updated[k]?.includes(original)) updated[k] = updated[k].replace(original, replacement);
      });
      return updated;
    });
  }

  // PRISMA numbers
  const totalRaw = importStats.identified || filteredArticles.length;
  const duplicates = importStats.duplicates || 0;
  const afterDupl = rawArticles.length;
  const rejected2 = articles.filter(a => a.status === "rejected").length;
  const afterScreen = articles.filter(a => a.status === "accepted").length;
  const uploadedCount = uploaded.length;
  const filteredCount = filteredArticles.length;

  const renderContent = () => {
    switch (tab) {
      case "search":   return <TabSearch theme={theme} setTheme={setTheme} concepts={concepts} setConcepts={setConcepts} boolOpts={boolOpts} setBoolOpts={setBoolOpts} searchParams={searchParams} setSearchParams={setSearchParams} appliedFilters={appliedFilters} setAppliedFilters={setAppliedFilters} rawArticles={rawArticles} filteredArticles={filteredArticles} searchDone={searchDone} importStats={importStats} importLog={importLog} aiStatus={aiStatus} generateStrategy={generateStrategy} handleImportFiles={handleImportFiles} downloadCSV={downloadSearchCSV} setTab={setTab} settings={settings} />;
      case "screen":   return <TabScreen articles={articles} setArticles={setArticles} inclusionCriteria={inclusionCriteria} setInclusionCriteria={setInclusionCriteria} theme={theme} rawArticles={filteredArticles} aiStatus={aiStatus} suggestCriteria={suggestCriteria} runScreening={runScreening} toggleStatus={toggleStatus} screeningDone={screeningDone} setTab={setTab} settings={settings} />;
      case "upload":   return <TabUpload accepted={accepted} handleBulkUpload={handleBulkUpload} setTab={setTab} aiStatus={aiStatus} />;
      case "prisma":   return <TabPrisma totalRaw={totalRaw} duplicates={duplicates} afterDupl={afterDupl} rejected2={rejected2} afterScreen={afterScreen} uploadedCount={uploadedCount} filteredCount={filteredCount} />;
      case "extract":  return <TabExtract uploaded={uploaded} extractCols={extractCols} approvedCols={approvedCols} setApprovedCols={setApprovedCols} extractData={extractData} aiStatus={aiStatus} suggestCols={suggestExtractCols} runExtraction={runExtraction} retryExtractRow={retryExtractRow} theme={theme} setTab={setTab} />;
      case "biblio":   return <TabBiblio articles={articles} accepted={accepted} theme={theme} />;
      case "framework":return <TabFramework framework={framework} extractData={extractData} aiStatus={aiStatus} generateFramework={generateFramework} uploaded={uploaded} />;
      case "narasi":   return <TabNarasi accepted={accepted} theme={theme} narasiSteps={narasiSteps} setNarasiSteps={setNarasiSteps} generateNarasi={generateNarasi} aiStatus={aiStatus} openStep={openStep} setOpenStep={setOpenStep} narasiView={narasiView} setNarasiView={setNarasiView} handleImprove={handleNarasiImprove} settings={settings} narasiAuthors={narasiAuthors} setNarasiAuthors={setNarasiAuthors} extractData={extractData} framework={framework} prismaData={{totalRaw, duplicates, afterDupl, rejected2, afterScreen, uploadedCount, filteredCount}} />;
      case "settings": return <TabSettings settings={settings} setSettings={setSettings} />;
      default: return null;
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="shell">
        <nav className="sidebar">
          <div className="sb-logo">
            <div className="wm">ResearchAI</div>
            <div className="sub">SLR Platform v3</div>
          </div>
          <div className="nav-lbl">Alur Kerja SLR</div>
          {TABS.map(t => (
            <div key={t.id} className={`nav-item ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <span className="ic">{t.icon}</span>
              <span>{t.label}</span>
              {t.id === "search" && filteredArticles.length > 0 && <span className="nb">{filteredArticles.length}</span>}
              {t.id === "screen" && accepted.length > 0 && <span className="nb green">{accepted.length}</span>}
              {t.id === "upload" && uploaded.length > 0 && <span className="nb green">{uploaded.length}</span>}
              {t.id === "extract" && extractData.length > 0 && <span className="nb">{extractData.length}</span>}
            </div>
          ))}
          <div style={{ marginTop: "auto", padding: "16px 18px", borderTop: "1px solid var(--border)" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.7 }}>
              <div>🔍 Ditemukan: <b style={{ color: "var(--accent)" }}>{totalRaw}</b></div>
              <div>✅ Diterima: <b style={{ color: "var(--green)" }}>{accepted.length}</b></div>
              <div>❌ Ditolak: <b style={{ color: "var(--red)" }}>{rejected.length}</b></div>
              <div>📤 Terupload: <b style={{ color: "var(--amber)" }}>{uploaded.length}</b></div>
            </div>
          </div>
        </nav>
        <div className="main">
          <div className="topbar">
            <div className="topbar-title"><span>SLR</span> — {theme || "Systematic Literature Review"}</div>
            <select style={{ maxWidth: 160, fontSize: 11 }} value={settings.journalTemplate} onChange={e => setSettings(p => ({ ...p, journalTemplate: e.target.value }))}>
              {JOURNAL_TPLS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <button className="btn sm" onClick={() => setTab("settings")}>⚙️ API Settings</button>
          </div>
          <div className="content">
            {aiStatus && (
              <div className="ai-bar">
                <div className="dp"><span /><span /><span /></div>
                AI sedang bekerja — {aiStatus}…
              </div>
            )}
            <ApiKeyBanner settings={settings} onGoSettings={() => setTab("settings")} />
            {renderContent()}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════
// TAB 1 — TEMA & PENCARIAN
// ═══════════════════════════════════════════════
function TabSearch({ theme, setTheme, concepts, setConcepts, boolOpts, setBoolOpts, searchParams, setSearchParams, appliedFilters, setAppliedFilters, rawArticles, filteredArticles, searchDone, importStats, importLog, aiStatus, generateStrategy, handleImportFiles, downloadCSV, setTab, settings }) {
  const [copied, setCopied] = useState("");
  const [qSel, setQSel] = useState({ Q1: true, Q2: true, Q3: false, Q4: false });
  const [includeUnranked, setIncludeUnranked] = useState(true);
  const [processed, setProcessed] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const fileRef = useRef(null);

  const opts = { yearFrom: searchParams.yearFrom, yearTo: searchParams.yearTo, docTypes: boolOpts.docTypes, langs: boolOpts.langs, journalOnly: boolOpts.journalOnly };
  const scopusQuery = buildScopusQuery(concepts, opts);
  const wosQuery = buildWosQuery(concepts, opts);
  const ready = scopusQuery.length > 0;

  const setYear = (k, v) => setSearchParams(p => ({ ...p, [k]: +v }));
  const toggleDoc = (k) => setBoolOpts(o => ({ ...o, docTypes: { ...o.docTypes, [k]: !o.docTypes[k] } }));
  const toggleLang = (k) => setBoolOpts(o => ({ ...o, langs: { ...o.langs, [k]: !o.langs[k] } }));

  const copy = async (t, tag) => {
    try { await navigator.clipboard.writeText(t); }
    catch (e) { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e2) {} document.body.removeChild(ta); }
    setCopied(tag); setTimeout(() => setCopied(""), 1600);
  };
  const openScopus = () => { copy(scopusQuery, "scopus"); window.open("https://www.scopus.com/results/results.uri?sort=plf-f&src=s&sot=b&sdt=b&s=" + encodeURIComponent(scopusQuery), "_blank", "noopener"); };
  const openWos = () => { copy(wosQuery, "wos"); window.open("https://www.webofscience.com/wos/woscc/advanced-search", "_blank", "noopener"); };

  const runProcess = () => {
    const qList = [...["Q1", "Q2", "Q3", "Q4"].filter(q => qSel[q]), ...(includeUnranked ? ["Unranked"] : [])];
    setAppliedFilters({ yearFrom: searchParams.yearFrom, yearTo: searchParams.yearTo, databases: [], qIndex: qList, types: [], openAccessOnly: false });
    setSearchParams(p => ({ ...p, filtersEnabled: true, qIndex: qList }));
    setProcessed(true);
  };

  const DOCS = [["article", "Artikel jurnal"], ["review", "Review"], ["conference", "Prosiding/konferensi"], ["bookChapter", "Bab buku"]];
  const LANGS = [["english", "Inggris"], ["indonesian", "Indonesia"]];
  const preStyle = { background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", padding: 10, borderRadius: 8, fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, fontFamily: "var(--fb)", lineHeight: 1.5 };

  return (
    <div>
      {/* STEP 1 — Tema */}
      <div className="card">
        <div className="card-title">🎯 Tema Penelitian</div>
        <div className="fg">
          <label>Tulis tema — AI menyusun konsep & kata kuncinya *</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="text" placeholder="contoh: Pengaruh kecerdasan buatan terhadap manajemen rantai pasok UMKM" value={theme} onChange={e => setTheme(e.target.value)} onKeyDown={e => e.key === "Enter" && generateStrategy()} style={{ flex: 1 }} />
            <button className="btn primary" onClick={generateStrategy} disabled={!theme.trim() || !!aiStatus}>
              {aiStatus === "merancang strategi" ? "⏳" : "✨ Buatkan Konsep"}
            </button>
          </div>
        </div>
        {concepts.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 8, fontWeight: 600, letterSpacing: .5 }}>
              STRATEGI — bisa diedit. Koma = sinonim (OR), antar baris = AND.
            </div>
            {concepts.map((c, i) => (
              <div key={i} style={{ marginBottom: 9 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent)", marginBottom: 3 }}>{c.label}</div>
                <div style={{ display: "flex", gap: 7 }}>
                  <input type="text" value={c.value} onChange={e => { const a = [...concepts]; a[i] = { ...a[i], value: e.target.value }; setConcepts(a); }} style={{ flex: 1 }} />
                  <button className="btn sm" onClick={() => setConcepts(concepts.filter((_, j) => j !== i))}>×</button>
                </div>
              </div>
            ))}
            <button className="btn sm" onClick={() => setConcepts([...concepts, { label: "Konsep tambahan", value: "" }])}>+ Tambah konsep</button>
          </div>
        )}
      </div>

      {/* STEP 2 — Kriteria */}
      {concepts.length > 0 && (
        <div className="card">
          <div className="card-title">🎛️ Kriteria Inklusi & Eksklusi</div>
          <div className="grid2" style={{ marginBottom: 12 }}>
            <div className="fg"><label>Tahun Mulai</label><input type="number" value={searchParams.yearFrom} onChange={e => setYear("yearFrom", e.target.value)} /></div>
            <div className="fg"><label>Tahun Akhir</label><input type="number" value={searchParams.yearTo} onChange={e => setYear("yearTo", e.target.value)} /></div>
          </div>
          <div className="fg" style={{ marginBottom: 10 }}>
            <label>Jenis Dokumen</label>
            <div className="chip-group">
              {DOCS.map(([k, l]) => <span key={k} className={"chip " + (boolOpts.docTypes[k] ? "on" : "")} onClick={() => toggleDoc(k)}>{boolOpts.docTypes[k] ? "✓ " : ""}{l}</span>)}
            </div>
          </div>
          <div className="fg" style={{ marginBottom: 10 }}>
            <label>Bahasa</label>
            <div className="chip-group">
              {LANGS.map(([k, l]) => <span key={k} className={"chip " + (boolOpts.langs[k] ? "on" : "")} onClick={() => toggleLang(k)}>{boolOpts.langs[k] ? "✓ " : ""}{l}</span>)}
            </div>
          </div>
          <div className="fg" style={{ marginBottom: 10 }}>
            <label>Cakupan hasil (kontrol jumlah artikel)</label>
            <div className="chip-group">
              {[["narrow", "Sempit (paling sedikit)"], ["balanced", "Seimbang"], ["broad", "Luas (banyak)"]].map(([k, l]) => <span key={k} className={"chip " + (((boolOpts.scope || "balanced") === k) ? "on" : "")} onClick={() => setBoolOpts(o => ({ ...o, scope: k }))}>{((boolOpts.scope || "balanced") === k) ? "✓ " : ""}{l}</span>)}
            </div>
          </div>
          <div className="chip-group">
            <span className={"chip " + (boolOpts.journalOnly ? "on" : "")} onClick={() => setBoolOpts(o => ({ ...o, journalOnly: !o.journalOnly }))}>{boolOpts.journalOnly ? "✓ " : ""}Hanya sumber jurnal (Scopus)</span>
            <span className={"chip " + (boolOpts.useWos ? "on" : "")} onClick={() => setBoolOpts(o => ({ ...o, useWos: !o.useWos }))}>{boolOpts.useWos ? "✓ " : ""}Sertakan Web of Science</span>
          </div>
        </div>
      )}

      {/* STEP 3 — Boolean */}
      {ready && (
        <div className="card">
          <div className="card-title">🔗 Boolean & Jalankan Pencarian</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fb923c" }}>● Scopus (Advanced search)</span>
            {copied === "scopus" && <span style={{ fontSize: 10, color: "var(--green)", fontWeight: 700 }}>Tersalin ✓</span>}
          </div>
          <pre style={preStyle}>{scopusQuery}</pre>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn primary" onClick={openScopus} style={{ flex: 1 }}>Buka & cari di Scopus →</button>
            <button className="btn sm" onClick={() => copy(scopusQuery, "scopus")}>Salin</button>
          </div>
          {boolOpts.useWos && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 0 6px" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent2)" }}>● Web of Science (Advanced search)</span>
                {copied === "wos" && <span style={{ fontSize: 10, color: "var(--green)", fontWeight: 700 }}>Tersalin ✓</span>}
              </div>
              <pre style={preStyle}>{wosQuery}</pre>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn" onClick={openWos} style={{ flex: 1, borderColor: "var(--accent2)", color: "var(--accent2)" }}>Buka & cari di Web of Science →</button>
                <button className="btn sm" onClick={() => copy(wosQuery, "wos")}>Salin</button>
              </div>
            </>
          )}
          <div style={{ marginTop: 12, fontSize: 10, color: "var(--muted)", lineHeight: 1.6, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 11px" }}>
            <b style={{ color: "var(--text)" }}>Scopus:</b> setelah tab terbuka & login institusi, buka <i>Advanced search</i>, paste (boolean sudah tersalin), <i>Search</i> → <i>Export → CSV</i>.<br />
            <b style={{ color: "var(--text)" }}>WoS:</b> buka <i>Advanced Search</i>, paste, <i>Search</i> → <i>Export → CSV</i> atau <i>Tab delimited (.txt)</i>. <b>Hindari "Export to Excel" (.xls)</b> — pakai CSV/Tab agar terbaca.
          </div>
        </div>
      )}

      {/* STEP 4 — Upload & dedup */}
      {ready && (
        <div className="card">
          <div className="card-title">📥 Unggah Hasil & Hapus Duplikat Otomatis</div>
          <div onClick={() => fileRef.current && fileRef.current.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleImportFiles(e.dataTransfer.files); }}
            style={{ border: "2px dashed var(--accent)", borderRadius: 10, padding: "22px 14px", textAlign: "center", cursor: "pointer", background: "rgba(79,156,249,.04)" }}>
            <div style={{ fontSize: 24 }}>⬆️</div>
            <div style={{ fontWeight: 600, color: "var(--text)", marginTop: 4, fontSize: 12 }}>Tarik file atau ketuk untuk memilih</div>
            <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>.csv · .txt · .tsv — Scopus & WoS, boleh beberapa file sekaligus</div>
            <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" multiple style={{ display: "none" }} onChange={e => handleImportFiles(e.target.files)} />
          </div>
          {importLog && importLog.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
              {importLog.slice(0, 8).map((f, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "6px 9px", borderRadius: 6, background: f.ok ? "rgba(52,211,153,.08)" : "rgba(248,113,113,.08)", color: f.ok ? "var(--green)" : "var(--red)" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "62%" }}>{f.name}</span>
                  <span style={{ fontWeight: 700 }}>{f.ok ? ("+" + f.n + " artikel") : (f.msg || "gagal")}</span>
                </div>
              ))}
            </div>
          )}
          {searchDone && rawArticles.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="badge q1">{rawArticles.length} artikel unik</span>
              <span className="badge pend">{importStats.duplicates || 0} duplikat dibuang</span>
            </div>
          )}
        </div>
      )}

      {/* STEP 5 — Filter Q */}
      {searchDone && rawArticles.length > 0 && (
        <div className="card">
          <div className="card-title">🏷️ Saring Q-Index lalu Proses</div>
          <div className="chip-group" style={{ marginBottom: 10 }}>
            {["Q1", "Q2", "Q3", "Q4"].map(q => <span key={q} className={"chip " + (qSel[q] ? "on" : "")} onClick={() => setQSel(s => ({ ...s, [q]: !s[q] }))}>{qSel[q] ? "✓ " : ""}{q}</span>)}
            <span className={"chip " + (includeUnranked ? "on" : "")} onClick={() => setIncludeUnranked(v => !v)}>{includeUnranked ? "✓ " : ""}Tanpa peringkat</span>
          </div>
          <button className="btn primary" onClick={runProcess}>⚙️ Proses</button>
          <div style={{ marginTop: 8, fontSize: 10, color: "var(--muted)", lineHeight: 1.6 }}>
            Q-index dicocokkan dari ISSN ke data Scimago/Scopus (54.011 ISSN). Web of Science tidak punya kuartil sendiri — kuartil Scimago diterapkan ke semua artikel melalui ISSN.
          </div>
        </div>
      )}

      {/* Hasil akhir (data sementara) */}
      {(processed || searchParams.filtersEnabled) && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: "var(--fh)", fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>{filteredArticles.length}</div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>artikel lolos saringan — data sementara</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn sm success" onClick={downloadCSV}>⬇ CSV</button>
              <button className="btn sm primary" onClick={() => setTab("screen")}>→ Lanjut Skrining</button>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {filteredArticles.slice(0, 40).map(a => (
              <div key={a.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "9px 11px", background: "var(--bg2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.35 }}>{a.title}</div>
                  <span className={"badge " + (a.q && a.q !== "Unranked" ? a.q.toLowerCase() : "pend")} style={{ flexShrink: 0 }}>{a.q}</span>
                </div>
                {a.authors && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3, fontStyle: "italic" }}>{shortAuthors(a.authors)}</div>}
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{[a.year, a.journal, a.citations ? (a.citations + " sitasi") : null].filter(Boolean).join(" · ")}</div>
                <div style={{ display: "flex", gap: 7, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                  {a.databases && a.databases.map(d => <span key={d} className="badge" style={{ background: d === "WoS" ? "rgba(167,139,250,.12)" : "rgba(251,146,60,.12)", color: d === "WoS" ? "var(--accent2)" : "#fb923c" }}>{d}</span>)}
                  {a.doi ? <a href={"https://doi.org/" + a.doi} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600 }}>doi.org/{a.doi} ↗</a> : <span style={{ fontSize: 10, color: "var(--red)" }}>DOI tidak tersedia</span>}
                </div>
                {a.abstract && (
                  <div style={{ marginTop: 5 }}>
                    <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.55 }}>{expanded === a.id ? a.abstract : (a.abstract.slice(0, 150) + (a.abstract.length > 150 ? "…" : ""))}</div>
                    {a.abstract.length > 150 && <button className="btn ghost xs" style={{ color: "var(--accent)", marginTop: 2 }} onClick={() => setExpanded(expanded === a.id ? null : a.id)}>{expanded === a.id ? "▲ Tutup" : "▼ Selengkapnya"}</button>}
                  </div>
                )}
              </div>
            ))}
            {filteredArticles.length > 40 && <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", padding: 6 }}>…dan {filteredArticles.length - 40} artikel lainnya (semua tetap diproses di skrining)</div>}
          </div>
        </div>
      )}

      {searchDone && rawArticles.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 24, color: "var(--muted)" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Belum ada artikel terbaca</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>Pastikan file CSV/TXT memuat kolom Title & Abstract (ekspor Scopus/WoS). File Excel (.xls) → ekspor ulang sebagai CSV.</div>
        </div>
      )}
    </div>
  );
}
// ═══════════════════════════════════════════════
// TAB 2 — SKRINING ARTIKEL
// ═══════════════════════════════════════════════
function TabScreen({ articles, setArticles, inclusionCriteria, setInclusionCriteria, theme, rawArticles, aiStatus, suggestCriteria, runScreening, toggleStatus, screeningDone, setTab }) {
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState("all");

  const togCrit = (id) => setInclusionCriteria(prev => prev.map(c => c.id === id ? { ...c, checked: !c.checked } : c));
  const filtered = articles.filter(a => filter === "all" || a.status === filter);
  const displayList = (screeningDone ? articles : rawArticles.map(a => ({ ...a, status: a.status || "pending" }))).filter(a => filter === "all" || a.status === filter);

  return (
    <div>
      {/* Inclusion Criteria Panel */}
      <div className="card">
        <div className="card-title">✅ Kriteria Inklusi / Eksklusi</div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
          Rekomendasi AI berdasarkan tema. Centang kriteria yang ingin diterapkan pada proses skrining otomatis.
        </div>
        {inclusionCriteria.length === 0 && (
          <button className="btn primary" onClick={suggestCriteria} disabled={!theme || !!aiStatus}>
            {aiStatus === "criteria" ? "⏳ Generating..." : "✨ Dapatkan Rekomendasi AI"}
          </button>
        )}
        {inclusionCriteria.map(c => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid rgba(42,51,71,.4)" }}>
            <input type="checkbox" checked={c.checked} onChange={() => togCrit(c.id)} style={{ accentColor: "var(--accent)", width: 14, height: 14, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: c.checked ? "var(--text)" : "var(--muted)" }}>{c.label}</span>
          </div>
        ))}
        {inclusionCriteria.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="btn primary" onClick={runScreening} disabled={!!aiStatus}>
              {aiStatus === "screening" ? "⏳ AI Menyaring..." : `🤖 Proses AI Screening (${rawArticles.length} artikel)`}
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {(screeningDone || articles.length > 0) && (
        <>
          <div style={{ display: "flex", gap: 7, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            {["all", "accepted", "pending", "rejected"].map(f => (
              <button key={f} className={`btn sm ${filter === f ? "primary" : ""}`} onClick={() => setFilter(f)}>
                {f === "all" ? "Semua" : f === "accepted" ? "✅ Diterima" : f === "pending" ? "⏳ Pending" : "❌ Ditolak"}
                <span style={{ opacity: .7, marginLeft: 3 }}>
                  ({(screeningDone ? articles : rawArticles.map(a => ({ ...a, status: "pending" }))).filter(a => f === "all" || a.status === f).length})
                </span>
              </button>
            ))}
            {screeningDone && <button className="btn sm primary" style={{ marginLeft: "auto" }} onClick={() => setTab("upload")}>→ Lanjut Upload</button>}
          </div>

          <div className="tw">
            <table>
              <thead><tr>
                <th>#</th>
                <th style={{ minWidth: 220 }}>Judul</th>
                <th>Penulis</th><th>Tahun</th><th>Jurnal</th><th>Q</th>
                <th style={{ minWidth: 160 }}>Abstract</th>
                <th>Status AI</th>
                <th>Alasan AI</th>
                <th>Link</th>
                <th>Aksi Manual</th>
              </tr></thead>
              <tbody>
                {displayList.map((a, i) => (
                  <tr key={a.id} style={a.status === "rejected" ? { opacity: .6 } : {}}>
                    <td style={{ color: "var(--muted)" }}>{i + 1}</td>
                    <td><div style={{ fontSize: 11, fontWeight: 600 }}>{a.title}</div></td>
                    <td style={{ fontSize: 10, color: "var(--muted)", maxWidth: 100 }}>{a.authors}</td>
                    <td>{a.year}</td>
                    <td style={{ fontSize: 10, maxWidth: 110 }}>{a.journal}</td>
                    <td><span className={`badge ${a.q?.toLowerCase()}`}>{a.q}</span></td>
                    <td style={{ maxWidth: 180 }}>
                      <div style={{ fontSize: 10, color: "var(--muted)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.abstract}</div>
                      <button className="btn ghost xs" style={{ color: "var(--accent)", marginTop: 2 }} onClick={() => setExpanded(expanded === a.id ? null : a.id)}>
                        {expanded === a.id ? "▲" : "▼ Baca"}
                      </button>
                      {expanded === a.id && <div style={{ fontSize: 10, marginTop: 5, lineHeight: 1.6 }}>{a.abstract}</div>}
                    </td>
                    <td>
                      <span className={`badge ${a.status === "accepted" ? "acc" : a.status === "rejected" ? "rej" : "pend"}`}>
                        {a.status === "accepted" ? "✓ Diterima" : a.status === "rejected" ? "✗ Ditolak" : "⏳ Pending"}
                      </span>
                    </td>
                    <td style={{ fontSize: 9, color: "var(--muted)", maxWidth: 120 }}>{a.aiReason || "—"}</td>
                    <td>
                      {a.doi && <a href={`https://doi.org/${a.doi}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontSize: 10 }}>🔗 DOI</a>}
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <button className="btn xs success" onClick={() => toggleStatus(a.id, "accepted")}>✓ Terima</button>
                        <button className="btn xs danger" onClick={() => toggleStatus(a.id, "rejected")}>✗ Tolak</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// TAB 3 — UPLOAD DOKUMEN (bulk single zone)
// ═══════════════════════════════════════════════
function TabUpload({ accepted, handleBulkUpload, setTab, aiStatus }) {
  const [dragging, setDragging] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const fileInputRef = useRef(null);

  const uploadedCount = accepted.filter(a => a.uploaded).length;
  const pct = accepted.length ? Math.round((uploadedCount / accepted.length) * 100) : 0;

  async function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const files = e.dataTransfer?.files;
    if (files?.length) {
      setIdentifying(true);
      try { await handleBulkUpload(files); }
      catch(err) { console.error("Upload error:", err); alert("Error saat upload: " + err.message); }
      setIdentifying(false);
    }
  }

  async function handleInput(e) {
    const files = e.target.files;
    if (files?.length) {
      setIdentifying(true);
      try { await handleBulkUpload(files); }
      catch(err) { console.error("Upload error:", err); alert("Error saat upload: " + err.message); }
      setIdentifying(false);
      // Reset input so user can re-select same files if needed
      e.target.value = "";
    }
  }

  function openPicker(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  return (
    <div>
      {/* Single bulk upload zone */}
      <div className="card">
        <div className="card-title">📤 Upload Semua Artikel Sekaligus</div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 14, lineHeight: 1.7 }}>
          Pilih atau drag semua file PDF/Word sekaligus. AI akan <strong style={{color:"var(--accent)"}}>otomatis mengidentifikasi</strong> dan mencocokkan setiap file dengan daftar artikel yang diterima. File yang tidak cocok akan diabaikan secara otomatis.
        </div>

        {/* Drop zone with label-based input (reliable across browsers) */}
        <label
          htmlFor="bulk-upload-input"
          className={`drop-zone ${dragging ? "drag" : ""}`}
          style={{ padding: 36, marginBottom: 14, display: "block", cursor: "pointer" }}
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
          onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
          onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setDragging(false); }}
          onDrop={handleDrop}
        >
          <input
            id="bulk-upload-input"
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            multiple
            style={{ display: "none" }}
            onChange={handleInput}
          />
          {identifying || aiStatus === "mengidentifikasi file..." ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 28 }}>🔍</div>
              <div style={{ fontFamily: "var(--fh)", fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>AI Mengidentifikasi File…</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Mencocokkan file dengan daftar artikel yang diterima</div>
              <div className="dp" style={{ marginTop: 4 }}><span/><span/><span/></div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 36 }}>📁</div>
              <div style={{ fontFamily: "var(--fh)", fontSize: 14, fontWeight: 700 }}>
                {dragging ? "Lepaskan file di sini" : "Klik di sini atau drag & drop file"}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>PDF, DOC, DOCX — bisa pilih banyak file sekaligus</div>
              <div className="btn primary" style={{ marginTop: 6 }}>
                📂 Pilih File dari Direktori
              </div>
            </div>
          )}
        </label>

        {/* Fallback explicit button — extra reliable on mobile */}
        <button
          type="button"
          className="btn"
          style={{ width: "100%", marginBottom: 10, padding: "8px", fontSize: 11 }}
          onClick={openPicker}
        >
          📂 Klik di sini jika area di atas tidak responsif
        </button>

        {/* Progress */}
        {uploadedCount > 0 && (
          <div style={{ marginBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: "var(--muted)" }}>Teridentifikasi otomatis</span>
              <span style={{ color: "var(--green)", fontWeight: 700 }}>{uploadedCount} / {accepted.length} artikel ({pct}%)</span>
            </div>
            <div className="prog"><div className="prog-fill" style={{ width: `${pct}%` }} /></div>
          </div>
        )}
      </div>

      {/* Confirmation list */}
      {accepted.length > 0 && (
        <div className="card">
          <div className="card-title">
            📋 Konfirmasi Status Upload
            <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--muted)", fontWeight: 400 }}>
              {uploadedCount} terupload · {accepted.length - uploadedCount} belum
            </span>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th style={{ minWidth: 220 }}>Judul Artikel</th>
                  <th>Penulis</th>
                  <th>Tahun</th>
                  <th>Q</th>
                  <th>Status Upload</th>
                  <th>File Teridentifikasi</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {accepted.map((a, i) => (
                  <tr key={a.id} style={{ background: a.uploaded ? "rgba(52,211,153,.03)" : "" }}>
                    <td style={{ color: "var(--muted)" }}>{i + 1}</td>
                    <td style={{ fontSize: 11, fontWeight: 600 }}>{a.title}</td>
                    <td style={{ fontSize: 10, color: "var(--muted)", maxWidth: 100 }}>{(a.authors||"").split(",")[0]}</td>
                    <td>{a.year}</td>
                    <td><span className={`badge ${a.q?.toLowerCase()}`}>{a.q}</span></td>
                    <td>
                      {a.uploaded
                        ? <span className="badge acc">✓ Terupload</span>
                        : <span className="badge pend">⏳ Belum</span>
                      }
                    </td>
                    <td style={{ fontSize: 10, color: a.uploaded ? "var(--green)" : "var(--muted)" }}>
                      {a.uploadedFile?.name || (a.uploaded ? "✓ Dikenali" : "—")}
                    </td>
                    <td>
                      {a.doi && <a href={`https://doi.org/${a.doi}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontSize: 10 }}>🔗 DOI</a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {uploadedCount > 0 && (
            <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <label htmlFor="bulk-upload-input" className="btn" style={{cursor:"pointer"}}>+ Tambah File Lagi</label>
              <button className="btn primary" onClick={() => setTab("prisma")}>→ Lanjut ke PRISMA ({uploadedCount} artikel)</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// TAB 4 — PRISMA 2020 (matching reference diagram)
// ═══════════════════════════════════════════════
function TabPrisma({ totalRaw, duplicates, afterDupl, rejected2, afterScreen, uploadedCount, filteredCount }) {
  const svgRef = useRef(null);

  // Compute all numbers consistently
  const n = (x) => x || 0;
  const totalRecords = n(totalRaw);
  const dupRemoved = n(duplicates);
  const afterDuplCount = n(afterDupl);
  const screenedCount = (filteredCount != null) ? n(filteredCount) : afterDuplCount;
  const autoFiltered = Math.max(0, afterDuplCount - screenedCount);
  const otherRemoved = 0;
  const screenExcluded = n(rejected2);
  const reportsSought = n(afterScreen);
  const reportsNotRetrieved = Math.max(0, n(afterScreen) - n(uploadedCount));
  const assessed = n(uploadedCount);
  const fullExcluded = 0;
  const included = n(uploadedCount);

  // ──────────────────────────────────────────
  // Build pure black-and-white SVG (for download)
  // Layout matches PRISMA 2020 reference exactly
  // ──────────────────────────────────────────
  function buildBWSvg() {
    // PRISMA 2020 - matching reference document exactly
    // Layout coordinates (precise alignment):
    //   Phase column:  x=20-48 (width=28)
    //   Left main:     x=80-340 (width=260) → center=210
    //   Right exclude: x=410-650 (width=240) → center=530
    //   Vertical flow center: x=210
    //   Horizontal arrows: from x=340 (right edge left box) to x=410 (left edge right box)
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 760" width="720" height="760" style="background:white;font-family:Arial,sans-serif">',
      '<defs>',
      '<marker id="arr" viewBox="0 0 10 10" markerWidth="9" markerHeight="9" refX="8" refY="5" orient="auto-start-reverse">',
      '<path d="M0,0 L10,5 L0,10 z" fill="#000"/>',
      '</marker>',
      '</defs>',
      '<rect width="720" height="760" fill="white"/>',

      // ── Title bar ──
      '<rect x="80" y="14" width="570" height="28" fill="white" stroke="#000" stroke-width="1.5"/>',
      '<text x="365" y="33" text-anchor="middle" font-size="13" font-weight="bold" fill="#000">Identification of studies via databases and registers</text>',

      // ── Phase labels (rotated, blue tinted in original but BW here) ──
      '<rect x="20" y="60" width="28" height="170" fill="white" stroke="#000" stroke-width="1"/>',
      '<text transform="rotate(-90,34,145)" x="34" y="148" text-anchor="middle" font-size="11" font-weight="bold" fill="#000">Identification</text>',

      '<rect x="20" y="240" width="28" height="320" fill="white" stroke="#000" stroke-width="1"/>',
      '<text transform="rotate(-90,34,400)" x="34" y="403" text-anchor="middle" font-size="11" font-weight="bold" fill="#000">Screening</text>',

      '<rect x="20" y="600" width="28" height="100" fill="white" stroke="#000" stroke-width="1"/>',
      '<text transform="rotate(-90,34,650)" x="34" y="653" text-anchor="middle" font-size="11" font-weight="bold" fill="#000">Included</text>',

      // ═══════════════════════════════════════════════════
      // ROW 1: IDENTIFICATION
      // ═══════════════════════════════════════════════════
      // Records identified (left, x=80-340)
      '<rect x="80" y="60" width="260" height="80" fill="white" stroke="#000" stroke-width="1.2"/>',
      '<text x="210" y="80" text-anchor="middle" font-size="11" fill="#000">Records identified from:</text>',
      '<text x="210" y="100" text-anchor="middle" font-size="10" fill="#000">Databases (n = ' + totalRecords + ')</text>',
      '<text x="210" y="118" text-anchor="middle" font-size="10" fill="#000">Registers (n = 0)</text>',

      // Records removed before screening (right, x=410-650)
      '<rect x="410" y="60" width="240" height="100" fill="white" stroke="#000" stroke-width="1.2"/>',
      '<text x="530" y="78" text-anchor="middle" font-size="10" font-weight="bold" fill="#000">Records removed before</text>',
      '<text x="530" y="92" text-anchor="middle" font-size="10" font-style="italic" font-weight="bold" fill="#000">screening:</text>',
      '<text x="530" y="108" text-anchor="middle" font-size="9.5" fill="#000">Duplicate records removed (n = ' + dupRemoved + ')</text>',
      '<text x="530" y="124" text-anchor="middle" font-size="9.5" fill="#000">Records marked as ineligible by</text>',
      '<text x="530" y="138" text-anchor="middle" font-size="9.5" fill="#000">automation tools (n = ' + autoFiltered + ')</text>',
      '<text x="530" y="153" text-anchor="middle" font-size="9.5" fill="#000">Records removed for other reasons (n = ' + otherRemoved + ')</text>',

      // Arrow horizontal: from x=340 (right edge of left box) to x=410 (left edge right box), at y=100
      '<line x1="340" y1="100" x2="410" y2="100" stroke="#000" stroke-width="1.2" marker-end="url(#arr)"/>',
      // Arrow vertical: from x=210, y=140 (bottom of left box) to y=250 (top of next left box)
      '<line x1="210" y1="140" x2="210" y2="248" stroke="#000" stroke-width="1.2" marker-end="url(#arr)"/>',

      // ═══════════════════════════════════════════════════
      // ROW 2: SCREENING - Records screened ↔ Records excluded
      // ═══════════════════════════════════════════════════
      '<rect x="80" y="250" width="260" height="55" fill="white" stroke="#000" stroke-width="1.2"/>',
      '<text x="210" y="275" text-anchor="middle" font-size="11" fill="#000">Records screened</text>',
      '<text x="210" y="293" text-anchor="middle" font-size="10" fill="#000">(n = ' + screenedCount + ')</text>',

      '<rect x="410" y="250" width="240" height="55" fill="white" stroke="#000" stroke-width="1.2"/>',
      '<text x="530" y="275" text-anchor="middle" font-size="11" fill="#000">Records excluded</text>',
      '<text x="530" y="293" text-anchor="middle" font-size="10" fill="#000">(n = ' + screenExcluded + ')</text>',

      // Horizontal arrow at y=277 (vertical center of boxes)
      '<line x1="340" y1="277" x2="410" y2="277" stroke="#000" stroke-width="1.2" marker-end="url(#arr)"/>',
      // Vertical arrow from x=210, y=305 (bottom of screened) to y=338 (top of next box)
      '<line x1="210" y1="305" x2="210" y2="338" stroke="#000" stroke-width="1.2" marker-end="url(#arr)"/>',

      // ═══════════════════════════════════════════════════
      // ROW 3: Reports sought for retrieval ↔ Reports not retrieved
      // ═══════════════════════════════════════════════════
      '<rect x="80" y="340" width="260" height="55" fill="white" stroke="#000" stroke-width="1.2"/>',
      '<text x="210" y="365" text-anchor="middle" font-size="11" fill="#000">Reports sought for retrieval</text>',
      '<text x="210" y="383" text-anchor="middle" font-size="10" fill="#000">(n = ' + reportsSought + ')</text>',

      '<rect x="410" y="340" width="240" height="55" fill="white" stroke="#000" stroke-width="1.2"/>',
      '<text x="530" y="365" text-anchor="middle" font-size="11" fill="#000">Reports not retrieved</text>',
      '<text x="530" y="383" text-anchor="middle" font-size="10" fill="#000">(n = ' + reportsNotRetrieved + ')</text>',

      '<line x1="340" y1="367" x2="410" y2="367" stroke="#000" stroke-width="1.2" marker-end="url(#arr)"/>',
      '<line x1="210" y1="395" x2="210" y2="428" stroke="#000" stroke-width="1.2" marker-end="url(#arr)"/>',

      // ═══════════════════════════════════════════════════
      // ROW 4: Reports assessed for eligibility ↔ Reports excluded
      // ═══════════════════════════════════════════════════
      '<rect x="80" y="430" width="260" height="55" fill="white" stroke="#000" stroke-width="1.2"/>',
      '<text x="210" y="455" text-anchor="middle" font-size="11" fill="#000">Reports assessed for eligibility</text>',
      '<text x="210" y="473" text-anchor="middle" font-size="10" fill="#000">(n = ' + assessed + ')</text>',

      '<rect x="410" y="430" width="240" height="55" fill="white" stroke="#000" stroke-width="1.2"/>',
      '<text x="530" y="455" text-anchor="middle" font-size="11" fill="#000">Reports excluded:</text>',
      '<text x="530" y="473" text-anchor="middle" font-size="10" fill="#000">(n = ' + fullExcluded + ')</text>',

      '<line x1="340" y1="457" x2="410" y2="457" stroke="#000" stroke-width="1.2" marker-end="url(#arr)"/>',
      // Long arrow down: from y=485 (bottom of assessed box) all the way to y=618 (top of included)
      '<line x1="210" y1="485" x2="210" y2="618" stroke="#000" stroke-width="1.2" marker-end="url(#arr)"/>',

      // ═══════════════════════════════════════════════════
      // INCLUDED
      // ═══════════════════════════════════════════════════
      '<rect x="80" y="620" width="260" height="75" fill="white" stroke="#000" stroke-width="1.5"/>',
      '<text x="210" y="643" text-anchor="middle" font-size="11" fill="#000">Studies included in review</text>',
      '<text x="210" y="660" text-anchor="middle" font-size="10" fill="#000">(n = ' + included + ')</text>',
      '<text x="210" y="678" text-anchor="middle" font-size="10" fill="#000">Reports of included studies</text>',
      '<text x="210" y="691" text-anchor="middle" font-size="10" fill="#000">(n = ' + included + ')</text>',

      '</svg>'
    ].join('');
  }

  function downloadAs(format) {
    const svgStr = buildBWSvg();
    if (format === "svg") {
      const blob = new Blob([svgStr], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "prisma_flow.svg"; a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const img = new Image();
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 720 * 2; canvas.height = 760 * 2;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      const mime = format === "jpg" ? "image/jpeg" : "image/png";
      const a = document.createElement("a");
      a.href = canvas.toDataURL(mime, 0.95);
      a.download = "prisma_flow." + format; a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  // Use BW SVG via dangerouslySetInnerHTML so visual matches export exactly
  return (
    <div>
      <div className="card">
        <div className="card-title">🔷 PRISMA 2020 Flow Diagram</div>
        <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
          {["svg","png","jpg","pdf"].map(f => (
            <button key={f} className="btn sm" onClick={() => f === "pdf" ? window.print() : downloadAs(f)}>
              ⬇ {f.toUpperCase()}
            </button>
          ))}
          <span style={{ fontSize: 10, color: "var(--muted)", alignSelf: "center", marginLeft: 4 }}>
            Hitam putih, sesuai standar PRISMA 2020
          </span>
        </div>

        <div style={{ overflowX: "auto", background: "white", borderRadius: 8, padding: 12 }}
             dangerouslySetInnerHTML={{ __html: buildBWSvg() }} />
      </div>

      <div className="card">
        <div className="card-title">📋 Ringkasan Numerik PRISMA</div>
        <div className="tw">
          <table>
            <thead><tr><th>Fase</th><th>Tahap</th><th>Jumlah (n)</th></tr></thead>
            <tbody>
              {[
                ["Identification","Records identified from databases",totalRecords],
                ["Identification","Records identified from registers",0],
                ["Pre-screening","Duplicate records removed",dupRemoved],
                ["Pre-screening","Marked ineligible by automation tools",autoFiltered],
                ["Pre-screening","Records removed for other reasons",otherRemoved],
                ["Screening","Records screened",screenedCount],
                ["Screening","Records excluded",screenExcluded],
                ["Screening","Reports sought for retrieval",reportsSought],
                ["Screening","Reports not retrieved",reportsNotRetrieved],
                ["Eligibility","Reports assessed for eligibility",assessed],
                ["Eligibility","Reports excluded (full-text)",fullExcluded],
                ["Included","Studies included in review",included],
                ["Included","Reports of included studies",included],
              ].map(([f,t,v]) => (
                <tr key={t}>
                  <td style={{color:"var(--muted)",fontSize:10}}>{f}</td>
                  <td style={{fontSize:11}}>{t}</td>
                  <td><strong style={{color:"var(--accent)"}}>{v}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// TAB 5 — EKSTRAKSI DATA
// ═══════════════════════════════════════════════
function TabExtract({ uploaded, extractCols, approvedCols, setApprovedCols, extractData, aiStatus, suggestCols, runExtraction, retryExtractRow, theme, setTab }) {
  const toggleCol = (col) => {
    setApprovedCols(prev => {
      const exists = prev.find(c => c.id === col.id);
      if (exists) return prev.filter(c => c.id !== col.id);
      return [...prev, col];
    });
  };
  const approveAll = () => setApprovedCols(extractCols.map(c => ({ ...c, approved: true })));

  return (
    <div>
      <div className="card">
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <div style={{ flex: 1, fontSize: 11, color: "var(--muted)" }}>
            {uploaded.length} artikel terupload siap diekstraksi — Tema: <strong style={{ color: "var(--accent)" }}>{theme}</strong>
          </div>
          <button className="btn sm primary" onClick={suggestCols} disabled={!uploaded.length || !!aiStatus}>
            {aiStatus === "cols" ? "⏳" : "✨ Rekomendasi Kolom AI"}
          </button>
        </div>

        {extractCols.length > 0 && (
          <>
            <div className="rec-box">
              <div className="rb-title">💡 Rekomendasi Kolom Ekstraksi (dari analisis artikel)</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button className="btn sm success" onClick={approveAll}>✓ Setujui Semua</button>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>{approvedCols.length} kolom dipilih</span>
              </div>
              <div className="tw">
                <table>
                  <thead><tr><th>Pilih</th><th>Nama Kolom</th><th>Deskripsi</th></tr></thead>
                  <tbody>
                    {extractCols.map(col => {
                      const isApproved = !!approvedCols.find(c => c.id === col.id);
                      return (
                        <tr key={col.id} style={isApproved ? { background: "rgba(52,211,153,.04)" } : {}}>
                          <td>
                            <input type="checkbox" checked={isApproved} onChange={() => toggleCol(col)} style={{ accentColor: "var(--green)", width: 14, height: 14 }} />
                          </td>
                          <td><strong style={{ fontSize: 11 }}>{col.label}</strong></td>
                          <td style={{ fontSize: 10, color: "var(--muted)" }}>{col.description}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn primary" onClick={runExtraction} disabled={!approvedCols.length || !!aiStatus}>
                {aiStatus === "extracting" ? "⏳ Mengekstraksi..." : `🔬 Proses Ekstraksi (${approvedCols.length} kolom)`}
              </button>
            </div>
          </>
        )}

        {!extractCols.length && !uploaded.length && (
          <div style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📤</div>
            Upload artikel terlebih dahulu di tab sebelumnya
          </div>
        )}
      </div>

      {extractData.length > 0 && (
        <div className="card">
          <div className="card-title">📊 Tabel Ekstraksi Data</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button className="btn sm" onClick={() => {
              const cols = ["No","Judul","Penulis","Tahun","Q","Jurnal",...approvedCols.map(c=>c.label)];
              const rows = extractData.map((d,i) => [
                i+1, '"'+(d.title||"").replace(/"/g,'""')+'"', '"'+(d.authors||"").replace(/"/g,'""')+'"',
                d.year, d.q, '"'+(d.journal||"").replace(/"/g,'""')+'"',
                ...approvedCols.map(c=>'"'+String(d[c.label]||"").replace(/"/g,'""')+'"')
              ]);
              const csv = [cols.join(","), ...rows.map(r=>r.join(","))].join("\n");
              const blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8"});
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href=url; a.download="ekstraksi_data.csv"; a.click();
            }}>⬇ Export CSV</button>
            <button className="btn sm" onClick={() => {
              // Build HTML table → Excel-compatible
              const cols = ["No","Judul","Penulis","Tahun","Q","Jurnal",...approvedCols.map(c=>c.label)];
              const thead = "<tr>" + cols.map(c=>"<th style=\"background:#ddd;font-weight:bold;border:1px solid #999;padding:4px\">" + c + "</th>").join("") + "</tr>";
              const tbody = extractData.map((d,i)=>{
                const cells = [i+1, d.title||"", d.authors||"", d.year, d.q, d.journal||"", ...approvedCols.map(c=>d[c.label]||"")];
                return `<tr>${cells.map(v=>"<td style=\"border:1px solid #ccc;padding:4px\">" + v + "</td>").join("")}</tr>`;
              }).join("");
              const html = `<html><head><meta charset="UTF-8"></head><body><table>${thead}${tbody}</table></body></html>`;
              const blob = new Blob([html], {type:"application/vnd.ms-excel;charset=utf-8"});
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href=url; a.download="ekstraksi_data.xls"; a.click();
            }}>⬇ Export Excel</button>
            <button className="btn sm primary" style={{ marginLeft: "auto" }} onClick={() => setTab("biblio")}>→ Bibliometrik</button>
          </div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th style={{ minWidth: 180 }}>Judul</th>
                  <th>Penulis</th>
                  <th>Tahun</th>
                  <th>Q</th>
                  <th>Jurnal</th>
                  {approvedCols.map(c => <th key={c.id} style={{ minWidth: 120 }}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {extractData.map((d, i) => (
                  <tr key={d.id} style={d._failed ? { background: "rgba(248,113,113,.06)" } : undefined}>
                    <td style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {i + 1}
                      <button className="btn xs" disabled={!!aiStatus} title="Ekstrak ulang baris ini" onClick={() => retryExtractRow(d.id)} style={{ display: "block", marginTop: 4, ...(d._failed ? { color: "var(--red)", borderColor: "var(--red)" } : {}) }}>↻</button>
                    </td>
                    <td style={{ maxWidth: 180, fontSize: 11, fontWeight: 600 }}>{d.title}</td>
                    <td style={{ fontSize: 10, color: "var(--muted)", maxWidth: 100 }}>{d.authors}</td>
                    <td>{d.year}</td>
                    <td><span className={`badge ${d.q?.toLowerCase()}`}>{d.q}</span></td>
                    <td style={{ fontSize: 10, maxWidth: 120 }}>{d.journal}</td>
                    {approvedCols.map(c => (
                      <td key={c.id} style={{ maxWidth: 150, fontSize: 10, color: d._failed ? "var(--red)" : undefined }}>{d[c.label] || "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DOWNLOAD CHART HELPER (black/white)
// ─────────────────────────────────────────────────────────────
function downloadChartBW(svgId, filename, fmt) {
  // Build a clean BW SVG from chart data passed as SVG element
  const el = document.getElementById(svgId);
  if (!el) return;
  // Clone and strip colors
  const clone = el.cloneNode(true);
  clone.setAttribute("style","background:white");
  // Walk all elements and force black stroke/fill
  clone.querySelectorAll("*").forEach(node => {
    if(node.tagName === "text") { node.setAttribute("fill","#000"); node.setAttribute("stroke","none"); }
    if(node.tagName === "rect" || node.tagName === "path" || node.tagName === "line" || node.tagName === "polyline") {
      const f = node.getAttribute("fill");
      if(f && f !== "none" && f !== "transparent") node.setAttribute("fill",f.startsWith("#fff")?"white":"#333");
      const s = node.getAttribute("stroke");
      if(s && s !== "none") node.setAttribute("stroke","#000");
    }
  });
  const svgStr = new XMLSerializer().serializeToString(clone);
  if(fmt==="svg"){
    const blob=new Blob([svgStr],{type:"image/svg+xml"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=filename+".svg";a.click();
    return;
  }
  const img=new Image();
  const blob=new Blob([svgStr],{type:"image/svg+xml"});
  const url=URL.createObjectURL(blob);
  img.onload=()=>{
    const w=el.viewBox?.baseVal?.width||600, h=el.viewBox?.baseVal?.height||400;
    const canvas=document.createElement("canvas");canvas.width=w*2;canvas.height=h*2;
    const ctx=canvas.getContext("2d");ctx.fillStyle="white";ctx.fillRect(0,0,w*2,h*2);
    ctx.scale(2,2);ctx.drawImage(img,0,0);
    const mime=fmt==="jpg"?"image/jpeg":"image/png";
    const a=document.createElement("a");a.href=canvas.toDataURL(mime,0.95);a.download=filename+"."+fmt;a.click();
    URL.revokeObjectURL(url);
  };img.src=url;
}

// Bar chart as SVG for BW export
function BarChartSVG({ id, data, maxVal, title, height=220 }) {
  const W=400, BAR_H=22, PAD=12, LBL_W=110;
  const h = PAD+data.length*(BAR_H+6)+PAD;
  return (
    <svg id={id} viewBox={`0 0 ${W} ${h}`} style={{width:"100%",maxWidth:W}} xmlns="http://www.w3.org/2000/svg">
      <rect width={W} height={h} fill="var(--bg3)"/>
      {data.map(([lbl,val],i)=>{
        const y=PAD+i*(BAR_H+6);
        const bw=Math.max(4,((val/Math.max(maxVal,1))*(W-LBL_W-PAD-40)));
        return (
          <g key={lbl}>
            <text x={LBL_W-4} y={y+BAR_H/2+4} textAnchor="end" fill="var(--muted)" fontSize="9" fontFamily="monospace">{lbl.length>16?lbl.slice(0,16)+"…":lbl}</text>
            <rect x={LBL_W} y={y} width={bw} height={BAR_H} rx="3" fill="var(--accent)" opacity="0.8"/>
            <text x={LBL_W+bw+4} y={y+BAR_H/2+4} fill="var(--text)" fontSize="9" fontWeight="700" fontFamily="monospace">{val}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════
// TAB 6 — BIBLIOMETRIK (with BW download)
// ═══════════════════════════════════════════════
function TabBiblio({ articles, accepted, theme }) {
  const yearMap = {}, qMap = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }, jMap = {}, kwMap = {};
  accepted.forEach(a => {
    yearMap[a.year] = (yearMap[a.year] || 0) + 1;
    if (qMap[a.q] !== undefined) qMap[a.q]++;
    jMap[a.journal] = (jMap[a.journal] || 0) + 1;
    (a.keywords || []).forEach(k => { kwMap[k] = (kwMap[k] || 0) + 1; });
  });
  const years = Object.entries(yearMap).sort((a, b) => a[0] - b[0]);
  const maxY = Math.max(...years.map(y => y[1]), 1);
  const topJ = Object.entries(jMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topK = Object.entries(kwMap).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const qEntries = Object.entries(qMap);
  const maxQ = Math.max(...qEntries.map(([,v])=>v),1);

  const DlBtns = ({id, name}) => (
    <div style={{display:"flex",gap:5,marginTop:8}}>
      {["svg","png","jpg","pdf"].map(f=>(
        <button key={f} className="btn xs" onClick={()=>f==="pdf"?window.print():downloadChartBW(id,name,f)}>
          ⬇{f.toUpperCase()}
        </button>
      ))}
    </div>
  );

  // Table download helper
  function downloadTableBW(tableId, name, fmt) {
    const table = document.getElementById(tableId);
    if(!table) return;
    // Build SVG from table
    const rows = table.querySelectorAll("tr");
    const W=600, ROW_H=22, PAD=10;
    let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${(rows.length+1)*ROW_H+PAD*2}" style="background:white">`;
    svg+=`<rect width="${W}" height="${(rows.length+1)*ROW_H+PAD*2}" fill="white"/>`;
    rows.forEach((row,ri)=>{
      const cells=row.querySelectorAll("th,td");
      const y=PAD+ri*ROW_H;
      if(ri===0) svg+=`<rect x="0" y="${y}" width="${W}" height="${ROW_H}" fill="#eee"/>`;
      svg+=`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#ccc" stroke-width="0.5"/>`;
      const cw=W/Math.max(cells.length,1);
      cells.forEach((cell,ci)=>{
        svg+=`<text x="${ci*cw+6}" y="${y+15}" font-family="Arial" font-size="9" fill="#000">${(cell.textContent||"").slice(0,30)}</text>`;
      });
    });
    svg+=`</svg>`;
    if(fmt==="svg"){const b=new Blob([svg],{type:"image/svg+xml"});const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=name+".svg";a.click();return;}
    const img=new Image();const b=new Blob([svg],{type:"image/svg+xml"});const u=URL.createObjectURL(b);
    img.onload=()=>{const canvas=document.createElement("canvas");canvas.width=600;canvas.height=(rows.length+1)*ROW_H+PAD*2;const ctx=canvas.getContext("2d");ctx.fillStyle="white";ctx.fillRect(0,0,600,canvas.height);ctx.drawImage(img,0,0);const a=document.createElement("a");a.href=canvas.toDataURL("image/png");a.download=name+"."+fmt;a.click();URL.revokeObjectURL(u);};img.src=u;
  }

  const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function tableWord(filename, cap, headers, rws) {
    const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
      + '@page{size:A4;margin:2.5cm 2.5cm;}'
      + 'body{font-family:"Times New Roman",Times,serif;font-size:11pt;color:#000;}'
      + 'p.cap{font-size:11pt;font-weight:bold;margin:0 0 6pt;}'
      + 'table{border-collapse:collapse;width:auto;margin:0;}'
      + 'th,td{border:1px solid #000;padding:3pt 10pt;text-align:left;vertical-align:top;font-size:11pt;}'
      + 'th{font-weight:bold;}'
      + '</style></head><body>'
      + '<p class="cap">' + esc(cap) + '</p>'
      + '<table><thead><tr>' + headers.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>'
      + rws.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('')
      + '</tbody></table></body></html>';
    const blob = new Blob([html], { type: "application/vnd.ms-word;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename + ".doc"; a.click();
    URL.revokeObjectURL(url);
  }
  const topCited = [...accepted].sort((a, b) => (b.citations || 0) - (a.citations || 0)).slice(0, 10);
  const WBtn = ({ onClick }) => <button className="btn xs" onClick={onClick} style={{ marginTop: 8 }}>⬇ Word</button>;

  return (
    <div>
      <div className="grid3" style={{ marginBottom: 14 }}>
        {[
          { val: accepted.length, lbl: "Artikel Inklusi" },
          { val: [...new Set(accepted.map(a => a.journal))].length, lbl: "Jurnal Unik" },
          { val: [...new Set(accepted.map(a => a.year))].length, lbl: "Tahun Tercakup" },
          { val: accepted.filter(a => a.q === "Q1").length, lbl: "Artikel Q1" },
          { val: accepted.reduce((s, a) => s + (a.citations || 0), 0), lbl: "Total Sitasi" },
          { val: Math.round(accepted.reduce((s, a) => s + (a.citations || 0), 0) / Math.max(accepted.length, 1)), lbl: "Rata-rata Sitasi" },
        ].map(s => <div key={s.lbl} className="stat-card"><div className="val">{s.val}</div><div className="lbl">{s.lbl}</div></div>)}
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-title">📅 Distribusi Tahun Publikasi</div>
          <div className="tw"><table><thead><tr><th>Tahun</th><th>Jumlah</th></tr></thead><tbody>
            {years.map(([y, c]) => <tr key={y}><td>{y}</td><td><strong>{c}</strong></td></tr>)}
          </tbody></table></div>
          <WBtn onClick={() => tableWord("tabel_distribusi_tahun", "Tabel 1. Distribusi tahun publikasi", ["Tahun", "Jumlah"], years.map(([y, c]) => [y, c]))} />
        </div>
        <div className="card">
          <div className="card-title">🏆 Distribusi Q-Index</div>
          <div className="tw"><table><thead><tr><th>Q-Index</th><th>Jumlah</th></tr></thead><tbody>
            {qEntries.map(([q, c]) => <tr key={q}><td>{q}</td><td><strong>{c}</strong></td></tr>)}
          </tbody></table></div>
          <WBtn onClick={() => tableWord("tabel_distribusi_q", "Tabel 2. Distribusi Q-Index (Scimago)", ["Q-Index", "Jumlah"], qEntries.map(([q, c]) => [q, c]))} />
        </div>
        <div className="card">
          <div className="card-title">📰 Top Jurnal</div>
          <div className="tw"><table><thead><tr><th>Jurnal</th><th>Artikel</th></tr></thead><tbody>
            {topJ.map(([j, c]) => <tr key={j}><td style={{ fontSize: 10 }}>{j}</td><td><strong>{c}</strong></td></tr>)}
          </tbody></table></div>
          <WBtn onClick={() => tableWord("tabel_top_jurnal", "Tabel 3. Jurnal dengan kontribusi terbanyak", ["Jurnal", "Jumlah Artikel"], topJ.map(([j, c]) => [j, c]))} />
        </div>
        <div className="card">
          <div className="card-title">🏷️ Frekuensi Keyword</div>
          <div className="tw"><table><thead><tr><th>Kata Kunci</th><th>Frek.</th></tr></thead><tbody>
            {topK.map(([k, c]) => <tr key={k}><td style={{ fontSize: 10 }}>{k}</td><td><strong>{c}</strong></td></tr>)}
          </tbody></table></div>
          <WBtn onClick={() => tableWord("tabel_keyword", "Tabel 4. Frekuensi kata kunci", ["Kata Kunci", "Frekuensi"], topK.map(([k, c]) => [k, c]))} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">📈 Artikel Paling Banyak Disitasi</div>
        <div className="tw">
          <table>
            <thead><tr><th>Judul</th><th>Penulis</th><th>Tahun</th><th>Jurnal</th><th>Q</th><th>Sitasi</th></tr></thead>
            <tbody>
              {topCited.map(a => (
                <tr key={a.id}>
                  <td style={{ maxWidth: 200, fontSize: 11 }}>{a.title}</td>
                  <td style={{ fontSize: 10, color: "var(--muted)" }}>{(a.authors || "").split(",")[0]}</td>
                  <td>{a.year}</td>
                  <td style={{ fontSize: 10 }}>{a.journal}</td>
                  <td><span className={`badge ${a.q?.toLowerCase()}`}>{a.q}</span></td>
                  <td><strong style={{ color: "var(--accent)" }}>{a.citations || 0}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <WBtn onClick={() => tableWord("tabel_sitasi", "Tabel 5. Artikel paling banyak disitasi", ["Judul", "Penulis", "Tahun", "Jurnal", "Q", "Sitasi"], topCited.map(a => [a.title, (a.authors || "").split(",")[0], a.year, a.journal, a.q, a.citations || 0]))} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// TAB 7 — FRAMEWORK / MODEL (horizontal, BW download)
// ═══════════════════════════════════════════════
function TabFramework({ framework, extractData, aiStatus, generateFramework, uploaded }) {
  function buildFrameworkSVG(fw) {
    if (!fw) return "";
    const cols = [
      { key:"inputs",    label:"ANTESEDEN",  items: fw.inputs    || [] },
      { key:"mediators", label:"MEDIATOR",   items: fw.mediators || [] },
      { key:"process",   label:"PROSES",     items: fw.process   || fw.mediators?.slice(0,1) || ["Knowledge Transfer"] },
      { key:"outputs",   label:"OUTCOME",    items: fw.outputs   || [] },
    ];
    const mods = fw.moderators || [];
    const COL_W = 140, COL_GAP = 50, PAD = 20;
    const ITEM_H = 36, ITEM_GAP = 10;
    const maxItems = Math.max(...cols.map(c=>c.items.length), 1);
    const colH = PAD + maxItems * (ITEM_H + ITEM_GAP) + PAD;
    const totalW = cols.length * COL_W + (cols.length - 1) * COL_GAP + PAD * 2;
    const modH = mods.length > 0 ? 60 : 0;
    const totalH = 60 + colH + modH + 20;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" style="background:white">
<rect width="${totalW}" height="${totalH}" fill="white"/>
<!-- Title -->
<text x="${totalW/2}" y="24" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="#000">${fw.title||"Research Framework"}</text>
<line x1="20" y1="32" x2="${totalW-20}" y2="32" stroke="#000" stroke-width="0.5"/>`;

    const colTops = [];
    // Draw columns
    cols.forEach((col, ci) => {
      const cx = PAD + ci * (COL_W + COL_GAP);
      colTops.push(cx);
      // Column header box
      svg += `<rect x="${cx}" y="40" width="${COL_W}" height="22" rx="3" fill="#333"/>`;
      svg += `<text x="${cx+COL_W/2}" y="55" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="bold" fill="#fff">${col.label}</text>`;
      // Items
      col.items.forEach((item, ii) => {
        const iy = 72 + ii * (ITEM_H + ITEM_GAP);
        svg += `<rect x="${cx}" y="${iy}" width="${COL_W}" height="${ITEM_H}" rx="3" fill="none" stroke="#000" stroke-width="1"/>`;
        // Wrap long text
        const words = item.split(" ");
        let line1 = "", line2 = "";
        words.forEach(w => {
          if ((line1+" "+w).trim().length < 18) line1 = (line1+" "+w).trim();
          else line2 = (line2+" "+w).trim();
        });
        svg += `<text x="${cx+COL_W/2}" y="${iy+14}" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" fill="#000">${line1}</text>`;
        if (line2) svg += `<text x="${cx+COL_W/2}" y="${iy+26}" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" fill="#000">${line2}</text>`;
      });
      // Arrow to next column
      if (ci < cols.length - 1) {
        const ax = cx + COL_W + 4;
        const ay = 72 + ((Math.max(...cols.map(c=>c.items.length),1)-1)/2) * (ITEM_H+ITEM_GAP) + ITEM_H/2;
        svg += `<line x1="${ax}" y1="${ay}" x2="${ax+COL_GAP-8}" y2="${ay}" stroke="#000" stroke-width="1.2" marker-end="url(#bwarr)"/>`;
      }
    });

    // Moderator box at bottom
    if (mods.length > 0) {
      const my = 72 + maxItems*(ITEM_H+ITEM_GAP) + 20;
      svg += `<rect x="${PAD}" y="${my}" width="${totalW-PAD*2}" height="44" rx="3" fill="none" stroke="#000" stroke-width="1" stroke-dasharray="5,3"/>`;
      svg += `<text x="${totalW/2}" y="${my+14}" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="bold" fill="#000">MODERATOR</text>`;
      const mtext = mods.join("  ·  ");
      svg += `<text x="${totalW/2}" y="${my+30}" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" fill="#000">${mtext.slice(0,80)}</text>`;
    }

    svg += `<defs><marker id="bwarr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#000"/></marker></defs>`;
    svg += `</svg>`;
    return svg;
  }

  function downloadFW(fmt) {
    const svg = buildFrameworkBwSvg(framework);
    if (!svg) return;
    if (fmt === "svg") {
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = "framework.svg"; a.click(); return;
    }
    const mm = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    const W = mm ? parseFloat(mm[1]) : 900, H = mm ? parseFloat(mm[2]) : 500;
    const img = new Image();
    const blob = new Blob([svg], { type: "image/svg+xml" }); const url = URL.createObjectURL(blob);
    img.onload = () => {
      const canvas = document.createElement("canvas"); canvas.width = W * 2; canvas.height = H * 2;
      const ctx = canvas.getContext("2d"); ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2); ctx.drawImage(img, 0, 0);
      const mime = fmt === "jpg" ? "image/jpeg" : "image/png";
      const a = document.createElement("a"); a.href = canvas.toDataURL(mime, 0.95); a.download = "framework." + fmt; a.click();
      URL.revokeObjectURL(url);
    }; img.src = url;
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontFamily: "var(--fh)", fontWeight: 700 }}>🗺️ Research Framework — Horizontal Flow</div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>Disintesis dari {uploaded.length} artikel · Diagram mengalir dari kiri ke kanan</div>
          </div>
          <button className="btn primary" onClick={generateFramework} disabled={!extractData.length || !!aiStatus}>
            {aiStatus === "framework" ? "⏳ Mensintesis..." : "✨ Generate Framework AI"}
          </button>
        </div>

        {!framework && !extractData.length && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🗺️</div>
            <div>Lakukan ekstraksi data terlebih dahulu</div>
          </div>
        )}

        {framework && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "var(--fh)", fontSize: 14, fontWeight: 700 }}>{framework.title}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{framework.description}</div>
            </div>

            {/* Horizontal flow diagram */}
            <div style={{ overflowX: "auto", background: "var(--bg3)", borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 0, minWidth: 700 }}>
                {[
                  { label: "ANTESEDEN", items: framework.inputs||[], color: "#34d399", border: "#34d399" },
                  { label: "MEDIATOR",  items: framework.mediators||[], color: "#a78bfa", border: "#a78bfa" },
                  { label: "PROSES",    items: framework.process||[], color: "#4f9cf9", border: "#4f9cf9" },
                  { label: "OUTCOME",   items: framework.outputs||[], color: "#fbbf24", border: "#fbbf24" },
                ].filter(c => (c.items||[]).length > 0).map((col, ci, arr) => (
                  <div key={col.label} style={{ display: "flex", alignItems: "center", flex: ci===arr.length-1?1:"auto" }}>
                    {/* Column */}
                    <div style={{ minWidth: 150, maxWidth: 170 }}>
                      <div style={{ background: col.color + "22", border: `1.5px solid ${col.border}`, borderRadius: "6px 6px 0 0", padding: "5px 10px", textAlign: "center" }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: col.color, letterSpacing: 1 }}>{col.label}</div>
                      </div>
                      <div style={{ border: `1.5px solid ${col.border}`, borderTop: "none", borderRadius: "0 0 6px 6px", padding: "6px 8px" }}>
                        {col.items.map((item, ii) => (
                          <div key={ii} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 4, padding: "5px 8px", marginBottom: ii<col.items.length-1?5:0, fontSize: 10 }}>
                            {item}
                          </div>
                        ))}
                        {col.items.length === 0 && <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", padding: 8 }}>—</div>}
                      </div>
                    </div>
                    {/* Arrow */}
                    {ci < arr.length - 1 && (
                      <div style={{ padding: "0 8px", fontSize: 20, color: "var(--muted)", alignSelf: "center" }}>→</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Moderator bar */}
              {(framework.moderators||[]).length > 0 && (
                <div style={{ marginTop: 14, border: "1.5px dashed rgba(251,191,36,.4)", borderRadius: 7, padding: "8px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "var(--amber)", marginBottom: 5, letterSpacing: 1 }}>MODERATOR</div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    {framework.moderators.map(m => (
                      <span key={m} style={{ background: "rgba(251,191,36,.1)", border: "1px solid rgba(251,191,36,.3)", borderRadius: 4, padding: "3px 10px", fontSize: 10, color: "var(--amber)" }}>{m}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Download buttons */}
            <div style={{ display: "flex", gap: 7, marginTop: 12 }}>
              {["svg","png","jpg","pdf"].map(f => (
                <button key={f} className="btn sm" onClick={() => f==="pdf"?window.print():downloadFW(f)}>⬇ {f.toUpperCase()}</button>
              ))}
              <span style={{ fontSize: 10, color: "var(--muted)", alignSelf: "center" }}>Hitam putih, background putih</span>
            </div>

            {/* Propositions */}
            {(framework.propositions||[]).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: "var(--accent)" }}>📌 Proposisi Penelitian</div>
                {framework.propositions.map((p, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "7px 10px", background: "var(--bg3)", borderRadius: 6, marginBottom: 5, fontSize: 11 }}>
                    <span style={{ color: "var(--accent)", fontWeight: 700, flexShrink: 0 }}>P{i+1}</span>
                    <span>{p.replace(/^P\d+[:\s]+/,"")}</span>
                  </div>
                ))}
              </div>
            )}

            {framework.synthesis && (
              <div style={{ marginTop: 14, padding: "12px 15px", background: "rgba(167,139,250,.05)", border: "1px solid rgba(167,139,250,.2)", borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent2)", marginBottom: 5 }}>🔮 TEMUAN SINTESIS UNIK</div>
                <div style={{ fontSize: 12, fontFamily: "var(--fs)", lineHeight: 1.8 }}>{framework.synthesis}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// WORD DOWNLOAD HELPER
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// SVG → BASE64 PNG (synchronous via canvas, used for Word embed)
// ─────────────────────────────────────────────────────────────
async function svgToPngDataUrl(svgString, width, height) {
  return new Promise((resolve) => {
    try {
      const blob = new Blob([svgString], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width * 2;
        canvas.height = height * 2;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(""); };
      img.src = url;
    } catch (e) { resolve(""); }
  });
}

// Build PRISMA SVG (BW) — precise alignment matching PRISMA 2020 reference
function buildPrismaSvg(prismaData) {
  const n = (x) => x || 0;
  const totalRecords = n(prismaData.totalRaw);
  const dupRemoved = n(prismaData.duplicates);
  const afterDuplCount = n(prismaData.afterDupl);
  const screenedCount = (prismaData.filteredCount != null) ? n(prismaData.filteredCount) : afterDuplCount;
  const autoFiltered = Math.max(0, afterDuplCount - screenedCount);
  const otherRemoved = 0;
  const screenExcluded = n(prismaData.rejected2);
  const reportsSought = n(prismaData.afterScreen);
  const reportsNotRetrieved = Math.max(0, n(prismaData.afterScreen) - n(prismaData.uploadedCount));
  const assessed = n(prismaData.uploadedCount);
  const fullExcluded = 0;
  const included = n(prismaData.uploadedCount);

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 760" width="720" height="760" style="background:white;font-family:Arial,sans-serif">',
    '<defs>',
    '<marker id="arr" viewBox="0 0 10 10" markerWidth="9" markerHeight="9" refX="8" refY="5" orient="auto-start-reverse">',
    '<path d="M0,0 L10,5 L0,10 z" fill="#000"/>',
    '</marker>',
    '</defs>',
    '<rect width="720" height="760" fill="white"/>',

    // Title
    '<rect x="80" y="14" width="570" height="28" fill="white" stroke="#000" stroke-width="1.5"/>',
    '<text x="365" y="33" text-anchor="middle" font-size="13" font-weight="bold" fill="#000">Identification of studies via databases and registers</text>',

    // Phase labels
    '<rect x="20" y="60" width="28" height="170" fill="white" stroke="#000" stroke-width="1"/>',
    '<text transform="rotate(-90,34,145)" x="34" y="148" text-anchor="middle" font-size="11" font-weight="bold" fill="#000">Identification</text>',
    '<rect x="20" y="240" width="28" height="320" fill="white" stroke="#000" stroke-width="1"/>',
    '<text transform="rotate(-90,34,400)" x="34" y="403" text-anchor="middle" font-size="11" font-weight="bold" fill="#000">Screening</text>',
    '<rect x="20" y="600" width="28" height="100" fill="white" stroke="#000" stroke-width="1"/>',
    '<text transform="rotate(-90,34,650)" x="34" y="653" text-anchor="middle" font-size="11" font-weight="bold" fill="#000">Included</text>',

    // Row 1: Identification
    '<rect x="80" y="60" width="260" height="80" fill="white" stroke="#000" stroke-width="1.2"/>',
    '<text x="210" y="80" text-anchor="middle" font-size="11" fill="#000">Records identified from:</text>',
    '<text x="210" y="100" text-anchor="middle" font-size="10" fill="#000">Databases (n = ' + totalRecords + ')</text>',
    '<text x="210" y="118" text-anchor="middle" font-size="10" fill="#000">Registers (n = 0)</text>',
    '<rect x="410" y="60" width="240" height="100" fill="white" stroke="#000" stroke-width="1.2"/>',
    '<text x="530" y="78" text-anchor="middle" font-size="10" font-weight="bold" fill="#000">Records removed before</text>',
    '<text x="530" y="92" text-anchor="middle" font-size="10" font-style="italic" font-weight="bold" fill="#000">screening:</text>',
    '<text x="530" y="108" text-anchor="middle" font-size="9.5" fill="#000">Duplicate records removed (n = ' + dupRemoved + ')</text>',
    '<text x="530" y="124" text-anchor="middle" font-size="9.5" fill="#000">Records marked as ineligible by</text>',
    '<text x="530" y="138" text-anchor="middle" font-size="9.5" fill="#000">automation tools (n = ' + autoFiltered + ')</text>',
    '<text x="530" y="153" text-anchor="middle" font-size="9.5" fill="#000">Records removed for other reasons (n = ' + otherRemoved + ')</text>',
    '<line x1="340" y1="100" x2="410" y2="100" stroke="#000" stroke-width="1.2" marker-end="url(#arr)"/>',
    '<line x1="210" y1="140" x2="210" y2="248" stroke="#000" stroke-width="1.2" marker-end="url(#arr)"/>',

    // Row 2: Screening
    '<rect x="80" y="250" width="260" height="55" fill="white" stroke="#000" stroke-width="1.2"/>',
    '<text x="210" y="275" text-anchor="middle" font-size="11" fill="#000">Records screened</text>',
    '<text x="210" y="293" text-anchor="middle" font-size="10" fill="#000">(n = ' + screenedCount + ')</text>',
    '<rect x="410" y="250" width="240" height="55" fill="white" stroke="#000" stroke-width="1.2"/>',
    '<text x="530" y="275" text-anchor="middle" font-size="11" fill="#000">Records excluded</text>',
    '<text x="530" y="293" text-anchor="middle" font-size="10" fill="#000">(n = ' + screenExcluded + ')</text>',
    '<line x1="340" y1="277" x2="410" y2="277" stroke="#000" stroke-width="1.2" marker-end="url(#arr)"/>',
    '<line x1="210" y1="305" x2="210" y2="338" stroke="#000" stroke-width="1.2" marker-end="url(#arr)"/>',

    // Row 3: Reports sought
    '<rect x="80" y="340" width="260" height="55" fill="white" stroke="#000" stroke-width="1.2"/>',
    '<text x="210" y="365" text-anchor="middle" font-size="11" fill="#000">Reports sought for retrieval</text>',
    '<text x="210" y="383" text-anchor="middle" font-size="10" fill="#000">(n = ' + reportsSought + ')</text>',
    '<rect x="410" y="340" width="240" height="55" fill="white" stroke="#000" stroke-width="1.2"/>',
    '<text x="530" y="365" text-anchor="middle" font-size="11" fill="#000">Reports not retrieved</text>',
    '<text x="530" y="383" text-anchor="middle" font-size="10" fill="#000">(n = ' + reportsNotRetrieved + ')</text>',
    '<line x1="340" y1="367" x2="410" y2="367" stroke="#000" stroke-width="1.2" marker-end="url(#arr)"/>',
    '<line x1="210" y1="395" x2="210" y2="428" stroke="#000" stroke-width="1.2" marker-end="url(#arr)"/>',

    // Row 4: Reports assessed
    '<rect x="80" y="430" width="260" height="55" fill="white" stroke="#000" stroke-width="1.2"/>',
    '<text x="210" y="455" text-anchor="middle" font-size="11" fill="#000">Reports assessed for eligibility</text>',
    '<text x="210" y="473" text-anchor="middle" font-size="10" fill="#000">(n = ' + assessed + ')</text>',
    '<rect x="410" y="430" width="240" height="55" fill="white" stroke="#000" stroke-width="1.2"/>',
    '<text x="530" y="455" text-anchor="middle" font-size="11" fill="#000">Reports excluded:</text>',
    '<text x="530" y="473" text-anchor="middle" font-size="10" fill="#000">(n = ' + fullExcluded + ')</text>',
    '<line x1="340" y1="457" x2="410" y2="457" stroke="#000" stroke-width="1.2" marker-end="url(#arr)"/>',
    '<line x1="210" y1="485" x2="210" y2="618" stroke="#000" stroke-width="1.2" marker-end="url(#arr)"/>',

    // Included
    '<rect x="80" y="620" width="260" height="75" fill="white" stroke="#000" stroke-width="1.5"/>',
    '<text x="210" y="643" text-anchor="middle" font-size="11" fill="#000">Studies included in review</text>',
    '<text x="210" y="660" text-anchor="middle" font-size="10" fill="#000">(n = ' + included + ')</text>',
    '<text x="210" y="678" text-anchor="middle" font-size="10" fill="#000">Reports of included studies</text>',
    '<text x="210" y="691" text-anchor="middle" font-size="10" fill="#000">(n = ' + included + ')</text>',

    '</svg>'
  ].join('');
}

// Build Framework SVG (BW horizontal flow) for Word embed
function buildFrameworkBwSvg(fw) {
  if (!fw) return "";
  const cols = [
    { label: "ANTESEDEN", items: (fw.inputs || []).filter(Boolean) },
    { label: "MEDIATOR", items: (fw.mediators || []).filter(Boolean) },
    { label: "PROSES", items: (fw.process || []).filter(Boolean) },
    { label: "OUTCOME", items: (fw.outputs || []).filter(Boolean) },
  ].filter(c => c.items.length > 0 || c.label === "ANTESEDEN" || c.label === "OUTCOME");
  const mods = (fw.moderators || []).filter(Boolean);

  const PAD = 24, GW = 168, GGAP = 50, HH = 26, ITEM_H = 38, ITEM_GAP = 8, TITLE_H = 46;
  const maxItems = Math.max(...cols.map(c => c.items.length), 1);
  const contentH = maxItems * (ITEM_H + ITEM_GAP) + ITEM_GAP;
  const groupH = HH + contentH;
  const GY = TITLE_H + 10;
  const centerY = GY + groupH / 2;
  const modH = mods.length ? 64 : 0;
  const totalW = PAD * 2 + cols.length * GW + (cols.length - 1) * GGAP;
  const totalH = GY + groupH + (mods.length ? (46 + modH) : 0) + PAD;

  const esc = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const wrap = (txt, max) => {
    const words = String(txt).split(" "); const lines = []; let cur = "";
    words.forEach(w => { if ((cur + " " + w).trim().length <= max) cur = (cur + " " + w).trim(); else { if (cur) lines.push(cur); cur = w; } });
    if (cur) lines.push(cur);
    return lines.slice(0, 2);
  };

  let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + totalW + ' ' + totalH + '" width="' + totalW + '" height="' + totalH + '" style="background:white">'
    + '<defs><marker id="fwarr" markerWidth="11" markerHeight="9" refX="9" refY="4.5" orient="auto"><path d="M0,0 L11,4.5 L0,9 Z" fill="#000"/></marker></defs>'
    + '<rect width="' + totalW + '" height="' + totalH + '" fill="white"/>'
    + '<text x="' + (totalW / 2) + '" y="26" text-anchor="middle" font-family="Times New Roman,serif" font-size="14" font-weight="bold" fill="#000">' + esc(fw.title || "Kerangka Konseptual") + '</text>'
    + '<line x1="' + PAD + '" y1="' + (TITLE_H - 6) + '" x2="' + (totalW - PAD) + '" y2="' + (TITLE_H - 6) + '" stroke="#000" stroke-width="0.6"/>';

  cols.forEach((col, ci) => {
    const gx = PAD + ci * (GW + GGAP);
    // kotak pengelompokan (container)
    svg += '<rect x="' + gx + '" y="' + GY + '" width="' + GW + '" height="' + groupH + '" rx="7" fill="white" stroke="#000" stroke-width="1.6"/>';
    // header strip (dengan sudut atas membulat, bawah lurus)
    svg += '<path d="M ' + gx + ' ' + (GY + 7) + ' a 7 7 0 0 1 7 -7 h ' + (GW - 14) + ' a 7 7 0 0 1 7 7 v ' + (HH - 7) + ' h -' + GW + ' z" fill="#000"/>';
    svg += '<text x="' + (gx + GW / 2) + '" y="' + (GY + 18) + '" text-anchor="middle" font-family="Times New Roman,serif" font-size="11" font-weight="bold" fill="#fff">' + col.label + '</text>';
    if (col.items.length === 0) {
      svg += '<text x="' + (gx + GW / 2) + '" y="' + (GY + HH + 28) + '" text-anchor="middle" font-family="Times New Roman,serif" font-size="10" fill="#777">(tidak ditemukan)</text>';
    }
    col.items.forEach((item, ii) => {
      const iy = GY + HH + ITEM_GAP + ii * (ITEM_H + ITEM_GAP);
      const ix = gx + 11, iw = GW - 22;
      svg += '<rect x="' + ix + '" y="' + iy + '" width="' + iw + '" height="' + ITEM_H + '" rx="4" fill="white" stroke="#000" stroke-width="1"/>';
      const lines = wrap(item, 22); const xc = gx + GW / 2;
      if (lines.length > 1) {
        svg += '<text x="' + xc + '" y="' + (iy + 16) + '" text-anchor="middle" font-family="Times New Roman,serif" font-size="10" fill="#000">' + esc(lines[0]) + '</text>';
        svg += '<text x="' + xc + '" y="' + (iy + 30) + '" text-anchor="middle" font-family="Times New Roman,serif" font-size="10" fill="#000">' + esc(lines[1]) + '</text>';
      } else {
        svg += '<text x="' + xc + '" y="' + (iy + ITEM_H / 2 + 4) + '" text-anchor="middle" font-family="Times New Roman,serif" font-size="10" fill="#000">' + esc(lines[0] || "") + '</text>';
      }
    });
    if (ci < cols.length - 1) {
      const x1 = gx + GW, x2 = gx + GW + GGAP;
      svg += '<line x1="' + (x1 + 3) + '" y1="' + centerY + '" x2="' + (x2 - 3) + '" y2="' + centerY + '" stroke="#000" stroke-width="1.7" marker-end="url(#fwarr)"/>';
    }
  });

  if (mods.length) {
    const gi = Math.max(0, Math.floor(cols.length / 2) - 1);
    let gapX = PAD + gi * (GW + GGAP) + GW + GGAP / 2;
    const mw = Math.min(totalW - PAD * 2, GW * 2);
    let mx = gapX - mw / 2;
    if (mx < PAD) mx = PAD; if (mx + mw > totalW - PAD) mx = totalW - PAD - mw;
    const myTop = GY + groupH + 46;
    // panah putus-putus dari kotak moderator naik ke garis alur
    svg += '<line x1="' + gapX + '" y1="' + myTop + '" x2="' + gapX + '" y2="' + (centerY + 4) + '" stroke="#000" stroke-width="1.4" stroke-dasharray="5,4" marker-end="url(#fwarr)"/>';
    svg += '<rect x="' + mx + '" y="' + myTop + '" width="' + mw + '" height="' + modH + '" rx="7" fill="white" stroke="#000" stroke-width="1.4" stroke-dasharray="6,4"/>';
    svg += '<text x="' + (mx + mw / 2) + '" y="' + (myTop + 21) + '" text-anchor="middle" font-family="Times New Roman,serif" font-size="11" font-weight="bold" fill="#000">MODERATOR</text>';
    const mlines = wrap(mods.join(" · "), 56);
    mlines.forEach((ln, li) => { svg += '<text x="' + (mx + mw / 2) + '" y="' + (myTop + 40 + li * 15) + '" text-anchor="middle" font-family="Times New Roman,serif" font-size="10" fill="#000">' + esc(ln) + '</text>'; });
  }

  return svg + '</svg>';
}

// Build year distribution chart SVG (BW)
function buildYearChartSvg(accepted) {
  const yearMap = {};
  accepted.forEach(a => { yearMap[a.year] = (yearMap[a.year] || 0) + 1; });
  const years = Object.entries(yearMap).sort((a, b) => a[0] - b[0]);
  if (years.length === 0) return "";
  const maxV = Math.max(...years.map(([, v]) => v), 1);
  const W = 500, BAR_H = 24, GAP = 8, PAD = 30, LBL_W = 60;
  const H = PAD + years.length * (BAR_H + GAP) + PAD;
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" style="background:white">'
    + '<rect width="' + W + '" height="' + H + '" fill="white"/>'
    + '<text x="' + (W / 2) + '" y="20" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" font-weight="bold" fill="#000">Distribusi Publikasi per Tahun</text>';
  years.forEach(([y, c], i) => {
    const yy = PAD + i * (BAR_H + GAP);
    const bw = (c / maxV) * (W - LBL_W - PAD - 40);
    svg += '<text x="' + (LBL_W - 5) + '" y="' + (yy + BAR_H / 2 + 4) + '" text-anchor="end" font-family="Arial,sans-serif" font-size="10" fill="#000">' + y + '</text>';
    svg += '<rect x="' + LBL_W + '" y="' + yy + '" width="' + bw + '" height="' + BAR_H + '" fill="#333" stroke="#000" stroke-width="0.5"/>';
    svg += '<text x="' + (LBL_W + bw + 5) + '" y="' + (yy + BAR_H / 2 + 4) + '" font-family="Arial,sans-serif" font-size="10" font-weight="bold" fill="#000">' + c + '</text>';
  });
  return svg + '</svg>';
}

// ─────────────────────────────────────────────────────────────
// CLEAN MARKDOWN → WORD HTML CONVERTER
// Strips ** ## [TABEL N:] [GAMBAR N:] markers and renders clean
// ─────────────────────────────────────────────────────────────
function markdownToWordHtml(text, embedMap) {
  if (!text) return "";
  const lines = text.split("\n");
  let html = "";
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Markdown table
    if (trimmed.startsWith("|")) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]); i++;
      }
      const rows = tableLines.filter(l => !l.match(/^[\s|:\-]+$/));
      if (rows.length > 0) {
        const parsed = rows.map(r =>
          r.split("|").filter((_, ci, a) => ci > 0 && ci < a.length - 1).map(c => c.trim())
        );
        const [hd, ...bd] = parsed;
        html += '<table><thead><tr>'
          + hd.map(h => '<th>' + cleanInline(h) + '</th>').join("")
          + '</tr></thead><tbody>'
          + bd.map(r => '<tr>' + r.map(c => '<td>' + cleanInline(c) + '</td>').join("") + '</tr>').join("")
          + '</tbody></table>';
      }
      continue;
    }

    // Figure/Table caption with embed marker
    const figMatch = trimmed.match(/^\*?\*?\[?(GAMBAR|Gambar|TABEL|Tabel)\s*(\d+)[:\s]+(.*?)\]?\*?\*?\.?$/);
    if (figMatch) {
      const isFig = figMatch[1].toUpperCase() === "GAMBAR";
      const num = figMatch[2];
      const caption = figMatch[3].replace(/[\*\]]+$/g, "").trim();

      // Try to embed real image based on caption keywords
      let embedded = "";
      if (embedMap && isFig) {
        const captionLower = caption.toLowerCase();
        if (captionLower.includes("prisma") && embedMap.prisma) {
          embedded = '<div style="text-align:center;margin:14pt 0"><img src="' + embedMap.prisma + '" style="max-width:480pt;width:100%" alt="PRISMA Flow"/></div>';
        } else if ((captionLower.includes("framework") || captionLower.includes("konseptual") || captionLower.includes("model")) && embedMap.framework) {
          embedded = '<div style="text-align:center;margin:14pt 0"><img src="' + embedMap.framework + '" style="max-width:520pt;width:100%" alt="Framework"/></div>';
        } else if ((captionLower.includes("distribusi") || captionLower.includes("tahun") || captionLower.includes("publikasi")) && embedMap.yearChart) {
          embedded = '<div style="text-align:center;margin:14pt 0"><img src="' + embedMap.yearChart + '" style="max-width:440pt;width:100%" alt="Year Distribution"/></div>';
        }
      }

      if (embedded) {
        html += embedded;
        html += '<p class="caption"><strong>' + (isFig ? "Gambar" : "Tabel") + ' ' + num + '.</strong> ' + caption + '</p>';
      } else {
        html += '<p class="caption"><strong>' + (isFig ? "Gambar" : "Tabel") + ' ' + num + '.</strong> ' + caption + '</p>';
      }
      i++;
      continue;
    }

    // Heading ## or ###
    if (trimmed.startsWith("### ")) {
      html += '<h3>' + cleanInline(trimmed.slice(4)) + '</h3>'; i++; continue;
    }
    if (trimmed.startsWith("## ")) {
      html += '<h2>' + cleanInline(trimmed.slice(3)) + '</h2>'; i++; continue;
    }

    // Empty line
    if (!trimmed) { i++; continue; }

    // Regular paragraph
    html += '<p>' + cleanInline(trimmed) + '</p>';
    i++;
  }
  return html;
}

// Clean inline markdown markers (bold, brackets, asterisks)
function cleanInline(text) {
  if (!text) return "";
  return text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "$1");
}

// ─────────────────────────────────────────────────────────────
// MAIN WORD DOWNLOADER (with embedded images)
// ─────────────────────────────────────────────────────────────
async function downloadWordWithAssets({ filename, theme, authors, narasiSteps, accepted, tpl, prismaData, framework, useTrans, translated }) {
  // Step 1: Build all SVG assets and convert to PNG data URLs
  const prismaSvg = buildPrismaSvg(prismaData);
  const fwSvg = framework ? buildFrameworkBwSvg(framework) : "";
  const yearSvg = buildYearChartSvg(accepted);

  const [prismaPng, fwPng, yearPng] = await Promise.all([
    svgToPngDataUrl(prismaSvg, 720, 760),
    fwSvg ? svgToPngDataUrl(fwSvg, 720, 360) : Promise.resolve(""),
    yearSvg ? svgToPngDataUrl(yearSvg, 500, 300) : Promise.resolve(""),
  ]);

  const embedMap = { prisma: prismaPng, framework: fwPng, yearChart: yearPng };

  // Step 2: Build header (title + authors)
  const validAuthors = authors.filter(a => a.name && a.name.trim());
  let authorsHtml = "";
  if (validAuthors.length > 0) {
    const namesLine = validAuthors.map((a, i) =>
      a.name + (validAuthors.length > 1 ? '<sup>' + (i + 1) + '</sup>' : "")
    ).join(", ");
    authorsHtml += '<p class="authors">' + namesLine + '</p>';
    validAuthors.forEach((a, i) => {
      if (a.affil || a.email) {
        authorsHtml += '<p class="affil">'
          + (validAuthors.length > 1 ? '<sup>' + (i + 1) + '</sup> ' : "")
          + (a.affil || "") + (a.email ? ', ' + a.email : "") + '</p>';
      }
    });
  }

  // Step 3: Compose full HTML body
  const src = useTrans ? translated : narasiSteps;
  const sectionTitles = {
    pendahuluan: useTrans ? "1. Introduction" : "1. Pendahuluan",
    metode: useTrans ? "2. Research Methods" : "2. Metode Penelitian",
    hasil: useTrans ? "3. Results and Discussion" : "3. Hasil dan Pembahasan",
    kesimpulan: useTrans ? "4. Conclusion" : "4. Kesimpulan",
  };

  let body = '<h1>' + theme + '</h1>';
  body += authorsHtml;

  if (src.abstrak) {
    body += '<h2>' + (useTrans ? "Abstract" : "Abstrak") + '</h2>';
    body += markdownToWordHtml(src.abstrak, embedMap);
  }

  ["pendahuluan", "metode", "hasil", "kesimpulan"].forEach(stepId => {
    if (src[stepId]) {
      body += '<h2>' + sectionTitles[stepId] + '</h2>';
      body += markdownToWordHtml(src[stepId], embedMap);
    }
  });

  // References — always last
  if (narasiSteps.referensi || accepted.length > 0) {
    body += '<h2>' + (useTrans ? "References" : "Daftar Referensi") + '</h2>';
    accepted.forEach((a, i) => {
      let ref = "";
      if (tpl.includes("IEEE")) {
        ref = "[" + (i + 1) + "] " + a.authors + ', "' + a.title + ',\" ' + a.journal + ", " + a.year + ".";
      } else if (tpl.includes("Vancouver")) {
        ref = (i + 1) + ". " + a.authors + ". " + a.title + ". " + a.journal + ". " + a.year + ".";
      } else {
        ref = a.authors + " (" + a.year + "). " + a.title + ". " + a.journal + ". https://doi.org/" + a.doi;
      }
      body += '<p class="ref">' + ref + '</p>';
    });
  }

  // Step 4: Wrap in clean Word HTML document
  const fullHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + theme + '</title>'
    + '<style>'
    + '@page { size: A4; margin: 2.5cm 2cm; }'
    + 'body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.8; color: #000; }'
    + 'h1 { font-size: 16pt; font-weight: bold; text-align: center; margin: 0 0 12pt; }'
    + 'h2 { font-size: 12pt; font-weight: bold; text-transform: uppercase; margin: 18pt 0 8pt; border-bottom: 1pt solid #000; padding-bottom: 3pt; }'
    + 'h3 { font-size: 11pt; font-weight: bold; margin: 12pt 0 6pt; }'
    + 'p { margin: 0 0 8pt; text-align: justify; text-indent: 0; }'
    + 'p.authors { text-align: center; font-size: 12pt; margin: 4pt 0; text-indent: 0; }'
    + 'p.affil { text-align: center; font-size: 10pt; font-style: italic; margin: 0 0 4pt; text-indent: 0; }'
    + 'p.caption { text-align: center; font-size: 10pt; font-style: italic; margin: 4pt 0 12pt; text-indent: 0; }'
    + 'p.ref { padding-left: 24pt; text-indent: -24pt; margin: 0 0 6pt; font-size: 11pt; }'
    + 'table { width: 100%; border-collapse: collapse; margin: 10pt 0; font-size: 10.5pt; }'
    + 'th { background: #e8e8e8; border: 1pt solid #000; padding: 5pt 7pt; text-align: left; font-weight: bold; }'
    + 'td { border: 1pt solid #000; padding: 5pt 7pt; vertical-align: top; }'
    + 'img { display: block; margin: 0 auto; }'
    + '</style></head><body>' + body + '</body></html>';

  const blob = new Blob([fullHtml], { type: "application/vnd.ms-word;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename + ".doc"; a.click();
  URL.revokeObjectURL(url);
}

// Backward-compat simple downloadWord (for per-section)
function downloadWord(content, filename) {
  const fullHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<style>'
    + 'body { font-family: "Times New Roman",serif; font-size: 12pt; line-height: 1.8; color: #000; margin: 2cm; }'
    + 'h1 { font-size: 14pt; font-weight: bold; text-align: center; }'
    + 'h2 { font-size: 12pt; font-weight: bold; text-transform: uppercase; border-bottom: 1pt solid #000; padding-bottom: 3pt; margin-top: 18pt; }'
    + 'p { margin-bottom: 8pt; text-align: justify; }'
    + 'table { width: 100%; border-collapse: collapse; margin: 12pt 0; font-size: 10pt; }'
    + 'th { background: #e8e8e8; border: 1pt solid #000; padding: 5pt 7pt; font-weight: bold; }'
    + 'td { border: 1pt solid #000; padding: 5pt 7pt; vertical-align: top; }'
    + 'p.caption { text-align: center; font-size: 10pt; font-style: italic; }'
    + '</style></head><body>' + content + '</body></html>';
  const blob = new Blob([fullHtml], { type: "application/vnd.ms-word;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename + ".doc"; a.click();
  URL.revokeObjectURL(url);
}

function renderNarasiContent(text, embedMap) {
  if (!text) return null;
  const lines = text.split("\n");
  const out = [];
  let i = 0;
  let pCount = 0;

  // Pre-clean: remove markdown metadata-style noise that doesn't belong in scientific articles
  const cleanText = (line) => line
    .replace(/^\s*#+\s*Catatan:.*$/gi, "")
    .replace(/^\s*\[.*?\]\s*$/g, (m) => m.match(/(GAMBAR|TABEL|Gambar|Tabel)/i) ? m : "")
    .replace(/^\s*-{3,}\s*$/g, "");

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = cleanText(rawLine);
    const trimmed = line.trim();

    // Markdown table block
    if (trimmed.startsWith("|")) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      out.push(<NarasiTable key={"t"+i} lines={tableLines} />);
      continue;
    }

    // Figure/Table caption [GAMBAR N: ...] or [TABEL N: ...]
    const figMatch = trimmed.match(/^\*?\*?\[?(GAMBAR|Gambar|TABEL|Tabel)\s*(\d+)[:\s]+(.*?)\]?\*?\*?\.?$/);
    if (figMatch) {
      const isFig = figMatch[1].toUpperCase() === "GAMBAR";
      const num = figMatch[2];
      const captionRaw = figMatch[3].replace(/[\*\]]+$/g, "").trim();
      const captionLower = captionRaw.toLowerCase();

      // Try to embed real image based on caption
      let imgSrc = null;
      if (embedMap && isFig) {
        if (captionLower.includes("prisma") && embedMap.prisma) imgSrc = embedMap.prisma;
        else if ((captionLower.includes("framework") || captionLower.includes("konseptual") || captionLower.includes("model")) && embedMap.framework) imgSrc = embedMap.framework;
        else if ((captionLower.includes("distribusi") || captionLower.includes("tahun") || captionLower.includes("publikasi")) && embedMap.yearChart) imgSrc = embedMap.yearChart;
      }

      out.push(
        <div key={"f"+i} style={{ margin: "20px 0", textAlign: "center" }}>
          {imgSrc && (
            <div style={{ marginBottom: 6 }}>
              <img src={imgSrc} alt={captionRaw} style={{ maxWidth: "100%", maxHeight: 480, background: "white", padding: 8, borderRadius: 6 }} />
            </div>
          )}
          {!imgSrc && isFig && (
            <div style={{ padding: "32px 16px", border: "1px dashed var(--border)", borderRadius: 6, color: "var(--muted)", fontSize: 11, fontStyle: "italic", marginBottom: 6, background: "rgba(255,255,255,.02)" }}>
              [ Gambar akan otomatis disisipkan saat download Word ]
            </div>
          )}
          <div style={{ fontSize: 11, fontFamily: "var(--fs)", fontStyle: "italic", color: "var(--text)" }}>
            <strong>{isFig ? "Gambar" : "Tabel"} {num}.</strong> {captionRaw}
          </div>
        </div>
      );
      i++;
      continue;
    }

    // Heading
    if (trimmed.startsWith("### ")) {
      out.push(<div key={"h3-"+i} style={{ fontFamily: "var(--fh)", fontWeight: 700, fontSize: 12, color: "var(--accent2)", margin: "14px 0 5px" }}>{trimmed.slice(4)}</div>);
      i++; continue;
    }
    if (trimmed.startsWith("## ")) {
      out.push(<div key={"h2-"+i} style={{ fontFamily: "var(--fh)", fontWeight: 700, fontSize: 13, color: "var(--accent)", textTransform: "uppercase", letterSpacing: .5, margin: "18px 0 6px", paddingBottom: 3, borderBottom: "1px solid var(--border)" }}>{trimmed.slice(3)}</div>);
      i++; continue;
    }

    // Empty line
    if (!trimmed) { i++; continue; }

    // Regular paragraph with inline bold support
    const parts = trimmed.split(/(\*\*[^*]+\*\*)/g).map((p, pi) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={pi}>{p.slice(2, -2)}</strong>
        : p
    );
    out.push(<p key={"p"+(pCount++)} style={{ marginBottom: 9, fontFamily: "var(--fs)", fontSize: 13, lineHeight: 1.95, textAlign: "justify" }}>{parts}</p>);
    i++;
  }
  return <div>{out}</div>;
}

function NarasiTable({ lines }) {
  // Parse markdown table
  const rows = lines.filter(l => !l.match(/^[\s|:-]+$/));
  const parsed = rows.map(row =>
    row.split("|").filter((_,i,a) => i>0 && i<a.length-1).map(c => c.trim())
  );
  if (!parsed.length) return null;
  const [header, ...body] = parsed;
  return (
    <div style={{overflowX:"auto",margin:"14px 0",borderRadius:7,border:"1px solid var(--border)"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <thead>
          <tr>
            {header.map((h,i)=>(
              <th key={i} style={{background:"var(--bg3)",padding:"8px 11px",textAlign:"left",fontSize:10,fontWeight:700,letterSpacing:.5,textTransform:"uppercase",color:"var(--muted)",borderBottom:"1px solid var(--border)",whiteSpace:"nowrap"}}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row,ri)=>(
            <tr key={ri} style={{background: ri%2===0?"":"rgba(28,35,51,.4)"}}>
              {row.map((cell,ci)=>(
                <td key={ci} style={{padding:"8px 11px",borderBottom:"1px solid rgba(42,51,71,.4)",verticalAlign:"top",lineHeight:1.6}}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════
// TAB 8 — NASKAH SLR (with author panel, translate, Word + embedded images)
// ═══════════════════════════════════════════════
function TabNarasi({ accepted, theme, narasiSteps, setNarasiSteps, generateNarasi, aiStatus, openStep, setOpenStep, narasiView, setNarasiView, handleImprove, settings, narasiAuthors, setNarasiAuthors, extractData, framework, prismaData }) {
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState({});
  const [showTranslated, setShowTranslated] = useState(false);
  const [targetLang, setTargetLang] = useState("en");
  const [embedMap, setEmbedMap] = useState({ prisma: "", framework: "", yearChart: "" });
  const [generatingImages, setGeneratingImages] = useState(false);
  const [downloadingWord, setDownloadingWord] = useState(false);

  const STEPS = [
    { id:"abstrak",     icon:"📄", title:"Abstrak & Judul" },
    { id:"pendahuluan", icon:"📖", title:"1. Pendahuluan" },
    { id:"metode",      icon:"⚙️",  title:"2. Metode Penelitian" },
    { id:"hasil",       icon:"📊", title:"3. Hasil & Pembahasan" },
    { id:"kesimpulan",  icon:"✅", title:"4. Kesimpulan" },
    { id:"referensi",   icon:"📚", title:"5. Daftar Referensi" },
  ];
  const tpl = JOURNAL_TPLS.find(t=>t.id===settings.journalTemplate)?.label||"APA 7th";
  const allDone = STEPS.every(s=>narasiSteps[s.id]);
  const fullText = STEPS.filter(s=>narasiSteps[s.id]&&s.id!=="referensi").map(s=>narasiSteps[s.id]).join("\n\n");
  const doneCount = STEPS.filter(s=>narasiSteps[s.id]).length;
  const tableCount = Object.values(narasiSteps).join(" ").match(/\[TABEL\s*\d+/gi)?.length||0;
  const figureCount = Object.values(narasiSteps).join(" ").match(/\[GAMBAR\s*\d+/gi)?.length||0;

  const addAuthor = ()=>setNarasiAuthors(p=>[...p,{id:Date.now(),name:"",affil:"",email:""}]);
  const removeAuthor = (id)=>setNarasiAuthors(p=>p.filter(a=>a.id!==id));
  const updateAuthor = (id,k,v)=>setNarasiAuthors(p=>p.map(a=>a.id===id?{...a,[k]:v}:a));

  // Build embed map (PNG data URLs) when narasi data changes — used for live preview AND Word download
  useEffect(() => {
    if (!allDone) return;
    let cancelled = false;
    setGeneratingImages(true);
    (async () => {
      const prismaSvg = buildPrismaSvg(prismaData || {});
      const fwSvg = framework ? buildFrameworkBwSvg(framework) : "";
      const yearSvg = buildYearChartSvg(accepted);
      const [prismaPng, fwPng, yearPng] = await Promise.all([
        svgToPngDataUrl(prismaSvg, 720, 760),
        fwSvg ? svgToPngDataUrl(fwSvg, 720, 360) : Promise.resolve(""),
        yearSvg ? svgToPngDataUrl(yearSvg, 500, 300) : Promise.resolve(""),
      ]);
      if (!cancelled) {
        setEmbedMap({ prisma: prismaPng, framework: fwPng, yearChart: yearPng });
        setGeneratingImages(false);
      }
    })();
    return () => { cancelled = true; };
  }, [allDone, framework, prismaData?.uploadedCount, accepted.length]);

  async function handleDownloadWord(useTrans) {
    setDownloadingWord(true);
    try {
      await downloadWordWithAssets({
        filename: "SLR_" + (theme||"naskah").replace(/[^\w]+/g,"_").slice(0,40) + (useTrans ? "_translated" : ""),
        theme: "Systematic Literature Review: " + theme,
        authors: narasiAuthors,
        narasiSteps,
        accepted,
        tpl,
        prismaData: prismaData || {},
        framework,
        useTrans,
        translated,
      });
    } catch(err) {
      console.error("Word download error:", err);
      alert("Gagal mengunduh Word: " + err.message);
    }
    setDownloadingWord(false);
  }

  function buildWordContent(useTrans) {
    const src = useTrans ? translated : narasiSteps;
    const authLine = narasiAuthors.filter(a=>a.name.trim()).map((a,i)=>"<div class=\"authors\">" + a.name + (narasiAuthors.filter(x=>x.name.trim()).length>1?"<sup>"+(i+1)+"</sup>":"") + "</div>" + (a.affil?"<div class=\"affil\">" + a.affil + (a.email?" · "+a.email:"") + "</div>":"")).join("");
    let html=`<h1>Systematic Literature Review: ${theme}</h1>${authLine}<br/>`;
    if(src.abstrak) html+=`<h2>Abstrak</h2><p>${src.abstrak.replace(/\n/g,"</p><p>")}</p>`;
    STEPS.filter(s=>s.id!=="abstrak"&&s.id!=="referensi"&&src[s.id]).forEach(step=>{
      html+=`<h2>${step.title}</h2>`;
      const lines=(src[step.id]||"").split("\n"); let i=0;
      while(i<lines.length){
        if(lines[i].trim().startsWith("|")){
          const tl=[];while(i<lines.length&&lines[i].trim().startsWith("|")){tl.push(lines[i]);i++;}
          const rows=tl.filter(l=>!l.match(/^[\s|:-]+$/));
          if(rows.length>0){const parsed=rows.map(r=>r.split("|").filter((_,ci,a)=>ci>0&&ci<a.length-1).map(c=>c.trim()));const[hd,...bd]=parsed;html+="<table><thead><tr>"+hd.map(h=>"<th>"+h+"</th>").join("")+"</tr></thead><tbody>"+bd.map(r=>"<tr>"+r.map(c=>"<td>"+c+"</td>").join("")+"</tr>").join("")+"</tbody></table>";}
        } else if(lines[i].match(/\[?(GAMBAR|TABEL)\s*\d+/i)){html+=`<p class="caption">${lines[i].replace(/\*\*/g,"")}</p>`;i++;}
        else if(lines[i].startsWith("## ")){html+=`<h2>${lines[i].replace(/^## /,"")}</h2>`;i++;}
        else if(lines[i].trim()){html+=`<p>${lines[i].replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>")}</p>`;i++;}
        else{i++;}
      }
    });
    if(narasiSteps.referensi){html+=`<h2>Daftar Referensi</h2>`;accepted.forEach((a,i)=>{html+=`<p style="padding-left:24pt;text-indent:-24pt">${tpl.includes("IEEE")?("["+((i+1))+"] "+a.authors+", \""+a.title+",\" "+a.journal+", "+a.year+".") : (a.authors+" ("+a.year+"). "+a.title+". "+a.journal+". https://doi.org/"+a.doi)}</p>`;});}
    return html;
  }

  async function translateAll(){
    setTranslating(true);
    const langNames={en:"English",ar:"Arabic",zh:"Chinese Simplified",fr:"French",de:"German",ja:"Japanese",ko:"Korean",es:"Spanish"};
    const lang=langNames[targetLang]||"English";
    const result={};
    for(const step of STEPS.filter(s=>narasiSteps[s.id]&&s.id!=="referensi")){
      try{
        const txt=await callAI(`Translate the following academic text to ${lang}. RULES: Keep ALL citations (Author, Year) unchanged. Keep ALL markdown table | formats intact. Keep ALL [GAMBAR N:] and [TABEL N:] markers. Keep ## headings structure. Output ONLY the translated text.\n\n${narasiSteps[step.id]}`,settings,"You are a professional academic translator.");
        result[step.id]=txt;
      }catch(e){result[step.id]=narasiSteps[step.id];}
    }
    result.referensi=narasiSteps.referensi;
    setTranslated(result);setShowTranslated(true);setTranslating(false);
  }

  return (
    <div>
      {/* Author Panel */}
      <div className="card">
        <div className="card-title">✍️ Identitas Penulis</div>
        {narasiAuthors.map((auth,idx)=>(
          <div key={auth.id} style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
            <div style={{width:22,height:22,borderRadius:"50%",background:"var(--accent)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,flexShrink:0,marginTop:idx===0?22:4}}>{idx+1}</div>
            <div className="grid3" style={{flex:1,gap:6}}>
              <div className="fg">{idx===0&&<label>Nama Penulis</label>}<input type="text" placeholder="Nama Lengkap" value={auth.name} onChange={e=>updateAuthor(auth.id,"name",e.target.value)}/></div>
              <div className="fg">{idx===0&&<label>Affiliasi / Institusi</label>}<input type="text" placeholder="Universitas / Lembaga" value={auth.affil} onChange={e=>updateAuthor(auth.id,"affil",e.target.value)}/></div>
              <div className="fg">{idx===0&&<label>Email</label>}<input type="text" placeholder="email@domain.com" value={auth.email} onChange={e=>updateAuthor(auth.id,"email",e.target.value)}/></div>
            </div>
            {narasiAuthors.length>1&&<button className="btn xs danger" style={{marginTop:idx===0?22:4}} onClick={()=>removeAuthor(auth.id)}>✕</button>}
          </div>
        ))}
        <button className="btn sm" onClick={addAuthor} style={{marginTop:6}}>+ Tambah Penulis</button>
      </div>

      {/* Top bar */}
      <div className="card" style={{padding:"11px 16px"}}>
        <div style={{display:"flex",gap:9,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{flex:1,fontSize:11,color:"var(--muted)"}}>
            Template: <strong style={{color:"var(--accent)"}}>{tpl}</strong> — {accepted.length} artikel — {doneCount}/{STEPS.length} selesai
            {tableCount>0&&<span style={{color:"var(--accent)",marginLeft:8}}>📊{tableCount}</span>}
            {figureCount>0&&<span style={{color:"var(--accent2)",marginLeft:6}}>🖼️{figureCount}</span>}
          </div>
          <button className={`btn sm ${narasiView==="steps"?"primary":""}`} onClick={()=>setNarasiView("steps")}>📑 Per Bagian</button>
          <button className={`btn sm ${narasiView==="gabungan"?"primary":""}`} onClick={()=>setNarasiView("gabungan")} disabled={!allDone}>📄 Gabungan</button>
          {allDone&&<button className="btn sm success" onClick={()=>downloadWord(buildWordContent(false),`SLR_${theme.slice(0,30)}`)}>⬇ Word</button>}
        </div>
      </div>

      {/* Per bagian view */}
      {narasiView==="steps"&&STEPS.map(step=>(
        <div key={step.id} className="card" style={{padding:"0 18px"}}>
          <div className="step-hdr" onClick={()=>setOpenStep(openStep===step.id?null:step.id)}>
            <div className="step-num">{step.icon}</div>
            <div className="step-ttl">{step.title}</div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {narasiSteps[step.id]&&<span className="badge acc">✓</span>}
              {!narasiSteps[step.id]&&<button className="btn xs primary" onClick={e=>{e.stopPropagation();generateNarasi(step.id);}} disabled={!!aiStatus}>{aiStatus===step.id?"⏳":"✨ Generate"}</button>}
              {narasiSteps[step.id]&&<>
                <button className="btn xs" onClick={e=>{e.stopPropagation();generateNarasi(step.id);}}>🔄</button>
                <button className="btn xs success" onClick={e=>{e.stopPropagation();downloadWord(`<h2>${step.title}</h2><div>${narasiSteps[step.id].replace(/\n/g,"<br/>")}</div>`,step.id);}}>⬇ Word</button>
              </>}
              <span style={{color:"var(--muted)",fontSize:11}}>{openStep===step.id?"▲":"▼"}</span>
            </div>
          </div>
          {openStep===step.id&&narasiSteps[step.id]&&(
            <div style={{padding:"14px 0 20px"}}>
              {step.id==="referensi"
                ?<div>{accepted.map((a,i)=><div key={a.id} style={{marginBottom:8,fontSize:12,fontFamily:"var(--fs)",paddingLeft:28,textIndent:-28,lineHeight:1.65}}>{tpl.includes("IEEE")?("["+((i+1))+"] "+a.authors+", \""+a.title+",\" "+a.journal+", "+a.year+".") : (a.authors+" ("+a.year+"). "+a.title+". "+a.journal+". https://doi.org/"+a.doi)}</div>)}</div>
                :renderNarasiContent(narasiSteps[step.id])
              }
            </div>
          )}
          {openStep===step.id&&!narasiSteps[step.id]&&(
            <div style={{padding:"20px 0",textAlign:"center",color:"var(--muted)",fontSize:11}}>Klik Generate AI — narasi akan menyertakan tabel, gambar, dan keterangan bagan secara otomatis.</div>
          )}
        </div>
      ))}

      {/* Gabungan view */}
      {narasiView==="gabungan"&&(
        <>
          <div className="nar-wrap" style={{marginBottom:14}}>
            <h1>Systematic Literature Review: {theme}</h1>
            <div style={{textAlign:"center",marginBottom:16}}>
              {narasiAuthors.filter(a=>a.name.trim()).map((a,i)=>(
                <div key={a.id}>
                  <div style={{fontSize:13,fontFamily:"var(--fs)",fontWeight:600}}>{a.name}{narasiAuthors.filter(x=>x.name.trim()).length>1?<sup style={{fontSize:9}}>{i+1}</sup>:""}</div>
                  {a.affil&&<div style={{fontSize:10,color:"var(--muted)"}}>{a.affil}{a.email?` · ${a.email}`:""}</div>}
                </div>
              ))}
              {!narasiAuthors.some(a=>a.name.trim())&&<div style={{fontSize:11,color:"var(--muted)"}}>Isi identitas penulis di atas | {new Date().getFullYear()}</div>}
            </div>
            {Object.keys(translated).length>0&&(
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                <button className={`btn sm ${!showTranslated?"primary":""}`} onClick={()=>setShowTranslated(false)}>🇮🇩 Indonesia</button>
                <button className={`btn sm ${showTranslated?"primary":""}`} onClick={()=>setShowTranslated(true)}>🌐 Terjemahan</button>
              </div>
            )}
            {(showTranslated?translated:narasiSteps).abstrak&&(
              <div style={{borderLeft:"3px solid var(--accent)",padding:"10px 14px",background:"var(--bg3)",borderRadius:"0 7px 7px 0",marginBottom:20}}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:1,textTransform:"uppercase",color:"var(--accent)",marginBottom:6}}>Abstract</div>
                {renderNarasiContent((showTranslated?translated:narasiSteps).abstrak)}
              </div>
            )}
            {STEPS.filter(s=>s.id!=="abstrak"&&s.id!=="referensi"&&(showTranslated?translated:narasiSteps)[s.id]).map(step=>(
              <div key={step.id} style={{marginBottom:22}}>
                <h2>{step.title}</h2>
                {renderNarasiContent((showTranslated?translated:narasiSteps)[step.id])}
              </div>
            ))}
            {narasiSteps.referensi&&(
              <div style={{marginTop:22,paddingTop:16,borderTop:"1px solid var(--border)"}}>
                <h2>Daftar Referensi</h2>
                {accepted.map((a,i)=><div key={a.id} style={{fontSize:11,fontFamily:"var(--fs)",marginBottom:8,paddingLeft:28,textIndent:-28,lineHeight:1.65}}>{tpl.includes("IEEE")?("["+((i+1))+"] "+a.authors+", \""+a.title+",\" "+a.journal+", "+a.year+".") : (a.authors+" ("+a.year+"). "+a.title+". "+a.journal+". https://doi.org/"+a.doi)}</div>)}
              </div>
            )}
          </div>

          {/* Translate panel */}
          <div className="card" style={{marginBottom:12}}>
            <div className="card-title">🌐 Terjemahkan Naskah</div>
            <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
              <div className="fg" style={{minWidth:170}}>
                <label>Bahasa Tujuan</label>
                <select value={targetLang} onChange={e=>setTargetLang(e.target.value)}>
                  <option value="en">English (Inggris)</option>
                  <option value="ar">Arabic (Arab)</option>
                  <option value="zh">Chinese Simplified (Mandarin)</option>
                  <option value="fr">French (Prancis)</option>
                  <option value="de">German (Jerman)</option>
                  <option value="ja">Japanese (Jepang)</option>
                  <option value="ko">Korean (Korea)</option>
                  <option value="es">Spanish (Spanyol)</option>
                </select>
              </div>
              <button className="btn primary" onClick={translateAll} disabled={translating||!fullText}>
                {translating?"⏳ Menerjemahkan...":"🌐 Terjemahkan"}
              </button>
              {Object.keys(translated).length>0&&(
                <button className="btn success" onClick={()=>downloadWord(buildWordContent(true),`SLR_${theme.slice(0,25)}_en`)}>⬇ Word Terjemahan</button>
              )}
            </div>
            {translating&&<div style={{marginTop:8,fontSize:11,color:"var(--accent)"}}>Menerjemahkan per bagian, mempertahankan tabel & sitasi...</div>}
          </div>

          <IntegrityPanel text={fullText} onImprove={handleImprove} aiStatus={aiStatus} settings={settings}/>
          <div className="card" style={{marginTop:12,borderColor:"rgba(167,139,250,.3)"}}>
            <div className="card-title" style={{color:"var(--accent2)"}}>📋 Deklarasi Penggunaan AI</div>
            <div style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:6,padding:"11px 13px",fontSize:12,fontFamily:"var(--fs)",lineHeight:1.8,marginTop:8}}>
              <strong>AI Usage Statement:</strong> The authors used an AI-assisted writing tool to support the systematic literature review process, including article screening, data extraction, table generation, and narrative drafting. All AI-generated content was critically reviewed, verified, and revised by the authors. Full intellectual responsibility rests with the authors.
            </div>
            <button className="btn xs" style={{marginTop:7}} onClick={()=>navigator.clipboard.writeText("The authors used an AI-assisted writing tool...")}>📋 Copy</button>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// TAB SETTINGS — Simple & Clean
// ═══════════════════════════════════════════════
function TabSettings({ settings, setSettings }) {
  const [localSettings, setLocalSettings] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const upd = (k, v) => setLocalSettings(p => ({ ...p, [k]: v }));
  const prov = AI_PROVIDERS.find(p => p.id === localSettings.provider);

  function handleSave() {
    setSettings(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const activeKey = {
    anthropic: localSettings.anthropicKey,
    gemini: localSettings.geminiKey,
    openai: localSettings.openaiKey,
    groq: localSettings.groqKey,
  }[localSettings.provider];

  return (
    <div style={{ maxWidth: 540 }}>
      <div className="card">
        <div className="card-title">⚙️ Konfigurasi AI</div>

        {/* Provider + Model row */}
        <div className="grid2" style={{ marginBottom: 14 }}>
          <div className="fg">
            <label>Provider AI</label>
            <select value={localSettings.provider} onChange={e => {
              const p = e.target.value;
              upd("provider", p);
              upd("model", AI_PROVIDERS.find(x => x.id === p)?.models[0] || "");
            }}>
              {AI_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div className="fg">
            <label>Model</label>
            <select value={localSettings.model} onChange={e => upd("model", e.target.value)}>
              {(prov?.models || []).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {/* API Key for selected provider */}
        <div className="fg" style={{ marginBottom: 14 }}>
          <label>
            API Key — {prov?.label}
            {activeKey?.trim()
              ? <span style={{ color: "var(--green)", marginLeft: 8, fontSize: 9 }}>✓ Sudah diisi</span>
              : <span style={{ color: "var(--amber)", marginLeft: 8, fontSize: 9 }}>⚠ Belum diisi</span>
            }
          </label>
          <input
            type="password"
            placeholder={
              localSettings.provider === "anthropic" ? "sk-ant-..." :
              localSettings.provider === "gemini" ? "AIza..." :
              localSettings.provider === "openai" ? "sk-..." : "gsk_..."
            }
            value={activeKey || ""}
            onChange={e => {
              const keyMap = { anthropic: "anthropicKey", gemini: "geminiKey", openai: "openaiKey", groq: "groqKey" };
              upd(keyMap[localSettings.provider], e.target.value);
            }}
          />
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>
            {localSettings.provider === "gemini" && <span style={{ color: "var(--green)" }}>Gemini 2.5 Flash tersedia gratis — </span>}
            {localSettings.provider === "groq" && <span style={{ color: "var(--green)" }}>LLaMA via Groq gratis dengan rate limit — </span>}
            <a href={
              localSettings.provider === "anthropic" ? "https://console.anthropic.com" :
              localSettings.provider === "gemini" ? "https://aistudio.google.com/app/apikey" :
              localSettings.provider === "openai" ? "https://platform.openai.com/api-keys" :
              "https://console.groq.com"
            } target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
              Dapatkan API key →
            </a>
          </div>
        </div>

        {/* Template jurnal */}
        <div className="fg" style={{ marginBottom: 18 }}>
          <label>Template Jurnal / Format Sitasi</label>
          <select value={localSettings.journalTemplate} onChange={e => upd("journalTemplate", e.target.value)}>
            {JOURNAL_TPLS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        {/* Save button */}
        <button
          className={`btn ${saved ? "success" : "primary"}`}
          onClick={handleSave}
          style={{ width: "100%", justifyContent: "center", padding: "9px", fontSize: 12 }}
        >
          {saved ? "✅ Pengaturan Tersimpan!" : "💾 Simpan Pengaturan"}
        </button>
      </div>

      {/* Other providers keys (collapsed) */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 8 }}>🔑 API Key Provider Lain (Opsional)</div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 12 }}>
          Isi jika ingin beralih provider sewaktu-waktu tanpa kehilangan key yang sudah tersimpan.
        </div>
        {AI_PROVIDERS.filter(p => p.id !== localSettings.provider).map(p => {
          const keyMap = { anthropic: "anthropicKey", gemini: "geminiKey", openai: "openaiKey", groq: "groqKey" };
          const kKey = keyMap[p.id];
          const ph = { anthropic:"sk-ant-...", gemini:"AIza...", openai:"sk-...", groq:"gsk_..." }[p.id];
          return (
            <div key={p.id} className="fg" style={{ marginBottom: 10 }}>
              <label>{p.label} {localSettings[kKey]?.trim() && <span style={{ color:"var(--green)", fontSize:9 }}>✓</span>}</label>
              <input type="password" placeholder={ph} value={localSettings[kKey] || ""} onChange={e => upd(kKey, e.target.value)} />
            </div>
          );
        })}
        <button className="btn sm success" style={{ marginTop: 6 }} onClick={handleSave}>💾 Simpan Semua Key</button>
      </div>
    </div>
  );
}
