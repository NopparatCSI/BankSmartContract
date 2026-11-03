// Presentation only: choose one clear next step without sending transactions.
export function getSetupState({ account, ready, wrongNetwork, connecting, busy, pending, error }) {
  const step = ready ? 3 : account ? 2 : 1;
  if (busy) return { step, action:'wait', label:'กำลังดำเนินการ…', title:'รอการยืนยันธุรกรรม', message:'ตรวจคำขอใน MetaMask แล้วรอเครือข่ายยืนยัน คุณยังไม่ต้องส่งรายการซ้ำ' };
  if (connecting) return { step, action:'wait', label:'กำลังเชื่อมต่อ…', title:'กำลังตรวจสอบการเชื่อมต่อ', message:'หาก MetaMask มีคำขอ กรุณาเลือกบัญชีและอนุญาตให้เชื่อมต่อ' };
  if (account && wrongNetwork) return { step:2, action:'switch', label:'สลับเครือข่าย', title:'เลือกเครือข่ายให้ตรงกัน', message:'กดสลับเครือข่าย แล้วตรวจและยืนยันคำขอใน MetaMask' };
  if (ready) return { step:3, action:'banking', label:'เริ่มฝาก–ถอน ETH', title:'บัญชี Bank พร้อมใช้งาน', message:'เลือกฝากหรือถอน กรอกจำนวน ETH แล้วตรวจและยืนยันใน MetaMask' };
  if (!account) return { step:1, action:'connect', label:'เชื่อมต่อกระเป๋า', title:'เริ่มต้นด้วยการเชื่อมต่อกระเป๋า', message:error || 'เชื่อมต่อ MetaMask เพื่อดูยอด ETH และตั้งค่าบัญชี Bank ของคุณ' };
  if (pending) return { step:2, action:'setup', label:'ตรวจสอบบัญชี Bank', title:'กำลังรอการสร้างบัญชี Bank', message:'เปิดตั้งค่าเพื่อตรวจสอบธุรกรรมเดิม ไม่ต้องกดสร้างบัญชีใหม่' };
  return { step:2, action:'setup', label:'ตั้งค่าบัญชี Bank', title:'เชื่อมต่อกระเป๋าแล้ว ตั้งค่า Bank ต่อได้เลย', message:error || 'สร้าง Bank ครั้งแรก หรือเชื่อมต่อด้วย Contract Address ของ Bank ที่มีอยู่แล้ว' };
}
