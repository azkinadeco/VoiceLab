/**
 * Script templates for social-media creators & online sellers.
 * Placeholders use {key}; values are filled from TEMPLATE_FIELDS.
 */

export interface TemplateField {
  key: string;
  label: string;
  placeholder: string;
}

export interface ScriptTemplate {
  id: string;
  category: string;
  title: string;
  voiceId: string;
  /** Suggested length in seconds (for the duration target). */
  targetSec: 15 | 30 | 60;
  text: string;
}

export const TEMPLATE_FIELDS: TemplateField[] = [
  { key: 'produk', label: 'Nama produk', placeholder: 'Serum Glow 30ml' },
  { key: 'harga', label: 'Harga promo', placeholder: '49 ribu' },
  { key: 'diskon', label: 'Diskon', placeholder: '50 persen' },
  { key: 'toko', label: 'Nama toko', placeholder: 'Toko Berkah' },
  { key: 'manfaat', label: 'Manfaat utama', placeholder: 'kulit cerah dalam 7 hari' },
];

export const TEMPLATE_CATEGORIES = [
  { id: 'promo', label: 'Promo' },
  { id: 'live', label: 'Live' },
  { id: 'review', label: 'Review' },
  { id: 'hook', label: 'Hook' },
  { id: 'cod', label: 'COD' },
  { id: 'kuliner', label: 'Kuliner' },
  { id: 'daerah', label: 'Daerah' },
];

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  // Promo
  {
    id: 'flash-sale',
    category: 'promo',
    title: 'Flash Sale Payday',
    voiceId: 'voice-gadis',
    targetSec: 15,
    text: 'Halo bestie! Khusus hari ini {produk} lagi diskon {diskon}, jadi cuma {harga} aja plus gratis ongkir. Stoknya terbatas, langsung checkout di keranjang kuning sekarang!',
  },
  {
    id: 'restock',
    category: 'promo',
    title: 'Restock Ready Lagi',
    voiceId: 'voice-gadis',
    targetSec: 15,
    text: 'Akhirnya ready lagi! {produk} yang kemarin sold out dalam hitungan jam sekarang sudah restock di {toko}. Jangan sampai kehabisan lagi ya, klik keranjang kuning sekarang!',
  },
  {
    id: 'bundling',
    category: 'promo',
    title: 'Paket Bundling Hemat',
    voiceId: 'voice-ardi',
    targetSec: 30,
    text: 'Mau lebih hemat? Beli {produk} sekarang dapat paket bundling spesial dengan harga cuma {harga}. Hasilnya {manfaat}. Promo ini hanya berlaku sampai tengah malam, jadi amankan sekarang juga di {toko}!',
  },
  // Live
  {
    id: 'live-opening',
    category: 'live',
    title: 'Pembuka Live Jualan',
    voiceId: 'voice-gadis',
    targetSec: 15,
    text: 'Selamat datang di live {toko}! Yang baru gabung, tap love dan follow dulu ya. Hari ini ada harga spesial live untuk {produk}, cuma {harga}!',
  },
  {
    id: 'live-countdown',
    category: 'live',
    title: 'Hitung Mundur Checkout',
    voiceId: 'voice-ardi',
    targetSec: 15,
    text: 'Oke kakak-kakak, stok {produk} tinggal sedikit! Aku hitung mundur ya, lima, empat, tiga, dua, satu, checkout sekarang di keranjang nomor satu!',
  },
  // Review
  {
    id: 'review-jujur',
    category: 'review',
    title: 'Review Jujur Seminggu',
    voiceId: 'voice-ardi',
    targetSec: 30,
    text: 'Jujur awalnya aku ragu beli {produk}, tapi setelah aku pakai sendiri seminggu, hasilnya beneran {manfaat}. Harganya juga cuma {harga}. Buat kalian yang penasaran, link pembelian ada di keranjang kuning ya!',
  },
  {
    id: 'unboxing',
    category: 'review',
    title: 'Unboxing Paket',
    voiceId: 'voice-gadis',
    targetSec: 30,
    text: 'Paket dari {toko} udah sampai! Packingnya rapi banget dan aman. Ini dia {produk}, kualitasnya jauh lebih bagus dari yang aku kira. Worth it banget sih buat harga {harga}.',
  },
  // Hook
  {
    id: 'hook-stop',
    category: 'hook',
    title: 'Stop Scrolling',
    voiceId: 'voice-gadis',
    targetSec: 15,
    text: 'Stop scrolling! Kalau kamu pengen {manfaat} tanpa ribet, dengerin ini sampai habis. Rahasianya ada di {produk}.',
  },
  {
    id: 'hook-salah',
    category: 'hook',
    title: 'Kesalahan yang Sering Terjadi',
    voiceId: 'voice-ardi',
    targetSec: 30,
    text: 'Tiga kesalahan yang bikin kamu gagal {manfaat}. Nomor satu, pakai produk asal murah. Nomor dua, nggak konsisten. Nomor tiga, belum kenal {produk}. Simak sampai akhir ya!',
  },
  // COD
  {
    id: 'cod-aman',
    category: 'cod',
    title: 'Bisa COD Bayar di Tempat',
    voiceId: 'voice-ardi',
    targetSec: 15,
    text: 'Masih ragu belanja online? Tenang, {produk} di {toko} bisa COD, bayar di tempat setelah barang sampai. Harga cuma {harga}, gratis ongkir lagi!',
  },
  // Kuliner
  {
    id: 'kuliner-viral',
    category: 'kuliner',
    title: 'Food Review Viral',
    voiceId: 'voice-ardi',
    targetSec: 30,
    text: 'Gila sih, {produk} di {toko} ini porsinya brutal dan bumbunya meresap sampai ke dalam! Harganya cuma {harga}, ramah di kantong. Wajib kalian coba!',
  },
  // Daerah
  {
    id: 'jawa',
    category: 'daerah',
    title: 'Aksen Jawa Ramah',
    voiceId: 'voice-dimas-jawa',
    targetSec: 15,
    text: 'Sugeng rawuh para sedulur sedaya. Monggo dipun cobi {produk} saking {toko}, reginipun namung {harga} lan kualitasipun saestu sae.',
  },
  {
    id: 'sunda',
    category: 'daerah',
    title: 'Aksen Sunda Akrab',
    voiceId: 'voice-jajang-sunda',
    targetSec: 15,
    text: 'Sampurasun wargi sadayana! Mangga {produk} ti {toko}, hargana ngan {harga} wungkul. Hayu geura di-checkout bilih kabujeng seep!',
  },
];

/** One-tap call-to-action sentences appended to the script. */
export const CTA_SNIPPETS = [
  { label: '🛒 Keranjang kuning', text: 'Langsung checkout di keranjang kuning sekarang!' },
  { label: '🔗 Link di bio', text: 'Link pembelian ada di bio ya!' },
  { label: '➕ Follow', text: 'Jangan lupa follow biar nggak ketinggalan promo berikutnya!' },
  { label: '💬 Komen', text: 'Komen "mau" kalau kamu tertarik, nanti aku kirim infonya!' },
  { label: '⏰ Stok terbatas', text: 'Stoknya terbatas, jadi jangan sampai kehabisan!' },
];

export const PLATFORM_TARGETS = [
  { id: 'tiktok15', label: 'TikTok 15s', sec: 15 },
  { id: 'reels30', label: 'Reels 30s', sec: 30 },
  { id: 'shorts60', label: 'Shorts 60s', sec: 60 },
  { id: 'free', label: 'Bebas', sec: 0 },
];

const FIELDS_KEY = 'voicelab_template_fields';

export function loadTemplateValues(): Record<string, string> {
  try {
    const raw = localStorage.getItem(FIELDS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveTemplateValues(values: Record<string, string>) {
  try {
    localStorage.setItem(FIELDS_KEY, JSON.stringify(values));
  } catch {}
}

/** Replace {key} with value, or the field's placeholder when empty. */
export function fillTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = values[key]?.trim();
    if (v) return v;
    return TEMPLATE_FIELDS.find((f) => f.key === key)?.placeholder || key;
  });
}

export function templateUsesField(text: string, key: string) {
  return text.includes(`{${key}}`);
}

/**
 * Estimated spoken seconds. Indonesian neural voices speak roughly
 * 2.6–2.9 words/second at 1.0x.
 */
export function estimateSeconds(text: string, speed = 1) {
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  return Math.max(1, Math.round(words / 2.8 / Math.max(0.5, speed)));
}
