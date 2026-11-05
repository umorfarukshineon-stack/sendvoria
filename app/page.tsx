"use client";

import { useMemo, useState } from "react";

type Product = { name: string; price: string; url: string };
type Contact = { email: string; status: "Subscribed" | "Unsubscribed" };

const initialProducts: Product[] = [
  { name: "Forever Love Necklace", price: "$39.00", url: "https://www.cartzify.com" },
  { name: "Personalized Family Gift", price: "$24.00", url: "https://www.cartzify.com" }
];

const navItems = ["Overview", "Campaigns", "Contacts", "Products", "Automations", "Analytics", "Settings"];

export default function Home() {
  const [active, setActive] = useState("Overview");
  const [products, setProducts] = useState(initialProducts);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState("");
  const [notice, setNotice] = useState("");
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productUrl, setProductUrl] = useState("https://www.cartzify.com");
  const [csvName, setCsvName] = useState("");

  const subscribed = useMemo(() => contacts.filter(c => c.status === "Subscribed").length, [contacts]);

  function importCsv(file?: File) {
    if (!file) return;
    setCsvName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const rows = String(reader.result || "").split(/\r?\n/).filter(Boolean);
      const parsed: Contact[] = [];
      rows.forEach((row, index) => {
        const value = row.split(",")[0]?.trim().replace(/^["']|["']$/g, "");
        if (value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && (index > 0 || !value.toLowerCase().includes("email"))) {
          parsed.push({ email: value.toLowerCase(), status: "Subscribed" });
        }
      });
      setContacts(current => {
        const known = new Set(current.map(c => c.email));
        return [...current, ...parsed.filter(c => !known.has(c.email))];
      });
      setNotice(`Imported ${parsed.length} valid email row(s) from ${file.name}. Please verify consent before sending.`);
    };
    reader.readAsText(file);
  }

  function addProduct() {
    if (!productName.trim() || !productUrl.startsWith("http")) {
      setNotice("Enter a product name and a valid https:// product link.");
      return;
    }
    setProducts(current => [...current, { name: productName.trim(), price: productPrice.trim() || "Price not set", url: productUrl.trim() }]);
    setProductName(""); setProductPrice(""); setNotice("Product link added to your library.");
  }

  function saveCampaign() {
    if (!campaignName.trim() || !subject.trim()) {
      setNotice("Add a campaign name and email subject before saving.");
      return;
    }
    setNotice(`Campaign “${campaignName}” saved as a local draft. Connect the backend and email provider to send campaigns.`);
    setCampaignName(""); setSubject("");
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="#"><span className="brand-mark">S</span><span>sendvoria<small>Marketing meets Commerce.</small></span></a>
        <div className="workspace-label">WORKSPACE</div>
        <nav>{navItems.map(item => <button key={item} onClick={() => { setActive(item); setNotice(""); }} className={active === item ? "nav-item active" : "nav-item"}><span className="nav-dot">{item === "Overview" ? "⌂" : item === "Campaigns" ? "✉" : item === "Contacts" ? "◎" : item === "Products" ? "▣" : item === "Automations" ? "↗" : item === "Analytics" ? "▥" : "⚙"}</span>{item}{item === "Contacts" && <span className="nav-count">{contacts.length}</span>}</button>)}</nav>
        <div className="sidebar-bottom"><div className="plan-card"><div className="plan-icon">✦</div><strong>Free workspace</strong><p>Start with the essentials. Upgrade only when you need more.</p><span className="plan-link">Plan limits apply</span></div><div className="profile"><div className="avatar">UF</div><div><strong>Workspace owner</strong><small>Free plan</small></div><span className="more">•••</span></div></div>
      </aside>

      <section className="main-area">
        <header className="topbar"><div className="crumb">Workspace <span>/</span> <b>{active}</b></div><div className="top-actions"><span className="status"><i /> All systems ready</span><button className="help-button" onClick={() => setNotice("Sendvoria starter workspace. Backend, authentication and email delivery are not connected yet.")}>Help</button><div className="avatar small-avatar">UF</div></div></header>
        <div className="content">
          {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}
          {active === "Overview" && <>
            <div className="page-heading"><div><div className="eyebrow">YOUR MARKETING HUB</div><h1>Good afternoon 👋</h1><p>Here’s what’s happening in your Sendvoria workspace.</p></div><button className="primary-button" onClick={() => setActive("Campaigns")}>＋ Create campaign</button></div>
            <div className="stats-grid">
              <Stat title="Total contacts" value={contacts.length.toLocaleString()} change="Import your audience" icon="◎" />
              <Stat title="Subscribed contacts" value={subscribed.toLocaleString()} change="Consent-based audience" icon="♧" />
              <Stat title="Campaigns sent" value="0" change="No campaigns sent yet" icon="✉" />
              <Stat title="Product links" value={products.length.toString()} change="Ready to promote" icon="▣" />
            </div>
            <div className="two-col">
              <div className="panel"><div className="panel-head"><div><h2>Get started with Sendvoria</h2><p>Your launch checklist</p></div><span className="muted-tag">3 steps</span></div><div className="check-list"><Task n="01" title="Import your contacts" desc="Upload a CSV of people who agreed to receive marketing." done={contacts.length > 0} onClick={() => setActive("Contacts")} /><Task n="02" title="Add your products" desc="Save product details and links to your online store." done={products.length > 2} onClick={() => setActive("Products")} /><Task n="03" title="Create your first campaign" desc="Build an email draft and preview your message." done={false} onClick={() => setActive("Campaigns")} /></div></div>
              <div className="panel audience-panel"><div className="panel-head"><div><h2>Audience snapshot</h2><p>Your contact list at a glance</p></div><span className="audience-icon">◎</span></div><div className="audience-number">{contacts.length.toLocaleString()}<small> contacts imported</small></div><div className="progress"><span style={{width: contacts.length ? "100%" : "0%"}} /></div><div className="legend-row"><span><i className="green-dot" /> Subscribed</span><b>{subscribed}</b></div><div className="legend-row"><span><i className="gray-dot" /> Unsubscribed</span><b>{contacts.length - subscribed}</b></div><button className="secondary-button full" onClick={() => setActive("Contacts")}>Manage contacts →</button></div>
            </div>
            <div className="panel bottom-panel"><div className="panel-head"><div><h2>Recently added products</h2><p>Links that can be added to your email campaigns</p></div><button className="text-button" onClick={() => setActive("Products")}>View product library →</button></div><div className="product-mini-list">{products.slice(0,3).map((p,i)=><div className="product-mini" key={i}><div className="product-thumb">{p.name.slice(0,1).toUpperCase()}</div><div className="product-info"><strong>{p.name}</strong><small>{p.url}</small></div><b>{p.price}</b></div>)}</div></div>
          </>}

          {active === "Contacts" && <><PageTitle eyebrow="AUDIENCE" title="Contacts" desc="Manage your subscribers and keep consent records organized." /><div className="stats-grid compact"><Stat title="All contacts" value={contacts.length.toLocaleString()} change="Unique imported emails" icon="◎"/><Stat title="Subscribed" value={subscribed.toLocaleString()} change="Eligible only after consent check" icon="♧"/><Stat title="Unsubscribed" value={(contacts.length-subscribed).toString()} change="Suppressed from marketing" icon="⊘"/></div><div className="panel"><div className="panel-head"><div><h2>Import contacts</h2><p>Upload a CSV file with an email column. The starter importer reads the first column.</p></div><span className="muted-tag">CSV upload</span></div><label className="upload-zone"><span className="upload-icon">↑</span><strong>Choose a CSV file to import</strong><small>{csvName || "CSV format · one email address per row"}</small><input type="file" accept=".csv,text/csv" onChange={e => importCsv(e.target.files?.[0])}/></label><p className="fine-print">Important: Only import people who have explicitly opted in to receive your marketing. Confirm consent and applicable privacy rules before sending.</p></div><div className="panel bottom-panel"><div className="panel-head"><div><h2>Contact list</h2><p>{contacts.length} contacts in this browser session</p></div></div>{contacts.length ? <div className="table-wrap"><table><thead><tr><th>Email</th><th>Status</th></tr></thead><tbody>{contacts.slice(0,100).map((c,i)=><tr key={i}><td>{c.email}</td><td><span className="pill green-pill">{c.status}</span></td></tr>)}</tbody></table></div> : <Empty title="Your audience is waiting" desc="Import a CSV to see contacts here."/>}</div></>}

          {active === "Products" && <><PageTitle eyebrow="COMMERCE LINKS" title="Product library" desc="Add products from your store. Customers will shop and check out on your own website."/><div className="panel"><div className="panel-head"><div><h2>Add a product link</h2><p>Sendvoria stores the product details and destination URL—not orders or payments.</p></div><span className="muted-tag">External checkout</span></div><div className="form-grid"><Field label="Product name"><input value={productName} onChange={e=>setProductName(e.target.value)} placeholder="e.g. Forever Love Necklace"/></Field><Field label="Price (optional)"><input value={productPrice} onChange={e=>setProductPrice(e.target.value)} placeholder="$39.00"/></Field><Field label="Product page URL" wide><input value={productUrl} onChange={e=>setProductUrl(e.target.value)} placeholder="https://yourstore.com/products/item"/></Field></div><button className="primary-button" onClick={addProduct}>＋ Add product</button></div><div className="panel bottom-panel"><div className="panel-head"><div><h2>Saved products</h2><p>{products.length} product links available for campaigns</p></div></div><div className="product-list">{products.map((p,i)=><div className="product-row" key={i}><div className="product-thumb large-thumb">{p.name.slice(0,1).toUpperCase()}</div><div className="product-info"><strong>{p.name}</strong><small>{p.url}</small></div><b>{p.price}</b><a className="open-link" href={p.url} target="_blank" rel="noreferrer">Open ↗</a></div>)}</div></div></>}

          {active === "Campaigns" && <><PageTitle eyebrow="EMAIL MARKETING" title="Campaigns" desc="Create and save campaign drafts. Live sending will be enabled after email provider setup."/><div className="panel"><div className="panel-head"><div><h2>New email campaign</h2><p>Start with a name and subject line. You can connect templates and product blocks next.</p></div><span className="muted-tag">Draft builder</span></div><div className="form-grid single"><Field label="Campaign name"><input value={campaignName} onChange={e=>setCampaignName(e.target.value)} placeholder="November gift collection"/></Field><Field label="Email subject"><input value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Thoughtful gifts they’ll remember"/></Field></div><div className="email-preview"><div className="preview-top"><span>EMAIL PREVIEW</span><span>Desktop · Draft</span></div><div className="preview-body"><div className="preview-brand">sendvoria</div><h2>Your next favorite gift is here.</h2><p>Discover thoughtful finds selected for the people who matter most.</p><div className="preview-product">{products[0]?.name || "Your featured product"}<br/><small>{products[0]?.price || "Product price"}</small></div><span className="preview-cta">SHOP NOW ↗</span><small className="preview-url">Button links to your external product page</small></div></div><button className="primary-button" onClick={saveCampaign}>Save campaign draft</button><p className="fine-print">This starter version saves the draft notice in the current session only. Database persistence, templates, test emails, scheduling and delivery are upcoming integrations.</p></div><div className="panel bottom-panel"><div className="panel-head"><div><h2>Campaign activity</h2><p>Your saved and sent campaigns will appear here.</p></div></div><Empty title="No campaigns yet" desc="Create your first campaign draft to get started."/></div></>}

          {active === "Automations" && <><PageTitle eyebrow="CUSTOMER JOURNEYS" title="Automations" desc="Plan timely messages around subscriber actions."/><div className="automation-grid">{[["Welcome series","Introduce your brand to new subscribers.","Available after backend setup"],["Product follow-up","Share related products after a link click.","Requires click tracking"],["Win-back campaign","Reconnect with inactive subscribers.","Requires engagement history"],["Birthday message","Send a special note on a subscriber's birthday.","Requires date field and consent"]].map((a,i)=><div className="panel automation-card" key={a[0]}><div className="automation-symbol">{["✦","▣","↻","♡"][i]}</div><h2>{a[0]}</h2><p>{a[1]}</p><span className="muted-tag">{a[2]}</span><button className="secondary-button" onClick={()=>setNotice(`${a[0]} is planned for a future backend-enabled release.`)}>View setup</button></div>)}</div></>}

          {active === "Analytics" && <><PageTitle eyebrow="PERFORMANCE" title="Analytics" desc="Measure delivery, engagement and store visits after integrations are connected."/><div className="stats-grid"><Stat title="Emails delivered" value="—" change="Provider connection required" icon="✉"/><Stat title="Open rate" value="—" change="Tracking not connected" icon="◉"/><Stat title="Click rate" value="—" change="Tracking not connected" icon="↗"/><Stat title="Store revenue" value="—" change="Store attribution not connected" icon="$"/></div><div className="panel"><Empty title="Analytics will appear here" desc="Connect an email provider and add store tracking to measure real campaign performance. Open rates can be affected by privacy features in email clients."/></div></>}

          {active === "Settings" && <><PageTitle eyebrow="WORKSPACE" title="Settings" desc="Configure your brand, sending identity and integrations."/><div className="panel settings-row"><div><h2>Workspace profile</h2><p>Sendvoria · Marketing meets Commerce.</p></div><span className="pill green-pill">Starter</span></div><div className="panel settings-row"><div><h2>Email provider</h2><p>Not connected. Add provider credentials as server-side environment variables after backend setup.</p></div><span className="pill yellow-pill">Setup needed</span></div><div className="panel settings-row"><div><h2>Database & authentication</h2><p>Supabase integration is not connected in this starter commit.</p></div><span className="pill yellow-pill">Setup needed</span></div><div className="panel settings-row"><div><h2>Privacy & compliance</h2><p>Production release must include verified opt-in, unsubscribe links, suppression lists and bounce/complaint handling.</p></div><span className="pill yellow-pill">Required before sending</span></div></>}
        </div>
      </section>
    </main>
  );
}

function Stat({title,value,change,icon}:{title:string;value:string;change:string;icon:string}) { return <div className="stat-card"><div className="stat-top"><span>{title}</span><i>{icon}</i></div><strong>{value}</strong><small>{change}</small></div>; }
function PageTitle({eyebrow,title,desc}:{eyebrow:string;title:string;desc:string}) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{desc}</p></div></div>; }
function Field({label,children,wide=false}:{label:string;children:React.ReactNode;wide?:boolean}) { return <label className={wide?"field wide":"field"}><span>{label}</span>{children}</label>; }
function Task({n,title,desc,done,onClick}:{n:string;title:string;desc:string;done:boolean;onClick:()=>void}) { return <button className="task" onClick={onClick}><span className={done?"task-number done":"task-number"}>{done?"✓":n}</span><span className="task-copy"><strong>{title}</strong><small>{desc}</small></span><span className="task-arrow">→</span></button>; }
function Empty({title,desc}:{title:string;desc:string}) { return <div className="empty"><span>✧</span><strong>{title}</strong><p>{desc}</p></div>; }