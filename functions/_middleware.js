
<!DOCTYPE html>
<html lang="id">
<meta charset="UTF-8">
<title>Buat Hash Admin</title>
<h2>Buat akun admin Serasi</h2>


<label>Username</label><br>
<input id="username" value="Mantap" autocomplete="username"><br><br>

<label>Password baru (minimal 12 karakter)</label><br>
<input id="password" type="password" minlength="12" autocomplete="new-password" value="Coba!Serasi2026Aman"><br><br>


<button id="buat">Buat SQL</button>
<p id="status"></p>
<textarea id="hasil" rows="6" cols="70" readonly></textarea>

<script>
const b64 = bytes => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

document.getElementById("buat").onclick = async () => {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const status = document.getElementById("status");
  const hasil = document.getElementById("hasil");

  if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) {
    status.textContent = "Username tidak valid.";
    return;
  }
  if (password.length < 12) {
    status.textContent = "Password minimal 12 karakter.";
    return;
  }

  try {
    const iterations = 310000;
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(password),
      "PBKDF2", false, ["deriveBits"]
    );
    const derived = new Uint8Array(await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations },
      key, 256
    ));
    const hash = `pbkdf2_sha256$${iterations}$${b64(salt)}$${b64(derived)}`;
    const q = s => "'" + s.replaceAll("'", "''") + "'";
    hasil.value = `INSERT INTO users (username, password_hash, role, active, created_at) VALUES (${q(username)}, ${q(hash)}, 'admin', 1, ${Math.floor(Date.now()/1000)});`;
    status.textContent = "SQL berhasil dibuat. Salin hasilnya ke Cloudflare D1.";
    document.getElementById("password").value = "";
  } catch {
    status.textContent = "Browser tidak mendukung fungsi hash di halaman lokal. Beri tahu saya pesan ini.";
  }
};
</script>
</html>
