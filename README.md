# 🌳 Silsilah Keluarga (Family Tree App)

Aplikasi Silsilah Keluarga interaktif, modern, dan minimalis yang dapat di-host langsung secara gratis di **GitHub Pages** (`github.io`) dan terhubung dengan **Google Sheets & Google Apps Script** sebagai database backend.

---

## 📁 Struktur Folder Project

```text
family-tree-app/
├── index.html          # Halaman utama aplikasi family tree
├── assets/
│   ├── man.png         # Photo placeholder default laki-laki
│   └── woman.png       # Photo placeholder default perempuan
├── css/
│   └── style.css       # Design system minimalis, gender highlights & memorial theme
├── js/
│   └── app.js          # Logic rendering tree, pan-zoom, modal detail & CRUD Google Sheets
└── README.md           # Panduan lengkap instalasi dan penggunaan
```

---

## ✨ Fitur Utama

1. **Mode Edit & Lihat**:
   - **Mode Lihat**: Menjelajah silsilah dengan tampilan bersih tanpa tombol edit.
   - **Mode Edit**: Mengaktifkan tombol `+ Tambah Anak`, `+ Tambah Pasangan`, Edit, dan Hapus.
2. **Navigasi Canvas Interaktif**:
   - **Klik Drag**: Geser canvas silsilah ke segala arah.
   - **Zoom In / Zoom Out**: Slider zoom, tombol `+` / `-`, scroll mouse wheel, serta **gestur cubit (pinch-to-zoom)** di layar HP.
3. **Kustomisasi Garis & Frame Foto**:
   - Slider untuk mengatur ketebalan garis penghubung silsilah.
   - Slider untuk mengatur ketebalan ring outline foto dan jarak (gap) dari foto.
4. **Indikator Gender Visual**:
   - Laki-Laki (`L`): Highlight & outline berwarna **Biru** (`#3B82F6`).
   - Perempuan (`P`): Highlight & outline berwarna **Pink** (`#EC4899`).
   - Tombol pilihan gender di form modal menyala sesuai warna gender saat aktif.
5. **Aesthetic Memorial View ("Mengenang")**:
   - Anggota keluarga yang telah wafat (`tgl_wafat` terisi) ditampilkan dengan tema memorial khusus (warna emas/gelap yang elegan, pita duka, dan layout kenangan).
6. **Collapse & Expand Branch**:
   - Tombol `+` / `-` di bawah kartu untuk menyembunyikan atau membuka cabang keturunan.
7. **Integrasi Google Sheets & Google Apps Script**:
   - Sinkronisasi otomatis data anggota keluarga dari Google Sheet secara realtime via Apps Script Web App API.

---

## 🚀 Cara Upload ke GitHub Pages (github.io)

1. Buat repository baru di GitHub, contoh: `family-tree`
2. Push seluruh folder dan file di atas ke repository GitHub Anda.
3. Masuk ke **Settings** repository GitHub Anda -> **Pages**.
4. Di bagian **Source**, pilih branch `main` (atau `master`) dan folder `/ (root)`.
5. Klik **Save**.
6. Website silsilah Anda akan aktif di URL: `https://username.github.io/family-tree/`

---

## ⚙️ Setting Google Apps Script (Code.gs)

Aplikasi ini sudah terkonfigurasi dengan URL Google Apps Script milik Anda:
`https://script.google.com/macros/s/AKfycbwDfDtj3rILYjmUzawlpN2gK9eFxel0WChuNGxgRhoGJwMVhHA4cwAXXN0tFviKAXk/exec`

Pastikan pada Google Sheet Anda:
1. Sheet diberi nama **`Person`**.
2. Kolom header pada baris pertama memiliki urutan:
   `id`, `nama`, `panggilan`, `jk`, `ayah_id`, `ibu_id`, `pasangan_id`, `urutan_anak`, `tgl_lahir`, `tgl_wafat`, `foto`, `catatan`
3. Saat melakukan **Deploy as Web App** di Apps Script:
   - **Execute as**: *Me*
   - **Who has access**: *Anyone* (Agar dapat diakses dari GitHub Pages).
