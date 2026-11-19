# 🎙️ ElevenVoice AI Lab PRO v2.0 — Desktop & Mobile Local Studio
> Solusi AI Voice Synthesis, Dubbing, dan Voiceover Lokal untuk Kreator Media Sosial (TikTok, Instagram Reels, YouTube Shorts) & Pedagang / Seller Online Shop (Iklan Promo & Keranjang Kuning).

Platform sintesis suara kecerdasan buatan (AI Voice Generation) mandiri dengan fitur lengkap setara **ElevenLabs 2.0**, dirancang dengan antarmuka modern, elegan, responsif, dan dapat di-install sebagai aplikasi desktop & mobile di **Windows, macOS, iOS (iPhone), dan Android**.

Seluruh data suara dan file audio generasi tersimpan langsung di storage PC lokal Anda (`/data/audio`).

---

## 📱 Tampilan Native Dual Mobile: iPhone 16 Pro & Android Galaxy S25
Aplikasi ini dilengkapi simulator perangkat seluler interaktif langsung di desktop:
- **🍎 Mode iPhone 16 Pro**: Dilengkapi bezel titanium ramping, Dynamic Island aktif, iOS Status Bar (9:41, Wi-Fi, Baterai), Cupertino bottom navigation bar, dan slide-up bottom sheet.
- **🤖 Mode Android Galaxy S25 / Pixel 9**: Dilengkapi center punch-hole camera, Android Status Bar (10:00, 5G, 98% baterai), Material You 3 pill indicator navigation, dan gesture bar.
- **⚡ 100% Responsif di Smartphone Asli**: Saat dibuka langsung di browser HP (Safari iOS atau Chrome Android), tampilan otomatis menyesuaikan layar penuh tanpa batas bingkai simulator.

---

## ✨ Fitur Unggulan untuk Kreator & Pedagang Online
1. **Naskah Cepat 1-Ketuk (Quick Script Chips)**:
   - Template langsung pakai untuk:
     - 🛍️ *Iklan Promo & Flash Sale (Payday/Keranjang Kuning)*
     - 📦 *Review Produk Jujur & Unboxing*
     - ⚡ *Hook Viral TikTok (Stop Scrolling)*
     - 🍲 *Kuliner & Food Review Viral*
     - 🇮🇩 *Aksen Jawa Ramah Pembeli (Sugeng Rawuh)*
     - 🇮🇩 *Aksen Sunda Akrab Pedagang (Sampurasun)*
2. **Katalog 28+ Suara Neural & Bahasa Daerah**:
   - Meliputi Bahasa Indonesia (*Ardi* & *Gadis*), aksen daerah Nusantara (*Dimas & Siti - Jawa*, *Jajang & Tuti - Sunda*), serta 10+ bahasa global (Inggris US/UK/AU, Jepang, Korea, Mandarin, Arab, dll.).
3. **Slide-Up Bottom Sheet Voice Picker**:
   - Pemilih suara bergaya native mobile sheet dengan kolom pencarian instan, filter kategori aksen horizontal, dan audio preview 1-ketuk.
4. **1-Ketuk Ekspor ke CapCut & WhatsApp**:
   - Unduh file audio **MP3** jernih, file subtitle **CapCut `.SRT`**, atau bagikan langsung via native **Web Share API** (`navigator.share`) ke WhatsApp, CapCut, atau TikTok.
5. **Auto-Save Naskah & Abort Controller**:
   - Draf naskah tersimpan otomatis ke browser local storage. Tombol "Batal" tersedia saat sintesis suara berlangsung.
6. **Voice Lab & Kloning Suara Mandiri**:
   - Kloning suara dengan merekam mikrofon 5 detik atau upload file suara untuk membuat profil suara unik.
7. **Isolasi Vokal & Ekstraksi Audio Video (MP4/MOV)**:
   - Bersihkan kebisingan latar belakang dan ekstrak suara langsung dari rekaman video TikTok atau Reels.
8. **Kamus Pelafalan Kustom**:
   - Atur cara pelafalan singkatan bisnis (UMKM, COD, gratis ongkir) agar suara AI melafalkannya dengan akurat.
9. **Kapasitas Disk & Manajemen Storage PC**:
   - Pantau penggunaan ruang hard disk dan bersihkan file audio lama dengan satu tombol.

---

## 🚀 Cara Menjalankan di Komputer Lokal

### 1. Prasyarat
- Node.js versi 18 atau yang lebih baru.

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Build & Jalankan Mode Produksi
```bash
npm run build
npm run start
```
Buka browser di `http://localhost:3000`.

### 4. Menjalankan Mode Development
```bash
npm run dev
```

---

## 📲 Cara Pasang di Windows, macOS, iPhone & Android
- **Windows / Mac**: Buka di Chrome/Edge, klik tombol **Install** di pojok kanan atas untuk memasang sebagai aplikasi desktop mandiri.
- **iPhone (iOS)**: Buka Safari, ketuk tombol **Bagikan (Share)**, lalu pilih **"Tambah ke Layar Utama" (Add to Home Screen)**.
- **Android**: Buka Chrome, ketuk ikon titik tiga di kanan atas, lalu pilih **"Pasang Aplikasi" / "Tambahkan ke Layar Utama"**.
