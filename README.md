Muzi Shope Game
Website top up game dengan katalog produk, checkout, pembayaran gateway, cek pesanan, riwayat transaksi, dan live chat berbasis Socket.IO.
Persyaratan
Node.js 20 atau lebih baru
Akun merchant Midtrans yang sudah diverifikasi untuk menerima pembayaran
Hosting yang mendukung aplikasi Node.js (Render, Railway, VPS, atau sejenisnya)
Jalankan lokal
Salin .env.example menjadi .env.
Isi MIDTRANS_SERVER_KEY dan MIDTRANS_CLIENT_KEY dari dashboard merchant Midtrans. Jangan pernah memasukkan Server Key ke file frontend atau commit .env ke GitHub.
Untuk pengujian, biarkan MIDTRANS_IS_PRODUCTION=false dan gunakan kredensial sandbox.
Jalankan:
npm install
npm start
Buka http://localhost:3000.
Tanpa kredensial gateway yang valid, checkout akan menolak pembuatan transaksi. Ini disengaja agar pelanggan tidak diarahkan ke pembayaran palsu.
Aktifkan pembayaran sungguhan
Selesaikan pendaftaran/verifikasi merchant di Midtrans.
Uji seluruh alur dengan kredensial sandbox terlebih dahulu.
Atur MIDTRANS_IS_PRODUCTION=true hanya setelah akun live disetujui, dan isi kredensial produksi melalui Environment Variables di hosting.
Atur BASE_URL ke URL HTTPS aplikasi yang benar.
Di dashboard Midtrans, daftarkan URL notifikasi transaksi: https://DOMAIN-ANDA/api/midtrans/notification.
Aktifkan QRIS dan metode lain yang memang tersedia/diizinkan pada akun merchant. Metode yang muncul ditentukan gateway, status merchant, dan konfigurasi; aplikasi tidak dapat mengaktifkan metode pembayaran hanya dengan kode.
Jalankan transaksi uji yang sah, lalu pastikan notifikasi memperbarui status menjadi PAID.
Deploy dan GitHub
GitHub Pages hanya meng-host file statis dan tidak menjalankan server.js. Karena website ini memerlukan Node.js, Socket.IO, penyimpanan pesanan, dan rahasia payment gateway, deploy seluruh repository ke hosting Node.js. GitHub dapat digunakan sebagai repository source:
Buat repository GitHub baru.
Upload seluruh file project kecuali .env, node_modules, dan data pesanan.
Hubungkan repository ke hosting Node.js.
Set Build/Install command npm install, start command npm start.
Tambahkan semua variabel environment dari .env.example di dashboard hosting.
Live chat
Chat real-time publik berbasis Socket.IO. Pesan saat ini hanya disiarkan ke klien yang sedang online dan tidak disimpan. Ini bukan inbox privat; jangan minta pelanggan mengirim OTP, kata sandi, data kartu, atau informasi sensitif. Untuk balasan admin, sambungkan socket client admin terpisah yang mengirim event chat:admin dengan ADMIN_CHAT_TOKEN dari server; jangan pernah menaruh token tersebut di frontend publik. Untuk penggunaan produksi, tambahkan autentikasi admin, moderasi, rate limiting, dan penyimpanan chat.
Data & batasan yang perlu diketahui
Katalog dan harga awal berada di server.js; sesuaikan dengan supplier resmi dan harga jual sebelum membuka toko.
Top up belum otomatis dikirim ke game. Untuk pemenuhan otomatis, integrasikan API supplier resmi di server dan proses hanya setelah pembayaran tervalidasi.
Contoh penyimpanan pesanan menggunakan data/orders.json untuk setup sederhana. Pada hosting ephemeral/multi-instance, gunakan database terkelola (PostgreSQL, misalnya) sebelum produksi.
Riwayat dicari menggunakan email atau nomor HP yang diberikan saat checkout. Kode pesanan tidak menggantikan verifikasi identitas untuk tindakan sensitif.
Harga di katalog adalah nilai awal yang perlu diverifikasi; cek harga, pajak, biaya gateway, aturan refund, privasi, dan ketentuan publisher game sebelum peluncuran.
Gunakan hanya kredensial dan akun merchant milik sendiri. Jangan pernah menyimpan data kartu pembayaran mentah.
File
public/index.html — UI storefront
public/style.css — desain responsif
public/app.js — frontend dan interaksi
server.js — API, pesanan, Midtrans notification, Socket.IO
.env.example — contoh variabel konfigurasi
