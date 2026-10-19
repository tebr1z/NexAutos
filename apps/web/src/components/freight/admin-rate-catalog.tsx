"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api";

type Overview = Awaited<ReturnType<typeof api.shippingOverview>>;
type Group = Overview["groups"][number];
type Row = Group["rows"][number];
type Editor = { group: Group; row?: Row; scope: "yard" | "state"; yard: string; values: string[] };
const input = "mt-1 w-full rounded-xl border border-white/15 bg-[#111827] px-3 py-2 text-sm text-white";
const button = "rounded-xl border border-white/15 px-3 py-2 text-sm disabled:opacity-50";
const usd = (value: number) => `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export function AdminRateCatalog({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<Overview | null>(null);
  const [auction, setAuction] = useState("COPART");
  const [state, setState] = useState("");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.shippingOverview().then((value) => { if (active) setData(value); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Tariflər yüklənmədi."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload, refreshKey]);

  const groups = data?.groups.filter((group) => group.auction === auction) ?? [];
  const missing = groups.filter((group) => group.missing);
  const term = search.trim().toLowerCase();
  const visible = groups.filter((group) => !state || group.state === state).map((group) => ({
    ...group,
    rows: group.rows.filter((row) => !term || `${group.state} ${group.stateName} ${row.yard}`.toLowerCase().includes(term)),
  })).filter((group) => group.rows.length > 0);

  function edit(group: Group, row?: Row) {
    setError(""); setNotice("");
    setEditor({ group, row, scope: row && !row.slug ? "state" : "yard", yard: row?.slug ? row.yard : "",
      values: data!.bands.map((band) => row?.rates[band.id] == null ? "" : String(row.rates[band.id])) });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editor || !data) return;
    const values = editor.values.map(Number);
    const slug = editor.yard.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (values.some((value) => !Number.isFinite(value) || value <= 0) || (editor.scope === "yard" && !slug)) {
      setError("Üç aralığın tarifini və şəhər/yard adını düzgün daxil edin."); return;
    }
    const key = editor.row?.key ?? `${editor.group.state}:${editor.group.auction}${editor.scope === "yard" ? `:${slug}` : ""}`;
    // Avoid silently replacing an existing route through the add form.
    if (!editor.row && editor.group.rows.some((row) => row.key === key)) {
      setError("Bu tarif artıq var. Siyahıdan «Düzəlt» düyməsi ilə dəyişin."); return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      await api.saveShippingRates({ cells: Object.fromEntries(data.bands.map((band, index) => [`${key}:${band.id}`, values[index]])) });
      setNotice(`${editor.group.auction} · ${editor.group.stateName} · ${editor.scope === "state" ? "Ümumi tarif" : editor.yard} bazaya yazıldı.`);
      setEditor(null); setReload((value) => value + 1);
    } catch (err) { setError(err instanceof Error ? err.message : "Tarif yadda saxlanılmadı."); }
    finally { setBusy(false); }
  }

  return <section className="mt-6 space-y-4" aria-label="ABŞ yol tarifləri">
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-xs text-zinc-400">Hərrac
        <select className={input} value={auction} onChange={(e) => setAuction(e.target.value)}><option value="COPART">Copart</option><option value="IAAI">IAAI</option></select>
      </label>
      <label className="text-xs text-zinc-400">Ştat
        <select className={input} value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">Bütün ABŞ — 50 ştat + DC</option>
          {groups.map((group) => <option key={group.state} value={group.state}>{group.stateName} ({group.state}){group.missing ? " — tarif yoxdur" : ""}</option>)}
        </select>
      </label>
      <label className="min-w-40 flex-1 text-xs text-zinc-400">Ştat / şəhər / yard axtar
        <input className={input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Məsələn: Savannah" />
      </label>
      <button className={button} disabled={loading || busy} onClick={() => setReload((value) => value + 1)}>Yenilə</button>
      <button className={button} disabled={!data || loading || busy} onClick={() => edit(groups.find((group) => group.state === state) ?? groups[0])}>+ Tarif əlavə et</button>
    </div>
    <p className="text-xs text-zinc-400">ABŞ–Poti tarifləri USD ilədir. Aralıq avtomobil + auction fee cəminə görə seçilir. Poti–Bakı ayrıca əlavə olunur{data ? ` (əsas tarif ${usd(data.tirUsd)})` : ""}.</p>
    {loading && <p role="status" className="text-sm text-zinc-400">Tariflər yüklənir…</p>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    {notice && <p role="status" className="text-sm text-emerald-400">{notice}</p>}

    {editor && <form onSubmit={save} className="space-y-3 rounded-2xl border border-sky-400/40 bg-sky-950/20 p-4">
      <fieldset disabled={busy} className="space-y-3">
        <legend className="font-medium">{editor.row ? "Tarifi düzəlt" : "Yeni tarif"} · {editor.group.auction} · {editor.group.stateName}</legend>
        {!editor.row && <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-zinc-400">Ştat
            <select className={input} value={editor.group.state} onChange={(e) => setEditor({ ...editor, group: data!.groups.find((group) => group.auction === editor.group.auction && group.state === e.target.value)! })}>
              {data?.groups.filter((group) => group.auction === editor.group.auction).map((group) => <option key={group.state} value={group.state}>{group.stateName} ({group.state})</option>)}
            </select>
          </label>
          <label className="text-xs text-zinc-400">Tarifin tətbiqi
            <select className={input} value={editor.scope} onChange={(e) => setEditor({ ...editor, scope: e.target.value as Editor["scope"] })}>
              <option value="yard">Konkret şəhər / yard</option><option value="state">Ştat üzrə ümumi tarif</option>
            </select>
          </label>
        </div>}
        {editor.scope === "yard" ? <label className="block text-xs text-zinc-400">Şəhər / yard (ştat kodu olmadan)
          <input required readOnly={!!editor.row} maxLength={120} className={input} value={editor.yard} onChange={(e) => setEditor({ ...editor, yard: e.target.value })} placeholder="Savannah" />
        </label> : <p className="text-xs text-amber-300">Yard üçün ayrıca tarif tapılmayanda bu ştatın ümumi tarifi tətbiq olunacaq. Şəhərlərin qiymətləri fərqlidirsə, konkret yard seçin.</p>}
        <div className="grid gap-3 sm:grid-cols-3">{data?.bands.map((band, index) => <label key={band.id} className="text-xs text-zinc-400">
          {band.min.toLocaleString("en-US")}–{band.max.toLocaleString("en-US")} USD invoys
          <input required type="number" min="0.01" step="0.01" className={input} value={editor.values[index]} onChange={(e) => setEditor({ ...editor, values: editor.values.map((value, i) => i === index ? e.target.value : value) })} />
        </label>)}</div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={!(Number(editor.values[0]) > 0)} onClick={() => setEditor({ ...editor, values: [editor.values[0], String(Number(editor.values[0]) + 50), String(Number(editor.values[0]) + 200)] })}>İlk tarifdən +50 / +200 USD doldur</button>
          <button className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-black">{busy ? "Yazılır…" : "Bazaya yaz"}</button>
          <button type="button" className={button} onClick={() => setEditor(null)}>Ləğv et</button>
        </div>
      </fieldset>
    </form>}

    {data && <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-3">
        <p className="text-sm text-zinc-300">{auction} · {groups.filter((group) => !group.missing).length} ştat/DC-də tarif var · {missing.length} tarif yoxdur</p>
        {visible.map((group) => <div key={group.state} className="overflow-hidden rounded-2xl border border-white/10">
          <div className="flex items-center justify-between gap-3 bg-white/5 px-4 py-3">
            <h3 className="font-medium">{group.stateName} <span className="text-zinc-500">{group.state}</span></h3>
            <button className="text-xs text-sky-300" disabled={busy} onClick={() => edit(groups.find((item) => item.state === group.state)!)}>+ Yard əlavə et</button>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="text-xs text-zinc-500"><tr><th className="p-3">Şəhər / yard</th>{data.bands.map((band) => <th key={band.id} className="whitespace-nowrap p-3">{band.min.toLocaleString("en-US")}–{band.max.toLocaleString("en-US")}</th>)}<th className="p-3">Dəyiş</th></tr></thead>
            <tbody>{group.rows.map((row) => <tr key={row.key} className="border-t border-white/10">
              <td className="p-3">{row.yard}</td>{data.bands.map((band) => <td key={band.id} className={`whitespace-nowrap p-3 ${row.rates[band.id] == null ? "text-amber-300" : "text-zinc-200"}`}>{row.rates[band.id] == null ? "Yoxdur" : usd(row.rates[band.id]!)}</td>)}
              <td className="p-3"><button className="text-sky-300" disabled={busy} onClick={() => edit(groups.find((item) => item.state === group.state)!, row)}>Düzəlt</button></td>
            </tr>)}</tbody>
          </table></div>
        </div>)}
        {!visible.length && <p className="rounded-xl border border-white/10 p-5 text-sm text-zinc-400">Bu seçim üzrə tarif yoxdur. Sağdakı siyahıdan və ya «Tarif əlavə et» ilə əlavə edin.</p>}
      </div>
      <aside className="space-y-3 rounded-2xl border border-amber-400/20 bg-amber-950/10 p-4">
        <h3 className="font-medium text-amber-200">Tarifi olmayan ştatlar · {missing.length}</h3>
        <p className="text-xs text-zinc-400">{auction} üçün bazada heç bir müsbət tarif yoxdur. Bu, həmin ştatda hərrac məntəqəsi olduğunu təsdiqləmir.</p>
        <div className="flex flex-wrap gap-2">{missing.map((group) => <button key={group.state} disabled={busy} className={`${button} text-amber-200`} title={group.stateName} onClick={() => { setState(group.state); setSearch(""); edit(group); }}>{group.stateName} ({group.state}) +</button>)}</div>
        {!missing.length && <p className="text-sm text-emerald-300">Bütün ştatlarda ən azı bir tarif var.</p>}
        <h4 className="border-t border-white/10 pt-3 text-sm">Natamam aralıqları olan ştatlar</h4>
        {groups.filter((group) => !group.missing && group.incomplete > 0).map((group) => <button key={group.state} className="block text-left text-xs text-amber-200" onClick={() => { setState(group.state); setSearch(""); }}>{group.stateName} — {group.incomplete} natamam tarif</button>)}
        <p className="text-xs text-zinc-500">Bir yardın tarifi bütün ştatın əhatə olunduğu demək deyil. Naməlum yardlar avtomatik aşkar edilmir.</p>
      </aside>
    </div>}
  </section>;
}
