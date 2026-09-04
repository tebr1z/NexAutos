"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/providers/i18n-provider";

export function ContactForm() {
  const { t } = useI18n();
  const c = t.contactPage;
  const [form, setForm] = useState({ name: "", email: "", phone: "", body: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  return (
    <form
      className="glass space-y-4 rounded-3xl p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.body.trim()) return;
        setStatus("sending");
        try {
          await api.createInquiry({
            name: form.name.trim(),
            email: form.email.trim() || undefined,
            phone: form.phone.trim() || undefined,
            body: form.body.trim(),
          });
          setForm({ name: "", email: "", phone: "", body: "" });
          setStatus("sent");
        } catch {
          setStatus("error");
        }
      }}
    >
      <input
        required
        className="w-full rounded-xl border border-line bg-transparent px-4 py-3 text-sm"
        placeholder={c.name}
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <input
        type="email"
        className="w-full rounded-xl border border-line bg-transparent px-4 py-3 text-sm"
        placeholder={c.email}
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <input
        className="w-full rounded-xl border border-line bg-transparent px-4 py-3 text-sm"
        placeholder={c.phone}
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />
      <textarea
        required
        className="h-32 w-full rounded-xl border border-line bg-transparent px-4 py-3 text-sm"
        placeholder={c.message}
        value={form.body}
        onChange={(e) => setForm({ ...form, body: e.target.value })}
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="rounded-full bg-fg px-6 py-3 text-sm text-bg disabled:opacity-50"
      >
        {status === "sending" ? "…" : c.send}
      </button>
      {status === "sent" && <p className="text-sm text-emerald-400">{c.sent}</p>}
      {status === "error" && <p className="text-sm text-red-400">{c.error}</p>}
    </form>
  );
}
