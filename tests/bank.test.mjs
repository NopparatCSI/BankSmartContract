import { test } from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory, parseEther } from 'ethers';
import { compile } from '../scripts/compile.mjs';
import { BankClient, parseAmount, validateConfig, readableError } from '../bank.js';
const compiled = compile({ 'Attack.sol': { content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
interface IBank { function deposit() external payable; function withdraw(uint256) external; function checkBalance() external view returns(uint256); }
contract Attack {
  IBank bank; bool rejectPayment;
  constructor(address target) { bank = IBank(target); }
  function deposit() external payable { bank.deposit{value:msg.value}(); }
  function attack(uint256 amount, bool reject) external { rejectPayment = reject; bank.withdraw(amount); }
  receive() external payable { if (rejectPayment) revert("Reject ETH"); try bank.withdraw(msg.value) {} catch {} }
}` } });
const bankArtifact = compiled['Bank.sol'].Bank;
const attackArtifact = compiled['Attack.sol'].Attack;
async function fixture() {
  const rpc = ganache.provider({ logging:{quiet:true}, chain:{chainId:1337,hardfork:'shanghai'}, wallet:{totalAccounts:3,defaultBalance:100} });
  const provider = new BrowserProvider(rpc, undefined, {cacheTimeout:-1});
  provider.pollingInterval = 20;
  const alice = await provider.getSigner(0), bob = await provider.getSigner(1);
  const bank = await new ContractFactory(bankArtifact.abi, bankArtifact.evm.bytecode.object, alice).deploy();
  await bank.waitForDeployment();
  return { rpc,provider,alice,bob,bank,close:async()=>{provider.destroy();await rpc.disconnect();} };
}
test('amount validation preserves 18-decimal precision and rejects invalid input', () => {
  assert.equal(parseAmount('0.000000000000000001'),1n);
  assert.equal(parseAmount('1.123456789123456789'),1123456789123456789n);
  for (const amount of ['0','-1','1e3','NaN','1.0000000000000000001','0x10','1,000','']) assert.throws(()=>parseAmount(amount));
  assert.throws(()=>validateConfig({chainId:'1',contractAddress:'0x7753139708C1137aC9B75082FA03f3D597223B31'}));
  assert.throws(()=>validateConfig({chainId:'1337',contractAddress:'0x0000000000000000000000000000000000000000'}));
  assert.equal(readableError({code:4001}),'คุณยกเลิกคำขอใน MetaMask แล้ว');
});
test('deposit/withdraw balances, events, isolation, and rejected amounts', async () => {
  const f = await fixture();
  try {
    assert.equal(await f.bank.checkBalance(),0n);
    const deposit = await (await f.bank.deposit({value:parseEther('2')})).wait();
    const depositEvent = f.bank.interface.parseLog(deposit.logs[0]);
    assert.equal(depositEvent.name,'Deposit');
    assert.equal(depositEvent.args.owner,await f.alice.getAddress());
    assert.equal(depositEvent.args.amount,parseEther('2'));
    assert.equal(await f.bank.checkBalance(),parseEther('2'));
    assert.equal(await f.bank.connect(f.bob).checkBalance(),0n);
    await assert.rejects(f.bank.deposit({value:0n}));
    await assert.rejects(f.bank.withdraw(0n));
    await assert.rejects(f.bank.withdraw(parseEther('3')));
    await assert.rejects(f.bank.connect(f.bob).withdraw(1n));
    const withdrawal = await (await f.bank.withdraw(parseEther('0.75'))).wait();
    const withdrawEvent = f.bank.interface.parseLog(withdrawal.logs[0]);
    assert.equal(withdrawEvent.name,'Withdraw');
    assert.equal(withdrawEvent.args.amount,parseEther('0.75'));
    assert.equal(await f.bank.checkBalance(),parseEther('1.25'));
    assert.equal(BigInt(await f.rpc.request({method:'eth_getBalance',params:[await f.bank.getAddress(),'latest']})),parseEther('1.25'));
  } finally { await f.close(); }
});
test('reentrancy cannot drain another depositor and failed ETH transfer restores balance', async () => {
  const f = await fixture();
  try {
    await (await f.bank.deposit({value:parseEther('5')})).wait();
    const attack = await new ContractFactory(attackArtifact.abi,attackArtifact.evm.bytecode.object,f.bob).deploy(await f.bank.getAddress());
    await attack.waitForDeployment();
    await (await attack.deposit({value:parseEther('1')})).wait();
    await (await attack.attack(parseEther('1'),false)).wait();
    assert.equal(await f.bank.checkBalance(),parseEther('5'));
    assert.equal(BigInt(await f.rpc.request({method:'eth_getBalance',params:[await f.bank.getAddress(),'latest']})),parseEther('5'));
    await (await attack.deposit({value:parseEther('1')})).wait();
    await assert.rejects(attack.attack(parseEther('1'),true));
    const balance = await f.bank.checkBalance({from:await f.alice.getAddress()});
    assert.equal(balance,parseEther('5'));
    const attackBalance = await f.rpc.request({method:'eth_call',params:[{to:await f.bank.getAddress(),from:await attack.getAddress(),data:f.bank.interface.encodeFunctionData('checkBalance')},'latest']});
    assert.equal(BigInt(attackBalance),parseEther('1'));
  } finally { await f.close(); }
});
test('the frontend BankClient completes a real local-chain roundtrip and rejects wrong contexts', async () => {
  const f = await fixture(); let app;
  try {
    let accounts = [await f.alice.getAddress()]; let chain = '0x539';
    const injected = {
      request: async ({method,params}) => {
        if (['eth_accounts','eth_requestAccounts'].includes(method)) return accounts;
        if (method === 'eth_chainId') return chain;
        return f.rpc.request({method,params});
      }
    };
    app = new BankClient(injected,{chainId:'1337',contractAddress:await f.bank.getAddress()});
    app.provider.pollingInterval = 20;
    await app.connect(); await app.openContract();
    await (await app.send('deposit','0.1')).wait();
    assert.equal((await app.balances()).bank,parseEther('0.1'));
    await (await app.send('withdraw','0.04')).wait();
    assert.equal((await app.balances()).bank,parseEther('0.06'));
    await assert.rejects(app.send('withdraw','0.07'),/Insufficient balance/);
    chain = '0xaa36a7'; await assert.rejects(app.send('deposit','0.1'),/เครือข่ายไม่ตรง/);
    chain = '0x539'; accounts = [await f.bob.getAddress()]; await assert.rejects(app.send('deposit','0.1'),/บัญชีเปลี่ยน/);
    accounts = []; await assert.rejects(app.assertContext(),/บัญชีเปลี่ยน/);
    accounts = [await f.alice.getAddress()];
    app.config.contractAddress = await f.bob.getAddress();
    await assert.rejects(app.openContract(),/ไม่พบ Smart Contract/);
  } finally { app?.destroy(); await f.close(); }
});

test('setup rejects wallet and unrelated contract addresses, and the built-in deploy produces a working Bank', async () => {
  const f = await fixture(); let app;
  try {
    const account = await f.alice.getAddress();
    const otherWallet = await f.bob.getAddress();
    const injected = { request: async ({method,params}) => {
      if (['eth_accounts','eth_requestAccounts'].includes(method)) return [account];
      if (method === 'eth_getCode' && params[0].toLowerCase() === otherWallet.toLowerCase()) return '0xef0100' + '11'.repeat(20);
      return f.rpc.request({method,params});
    } };
    app = new BankClient(injected,{chainId:'1337',contractAddress:account});
    app.provider.pollingInterval = 20;
    await app.connect();
    assert.ok(await app.walletBalance() > 0n);
    await assert.rejects(app.openContract(),/Address นี้เป็นกระเป๋า MetaMask/);
    assert.equal(app.contract,undefined);
    app.config.contractAddress = otherWallet;
    await assert.rejects(app.openContract(),/บัญชีกระเป๋าที่มอบหมายโค้ด/);
    const unrelated = await new ContractFactory(attackArtifact.abi,attackArtifact.evm.bytecode.object,f.alice).deploy(await f.bank.getAddress());
    await unrelated.waitForDeployment();
    app.config.contractAddress = await unrelated.getAddress();
    await assert.rejects(app.openContract(),/checkBalance\(\) ของ Bank ไม่ได้/);
    assert.equal(app.contract,undefined);
    const created = await app.deployBank();
    const receipt = await created.deploymentTransaction().wait();
    assert.equal(receipt.status,1);
    app.config.contractAddress = await created.getAddress();
    assert.notEqual(app.config.contractAddress,account);
    await app.openContract();
    await (await app.send('deposit','0.01')).wait();
    assert.equal((await app.balances()).bank,parseEther('0.01'));
    await (await app.send('withdraw','0.01')).wait();
    assert.equal((await app.balances()).bank,0n);
  } finally { app?.destroy(); await f.close(); }
});

import { getSetupState } from '../assets/ui-state.js';
test('new user receives a clear next action for every setup stage', () => {
  assert.equal(getSetupState({}).action,'connect');
  assert.equal(getSetupState({account:'0x1'}).action,'setup');
  assert.equal(getSetupState({account:'0x1',wrongNetwork:true}).action,'switch');
  assert.equal(getSetupState({account:'0x1',ready:true}).action,'banking');
  assert.equal(getSetupState({account:'0x1',pending:true}).label,'ตรวจสอบบัญชี Bank');
  assert.equal(getSetupState({connecting:true}).action,'wait');
  assert.equal(getSetupState({account:'0x1',ready:true,busy:true}).action,'wait');
  const failed = getSetupState({account:'0x1',error:'Address นี้เป็นกระเป๋า กรุณาสร้าง Bank'});
  assert.equal(failed.step,2); assert.match(failed.message,/กรุณาสร้าง Bank/);
});
