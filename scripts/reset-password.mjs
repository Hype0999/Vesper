#!/usr/bin/env node
// ==============================================================================
// TravelHub Pro - User & Vault Password Reset Tool
// Works on Windows, Linux, and Raspberry Pi OS
// Usage:
//   node scripts/reset-password.mjs
//   node scripts/reset-password.mjs [username] [new_account_password] [new_vault_password]
// ==============================================================================

import readline from 'node:readline';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import argon2 from 'argon2';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Find active database
const candidateDbPaths = [
  path.resolve(projectRoot, 'storage/database/media-hub.sqlite'),
  path.resolve(projectRoot, 'server/storage/database/media-hub.sqlite'),
];

let dbPath = candidateDbPaths.find((p) => fs.existsSync(p));
if (!dbPath) {
  dbPath = candidateDbPaths[0];
}

console.log('====================================================');
console.log('   🔐 TravelHub Pro - Password Reset Utility');
console.log('====================================================');
console.log('Target database:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('\n❌ Error: Database file not found at:', dbPath);
  console.error('Please start the server first to initialize the database.');
  process.exit(1);
}

const db = new Database(dbPath);

// List existing users
const users = db.prepare('SELECT id, username, role, created_at FROM users').all();

if (users.length === 0) {
  console.error('\n❌ No users found in database. The hub is not initialized yet.');
  console.log('Please open http://localhost:3000 to complete first-run setup.');
  process.exit(1);
}

console.log('\nRegistered accounts:');
users.forEach((u, idx) => {
  console.log(` [${idx + 1}] Username: "${u.username}" | Role: ${u.role || 'admin'} (ID: ${u.id})`);
});
console.log('----------------------------------------------------');

const ARGON2_CONFIG = {
  type: 2, // argon2id
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

async function executeReset(username, newPass, newVaultPass) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    console.error(`\n❌ Error: User "${username}" not found.`);
    process.exit(1);
  }

  console.log(`\n⏳ Hashing passwords with Argon2id for user "${username}"...`);

  const passwordHash = await argon2.hash(newPass, ARGON2_CONFIG);
  let vaultPasswordHash = user.vault_password_hash;

  if (newVaultPass && newVaultPass.trim().length > 0) {
    vaultPasswordHash = await argon2.hash(newVaultPass, ARGON2_CONFIG);
  }

  db.prepare(`
    UPDATE users
    SET password_hash = ?, vault_password_hash = ?
    WHERE id = ?
  `).run(passwordHash, vaultPasswordHash, user.id);

  // Invalidate any active sessions for security
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  db.prepare('DELETE FROM vault_sessions WHERE user_id = ?').run(user.id);

  console.log('\n✅ SUCCESS! Credentials updated successfully:');
  console.log(` • Username:         ${username}`);
  console.log(` • Account Password: ${newPass}`);
  if (newVaultPass && newVaultPass.trim().length > 0) {
    console.log(` • Vault Passphrase: ${newVaultPass}`);
  } else {
    console.log(` • Vault Passphrase: (Unchanged)`);
  }
  console.log(' • Active sessions:  Revoked (Please log in with your new password)');
  console.log('====================================================\n');
}

// Check CLI arguments
const args = process.argv.slice(2);

if (args.length >= 2) {
  const targetUser = args[0];
  const targetPass = args[1];
  const targetVault = args[2] || '';
  await executeReset(targetUser, targetPass, targetVault);
  process.exit(0);
}

// Interactive Prompt
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

try {
  let selectedUsername = users[0].username;
  if (users.length > 1) {
    const userAns = await question(`\nEnter username to reset [default: ${users[0].username}]: `);
    if (userAns.trim()) {
      selectedUsername = userAns.trim();
    }
  }

  const newPass = await question(`Enter NEW account password for "${selectedUsername}": `);
  if (!newPass || newPass.trim().length < 4) {
    console.error('❌ Password must be at least 4 characters long.');
    rl.close();
    process.exit(1);
  }

  const newVault = await question('Enter NEW vault passphrase (press Enter to keep current): ');

  rl.close();
  await executeReset(selectedUsername, newPass.trim(), newVault.trim());
} catch (err) {
  console.error('\n❌ Operation cancelled or failed:', err);
  rl.close();
  process.exit(1);
}
