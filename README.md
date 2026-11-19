# MKS · Management Knowledge Sharing

Web app untuk kegiatan MKS setiap Jumat: **jadwal & kalender**, **absen**, **upload materi**, dan **rekaman Zoom otomatis** yang muncul di kalender.

- **Frontend:** Vue 3 + Vite, gaya Brutalism, dijalankan di GitHub Pages.
- **Backend:** Google Apps Script (Web App).
- **Database:** Google Sheet. **File:** Google Drive.

```
mks-app/
├─ apps-script/          ← salin ke editor Apps Script (terikat ke Google Sheet)
│  ├─ appsscript.json    manifest (zona waktu, izin, pengaturan web app)
│  ├─ Code.gs            pintu masuk API (doGet / doPost)
│  ├─ Config.gs          nama sheet, pengaturan, utilitas
│  ├─ Auth.gs            verifikasi login Google
│  ├─ Tautan.gs          hubungkan akun Google ke nama pegawai (sekali, saat pertama masuk)
│  ├─ Data.gs            baca jadwal/pegawai/materi + API jadwal & profil
│  ├─ Absen.gs           absen
│  ├─ Materi.gs          upload materi (resumable, tanpa batas ukuran)
│  ├─ Rekaman.gs         pindahkan rekaman cloud Zoom → Google Drive
│  ├─ WhatsApp.gs        pengumuman grup WA (opsional, nonaktif)
│  └─ Setup.gs           menu "MKS" di Sheet, setup sheet & trigger
├─ frontend/             ← aplikasi Vue
└─ .github/workflows/deploy.yml   build & deploy otomatis ke GitHub Pages
```

---

## Cara kerja singkat

| Fitur | Siapa | Aturan |
|---|---|---|
| Jadwal, materi, rekaman | Semua orang, **tanpa login** | Data dari sheet `Jadwal`, `Materi` |
| Absen | Pegawai, login Google | Hanya di hari yang ada jadwal, jam `ABSEN_BUKA`–`ABSEN_TUTUP`, sekali per orang |
| Upload materi | **Hanya 3 pemateri** sesi itu | Dibuka sejak sehari setelah sesi sebelumnya; sesi yang sudah lewat tetap bisa direvisi |
| Rekaman | Otomatis | Zoom merekam ke cloud → script menyalin ke Drive → link muncul di kalender → rekaman di Zoom dipindah ke Trash |

Keamanan login: frontend memakai **Sign in with Google**. Setiap aksi, Apps Script memeriksa token ke Google, lalu mencocokkan email dengan kolom **Email Google** di sheet `Pegawai`. Kolom ini **terisi sendiri**: saat pertama kali masuk, pegawai memilih namanya dari daftar nama yang belum terhubung. Setelah itu nama tersebut terkunci ke email itu dan hilang dari daftar, jadi tidak bisa diambil alih orang lain. Setiap penautan dicatat di sheet `Log`.

---

## Langkah setup (±1 jam, sekali saja)

Kerjakan semua langkah Google memakai **akun Workspace kantor** (pemilik data).

### 1. Google Sheet + Apps Script
1. Unggah **MKS_Database_Import.xlsx** (berisi 57 pegawai dan 30 sesi 2026–2027) ke Google Drive, buka dengan Google Spreadsheet, lalu **File › Simpan sebagai Google Spreadsheet**. Beri nama, misalnya "MKS Database". (Tanpa file itu: buat Google Sheet kosong; sheet akan dibuat oleh `setup`.)
2. Menu **Extensions › Apps Script**.
3. Di editor: **Project Settings** (ikon roda) › centang **Show "appsscript.json" manifest file in editor**.
4. Salin isi setiap file di folder `apps-script/` ke file dengan nama yang sama di editor (buat file baru dengan tombol **+ › Script**). Ganti isi `appsscript.json` dengan versi dari folder ini.
5. Simpan, pilih fungsi `setup` di toolbar, klik **Run**, lalu izinkan akses yang diminta.
6. Muat ulang Google Sheet. Akan muncul menu **MKS** dan sheet: `Pengaturan`, `Pegawai`, `Jadwal`, `Kehadiran`, `Materi`, `Rekaman`, `Log`.

### 2. Folder Google Drive
1. Buat folder, misalnya `MKS`, di Drive akun kantor.
2. Buka folder itu; salin ID dari alamatnya (`https://drive.google.com/drive/folders/`**`INI_ID_NYA`**).
3. Tempel ke sheet `Pengaturan`, baris `DRIVE_FOLDER_ID`.

Script akan membuat subfolder otomatis: `MKS/2026-11-20/Materi` dan `MKS/2026-11-20/Rekaman`.

### 3. Client ID untuk login Google
1. Buka <https://console.cloud.google.com>, buat project baru (misalnya "MKS").
2. **APIs & Services › OAuth consent screen**: isi nama aplikasi & email. Pilih audiens **External** (karena pegawai memakai Gmail pribadi), lalu **Publish app** ke status *In production*. Aplikasi ini hanya meminta nama & email, jadi tidak perlu verifikasi Google.
3. **APIs & Services › Credentials › Create credentials › OAuth client ID**, tipe **Web application**.
4. **Authorized JavaScript origins**, tambahkan:
   - `https://USERNAME.github.io` (ganti USERNAME dengan akun/organisasi GitHub)
   - `http://localhost:5173` (untuk mencoba di komputer sendiri)
5. Salin **Client ID** (berakhiran `.apps.googleusercontent.com`).
6. Di Apps Script: **Project Settings › Script Properties › Add property**: `GOOGLE_CLIENT_ID` = Client ID tadi.

### 4. Deploy Apps Script sebagai Web App
1. **Deploy › New deployment** › tipe **Web app**.
2. *Execute as*: **Me**. *Who has access*: **Anyone**.
3. **Deploy**, lalu salin **Web app URL** (berakhiran `/exec`).

> Jika opsi **Anyone** tidak muncul, admin Google Workspace perlu mengizinkannya (Admin console › Apps › Google Workspace › Drive and Docs › Sharing settings, atau kebijakan Apps Script).
>
> Setiap kali kode Apps Script diubah: **Deploy › Manage deployments › Edit (ikon pensil) › Version: New version › Deploy**. URL tetap sama.

### 5. Zoom: rekam otomatis ke cloud + akses API
1. Di pengaturan meeting MKS (meeting berulang yang dipakai tiap minggu), aktifkan **Automatically record meeting › In the cloud**. Ubah langsung di meeting yang sudah ada, karena perubahan di pengaturan akun hanya berlaku untuk meeting yang dibuat sesudahnya.
2. Buka <https://marketplace.zoom.us> › **Develop › Build App** › **Server-to-Server OAuth App** (perlu admin Zoom atau peran yang diizinkan).
3. Di **Scopes**, tambahkan izin untuk **membaca daftar cloud recording pengguna** dan **menghapus cloud recording** (cari kata "recording").
4. **Activate** aplikasi, lalu salin **Account ID**, **Client ID**, **Client Secret** ke Script Properties:
   - `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`
5. Isi di sheet `Pengaturan`:
   - `ZOOM_LINK`: link gabung meeting
   - `ZOOM_MEETING_ID`: angka meeting ID (tanpa spasi)
   - `ZOOM_HOST_EMAIL`: email akun Zoom host
   - `HAPUS_REKAMAN_DI_ZOOM`: `YA` agar kuota cloud Zoom tetap lega
6. Coba lewat menu **MKS › Tes koneksi Zoom**.

### 6. GitHub Pages
1. Buat repository baru di GitHub, unggah seluruh isi folder `mks-app` (termasuk folder `.github`).
2. **Settings › Pages › Build and deployment › Source: GitHub Actions**.
3. **Settings › Secrets and variables › Actions › tab Variables › New repository variable**:
   - `VITE_API_URL` = Web app URL dari langkah 4
   - `VITE_GOOGLE_CLIENT_ID` = Client ID dari langkah 3
4. Buka tab **Actions** › workflow **Deploy ke GitHub Pages** › **Run workflow** (atau cukup push ke `main`).
5. Web aktif di `https://USERNAME.github.io/NAMA-REPO/`.
6. Kembali ke sheet `Pengaturan`:
   - `FRONTEND_ORIGIN` = `https://USERNAME.github.io` (tanpa nama repo, tanpa `/` di akhir)
   - `URL_WEB` = `https://USERNAME.github.io/NAMA-REPO/`

---

## Pemakaian sehari-hari (admin)

- **Pegawai:** isi `NIP`, `Nama`, `Jabatan`, `Aktif` = `YA`. Pegawai tanpa NIP (outsourcing) memakai ID `OS-01`, `OS-02`, dst. `Email Google` terisi otomatis saat pegawai pertama kali masuk. **Reset** (salah pilih nama atau ganti akun): kosongkan sel `Email Google` orang tersebut. Periksa sheet `Log` (jenis `TAUTAN`) bila ada yang mengaku namanya sudah dipakai.
- **Jadwal:** satu baris per sesi (Jumat, dua minggu sekali). Kolom NIP pemateri dan `NIP Moderator` berupa dropdown dari sheet `Pegawai`; kolom `Nama ...` di sebelah kanan hanya bantuan baca. `Link Rekaman` dan `Durasi Rekaman` diisi otomatis. Jam mulai acara diatur di `JAM_MULAI` (sheet `Pengaturan`).
- **Rekap kehadiran:** sheet `Kehadiran` (filter per tanggal, atau buat pivot table).
- **Materi:** tercatat di sheet `Materi`. File yang dihapus pemateri berstatus `DIHAPUS` dan masuk Trash Drive.
- **Rekaman:** trigger berjalan tiap 30 menit. Setelah Zoom selesai memproses rekaman, salinan ke Drive biasanya muncul dalam 30–90 menit. Rekaman besar diselesaikan bertahap. Riwayat ada di sheet `Rekaman`, kesalahan di sheet `Log`.
- Data web disegarkan maksimal 1 menit (cache). Paksa lewat **MKS › Bersihkan cache jadwal**.

## Pengumuman WhatsApp (opsional, nanti)
Sudah disiapkan di `WhatsApp.gs`, nonaktif secara bawaan. Untuk mengaktifkan: daftar di gateway seperti Fonnte memakai nomor khusus MKS (bukan nomor pribadi), masukkan nomor itu ke grup, isi Script Property `FONNTE_TOKEN`, isi `WA_GROUP_ID`, lalu ubah `WA_AKTIF` menjadi `YA`. Teks pesan bisa diubah di fungsi `teksPengumuman_()`. Gateway ini tidak resmi, jadi tetap ada risiko nomor diblokir.

## Mencoba di komputer sendiri
```bash
cd frontend
npm install
cp .env.example .env.local   # isi VITE_API_URL & VITE_GOOGLE_CLIENT_ID, atau biarkan kosong untuk mode demo
npm run dev                  # buka http://localhost:5173
```
Tanpa `VITE_API_URL`, aplikasi berjalan dalam **mode demo** dengan data contoh (login dan upload nonaktif).

## Catatan teknis & batasan
- **Upload file besar:** browser mengirim potongan 8 MB langsung ke Google Drive. Jika browser menolak (CORS), aplikasi otomatis beralih ke mode cadangan lewat Apps Script. Mode cadangan lebih lambat, tetapi tetap tanpa batas ukuran.
- **Berbagi file:** materi dan rekaman dibagikan sebagai "siapa saja yang punya link bisa melihat". Jika kebijakan Workspace kantor melarang berbagi ke luar domain, file tetap tersimpan tetapi hanya bisa dibuka akun yang diberi akses. Kegagalan berbagi tercatat di sheet `Log`.
- **Login** berlaku ±1 jam. Setelah itu pengguna diminta masuk lagi.
- **Kuota Apps Script** (akun Workspace) jauh di atas kebutuhan MKS mingguan.
