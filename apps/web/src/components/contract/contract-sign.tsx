"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type PublicContract } from "@/lib/api";
import { SignaturePad } from "@/components/contract/signature-pad";
import { LOCALES, type Locale } from "@/lib/constants";

const STEPS = [
  { id: "otp", az: "Telefon", en: "Phone", ru: "Телефон", tr: "Telefon" },
  { id: "read", az: "Müqavilə", en: "Contract", ru: "Договор", tr: "Sözleşme" },
  { id: "sign", az: "Əl imzası", en: "Signature", ru: "Подпись", tr: "İmza" },
  { id: "confirm", az: "OTP təsdiq", en: "OTP confirm", ru: "OTP", tr: "OTP" },
  { id: "done", az: "PDF", en: "PDF", ru: "PDF", tr: "PDF" },
] as const;

const UI = {
  az: {
    pick: "Müqavilə dilini seçin",
    pickSub: "İmza səhifəsi seçdiyiniz dildə açılacaq.",
    continue: "Davam et",
    loading: "Müqavilə yüklənir…",
    missing: "Müqavilə tapılmadı",
    econtract: "Elektron müqavilə",
  },
  en: {
    pick: "Choose contract language",
    pickSub: "The signing page opens in the language you pick.",
    continue: "Continue",
    loading: "Loading contract…",
    missing: "Contract not found",
    econtract: "Electronic contract",
  },
  ru: {
    pick: "Выберите язык договора",
    pickSub: "Страница подписи откроется на выбранном языке.",
    continue: "Далее",
    loading: "Загрузка…",
    missing: "Договор не найден",
    econtract: "Электронный договор",
  },
  tr: {
    pick: "Sözleşme dilini seçin",
    pickSub: "İmza sayfası seçtiğiniz dilde açılır.",
    continue: "Devam",
    loading: "Yükleniyor…",
    missing: "Sözleşme bulunamadı",
    econtract: "Elektronik sözleşme",
  },
} as const;

function sessionKey(token: string) {
  return `anx_contract_session_${token}`;
}

function langKey(token: string) {
  return `anx_contract_lang_${token}`;
}

export function ContractSign({ token, requireLanguage = false }: { token: string; requireLanguage?: boolean }) {
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
  const [phase, setPhase] = useState<(typeof STEPS)[number]["id"] | "lang">("otp");
  const [lang, setLang] = useState<Locale>("az");
  const readerRef = useRef<HTMLDivElement>(null);
  const ui = UI[lang];

  const load = useCallback(
    async (sessionToken?: string, locale?: Locale) => {
      const next = await api.publicContract(token, sessionToken, locale ?? lang);
      setData(next);
      if (next.sessionToken) {
        sessionStorage.setItem(sessionKey(token), next.sessionToken);
        setSession(next.sessionToken);
      }
      const insurance = next.kind === "INSURANCE";
      if (next.step === "done") setPhase("done");
      else if (next.step === "void") setError("Bu müqavilə ləğv edilib.");
      else if (next.step === "sign") setPhase("sign");
      else if (next.step === "read" || insurance) setPhase("read");
      else setPhase("otp");
      return next;
    },
    [token, lang],
  );

  useEffect(() => {
    const stored = sessionStorage.getItem(sessionKey(token)) ?? "";
    const savedLang = (sessionStorage.getItem(langKey(token)) as Locale | null) ?? null;
    setSession(stored);
    if (requireLanguage && !savedLang) {
      setPhase("lang");
      api
        .publicContract(token, stored || undefined)
        .then((next) => {
          setData(next);
          if (next.sessionToken) {
            sessionStorage.setItem(sessionKey(token), next.sessionToken);
            setSession(next.sessionToken);
          }
        })
        .catch((err: Error) => setError(err.message || "Müqavilə açılmadı."));
      return;
    }
    if (savedLang) setLang(savedLang);
    load(stored || undefined, savedLang || undefined).catch((err: Error) => setError(err.message || "Müqavilə açılmadı."));
  }, [load, requireLanguage, token]);

  async function pickLanguage(next: Locale) {
    sessionStorage.setItem(langKey(token), next);
    setLang(next);
    const stored = sessionStorage.getItem(sessionKey(token)) ?? "";
    await load(stored || undefined, next).catch((err: Error) => setError(err.message || ui.missing));
  }

  const insurance = data?.kind === "INSURANCE";
  const visibleSteps = useMemo(
    () => (insurance ? STEPS.filter((s) => s.id !== "otp") : [...STEPS]),
    [insurance],
  );
  const activeIndex = useMemo(() => visibleSteps.findIndex((s) => s.id === phase), [phase, visibleSteps]);

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
    let sessionToken = session;
    if (!sessionToken && insurance) {
      const next = await api.publicContract(token, undefined, lang);
      if (next.sessionToken) {
        sessionStorage.setItem(sessionKey(token), next.sessionToken);
        setSession(next.sessionToken);
        sessionToken = next.sessionToken;
      }
    }
    if (!sessionToken || !readFully || !scrolled) return;
    setBusy("read");
    try {
      await api.publicContractRead(token, sessionToken);
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
        locale: lang,
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
    return <p className="px-5 pt-32 text-sm text-muted">{ui.loading}</p>;
  }

  if (error && !data) {
    return (
      <article className="mx-auto max-w-lg px-5 pt-32 pb-24">
        <h1 className="font-display text-3xl">{ui.missing}</h1>
        <p className="mt-4 text-sm text-muted">{error}</p>
      </article>
    );
  }

  if (!data) return null;

  return (
    <article className="mx-auto max-w-3xl px-5 pt-28 pb-24 md:px-8">
      {requireLanguage || data.kind === "INSURANCE" ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {LOCALES.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => void pickLanguage(item.code)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                lang === item.code ? "border-fg bg-fg text-bg" : "border-line text-muted"
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>
      ) : null}
      <p className="text-[11px] uppercase tracking-[0.32em] text-muted">{ui.econtract}</p>
      <h1 className="font-display mt-3 text-3xl text-fg md:text-4xl">№ {data.number}</h1>
      <p className="mt-2 text-sm text-muted">
        {data.customerName} · {data.maskedPhone}
        {data.customerIdNumber ? ` · Vəsiqə ${data.customerIdNumber}` : ""}
        {data.vin ? ` · VIN ${data.vin}` : ""}
        {data.make || data.model ? ` · ${[data.year, data.make, data.model].filter(Boolean).join(" ")}` : ""}
      </p>

      {phase === "lang" ? (
        <section className="mt-10 space-y-5">
          <h2 className="font-display text-3xl">{ui.pick}</h2>
          <p className="text-sm text-muted">{ui.pickSub}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {LOCALES.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => void pickLanguage(item.code)}
                className="rounded-2xl border border-line px-5 py-4 text-left text-lg hover:border-fg"
              >
                {item.name}
              </button>
            ))}
          </div>
        </section>
      ) : (
      <>
      <ol className={`mt-8 grid gap-2 text-[11px] uppercase tracking-wide ${insurance ? "grid-cols-4" : "grid-cols-5"}`}>
        {visibleSteps.map((step, i) => (
          <li
            key={step.id}
            className={`rounded-lg px-2 py-2 text-center ${
              i <= activeIndex ? "bg-fg text-bg" : "border border-line text-muted"
            }`}
          >
            {step[lang]}
          </li>
        ))}
      </ol>

      {error && <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}

      {phase === "otp" && !insurance && (
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
            className="mt-6 max-h-[32rem] overflow-y-auto rounded-2xl border border-line bg-white p-5 text-[#111] md:p-8"
          >
            <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-500">{data.body.kicker}</p>
            <h3 className="mt-2 font-sans text-xl font-semibold leading-snug">{data.body.title}</h3>
            <p className="mt-4 font-sans text-[15px] leading-8 text-zinc-700">{data.body.intro}</p>
            {data.body.sections.map((section) => (
              <section key={section.id} className="mt-8">
                <h4 className="font-sans text-base font-semibold">{section.title}</h4>
                {section.facts?.length ? (
                  <dl className="mt-3 divide-y divide-zinc-200 rounded-xl border border-zinc-200">
                    {section.facts.map((fact) => (
                      <div key={`${section.id}-${fact.label}`} className="grid grid-cols-1 gap-1 px-3 py-2.5 sm:grid-cols-[13rem_1fr] sm:gap-4">
                        <dt className="font-sans text-xs text-zinc-500">{fact.label}</dt>
                        <dd className="font-sans text-sm font-medium text-zinc-900">{fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {section.paragraphs.map((p, i) => (
                  <p key={`${section.id}-${i}`} className="mt-3 font-sans text-[15px] leading-8 text-zinc-700">
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
          <h2 className="font-display text-2xl">{insurance ? "SMS kod — imzanın təsdiqi" : "İkinci OTP — imzanın təsdiqi"}</h2>
          <p className="text-sm leading-7 text-muted">
            {insurance
              ? "Əl imzasından sonra telefonunuza bir dəfə SMS kod gəlir. Bu kod olmadan sığorta müqaviləsi bağlanmış sayılmır."
              : "Əl imzası kifayət deyil. Eyni telefon nömrəsinə ikinci kod gəlir. Hər iki element olmadan müqavilə bağlanmış sayılmır."}
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
            {data.kind === "INSURANCE"
              ? "Sığorta müqaviləsi təsdiqləndi. Qısa sonra sığorta haqqı hesabınıza köçürüləcək — SMS də göndərilir."
              : "Sənəd Auto Nex reyestrinə düşdü. PDF keçidi WhatsApp və e-poçtunuza da göndərilir."}
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
      </>
      )}
    </article>
  );
}

function otpHint(error?: string) {
  if (error === "not_configured") return "WhatsApp/SMS hələ qoşulmayıb. Auto Nex-ə yazın.";
  if (error === "no_phone") return "Telefonsuz kod getməz.";
  return "Kod göndərilmədi. Bir dəqiqə sonra yenidən cəhd edin.";
}
