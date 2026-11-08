"use client";

import { useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import { api } from "@/lib/api";
import type { TrackingShipment } from "@/lib/types";

export function ShipmentReview({ shipment }: { shipment: TrackingShipment }) {
  const [review, setReview] = useState(shipment.review);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (shipment.currentStatus !== "DELIVERED") return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rating || !shipment.reviewToken || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.submitTrackingReview(shipment.trackingCode, { reviewToken: shipment.reviewToken, rating, ...(comment.trim() ? { comment: comment.trim() } : {}) });
      setReview(result);
    } catch {
      // A second tab may already have submitted this order's single review.
      try {
        const latest = await api.track(shipment.trackingCode);
        if (latest.review) { setReview(latest.review); return; }
      } catch { /* preserve the actionable form message */ }
      setError("Qiymətləndirmə göndərilmədi. Bir qədər sonra yenidən yoxlayın və ya səhifəni yeniləyin.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="mt-6 rounded-3xl border border-royal/25 bg-card p-5 sm:p-7" aria-labelledby="shipment-review">
    <h2 id="shipment-review" className="text-xl font-semibold">{review ? "Qiymətləndirdiyiniz üçün təşəkkür edirik!" : "Avtomobiliniz təhvil verildi. Xidmətimizi qiymətləndirin"}</h2>
    {review ? <div className="mt-4"><p className="flex items-center gap-2 text-sm text-royal"><CheckCircle2 size={19} />Qiymətləndirməniz qeydə alındı: {review.rating} / 5</p>{review.comment && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted">{review.comment}</p>}</div> : shipment.reviewToken ? <form onSubmit={submit} className="mt-4">
      <fieldset disabled={busy}><legend className="text-sm text-muted">Xidmət keyfiyyətindən nə dərəcədə razı qaldınız?</legend><div className="mt-3 flex gap-2">{[1, 2, 3, 4, 5].map((value) => <label key={value} className="cursor-pointer"><input className="peer sr-only" type="radio" name="service-rating" value={value} checked={rating === value} onChange={() => setRating(value)} required aria-label={`${value} ulduz`} /><span className={`flex h-12 w-12 items-center justify-center rounded-xl border transition peer-focus-visible:ring-2 peer-focus-visible:ring-royal ${value <= rating ? "border-amber-400 bg-amber-400/10 text-amber-500" : "border-line text-muted"}`}><Star size={25} fill={value <= rating ? "currentColor" : "none"} /></span></label>)}</div></fieldset>
      <label className="mt-5 block text-sm">Rəyiniz <span className="text-muted">(istəyə bağlı)</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} disabled={busy} rows={3} className="mt-2 block w-full rounded-xl border border-line bg-bg p-3 text-sm outline-none focus:border-royal" placeholder="Xidmətimizi yaxşılaşdırmaq üçün fikrinizi paylaşın…" /></label>
      <p className="mt-2 text-xs text-muted">Rəyiniz sifarişə bağlı saxlanılır; avtomatik olaraq ictimai saytda paylaşılmır.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={!rating || busy} className="mt-4 min-h-11 rounded-full bg-royal px-6 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Göndərilir…" : "Qiymətləndirməni göndər"}</button>
    </form> : <p className="mt-3 text-sm text-muted">Qiymətləndirmə formasını açmaq üçün səhifəni yeniləyin. Problem davam edərsə menecerinizə bildirin.</p>}
  </section>;
}
