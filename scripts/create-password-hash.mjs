import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
const rl = createInterface({ input: stdin, output: stdout });
try {
  const username = (await rl.question('Username (tanpa spasi): ')).trim();
  const roleInput = (await rl.question('Peran [admin/staff]: ')).trim().toLowerCase() || 'staff';
  const password = await rl.question('Password baru (min. 12 karakter): ');
  if (!/^[a-zA-Z0-9._-]{3,80}$/.test(username)) throw new Error('Username harus 3-80 karakter: huruf, angka, titik, garis bawah, atau strip.');
  if (!['admin', 'staff'].includes(roleInput)) throw new Error('Peran harus admin atau staff.');
  if (password.length < 12) throw new Error('Gunakan password minimal 12 karakter.');
  const iterations = 310000;
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const encoded = `pbkdf2_sha256$${iterations}$${salt.toString('base64')}$${hash.toString('base64')}`;
  const sqlQuote = s => "'" + s.replaceAll("'", "''") + "'";
  console.log('\nJalankan perintah SQL ini di Cloudflare D1 Console setelah schema.sql diterapkan:');
  console.log(`INSERT INTO users (username, password_hash, role, active, created_at) VALUES (${sqlQuote(username)}, ${sqlQuote(encoded)}, ${sqlQuote(roleInput)}, 1, ${Math.floor(Date.now()/1000)});`);
  console.log('\nJangan bagikan hash ini atau password. Perintah ini tidak membuat akun sampai SQL dijalankan.');
} finally { rl.close(); }
