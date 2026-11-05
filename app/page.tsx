"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Contact = { id:string; email:string; status:string; consent_status:string; first_name?:string|null; last_name?:string|null };
type Product = { id:string; name:string; price:number|null; currency:string; external_url:string };
type Campaign = { id:string; name:string; subject:string; status:string; created_at:string };

export default function Home() {
  const supabase = createSupabaseBrowserClient();
  const [user,setUser] = useState<User|null>(null);
  const [authLoading,setAuthLoading] = useState(true);
  const [authMode,setAuthMode] = useState<"login"|"signup">("login");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [fullName,setFullName] = useState("");
  const [notice,setNotice] = useState("");
  const [busy,setBusy] = useState(false);
  const [active,setActive] = useState("Overview");
  const [contacts,setContacts] = useState<Contact[]>([]);
  const [products,setProducts] = useState<Product[]>([]);
  const [campaigns,setCampaigns] = useState<Campaign[]>([]);
  const [productName,setProductName] = useState("");
  const [productPrice,setProductPrice] = useState("");
  const [productUrl,setProductUrl] = useState("https://www.cartzify.com");
  const [campaignName,setCampaignName] = useState("");
  const [subject,setSubject] = useState("");
  const [scheduledAt,setScheduledAt] = useState("");
  const [previewText,setPreviewText] = useState("");
  const [emailBody,setEmailBody] = useState("Hello there,\\n\\nWe have something special to share with you.\\n\\nDiscover it today.");
  const [ctaLabel,setCtaLabel] = useState("Shop now");
  const [ctaUrl,setCtaUrl] = useState("https://www.cartzify.com");
  const [consentConfirmed,setConsentConfirmed] = useState(false);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getUser().then(({data}) => { setUser(data.user); setAuthLoading(false); });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,session) => {
      setUser(session?.user ?? null);
      if (session?.user) setNotice("Signed in successfully.");
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => { if(user) void refresh(); }, [user]);

  async function refresh() {
    const [c,p,m] = await Promise.all([
      fetch("/api/contacts",{cache:"no-store"}),
      fetch("/api/products",{cache:"no-store"}),
      fetch("/api/campaigns",{cache:"no-store"})
    ]);
    if(c.ok) setContacts((await c.json()).contacts ?? []);
    if(p.ok) setProducts((await p.json()).products ?? []);
    if(m.ok) setCampaigns((await m.json()).campaigns ?? []);
  }

  async function authenticate(e:FormEvent) {
    e.preventDefault();
    if(!supabase) return setNotice("Supabase environment variables are missing. Please check the Render service environment.");
    setBusy(true); setNotice("");
    try {
      if(authMode==="signup") {
        const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{data:{full_name:fullName.trim()},emailRedirectTo:window.location.origin+"/auth/callback"}});
        if(error) throw error;
        if(data.session) { setUser(data.user); setNotice("Account created. Welcome to Sendvoria!"); }
        else setNotice("Registration received. Please check your email and confirm your address before signing in.");
      } else {
        const {data,error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
        if(error) throw error;
        setUser(data.user); setNotice("Welcome back to Sendvoria.");
      }
    } catch(err) { setNotice(err instanceof Error?err.message:"Authentication failed."); }
    finally { setBusy(false); }
  }

  async function signOut() {
    if(!supabase) return;
    await supabase.auth.signOut(); setUser(null); setContacts([]); setProducts([]); setCampaigns([]); setActive("Overview"); setNotice("You have signed out.");
  }

  async function importCsv(file?:File) {
    if(!file) return;
    if(!consentConfirmed) return setNotice("Please confirm that every imported contact has documented permission to receive your marketing emails.");
    setBusy(true);
    try {
      const text=await file.text();
      const lines=text.split(/\r?\n/).filter(Boolean);
      const rows=lines.map((line)=>line.split(",").map(x=>x.trim().replace(/^["']|["']$/g,""))).filter(cols=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cols[0]??"") && !(lines.indexOf(cols.join(","))===0 && cols[0].toLowerCase()==="email"));
      const payload=rows.map(cols=>({email:cols[0].toLowerCase(),first_name:cols[1]??"",last_name:cols[2]??"",consent_status:"confirmed",consent_source:"User-confirmed CSV import"}));
      let imported=0;
      for(let i=0;i<payload.length;i+=500) {
        const response=await fetch("/api/contacts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contacts:payload.slice(i,i+500)})});
        const result=await response.json();
        if(!response.ok) throw new Error(result.error??"CSV import failed");
        imported+=result.imported??0;
      }
      setNotice(`Imported ${imported} consent-confirmed contacts. Duplicate addresses were skipped.`);
      await refresh();
    } catch(err) { setNotice(err instanceof Error?err.message:"Could not import CSV."); }
    finally { setBusy(false); }
  }

  async function addProduct(e:FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const response=await fetch("/api/products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:productName,price:productPrice||null,external_url:productUrl})});
      const result=await response.json(); if(!response.ok) throw new Error(result.error??"Could not save product");
      setProductName("");setProductPrice("");setNotice("Product link saved. Checkout remains on your external store.");await refresh();
    } catch(err){setNotice(err instanceof Error?err.message:"Could not save product.");}
    finally{setBusy(false);}
  }

  async function saveCampaign(e:FormEvent) {
    e.preventDefault();setBusy(true);
    try {
      const response=await fetch("/api/campaigns",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:campaignName,subject,scheduled_at:scheduledAt ? new Date(scheduledAt).toISOString() : null,preview_text:previewText,html_content:`<!doctype html><html><body style="font-family:Arial,sans-serif;color:#17221f;max-width:600px;margin:auto;padding:24px"><h1>${campaignName.replace(/[&<>"]/g,"")}</h1><p>${emailBody.split("\\n").map(line=>line.replace(/[&<>"]/g,"")).join("<br>")}</p><p><a href="${ctaUrl}" style="display:inline-block;background:#167b5b;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px">${ctaLabel.replace(/[&<>"]/g,"")}</a></p><p style="font-size:12px;color:#777">You received this email because you subscribed to updates.</p></body></html>`})});
      const result=await response.json();if(!response.ok)throw new Error(result.error??"Could not save campaign");
      setCampaignName("");setSubject("");setScheduledAt("");setNotice(scheduledAt ? "Campaign schedule saved. This is a schedule record only; automated email delivery is not enabled yet." : "Campaign draft saved to your Sendvoria database. Email sending is not enabled yet.");await refresh();
    } catch(err){setNotice(err instanceof Error?err.message:"Could not save campaign.");}
    finally{setBusy(false);}
  }

  if(authLoading) return <main className="auth-shell"><div className="auth-card"><div className="brand-mark">S</div><h1>Loading Sendvoria…</h1><p>Checking your secure session.</p></div></main>;
  if(!user) return <main className="auth-shell"><section className="auth-card"><div className="auth-logo"><span className="brand-mark">S</span><div><strong>sendvoria</strong><small>Marketing meets Commerce.</small></div></div><div className="eyebrow">YOUR MARKETING WORKSPACE</div><h1>{authMode==="login"?"Welcome back":"Create your account"}</h1><p className="auth-description">{authMode==="login"?"Sign in to manage your audience, campaigns and product links.":"Start building your email marketing workspace for free."}</p>{notice&&<div className="notice">{notice}</div>}<form onSubmit={authenticate} className="auth-form">{authMode==="signup"&&<label className="field"><span>Full name</span><input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your name" required/></label>}<label className="field"><span>Email address</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required/></label><label className="field"><span>Password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} required/></label><button className="primary-button auth-submit" disabled={busy}>{busy?"Please wait…":authMode==="login"?"Sign in":"Create free account"}</button></form><p className="auth-switch">{authMode==="login"?"New to Sendvoria?":"Already have an account?"} <button onClick={()=>{setAuthMode(authMode==="login"?"signup":"login");setNotice("");}}>{authMode==="login"?"Create account":"Sign in"}</button></p><p className="fine-print">Your workspace is private. Only authenticated users can access their saved contacts, products and campaigns.</p></section></main>;

  const nav=["Overview","Campaigns","Contacts","Products","Automations","Analytics","Settings"];
  return <main className="shell"><aside className="sidebar"><a className="brand" href="#"><span className="brand-mark">S</span><span>sendvoria<small>Marketing meets Commerce.</small></span></a><div className="workspace-label">WORKSPACE</div><nav>{nav.map(item=><button key={item} onClick={()=>setActive(item)} className={active===item?"nav-item active":"nav-item"}><span className="nav-dot">{item==="Overview"?"⌂":item==="Campaigns"?"✉":item==="Contacts"?"◎":item==="Products"?"▣":item==="Automations"?"↗":item==="Analytics"?"▥":"⚙"}</span>{item}{item==="Contacts"&&<span className="nav-count">{contacts.length}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="plan-card"><div className="plan-icon">✦</div><strong>Free workspace</strong><p>External store checkout · Free-first setup.</p></div><div className="profile"><div className="avatar">{(user.user_metadata?.full_name??user.email??"S").slice(0,2).toUpperCase()}</div><div><strong>{user.user_metadata?.full_name??"Workspace owner"}</strong><small>{user.email}</small></div><button className="more" onClick={signOut}>Sign out</button></div></div></aside>
  <section className="main-area"><header className="topbar"><div className="crumb">Workspace <span>/</span> <b>{active}</b></div><div className="top-actions"><span className="status"><i/> Signed in</span><button className="help-button" onClick={signOut}>Sign out</button></div></header><div className="content">{notice&&<div className="notice"><span>{notice}</span><button onClick={()=>setNotice("")}>×</button></div>}
  {active==="Overview"&&<><div className="page-heading"><div><div className="eyebrow">YOUR MARKETING HUB</div><h1>Welcome to Sendvoria 👋</h1><p>Your secure workspace is connected to the database.</p></div><button className="primary-button" onClick={()=>setActive("Campaigns")}>＋ Create campaign</button></div><div className="stats-grid"><Stat title="Total contacts" value={contacts.length.toLocaleString()} change="Saved in your database" icon="◎"/><Stat title="Confirmed subscribers" value={contacts.filter(c=>c.consent_status==="confirmed"&&c.status==="subscribed").length.toLocaleString()} change="Consent-confirmed only" icon="♧"/><Stat title="Campaign drafts" value={campaigns.length.toString()} change="Saved campaigns" icon="✉"/><Stat title="Product links" value={products.length.toString()} change="External store products" icon="▣"/></div><div className="panel"><h2>Database connection</h2><p>Your contacts, products and campaign drafts are loaded from Supabase. Email delivery remains disabled until sender verification and compliance features are configured.</p></div></>}
  {active==="Contacts"&&<><PageTitle eyebrow="AUDIENCE" title="Contacts" desc="Import only contacts who have explicitly opted in to receive your marketing."/><div className="panel"><h2>Import contacts from CSV</h2><p className="fine-print">CSV columns: email, first_name, last_name. Only import a permission-based list.</p><label className="consent-check"><input type="checkbox" checked={consentConfirmed} onChange={e=>setConsentConfirmed(e.target.checked)}/> I confirm that these contacts gave permission to receive marketing emails and that I can document their consent.</label><label className="upload-zone"><span className="upload-icon">↑</span><strong>{busy?"Importing…":"Choose CSV file"}</strong><small>Up to 500 contacts per request</small><input type="file" accept=".csv,text/csv" disabled={busy} onChange={e=>void importCsv(e.target.files?.[0])}/></label></div><div className="panel"><h2>Contact list ({contacts.length})</h2>{contacts.length?<div className="table-wrap"><table><thead><tr><th>Email</th><th>Status</th><th>Consent</th></tr></thead><tbody>{contacts.slice(0,200).map(c=><tr key={c.id}><td>{c.email}</td><td>{c.status}</td><td>{c.consent_status}</td></tr>)}</tbody></table></div>:<Empty title="No contacts yet" desc="Import your permission-based CSV to get started."/ >}</div></>}
  {active==="Products"&&<><PageTitle eyebrow="COMMERCE LINKS" title="Product library" desc="Your customer shops, adds to cart and checks out on your own external store."/><div className="panel"><form onSubmit={addProduct} className="form-grid"><Field label="Product name"><input value={productName} onChange={e=>setProductName(e.target.value)} required/></Field><Field label="Price (optional)"><input value={productPrice} onChange={e=>setProductPrice(e.target.value)} type="number" min="0" step="0.01"/></Field><Field label="External product page HTTPS URL" wide><input value={productUrl} onChange={e=>setProductUrl(e.target.value)} type="url" required/></Field><button className="primary-button" disabled={busy}>Save product link</button></form></div><div className="panel"><h2>Saved product links ({products.length})</h2>{products.map(p=><div className="product-row" key={p.id}><div className="product-info"><strong>{p.name}</strong><small>{p.external_url}</small></div><b>{p.price===null?"":p.price+" "+p.currency}</b><a className="open-link" href={p.external_url} target="_blank" rel="noreferrer">Open ↗</a></div>)}</div></>}
  {active==="Campaigns"&&<><PageTitle eyebrow="EMAIL MARKETING" title="Campaign builder" desc="Design and save responsive HTML email drafts. Sending is disabled until a verified provider and compliance flow are connected."/><div className="two-col"><div className="panel"><form onSubmit={saveCampaign} className="form-grid single"><Field label="Campaign name"><input value={campaignName} onChange={e=>setCampaignName(e.target.value)} required/></Field><Field label="Email subject"><input value={subject} onChange={e=>setSubject(e.target.value)} required/></Field><Field label="Inbox preview text"><input value={previewText} onChange={e=>setPreviewText(e.target.value)} maxLength={250}/></Field><Field label="Schedule time (optional)"><input type="datetime-local" value={scheduledAt} min={new Date(Date.now()+60000).toISOString().slice(0,16)} onChange={e=>setScheduledAt(e.target.value)}/></Field><Field label="Email message"><textarea className="email-editor" rows={9} value={emailBody} onChange={e=>setEmailBody(e.target.value)} /></Field><Field label="Call-to-action button"><input value={ctaLabel} onChange={e=>setCtaLabel(e.target.value)} required/></Field><Field label="External product/store URL (HTTPS)"><input type="url" value={ctaUrl} onChange={e=>setCtaUrl(e.target.value)} required/></Field><button className="primary-button" disabled={busy}>{scheduledAt ? "Save schedule" : "Save campaign draft"}</button></form></div><div className="panel"><h2>Live preview</h2><div className="email-preview"><div className="preview-top"><span>EMAIL PREVIEW</span><span>RESPONSIVE</span></div><div className="preview-body"><div className="preview-brand">sendvoria</div><h2>{campaignName||"Your campaign headline"}</h2><p>{previewText||"A short preview of your message in the inbox."}</p><p style={{whiteSpace:"pre-wrap",textAlign:"left"}}>{emailBody}</p><a className="preview-cta" href={ctaUrl} target="_blank" rel="noreferrer">{ctaLabel}</a><small className="preview-url">{ctaUrl}</small></div></div><p className="fine-print">This preview is for drafting only. No email is sent when you save.</p></div></div><div className="panel"><h2>Campaign drafts ({campaigns.length})</h2>{campaigns.map(c=><div className="product-row" key={c.id}><div className="product-info"><strong>{c.name}</strong><small>{c.subject}</small></div><span className="pill yellow-pill">{c.status}</span></div>)}</div></>}
  {active==="Automations"&&<><PageTitle eyebrow="CUSTOMER JOURNEYS" title="Automations" desc="Automation records are supported by the database. Execution workflows are not active yet."/><Empty title="Automation builder coming next" desc="Welcome, product-click and re-engagement workflows need scheduling and email provider setup."/></>}
  {active==="Analytics"&&<><PageTitle eyebrow="PERFORMANCE" title="Analytics" desc="Real metrics will appear when sending and tracking are enabled."/><Empty title="No email events yet" desc="Campaign delivery, opens and clicks are not active yet."/></>}
  {active==="Settings"&&<><PageTitle eyebrow="WORKSPACE" title="Settings" desc="Your authenticated account and integration status."/><div className="panel"><h2>Signed-in account</h2><p>{user.email}</p><span className="pill green-pill">Authenticated with Supabase</span></div><div className="panel"><h2>Email provider</h2><p>Not connected. Sending remains disabled until verified sender identity, unsubscribe and bounce/complaint handling are ready.</p></div></>}
  </div></section></main>;
}

function Stat({title,value,change,icon}:{title:string;value:string;change:string;icon:string}){return <div className="stat-card"><div className="stat-top"><span>{title}</span><i>{icon}</i></div><strong>{value}</strong><small>{change}</small></div>}
function PageTitle({eyebrow,title,desc}:{eyebrow:string;title:string;desc:string}){return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{desc}</p></div></div>}
function Field({label,wide,children}:{label:string;wide?:boolean;children:React.ReactNode}){return <label className={wide?"field wide":"field"}><span>{label}</span>{children}</label>}
function Empty({title,desc}:{title:string;desc:string}){return <div className="empty"><span>✦</span><strong>{title}</strong><p>{desc}</p></div>}
