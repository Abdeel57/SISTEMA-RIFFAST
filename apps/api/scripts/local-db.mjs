// PostgreSQL portátil para desarrollo local — sin Docker ni instalación de servicio.
// Usa los binarios de `@embedded-postgres` vía `pg_ctl`, que en Windows arranca el
// servidor con un token restringido (necesario porque Postgres no corre como admin).
//
//   node scripts/local-db.mjs          -> inicia (idempotente). DB queda corriendo.
//   node scripts/local-db.mjs stop     -> detiene el servidor.
//
// Cadena de conexión: postgresql://postgres:postgres@localhost:5433/bismark
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiDir = join(__dirname, '..');
const repoRoot = join(apiDir, '..', '..');
const dataDir = join(apiDir, '.localdb');
const logFile = join(apiDir, '.localdb-log.txt');
const PORT = 5433;
const isWin = process.platform === 'win32';
const exe = (name) => (isWin ? `${name}.exe` : name);

function findBinDir() {
  const base = join(repoRoot, 'node_modules', '@embedded-postgres');
  if (!existsSync(base)) throw new Error('Falta @embedded-postgres. Ejecuta: npm install');
  for (const pkg of readdirSync(base)) {
    const bin = join(base, pkg, 'native', 'bin');
    if (existsSync(join(bin, exe('pg_ctl')))) return bin;
  }
  throw new Error('No se encontraron binarios de Postgres (@embedded-postgres).');
}

const BIN = findBinDir();
const pgctl = join(BIN, exe('pg_ctl'));
const initdb = join(BIN, exe('initdb'));

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: apiDir });
  return r.status ?? 1;
}

if (process.argv[2] === 'stop') {
  console.log('[localdb] Deteniendo Postgres...');
  run(pgctl, ['-D', dataDir, 'stop', '-m', 'fast']);
  process.exit(0);
}

// Inicializar el cluster la primera vez (autenticación trust para desarrollo local).
if (!existsSync(join(dataDir, 'PG_VERSION'))) {
  console.log('[localdb] Inicializando cluster local...');
  const code = run(initdb, ['-D', dataDir, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--no-locale']);
  if (code !== 0) {
    console.error('[localdb] initdb falló.');
    process.exit(1);
  }
}

// Iniciar el servidor (idempotente: si ya corre, pg_ctl lo informa).
console.log(`[localdb] Iniciando Postgres en el puerto ${PORT}...`);
const status = run(pgctl, ['-D', dataDir, '-l', logFile, '-o', `-p ${PORT}`, '-w', 'start']);

if (status === 0) {
  console.log('[localdb] ✅ Postgres listo en postgresql://postgres:postgres@localhost:5433/bismark');
  console.log('[localdb]    (la base "bismark" la crea Prisma al migrar)');
} else {
  // pg_ctl devuelve !=0 si ya estaba corriendo; verificar el log.
  console.log('[localdb] Postgres ya estaba corriendo o revisa', logFile);
}
process.exit(0);
