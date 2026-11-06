"use strict";

const notice = document.getElementById("notice");
const retry = document.getElementById("retry");
const openBidCars = document.getElementById("openBidCars");

async function openCalculator() {
  retry.hidden = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let caucasus = false;
    try { const url = new URL(tab?.url || ""); caucasus = url.protocol === "https:" && url.hostname === "login.caucasusauto.com"; } catch { /* restricted browser tab */ }
    if (!globalThis.AutoNexBidCarsParser.isBidCarsLotUrl(tab?.url) && !caucasus) {
      notice.textContent = globalThis.AutoNexBidCarsParser.LOT_PAGE_NOTICE;
      openBidCars.hidden = false;
      return;
    }
    notice.textContent = caucasus ? "Tarif toplayıcısı açılır…" : "Lot kalkulyatoru açılır…";
    openBidCars.hidden = true;
    const response = await chrome.runtime.sendMessage({ type: "ANX_OPEN_ACTIVE_TAB" });
    if (!response?.ok) throw new Error(response?.error || "Panel açılmadı. Səhifəni Ctrl+R ilə yeniləyib yenidən yoxlayın.");
    window.close();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    notice.textContent = /receiving end|connection|invalidated|message port/i.test(message)
      ? "Extension yenilənib. BidCars lot səhifəsini Ctrl+R ilə təzələyib yenidən yoxlayın."
      : message;
    retry.hidden = false;
  }
}
retry.addEventListener("click", () => void openCalculator());
void openCalculator();
