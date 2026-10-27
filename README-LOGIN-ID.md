# Login aman untuk Serasi Update Harga (Cloudflare Pages)

Paket ini menambahkan halaman login dan Pages Functions ke dashboard statis yang sudah ada. **Login belum aktif sampai pengaturan Cloudflare di bawah selesai.** Uji dulu melalui branch preview, jangan langsung deploy ke produksi.

## File yang ditambahkan
- `login.html`: halaman login.
- `functions/_middleware.js`: memeriksa sesi sebelum melayani dashboard.
- `functions/api/login.js`: verifikasi username/password, rate limit, dan pembuatan sesi.
- `functions/api/logout.js`: mengakhiri sesi.
- `_routes.json`: mengarahkan semua rute melalui Pages Functions middleware.
- `schema.sql`: tabel akun, sesi, dan percobaan login.
- `scripts/create-password-hash.mjs`: alat lokal untuk membuat hash password dan perintah SQL akun.

## A. Uji aman lewat branch GitHub
1. Buat branch baru di GitHub, misalnya `add-login-test`.
2. Tambahkan file-file paket ini ke root repository bersama `index.html` yang sekarang.
3. Pastikan deployment preview memakai project Pages yang sama dan binding D1 dipasang untuk environment preview juga.

## B. Buat database D1
1. Cloudflare Dashboard → Workers & Pages → D1 SQL Database → Create database.
2. Beri nama, misalnya `serasi-auth`.
3. Buka database → Console, jalankan isi `schema.sql`.
4. Pada Cloudflare Pages project → Settings → Functions → D1 database bindings, tambahkan binding variable name **DB** dan pilih database `serasi-auth`. Atur untuk Preview dan Production sesuai kebutuhan.
5. Redeploy branch preview agar binding tersedia.

## C. Buat akun admin
1. Jalankan di komputer yang memiliki Node.js: `node scripts/create-password-hash.mjs`.
2. Masukkan username admin, peran `admin`, dan password kuat minimal 12 karakter. Input password akan tampil saat diketik di terminal; lakukan di komputer pribadi.
3. Salin perintah SQL yang dihasilkan dan jalankan di D1 Console. Jangan tempel password ke chat atau commit password ke GitHub.
4. Ulangi untuk setiap akun staf dengan peran `staff`.

## D. Tes sebelum produksi
- Tanpa login, buka `/` → harus diarahkan ke `/login.html`.
- Password salah → harus ditolak.
- Login benar → masuk dashboard.
- Logout dapat diuji melalui POST `/api/logout` dari halaman yang telah login; tombol logout belum ditambahkan pada dashboard lama.
- Setelah mengubah status user menjadi `active=0` di D1, sesi user itu tidak lagi diterima.
- Uji `/api/session` saat belum login dan saat sudah login.

## E. Catatan penting
- Fungsi login hanya mengamankan akses ke dashboard jika `_routes.json` dan Pages Functions benar-benar diterapkan dan diuji pada deployment yang aktif.
- Dashboard saat ini adalah satu file HTML. Data yang tertanam di dalam HTML akan dilayani setelah login melalui middleware, tetapi bila repository GitHub publik, siapa pun masih dapat membaca data dari repository. Jadikan repository **Private** dan periksa apakah ada deployment preview yang dapat diakses publik.
- Cookie sesi berumur 12 jam, `HttpOnly`, `Secure`, `SameSite=Strict`. Rate limit dasar membatasi 10 percobaan per IP per 15 menit.
- Buat cadangan sebelum deployment produksi. Login ini belum memiliki UI administrasi akun; akun dikelola melalui D1 Console.
- Jangan simpan password, token, atau secret di repository.
