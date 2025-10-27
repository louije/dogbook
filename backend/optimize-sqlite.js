#!/usr/bin/env node
/**
 * Optimize SQLite database settings
 *
 * This script sets optimal PRAGMA values for the SQLite database:
 * - WAL mode: Better concurrency, allows multiple readers with one writer
 * - NORMAL synchronous: Good balance between safety and performance
 * - Larger cache: Better query performance
 *
 * Run this after database creation or migration
 */

const Database = require('better-sqlite3');
const path = require('path');

// Determine database path from environment or use default
const dbPath = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.replace('file:', '').split('?')[0]
  : path.join(__dirname, '..', 'data', 'keystone.db');

console.log(`Optimizing SQLite database at: ${dbPath}`);

try {
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  console.log('✓ Enabled WAL (Write-Ahead Logging) mode');

  // Set synchronous to NORMAL for good balance
  db.pragma('synchronous = NORMAL');
  console.log('✓ Set synchronous mode to NORMAL');

  // Increase cache size (negative value = KB, positive = pages)
  // -64000 = 64MB cache
  db.pragma('cache_size = -64000');
  console.log('✓ Set cache size to 64MB');

  // Use memory for temp store (faster)
  db.pragma('temp_store = MEMORY');
  console.log('✓ Set temp store to MEMORY');

  // Enable memory-mapped I/O (256MB)
  db.pragma('mmap_size = 268435456');
  console.log('✓ Enabled memory-mapped I/O (256MB)');

  // Show current settings
  console.log('\nCurrent database settings:');
  console.log('  Journal mode:', db.pragma('journal_mode', { simple: true }));
  console.log('  Synchronous:', db.pragma('synchronous', { simple: true }));
  console.log('  Cache size:', db.pragma('cache_size', { simple: true }));
  console.log('  Temp store:', db.pragma('temp_store', { simple: true }));
  console.log('  Mmap size:', db.pragma('mmap_size', { simple: true }));

  db.close();
  console.log('\n✓ Database optimization complete!');
} catch (error) {
  console.error('Error optimizing database:', error.message);
  process.exit(1);
}
