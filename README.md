# VAULT — Smart Contract Bank

เว็บ DApp สำหรับ CSI301 Assignment 6 ใช้ MetaMask ฝาก ถอน และตรวจสอบยอด ETH ผ่าน Bank Smart Contract ออกแบบธีม **Black / Neon Purple** และรองรับมือถือ

**ผู้จัดทำ:** 66068773 · นพรัตน์ สุวรรณะ

โปรเจกต์อยู่ที่ `D:\csi301\assi6` หน้าเว็บเป็น HTML / CSS / JavaScript แบบ static จึงนำขึ้น GitHub Pages ได้ ส่วนสัญญา Bank ทำงานแยกอยู่บน Sepolia การเผยแพร่หน้าเว็บไม่ใช่การ Deploy สัญญาใหม่

## 1. เปิดเว็บในเครื่อง

ต้องมี Node.js 20 ขึ้นไป (workflow ของ GitHub ใช้ Node.js 22)

```powershell
cd D:\csi301\assi6
npm.cmd start
```

เปิด [http://127.0.0.1:5173](http://127.0.0.1:5173) ใน Chrome ที่ติดตั้ง MetaMask หรือดับเบิลคลิก `start.bat` และเปิด URL เดียวกัน หยุดเซิร์ฟเวอร์ด้วย Ctrl + C

การเปิดเว็บและ Build ไม่ต้องติดตั้งแพ็กเกจ เพราะเก็บ ethers.js และไฟล์สำหรับสร้าง Bank ไว้ใน `assets/` แล้ว ส่วนการ Compile สัญญาและรันชุดทดสอบต้องติดตั้ง dependencies ก่อน:

```powershell
npm.cmd ci --cache .\work\npm-cache
npm.cmd test
```

## 2. ค่าที่ต้องตรวจสอบก่อนเผยแพร่

เปิด `config.js`:

```javascript
export const DEFAULT_CONFIG = {
  contractAddress: '0xe017Fa61A9d8248071192A4C82C745840bfdF6b3',
  chainId: '11155111',
  studentId: '66068773',
  studentName: 'นพรัตน์ สุวรรณะ'
};
```

### Contract Address ใส่อะไร?

ใส่ **Address ของสัญญา Bank ที่ Deploy บน Sepolia แล้ว** หากต้องการให้หน้าเว็บเชื่อมต่อ Bank เดิมเป็นค่าเริ่มต้น ไม่ใช่เลขกระเป๋า MetaMask

- Contract Address เป็นข้อมูลสาธารณะ ไม่ใช่ private key หรือ seed phrase
- หลายกระเป๋าใช้ Bank สัญญาเดียวกันได้ แต่ยอดฝากและสิทธิ์ถอนแยกตามกระเป๋า
- หากเคยฝากเงินแล้ว ให้ใช้กระเป๋า เครือข่าย และ Bank Address เดิมเพื่ออ่านยอดหรือถอน ไม่ต้องสร้างสัญญาใหม่
- เว้น `contractAddress: ''` ได้หากยังไม่มีสัญญา ผู้ใช้จะตั้งค่าหรือสร้าง Bank จากหน้าเว็บภายหลังได้ แต่ยังฝาก–ถอนไม่ได้จนกว่าจะเชื่อมต่อ Bank สำเร็จ

**ค่าบน localhost ไม่ย้ายไป GitHub Pages อัตโนมัติ:** การอนุญาต MetaMask, Contract Address ที่บันทึกผ่านเว็บ และประวัติในเบราว์เซอร์เป็นข้อมูลของเว็บไซต์นั้น เมื่อเปิด GitHub Pages ครั้งแรกให้เชื่อมต่อ MetaMask และใส่ Address ของ Bank เดิม หรือกำหนดไว้ใน `config.js` ก่อน Push

ค่าที่บันทึกผ่านหน้าตั้งค่ามีลำดับก่อนค่าเริ่มต้นเฉพาะ `contractAddress` และ `chainId` หากเปลี่ยน `config.js` แล้วเบราว์เซอร์เดิมยังแสดงสัญญาเก่า ให้แก้ Address ผ่านหน้าตั้งค่าของเว็บด้วย

### ชื่อและรหัสนักศึกษา

ใช้ค่าจาก `config.js` เสมอ แสดงใน Sidebar และ Footer หน้าต่างข้อมูลผู้จัดทำเป็นแบบอ่านอย่างเดียว และไม่มีปุ่มบันทึก ข้อมูลชื่อหรือรหัสเก่าในเบราว์เซอร์จะไม่ทับค่าที่กำหนดไว้ในไฟล์

## 3. ตรวจและ Build ก่อนอัปโหลด

```powershell
cd D:\csi301\assi6
npm.cmd run build
```

คำสั่งนี้คัดลอกเฉพาะหน้าเว็บและทรัพยากรที่ใช้ไปยัง `dist/` และตรวจ:

- Contract Address เริ่มต้นไม่มีช่องว่าง รูปแบบถูกต้อง และเครือข่ายที่กำหนดรองรับ
- ไฟล์ JavaScript ไม่มี syntax error
- ไฟล์หน้าเว็บ โมดูล รูปไอคอน คู่มือ และไฟล์สัญญาที่อ้างถึงมีอยู่จริง
- ชื่อไฟล์และตัวพิมพ์เล็ก–ใหญ่ตรงกันสำหรับระบบ Linux บน GitHub
- ลิงก์และโมดูลใช้ได้เมื่อเว็บอยู่ใต้ path ของ repository เช่น `/vault-bank/`
- ไม่มี HTML ID ซ้ำ และลิงก์ภายในหน้าชี้ไปยัง ID ที่มีอยู่

หาก Build ไม่ผ่าน ให้แก้ข้อความผิดพลาดก่อน Push ส่วนการตรวจ `dist/` ที่สร้างไว้แล้วใช้ `npm.cmd run check`

## 4. นำขึ้น GitHub และเปิด GitHub Pages

### วิธีแนะนำ: GitHub Actions ที่เตรียมไว้ในโปรเจกต์

workflow อยู่ที่ `.github/workflows/deploy.yml` ทำงานเมื่อ Push สาขา `main` หรือกด Run workflow เอง โดย Build และตรวจไฟล์ก่อนอัปโหลด `dist/` ไป Pages

1. สร้าง repository ใหม่บน GitHub เช่น `vault-bank` หากใช้ GitHub Free ให้เลือก Public สำหรับ GitHub Pages และสร้างเป็น repository ว่างก่อน โดยยังไม่เพิ่ม README จากหน้า GitHub
2. เปิด Terminal ที่โฟลเดอร์โปรเจกต์ แล้วใช้คำสั่งด้านล่าง โดยเปลี่ยน `YOUR_USERNAME` และ `YOUR_REPOSITORY` เป็นข้อมูลจริง:

```powershell
cd D:\csi301\assi6
git init
git add .
git status --short
git commit -m "Prepare VAULT for GitHub Pages"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

ก่อน Commit ให้ตรวจรายการจาก `git status --short` ว่าไม่ได้เพิ่ม `node_modules/`, `work/`, `artifacts/` หรือ `dist/` ซึ่ง `.gitignore` ตัดออกไว้แล้ว

3. บน GitHub ไปที่ **repository → Settings → Pages → Build and deployment → Source → GitHub Actions** ตาม [คู่มือกำหนดแหล่งเผยแพร่ของ GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
4. ไปที่แท็บ **Actions → Deploy VAULT to GitHub Pages → Run workflow → main** หาก workflow ทำงานสำเร็จหลัง Push แล้ว ไม่ต้องรันซ้ำ หากรอบแรกทำงานก่อนตั้งค่า Pages และล้มเหลว ให้ตั้งค่า Source ตามข้อ 3 แล้วรันใหม่
5. เมื่อ Deploy สำเร็จ เปิด URL จาก **Settings → Pages → Visit site** หรือหน้าสรุป workflow รูปแบบ URL ของ Repository Pages คือ `https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/`
6. เปิด URL จริงด้วย Chrome ที่มี MetaMask ทดสอบเชื่อมต่อ Sepolia และ Bank เดิม แล้วตรวจว่าชื่อกับรหัสนักศึกษาปรากฏที่ Footer ก่อนนำ URL ส่งงาน

**วางไฟล์ไว้ที่ root ของ repository:** ต้องเห็น `index.html`, `package.json`, `assets/`, `scripts/` และ `.github/` ในหน้าแรกของ repository ไม่วางทั้งหมดซ้อนอยู่ในโฟลเดอร์ `assi6/` อีกชั้น

workflow ใช้ `GITHUB_TOKEN` ที่ GitHub จัดให้ พร้อมสิทธิ์ `contents: read`, `pages: write`, `id-token: write` และ environment `github-pages` ไม่ต้องเพิ่ม private key กระเป๋าเข้า GitHub Secrets การทำงานของ workflow อ้างอิง [คู่มือ custom workflow ของ GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

workflow ไม่รัน `npm ci` เพราะการ Build ใช้เฉพาะ Node.js built-in และไฟล์ที่เก็บมากับ repository; ชุดทดสอบสัญญารันแยกในเครื่องด้วย `npm.cmd test`

### ถ้ามี Git repository หรือ remote อยู่แล้ว

ข้าม `git init` และ `git remote add origin` ที่ตั้งค่าไว้แล้ว ตรวจด้วย `git remote -v` และ Push ไป repository ที่ต้องการโดยไม่ทับประวัติของสาขาอื่น

### อัปเดตเว็บไซต์ครั้งถัดไป

```powershell
cd D:\csi301\assi6
npm.cmd run build
git add .
git commit -m "Update VAULT website"
git push
```

เมื่อ Push สาขา `main` workflow จะ Deploy หน้าเว็บรอบใหม่ หลังสำเร็จกด Ctrl + F5 หากยังเห็นหน้าเก่า

หากเปลี่ยนเฉพาะหน้าเว็บ ไม่ต้อง Deploy Bank ใหม่ ยอดฝากเดิมยังอยู่ในสัญญาเดิม

## 5. เริ่มใช้งานบน URL ที่เผยแพร่แล้ว

1. เปิด MetaMask เลือก Sepolia และเตรียม ETH ทดสอบสำหรับค่า Gas
2. กด **เชื่อมต่อ MetaMask** บนเว็บใหม่และอนุญาตบัญชีที่ต้องการ
3. หากตั้ง Contract Address เริ่มต้นไว้แล้ว เว็บจะตรวจ Bank ให้อัตโนมัติ หากยังว่าง เปิด **ตั้งค่าบัญชี Bank**
4. ถ้ามี Bank อยู่แล้ว เปิด **มี Contract Address ของ Bank อยู่แล้ว** ใส่ Address แล้วกด **เชื่อมต่อ Bank นี้**
5. ถ้ายังไม่มี Bank กด **สร้าง Bank Smart Contract** ตรวจและยืนยันใน MetaMask แล้วรอสำเร็จ เว็บจะบันทึก Address ให้เอง
6. เลือกฝากหรือถอน กรอกจำนวน ตรวจข้อมูลใน MetaMask แล้วยืนยัน รอธุรกรรมสำเร็จ

การเผยแพร่ผ่าน GitHub Pages ไม่ส่งธุรกรรม ไม่สร้าง Bank และไม่ย้าย ETH ของผู้ใช้โดยอัตโนมัติ การเซ็นรายการเกิดใน MetaMask เมื่อผู้ใช้เลือกดำเนินการ

ปุ่ม **วิธีใช้งาน** ในเว็บมีคู่มือ 6 หัวข้อและดาวน์โหลดคู่มือได้จาก `assets/USER-GUIDE.md` ประวัติที่หน้าเว็บแสดงเป็นรายการที่ทำผ่านเบราว์เซอร์นั้น ไม่ใช่ประวัติทั้งหมดบนเครือข่าย

## 6. โครงสร้างไฟล์และสิ่งที่ต้องอัปโหลด

```text
assi6/
├── .github/workflows/deploy.yml   # Workflow เผยแพร่ GitHub Pages
├── .gitignore
├── .nojekyll
├── index.html                    # หน้าเว็บและหน้าต่างคู่มือ
├── styles.css                    # ธีม Black / Neon Purple
├── app.js                        # สถานะหน้าเว็บและการใช้งาน MetaMask
├── bank.js                       # ABI และการเรียกสัญญา Bank
├── config.js                     # Contract Address เครือข่าย และผู้จัดทำ
├── assets/
│   ├── ethers.min.js             # ethers.js 6.15.0 ที่หน้าเว็บใช้
│   ├── ETHERS-LICENSE.md
│   ├── bank-contract.js          # ABI/bytecode สำหรับปุ่มสร้าง Bank
│   ├── ui-state.js
│   ├── USER-GUIDE.md
│   └── favicon.svg
├── contracts/Bank.sol
├── scripts/
│   ├── server.mjs                # ใช้เฉพาะตอนเปิดเว็บในเครื่อง
│   ├── build.mjs
│   ├── check-site.mjs
│   └── compile.mjs
├── tests/bank.test.mjs
├── package.json
├── package-lock.json
├── README.md
└── start.bat
```

อัปโหลด source ข้างต้นรวมถึงไฟล์ซ่อน `.github/`, `.gitignore`, `.nojekyll` ด้วย อย่าลืม `assets/bank-contract.js` เพราะ workflow ไม่ Compile Solidity ให้ใหม่ และอย่าลืม `scripts/check-site.mjs` ที่ Build ต้องใช้

ไม่อัปโหลด `node_modules/`, `work/`, `artifacts/`, `dist/`, `.env` หรือ `.env.*` ผ่าน Git (`.gitignore` เตรียมไว้แล้ว) โฟลเดอร์ `design-system/` เป็นเอกสารประกอบ เก็บใน repository ได้แต่จะไม่รวมในเว็บไซต์ที่เผยแพร่

## 7. Compile และทดสอบ Smart Contract

เมื่อเปลี่ยน `contracts/Bank.sol` ให้ติดตั้ง dependencies แล้วสร้าง ABI/bytecode ใหม่ก่อน Build:

```powershell
npm.cmd ci --cache .\work\npm-cache
npm.cmd run compile
npm.cmd test
npm.cmd run build
```

Compile ใช้ Solidity **0.8.26**, OpenZeppelin Contracts **5.1.0**, optimizer **200 runs**, EVM **Paris** โดยเขียนผลไปยัง `assets/bank-contract.js` และ `artifacts/Bank.json` ต้อง Commit ไฟล์ `assets/bank-contract.js` ที่สร้างใหม่ไปด้วย

ชุดทดสอบ 6 ชุดครอบคลุมจำนวน ETH, ฝาก–ถอนและ events, ยอดเงินแยกบัญชี, การปฏิเสธยอดไม่ถูกต้อง, Reentrancy / การส่ง ETH ไม่สำเร็จ, BankClient กับบัญชีหรือเครือข่ายที่เปลี่ยน, การสร้าง Bank จาก bytecode และขั้นตอนแนะนำในหน้าเว็บ การทดสอบใช้ Ganache ในหน่วยความจำและบัญชีทดสอบ ไม่ใช้กระเป๋าของผู้ใช้

## 8. แก้ปัญหา Deploy

| อาการ | จุดที่ต้องตรวจ |
| --- | --- |
| ไม่เห็น workflow ใน Actions | อัปโหลด `.github/workflows/deploy.yml` และตรวจว่าอยู่ root ของ repository |
| Pages ไม่พร้อม หรือ workflow แจ้งให้เปิดใช้งาน Pages | ตั้ง Settings → Pages → Source เป็น GitHub Actions แล้ว Run workflow ใหม่ |
| เปิด URL แล้ว 404 | ใช้ URL ที่แสดงใน Settings → Pages และตรวจว่า Deploy สำเร็จแล้ว |
| หน้าเว็บเปิด แต่ CSS / JavaScript หาย | รัน Build ตรวจลิงก์ ชื่อไฟล์และตัวพิมพ์เล็ก–ใหญ่ และอย่าเปลี่ยน path ของไฟล์เป็น `/assets/...` |
| เปิดเว็บได้ แต่ MetaMask ไม่เชื่อมต่อ | เปิด URL ในเบราว์เซอร์ที่มี MetaMask แล้วอนุญาตเว็บไซต์ที่เผยแพร่ใหม่ |
| ยอดฝากเดิมไม่แสดงบน GitHub Pages | ใช้กระเป๋า Sepolia และ Contract Address ของ Bank เดิม ข้อมูล localhost ไม่ย้ายมาเอง |
| ฝากไม่ได้ / missing revert data | ตรวจว่าเป็น Address ของสัญญา Bank ไม่ใช่ Address กระเป๋า และอยู่บนเครือข่ายเดียวกัน |
| ไม่เห็นการแก้ชื่อหรือรหัส | แก้ config.js แล้ว Commit/Push รอ workflow สำเร็จ จากนั้น Ctrl + F5 |

## ผลตรวจเตรียม Deploy — 3 พฤศจิกายน 2026

- แก้ช่องว่างนำหน้า Contract Address ใน config.js และตรวจรูปแบบ Address ตอน Build
- ค่าเริ่มต้นเป็น Bank บน Sepolia: `0xe017Fa61A9d8248071192A4C82C745840bfdF6b3`
- ตรวจเครือข่ายจริงแบบอ่านอย่างเดียว: พบ bytecode ตรงกับ Bank ที่โปรเจกต์ใช้ และเรียก checkBalance() ได้ ไม่มีการส่งธุรกรรม
- Build ปกติและ Build จากสำเนาที่ไม่มี node_modules ผ่าน ตรวจไฟล์เผยแพร่ 13 ไฟล์และลิงก์ภายใน 57 จุด
- ชุดทดสอบในเครื่องผ่าน 6 ชุด
- ยังไม่ได้ Push หรือรัน Deploy บน GitHub ต้องตรวจ URL จริงและการเชื่อม MetaMask อีกครั้งหลัง workflow สำเร็จ

## เอกสารอ้างอิง

- [GitHub Pages: ตั้งค่าแหล่งเผยแพร่](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [GitHub Pages: custom workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [MetaMask: การอนุญาตบัญชีให้เว็บไซต์](https://support.metamask.io/more-web3/dapps/manage-dapp-permissions)
- [ethers.js](https://docs.ethers.org/v6/getting-started/)
- [OpenZeppelin ReentrancyGuard](https://docs.openzeppelin.com/contracts/5.x/api/utils#ReentrancyGuard)
