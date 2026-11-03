import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { DEFAULT_CONFIG, NETWORKS } from '../config.js';
import { getAddress, ZeroAddress } from '../assets/ethers.min.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseURL = new URL('https://example.github.io/vault-bank/');

export function validateSite(directory = path.join(projectRoot, 'dist')) {
  if (!NETWORKS[DEFAULT_CONFIG.chainId]) throw new Error('Unsupported default network in config.js');
  if (DEFAULT_CONFIG.contractAddress) {
    if (DEFAULT_CONFIG.contractAddress !== DEFAULT_CONFIG.contractAddress.trim()) throw new Error('Contract Address has leading or trailing whitespace in config.js');
    const address = getAddress(DEFAULT_CONFIG.contractAddress);
    if (address === ZeroAddress) throw new Error('Contract Address cannot be the zero address');
    console.log('Default Bank address is valid; chain ID: ' + DEFAULT_CONFIG.chainId);
  }
  const siteRoot = path.resolve(directory);
  const files = [];
  function walk(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes:true })) {
      const filename = path.join(folder, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Do not publish symbolic links: ' + filename);
      if (entry.isDirectory()) walk(filename); else if (entry.isFile()) files.push(filename);
    }
  }
  if (!fs.existsSync(siteRoot)) throw new Error('Build the site first: npm run build');
  walk(siteRoot);
  function exactFile(relative) {
    const parts = relative.split('/').filter(Boolean);
    let current = siteRoot;
    for (const part of parts) {
      if (part === '..' || !fs.existsSync(current) || !fs.statSync(current).isDirectory() || !fs.readdirSync(current).includes(part)) throw new Error('Missing file or incorrect letter case: ' + relative);
      current = path.join(current, part);
    }
    if (!fs.existsSync(current) || !fs.statSync(current).isFile()) throw new Error('Not a file: ' + relative);
    return current;
  }
  for (const required of ['index.html','styles.css','app.js','bank.js','config.js','assets/ethers.min.js','assets/ETHERS-LICENSE.md','assets/bank-contract.js','assets/ui-state.js','assets/USER-GUIDE.md','contracts/Bank.sol','.nojekyll']) exactFile(required);
  let references = 0;
  function checkReference(reference, source) {
    if (!reference || /^(?:data:|mailto:|tel:|javascript:)/i.test(reference)) return;
    const relativeSource = path.relative(siteRoot, source).split(path.sep).join('/');
    const resolved = new URL(reference, new URL(relativeSource, baseURL));
    if (resolved.origin !== baseURL.origin) return;
    if (!resolved.pathname.startsWith(baseURL.pathname)) throw new Error('Root-relative link breaks Repository Pages: ' + reference + ' in ' + relativeSource);
    const relative = decodeURIComponent(resolved.pathname.slice(baseURL.pathname.length)) || 'index.html';
    const target = exactFile(relative);
    if (resolved.hash && path.extname(target) === '.html') {
      const targetText = fs.readFileSync(target,'utf8');
      const ids = [...targetText.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
      if (!ids.includes(decodeURIComponent(resolved.hash.slice(1)))) throw new Error('Missing anchor: ' + reference);
    }
    references++;
  }
  for (const file of files) {
    const extension = path.extname(file);
    if (!['.html','.css','.js'].includes(extension)) continue;
    const content = fs.readFileSync(file, 'utf8');
    if (extension === '.js') {
      const result = spawnSync(process.execPath, ['--check',file], { encoding:'utf8', windowsHide:true });
      if (result.status !== 0) throw new Error('JavaScript syntax check failed: ' + file + '\n' + (result.stderr || result.error?.message || ''));
      if (!file.endsWith('ethers.min.js')) for (const match of content.matchAll(/\bfrom\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) checkReference(match[1] || match[2],file);
    }
    if (extension === '.html') {
      const ids = [...content.matchAll(/\bid=["']([^"']+)["']/g)].map(match=>match[1]);
      if (new Set(ids).size !== ids.length) throw new Error('Duplicate HTML IDs: ' + file);
      for (const match of content.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) checkReference(match[1],file);
    }
    if (extension === '.css') for (const match of content.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/g)) checkReference(match[1],file);
  }
  console.log('Pages check passed: ' + files.length + ' files, ' + references + ' local references; repository subpath and letter case are valid.');
  return { files:files.length, references };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) validateSite();
