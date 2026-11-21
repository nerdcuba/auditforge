// Fija la contraseña de un usuario existente sin mostrarla ni guardarla.
// Uso: npm run set-password -- tu@correo.com
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email) fail("Indica el correo: npm run set-password -- tu@correo.com");
if (!url || !key) fail("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function askHidden(prompt) {
  process.stdout.write(prompt);
  const muted = new Writable({ write: (_chunk, _encoding, done) => done() });
  const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
  return new Promise((resolve) => {
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const password = await askHidden("Nueva contraseña (mínimo 12 caracteres, no se verá): ");
if (password.length < 12 || password.length > 72) fail("La contraseña debe tener entre 12 y 72 caracteres.");
const repeated = await askHidden("Repítela: ");
if (password !== repeated) fail("Las contraseñas no coinciden.");

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let user;
for (let page = 1; !user; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
  if (error) fail(`No se pudo consultar Supabase: ${error.message}`);
  user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
  if (data.users.length < 200) break;
}
if (!user) fail("No existe ningún usuario con ese correo.");

const { error } = await admin.auth.admin.updateUserById(user.id, { password });
if (error) fail(`No se pudo guardar: ${error.message}`);
console.log("Contraseña guardada.");
