"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type PublicContract } from "@/lib/api";
import { SignaturePad } from "@/components/contract/signature-pad";

const STEPS = [
  { id: "otp", label: "Telefon" },
  { id: "read", label: "Müqavilə" },
  { id: "sign", label: "Əl imzası" },
  { id: "confirm", label: "OTP təsdiq" },
  { id: "done", label: "PDF" },
] as const;

function sessionKey(token: string) {
  return `anx_contract_session_${token}`;
}

export function ContractSign({ token }: { token: string }) {
  const [data, setData] = useState<PublicContract | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [session, setSession] = useState("");
  const [signature, setSignature] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [readFully, setReadFully] = useState(false);
  const [acceptedEsign, setAcceptedEsign] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [signOtpSent, setSignOtpSent] = useState(false);
  const [phase, setPhase] = useState<(typeof STEPS)[number]["id"]>("otp");
  const readerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (sessionToken?: string) => {
      const next = await api.publicContract(token, sessionToken);
      setData(next);
      if (next.step === "done") setPhase("done");
      else if (next.step === "void") setError("Bu müqavilə ləğv edilib.");
      else if (next.step === "sign") setPhase("sign");
      else if (next.step === "read") setPhase("read");
      else setPhase("otp");
      return next;
    },
    [token],
  );

  useEffect(() => {
    const stored = sessionStorage.getItem(sessionKey(token)) ?? "";
    setSession(stored);
    load(stored || undefined).catch((err: Error) => setError(err.message || "Müqavilə açılmadı."));
  }, [load, token]);

  const activeIndex = useMemo(() => STEPS.findIndex((s) => s.id === phase), [phase]);

  async function sendPhoneOtp() {
    setBusy("otp");
    setError("");
    try {
      const res = await api.publicContractOtp(token, { purpose: "PHONE_VERIFY" });
      setDevCode(res.devCode ?? null);
      if (!res.sent && !res.devCode) setError(otpHint(res.error));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kod göndərilmədi.");
    }
    setBusy("");
  }

  async function verifyPhone() {
    if (code.trim().length < 4) return;
    setBusy("verify");
    setError("");
    try {
      const res = await api.publicContractVerify(token, { purpose: "PHONE_VERIFY", code: code.trim() });
      if (res.sessionToken) {
        sessionStorage.setItem(sessionKey(token), res.sessionToken);
        setSession(res.sessionToken);
        setCode("");
        setDevCode(null);
        await load(res.sessionToken);
        setPhase("read");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kod səhvdir.");
    }
    setBusy("");
  }

  function onReadScroll() {
    const el = readerRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setScrolled(true);
  }

  async function continueFromRead() {
    if (!session || !readFully || !scrolled) return;
    setBusy("read");
    try {
      await api.publicContractRead(token, session);
      setPhase("sign");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Davam etmək olmadı.");
    }
    setBusy("");
  }

  async function sendSignOtp() {
    if (!session || !signature) return;
    setBusy("sign-otp");
    setError("");
    try {
      const res = await api.publicContractOtp(token, { purpose: "SIGN_CONFIRM", sessionToken: session });
      setDevCode(res.devCode ?? null);
      setSignOtpSent(true);
      setPhase("confirm");
      if (!res.sent && !res.devCode) setError(otpHint(res.error));
    } catch (err) {
      setError(err instanceof Error ? err.message : "İmza kodu göndərilmədi.");
    }
    setBusy("");
  }

  async function finalize() {
    if (!session || !signature || !acceptedEsign || !acceptedTerms || !readFully) return;
    setBusy("sign");
    setError("");
    try {
      await api.publicContractSign(token, {
        sessionToken: session,
        code: code.trim(),
        signaturePng: signature,
        readFully: true,
        acceptedEsign: true,
        acceptedTerms: true,
      });
      sessionStorage.removeItem(sessionKey(token));
      await load();
      setPhase("done");
      setCode("");
      setDevCode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "İmza qəbul olunmadı.");
    }
    setBusy("");
  }

  if (!data && !error) {
    return <p className="px-5 pt-32 text-sm text-muted">Müqavilə yüklənir…</p>;
  }

  if (error && !data) {
    return (
      <article className="mx-auto max-w-lg px-5 pt-32 pb-24">
        <h1 className="font-display text-3xl">Müqavilə tapılmadı</h1>
        <p className="mt-4 text-sm text-muted">{error}</p>
      </article>
    );
  }

  if (!data) return null;

  return (
    <article className="mx-auto max-w-3xl px-5 pt-28 pb-24 md:px-8">
      <p className="text-[11px] uppercase tracking-[0.32em] text-muted">Elektron müqavilə</p>
      <h1 className="font-display mt-3 text-3xl text-fg md:text-4xl">№ {data.number}</h1>
      <p className="mt-2 text-sm text-muted">
        {data.customerName} · {data.maskedPhone}
        {data.vin ? ` · VIN ${data.vin}` : ""}
      </p>

      <ol className="mt-8 grid grid-cols-5 gap-2 text-[11px] uppercase tracking-wide">
        {STEPS.map((step, i) => (
          <li
            key={step.id}
            className={`rounded-lg px-2 py-2 text-center ${
              i <= activeIndex ? "bg-fg text-bg" : "border border-line text-muted"
            }`}
          >
            {step.label}
          </li>
        ))}
      </ol>

      {error && <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      {phase === "otp" && (
        <section className="mt-10 space-y-5">
          <h2 className="font-display text-2xl">Telefon nömrəsinin təsdiqi</h2>
          <p className="text-sm leading-7 text-muted">
            Müqavilə mətni yalnız SMS kodundan sonra açılır. Kod {data.maskedPhone} nömrəsinə gəlir. Bu, «Elektron imza və
            elektron sənəd haqqında» Qanuna uyğun olaraq imza vasitəsinin (telefonun) sizin nəzarətinizdə olduğunu təsdiqləyir.
          </p>
          <button
            type="button"
            disabled={busy === "otp"}
            onClick={() => void sendPhoneOtp()}
            className="rounded-xl bg-fg px-5 py-3 text-sm text-bg disabled:opacity-50"
          >
            {busy === "otp" ? "Göndərilir…" : "SMS kod göndər"}
          </button>
          {devCode && (
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              SMS xidməti qurulmayıbsa kod: <span className="font-mono text-lg">{devCode}</span>
            </p>
          )}
          <label className="block text-xs text-muted">
            6 rəqəmli kod
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-1 w-full rounded-xl border border-line bg-transparent px-4 py-3 font-mono text-lg tracking-[0.4em] text-fg"
            />
          </label>
          <button
            type="button"
            disabled={busy === "verify" || code.length < 4}
            onClick={() => void verifyPhone()}
            className="rounded-xl border border-line px-5 py-3 text-sm disabled:opacity-40"
          >
            {busy === "verify" ? "Yoxlanır…" : "Kodu təsdiqlə və müqaviləni aç"}
          </button>
        </section>
      )}

      {phase === "read" && data.body && (
        <section className="mt-10">
          <h2 className="font-display text-2xl">Müqaviləni tam oxuyun</h2>
          <p className="mt-2 text-sm text-muted">Aşağı sürüşdürmədən və oxuduğunuzu təsdiqləmədən imzaya keçilmir.</p>
          <div
            ref={readerRef}
            onScroll={onReadScroll}
            className="mt-6 max-h-[28rem] overflow-y-auto rounded-2xl border border-line bg-card p-5 md:p-8"
          >
            <p className="text-[11px] uppercase tracking-[0.28em] text-muted">{data.body.kicker}</p>
            <h3 className="font-display mt-2 text-xl">{data.body.title}</h3>
            <p className="mt-4 text-sm leading-7 text-muted">{data.body.intro}</p>
            {data.body.sections.map((section) => (
              <section key={section.id} className="mt-8">
                <h4 className="font-display text-lg">{section.title}</h4>
                {section.paragraphs.map((p, i) => (
                  <p key={`${section.id}-${i}`} className="mt-3 text-sm leading-7 text-muted">
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </div>
          <label className="mt-5 flex items-start gap-3 text-sm">
            <input type="checkbox" checked={readFully} onChange={(e) => setReadFully(e.target.checked)} className="mt-1" />
            <span>Müqavilənin bütün bölmələrini oxudum və şərtləri qəbul edirəm.</span>
          </label>
          {!scrolled && <p className="mt-2 text-xs text-muted">Davam üçün mətni axıra qədər sürüşdürün.</p>}
          <button
            type="button"
            disabled={!scrolled || !readFully || busy === "read"}
            onClick={() => void continueFromRead()}
            className="mt-5 rounded-xl bg-fg px-5 py-3 text-sm text-bg disabled:opacity-40"
          >
            Elektron imzaya keç
          </button>
        </section>
      )}

      {phase === "sign" && (
        <section className="mt-10 space-y-5">
          <h2 className="font-display text-2xl">Əl ilə elektron imza</h2>
          <p className="text-sm leading-7 text-muted">
            Ekranda imzanızı çəkin. Bu təsvir PDF-ə düşür və OTP kodu ilə birlikdə sadə elektron imzanızı təşkil edir.
          </p>
          <SignaturePad onChange={setSignature} />
          <button
            type="button"
            disabled={!signature || busy === "sign-otp"}
            onClick={() => void sendSignOtp()}
            className="rounded-xl bg-fg px-5 py-3 text-sm text-bg disabled:opacity-40"
          >
            {busy === "sign-otp" ? "Kod göndərilir…" : "İmzanı saxla və təsdiq kodu göndər"}
          </button>
        </section>
      )}

      {phase === "confirm" && (
        <section className="mt-10 space-y-5">
          <h2 className="font-display text-2xl">İkinci OTP — imzanın təsdiqi</h2>
          <p className="text-sm leading-7 text-muted">
            Əl imzası kifayət deyil. Eyni telefon nömrəsinə ikinci kod gəlir. Hər iki element olmadan müqavilə bağlanmış
            sayılmır.
          </p>
          {signature && (
            <img src={signature} alt="İmza önbaxış" className="h-24 rounded-xl border border-line bg-white" />
          )}
          {signOtpSent && (
            <button type="button" className="text-xs underline" onClick={() => void sendSignOtp()}>
              Kodu yenidən göndər
            </button>
          )}
          {devCode && (
            <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              Kod: <span className="font-mono text-lg">{devCode}</span>
            </p>
          )}
          <label className="block text-xs text-muted">
            Təsdiq kodu
            <input
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-1 w-full rounded-xl border border-line bg-transparent px-4 py-3 font-mono text-lg tracking-[0.4em]"
            />
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={acceptedEsign} onChange={(e) => setAcceptedEsign(e.target.checked)} className="mt-1" />
            <span>
              Elektron imzanın (OTP + əl imzası) kağız imza ilə eyni hüquqi nəticə doğurmasını qəbul edirəm.
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-1" />
            <span>Məlumatlarım doğrudur; OTP mənə məxsus nömrəyə gəlib; ekrandakı imza mənimdir.</span>
          </label>
          <button
            type="button"
            disabled={busy === "sign" || code.length < 4 || !acceptedEsign || !acceptedTerms || !signature}
            onClick={() => void finalize()}
            className="rounded-xl bg-fg px-5 py-3 text-sm text-bg disabled:opacity-40"
          >
            {busy === "sign" ? "İmzalanır…" : "Təsdiq et və PDF yarat"}
          </button>
        </section>
      )}

      {phase === "done" && (
        <section className="mt-10 space-y-4">
          <h2 className="font-display text-2xl">Müqavilə imzalandı</h2>
          <p className="text-sm leading-7 text-muted">
            Sənəd Auto Nex reyestrinə düşdü. PDF keçidi WhatsApp və e-poçtunuza da göndərilir.
          </p>
          {data.documentHash && (
            <p className="break-all font-mono text-[11px] text-muted">SHA-256: {data.documentHash}</p>
          )}
          {data.signaturePng && (
            <img src={data.signaturePng} alt="İmza" className="h-20 rounded-xl border border-line bg-white" />
          )}
          <a
            href={api.publicContractPdfUrl(token)}
            className="inline-block rounded-xl bg-fg px-5 py-3 text-sm text-bg"
            target="_blank"
            rel="noreferrer"
          >
            PDF-i aç
          </a>
        </section>
      )}
    </article>
  );
}

function otpHint(error?: string) {
  if (error === "not_configured") return "WhatsApp/SMS hələ qoşulmayıb. Auto Nex-ə yazın.";
  if (error === "no_phone") return "Telefonsuz kod getməz.";
  return "Kod göndərilmədi. Bir dəqiqə sonra yenidən cəhd edin.";
}
