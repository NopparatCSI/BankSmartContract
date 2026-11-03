import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function compile(extraSources = {}) {
  const sources = { 'Bank.sol': { content: fs.readFileSync(path.join(root, 'contracts/Bank.sol'), 'utf8') }, ...extraSources };
  const input = { language: 'Solidity', sources, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris', outputSelection: { '*': { '*': ['abi','evm.bytecode.object'] } } } };
  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: name => {
    const resolved = path.resolve(root, 'node_modules', name);
    if (!resolved.startsWith(path.resolve(root, 'node_modules') + path.sep)) return { error: 'Invalid import' };
    try { return { contents: fs.readFileSync(resolved, 'utf8') }; } catch { return { error: 'Import not found: ' + name }; }
  } }));
  const failures = (output.errors || []).filter(e => e.severity === 'error');
  if (failures.length) throw new Error(failures.map(e => e.formattedMessage).join('\n'));
  return output.contracts;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bank = compile()['Bank.sol'].Bank;
  fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'artifacts/Bank.json'), JSON.stringify({ compiler: solc.version(), abi:bank.abi, bytecode:'0x'+bank.evm.bytecode.object }, null, 2));
  fs.writeFileSync(path.join(root, 'assets/bank-contract.js'), '// Generated from contracts/Bank.sol by npm run compile.\nexport const BANK_ARTIFACT = ' + JSON.stringify({ abi:bank.abi, bytecode:'0x'+bank.evm.bytecode.object }) + ';\n');
  console.log('Bank.sol compiled successfully with Solidity ' + solc.version());
}
