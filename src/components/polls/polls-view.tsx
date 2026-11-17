"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import type { PublicPoll } from "@/lib/public-types";
import type { Locale } from "@/i18n";

const copy = {
  en: {
    eyebrow: "THE COMMUNITY PULSE", title: "A clearer picture starts with your voice.",
    intro: "Weigh in on public questions shaping Bangladesh. Each poll allows one vote per IP address and browser profile; results appear after you vote.",
    once: "ONE VOTE PER IP + BROWSER", open: "Open polls", closed: "Closed polls", loading: "Loading polls…", noOpen: "No open polls right now.", noClosed: "Closed poll results will appear here.",
    vote: "Cast my vote", voted: "Your vote is in", closedLabel: "Poll closed", votes: "votes", closes: "Closes", ended: "Ended", source: "Read background", showResults: "Vote to see the results",
    topics: { government: "Government & policy", society: "Society", local: "Local issues", other: "Public debate" },
    create: "Create a poll", createIntro: "Publish a clear, balanced question with enough context for people to make up their own minds.",
    question: "Poll question", topic: "Topic", context: "Background and context", contextHint: "Add neutral context. Avoid claims without evidence.", options: "Answer options", addOption: "Add option", sourceUrl: "Background link (optional)", closesAt: "Close at (optional)", publish: "Publish poll", publishing: "Publishing…", closePoll: "Close poll", reopen: "Reopen poll", error: "Something went wrong. Please try again.", saveError: "Could not publish the poll.", voteError: "Your vote could not be saved.", privacy: "Raw IPs are never stored. A secure first-party browser cookie helps prevent repeat votes; vote records keep only a keyed hash of that browser ID.", guideline: "Keep questions specific, neutral, and grounded in verifiable facts. Polls are community opinion, not official government results.",
  },
  bn: {
    eyebrow: "জনমতের চিত্র", title: "আপনার মতামতেই জনমতের চিত্র স্পষ্ট হয়।",
    intro: "বাংলাদেশের গুরুত্বপূর্ণ জনস্বার্থের বিষয়ে মত দিন। প্রতিটি আইপি ঠিকানা থেকে একবার ভোট দেওয়া যাবে; ভোট দেওয়ার পর ফল দেখা যাবে।",
    once: "প্রতি আইপি থেকে একবার ভোট", open: "চলমান জরিপ", closed: "শেষ হওয়া জরিপ", loading: "জরিপ লোড হচ্ছে…", noOpen: "এখন কোনো চলমান জরিপ নেই।", noClosed: "শেষ হওয়া জরিপের ফল এখানে দেখা যাবে।",
    vote: "আমার ভোট দিন", voted: "আপনার ভোট গ্রহণ করা হয়েছে", closedLabel: "জরিপ শেষ", votes: "টি ভোট", closes: "শেষ হবে", ended: "শেষ হয়েছে", source: "প্রেক্ষাপট পড়ুন", showResults: "ফল দেখতে ভোট দিন",
    topics: { government: "সরকার ও নীতি", society: "সমাজ", local: "স্থানীয় বিষয়", other: "জনআলোচনা" },
    create: "নতুন জরিপ", createIntro: "স্পষ্ট ও ভারসাম্যপূর্ণ প্রশ্ন এবং পর্যাপ্ত প্রেক্ষাপট দিয়ে জরিপ প্রকাশ করুন।",
    question: "জরিপের প্রশ্ন", topic: "বিষয়", context: "পটভূমি ও প্রেক্ষাপট", contextHint: "নিরপেক্ষ তথ্য দিন। প্রমাণহীন দাবি এড়িয়ে চলুন।", options: "উত্তরের বিকল্প", addOption: "বিকল্প যোগ করুন", sourceUrl: "প্রেক্ষাপটের লিংক (ঐচ্ছিক)", closesAt: "শেষ হওয়ার সময় (ঐচ্ছিক)", publish: "জরিপ প্রকাশ করুন", publishing: "প্রকাশ হচ্ছে…", closePoll: "জরিপ বন্ধ করুন", reopen: "জরিপ আবার চালু করুন", error: "সমস্যা হয়েছে। আবার চেষ্টা করুন।", saveError: "জরিপ প্রকাশ করা যায়নি।", voteError: "আপনার ভোট সংরক্ষণ করা যায়নি।", privacy: "আপনার আইপি ঠিকানা দেখানো বা সংরক্ষণ করা হয় না। পুনরায় ভোট ঠেকাতে শুধু একমুখী সুরক্ষিত হ্যাশ ব্যবহার করা হয়।", guideline: "প্রশ্ন নির্দিষ্ট, নিরপেক্ষ এবং যাচাইযোগ্য তথ্যভিত্তিক রাখুন। জরিপের ফল জনমত, সরকারি ফল নয়।",
  },
} as const;

type Topic = PublicPoll["topic"];
type ApiError = { error?: { message?: string } };

export function PollsView({ locale, canManage }: { locale: Locale; canManage: boolean }) {
  const t = copy[locale];
  const [polls, setPolls] = useState<PublicPoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/polls", { cache: "no-store" });
      if (!res.ok) throw new Error(t.error);
      const data = (await res.json()) as { items: PublicPoll[] };
      setPolls(data.items);
      setMessage("");
    } catch { setMessage(t.error); }
    finally { setLoading(false); }
  }, [t.error]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function vote(poll: PublicPoll, optionId: string) {
    setBusy(poll.id);
    setMessage("");
    try {
      const res = await fetch(`/api/polls/${poll.id}/votes`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId }),
      });
      const body = (await res.json()) as ApiError;
      if (!res.ok) throw new Error(body.error?.message || t.voteError);
      await refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : t.voteError); }
    finally { setBusy(null); }
  }

  async function setStatus(poll: PublicPoll, status: "open" | "closed") {
    setBusy(poll.id);
    try {
      const res = await fetch(`/api/polls/${poll.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const body = (await res.json()) as ApiError;
      if (!res.ok) throw new Error(body.error?.message || t.error);
      await refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : t.error); }
    finally { setBusy(null); }
  }

  const open = polls.filter((p) => p.status === "open");
  const closed = polls.filter((p) => p.status === "closed");

  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 pt-7 md:px-6 md:pt-12">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#113d38] px-6 py-9 text-white shadow-card md:px-12 md:py-14">
        <div className="absolute -right-14 -top-24 h-72 w-72 rounded-full border border-white/10" />
        <div className="absolute -right-3 -top-12 h-52 w-52 rounded-full border border-white/10" />
        <div className="relative max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />{t.eyebrow}
          </div>
          <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight md:text-5xl">{t.title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-emerald-50/85 md:text-lg">{t.intro}</p>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-emerald-50/80">
            <span className="inline-flex items-center gap-2"><Icon name="checkCircle" size={17} />{t.once}</span>
            <span className="inline-flex items-center gap-2"><Icon name="shield" size={17} />{t.privacy}</span>
          </div>
        </div>
      </section>

      {message && <div role="status" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{message}</div>}

      {canManage && <CreatePollForm locale={locale} onCreated={refresh} />}

      <section className="mt-9" aria-labelledby="open-polls">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">{t.eyebrow}</p><h2 id="open-polls" className="mt-1 text-2xl font-bold tracking-tight text-ink">{t.open}</h2></div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-brand-800">{open.length}</span>
        </div>
        {loading ? <div className="card p-6 text-sm text-ink-muted">{t.loading}</div> : open.length ? <div className="grid gap-4 lg:grid-cols-2">{open.map((p) => <PollCard key={p.id} poll={p} t={t} busy={busy === p.id} canManage={canManage} onVote={vote} onStatus={setStatus} />)}</div> : <div className="card p-7 text-center text-ink-muted">{t.noOpen}</div>}
      </section>

      <section className="mt-11" aria-labelledby="closed-polls">
        <div className="mb-4 flex items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{t.eyebrow}</p><h2 id="closed-polls" className="mt-1 text-2xl font-bold tracking-tight text-ink">{t.closed}</h2></div><span className="rounded-full bg-canvas px-3 py-1 text-sm font-semibold text-ink-muted">{closed.length}</span></div>
        {loading ? <div className="card p-6 text-sm text-ink-muted">{t.loading}</div> : closed.length ? <div className="grid gap-4 lg:grid-cols-2">{closed.map((p) => <PollCard key={p.id} poll={p} t={t} busy={busy === p.id} canManage={canManage} onVote={vote} onStatus={setStatus} />)}</div> : <div className="card p-7 text-center text-ink-muted">{t.noClosed}</div>}
      </section>
      <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-ink-muted">{t.guideline}</p>
    </div>
  );
}

function PollCard({ poll, t, busy, canManage, onVote, onStatus }: {
  poll: PublicPoll;
  t: (typeof copy)[Locale];
  busy: boolean;
  canManage: boolean;
  onVote: (poll: PublicPoll, optionId: string) => void;
  onStatus: (poll: PublicPoll, status: "open" | "closed") => void;
}) {
  const [selectedOption, setSelectedOption] = useState("");
  const resultsVisible = poll.hasVoted || poll.status === "closed";
  return (
    <article className="card overflow-hidden p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-[#e8f4f1] px-3 py-1 text-xs font-semibold text-brand-800">{t.topics[poll.topic]}</span>
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${poll.status === "open" ? "text-emerald-700" : "text-ink-muted"}`}><span className={`h-2 w-2 rounded-full ${poll.status === "open" ? "bg-emerald-500" : "bg-slate-400"}`} />{poll.status === "open" ? (t.closes) : t.closedLabel}{poll.closesAt && poll.status === "open" ? ` · ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(poll.closesAt))}` : ""}</span>
      </div>
      <h3 className="mt-4 text-xl font-bold leading-snug text-ink">{poll.question}</h3>
      {poll.context && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink-muted">{poll.context}</p>}
      {poll.sourceUrl && <a className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline" href={poll.sourceUrl} target="_blank" rel="noopener noreferrer"><Icon name="link" size={15} />{t.source}<span className="sr-only"> (opens in a new tab)</span></a>}

      <div className="mt-5 space-y-2.5">
        {poll.options.map((o) => (
          <div key={o.id}>
            {resultsVisible ? (
              <div className="relative overflow-hidden rounded-xl border border-line bg-white">
                <div className="absolute inset-y-0 left-0 bg-[#e8f4f1] transition-[width] duration-500" style={{ width: `${o.percent}%` }} />
                <div className="relative flex items-center justify-between gap-3 px-3.5 py-3 text-sm"><span className="font-medium text-ink">{o.text}</span><span className="shrink-0 font-semibold tabular-nums text-brand-800">{o.percent}% <span className="font-normal text-ink-muted">· {o.votes}</span></span></div>
              </div>
            ) : (
              <button type="button" disabled={busy || poll.status !== "open"} aria-pressed={selectedOption === o.id} onClick={() => setSelectedOption(o.id)} className={`group flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition disabled:opacity-60 ${selectedOption === o.id ? "border-brand-600 bg-[#f5faf8] text-ink" : "border-line text-ink hover:border-brand-500 hover:bg-[#f5faf8]"}`}>
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selectedOption === o.id ? "border-brand-700" : "border-slate-300 group-hover:border-brand-600"}`}><span className={`h-2 w-2 rounded-full ${selectedOption === o.id ? "bg-brand-700" : "bg-transparent group-hover:bg-brand-600"}`} /></span>{o.text}
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-ink-muted">
        {resultsVisible ? <span>{poll.totalVotes.toLocaleString()} {t.votes}</span> : <span>{t.showResults}</span>}
        {poll.status === "open" && !poll.hasVoted && <Button size="sm" disabled={busy || !selectedOption} onClick={() => onVote(poll, selectedOption)}>{busy ? t.loading : t.vote}</Button>}
        {poll.hasVoted && poll.status === "open" && <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700"><Icon name="checkCircle" size={16} />{t.voted}</span>}
        {canManage && <button disabled={busy} onClick={() => onStatus(poll, poll.status === "open" ? "closed" : "open")} className="rounded-lg px-2 py-1 font-semibold text-ink-muted hover:bg-canvas disabled:opacity-50">{poll.status === "open" ? t.closePoll : t.reopen}</button>}
      </div>
    </article>
  );
}

function CreatePollForm({ locale, onCreated }: { locale: Locale; onCreated: () => Promise<void> }) {
  const t = copy[locale];
  const [expanded, setExpanded] = useState(false);
  const [options, setOptions] = useState(["", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError("");
    const formElement = e.currentTarget;
    const form = new FormData(formElement);
    const closeValue = String(form.get("closesAt") || "");
    const payload = { topic: form.get("topic"), question: form.get("question"), context: form.get("context"), sourceUrl: form.get("sourceUrl"), closesAt: closeValue ? new Date(closeValue).toISOString() : "", options: options.map((x) => x.trim()).filter(Boolean) };
    try {
      const res = await fetch("/api/polls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = (await res.json()) as ApiError;
      if (!res.ok) throw new Error(body.error?.message || t.saveError);
      formElement.reset(); setOptions(["", ""]); setExpanded(false); await onCreated();
    } catch (err) { setError(err instanceof Error ? err.message : t.saveError); }
    finally { setBusy(false); }
  }
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/70">
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
        <span><span className="block text-sm font-bold text-ink">{t.create}</span><span className="mt-1 block text-sm text-ink-muted">{t.createIntro}</span></span><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-700"><Icon name={expanded ? "x" : "plus"} size={19} /></span>
      </button>
      {expanded && <form onSubmit={submit} className="grid gap-4 border-t border-emerald-200 bg-white p-5 md:grid-cols-2 md:p-6">
        <label className="md:col-span-2"><span className="mb-1.5 block text-sm font-semibold">{t.question}</span><input name="question" required minLength={8} maxLength={180} className="w-full rounded-xl border border-line px-3.5 py-3 text-sm" /></label>
        <label><span className="mb-1.5 block text-sm font-semibold">{t.topic}</span><select name="topic" className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm">{Object.entries(t.topics).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span className="mb-1.5 block text-sm font-semibold">{t.closesAt}</span><input name="closesAt" type="datetime-local" className="w-full rounded-xl border border-line px-3 py-3 text-sm" /></label>
        <label className="md:col-span-2"><span className="mb-1.5 block text-sm font-semibold">{t.context}</span><textarea name="context" rows={3} maxLength={1000} placeholder={t.contextHint} className="w-full rounded-xl border border-line px-3.5 py-3 text-sm" /></label>
        <fieldset className="space-y-2 md:col-span-2"><legend className="mb-1.5 text-sm font-semibold">{t.options}</legend>{options.map((value, i) => <input key={i} required={i < 2} maxLength={80} value={value} onChange={(e) => setOptions(options.map((v, j) => j === i ? e.target.value : v))} aria-label={`${t.options} ${i + 1}`} className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm" />)}{options.length < 5 && <button type="button" onClick={() => setOptions([...options, ""])} className="text-sm font-semibold text-brand-700 hover:underline">+ {t.addOption}</button>}</fieldset>
        <label className="md:col-span-2"><span className="mb-1.5 block text-sm font-semibold">{t.sourceUrl}</span><input name="sourceUrl" type="url" maxLength={500} placeholder="https://" className="w-full rounded-xl border border-line px-3.5 py-3 text-sm" /></label>
        {error && <p role="alert" className="text-sm text-rose-700 md:col-span-2">{error}</p>}
        <div className="md:col-span-2"><Button type="submit" disabled={busy}>{busy ? t.publishing : t.publish}</Button></div>
      </form>}
    </section>
  );
}
