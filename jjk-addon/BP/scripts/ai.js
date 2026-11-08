// ตรรกะล้วน (ไม่ import อะไร) เพื่อทดสอบด้วย node ได้

export const TUNING = {
  armorHeavy: 10, // เกราะ >= ค่านี้ ถือว่า "เกราะเยอะ"
  lowHealth: 20, // เลือด < ค่านี้ (20 = 10 หัวใจ) ถือว่า "เลือดน้อย"
  sword: { reach: 4.5, windup: 8, busy: 20, cooldown: 30, damage: 14 },
  spear: { minDist: 3, maxDist: 14, windup: 12, flight: 8, busy: 45, cooldown: 120, damage: 24, hitReach: 3.4 },
  pistol: { maxDist: 15, windup: 8, busy: 16, cooldown: 50, damage: 8, slowTicks: 20, slowAmp: 3 },
  yuun: { gangUp: 2, nearRadius: 8, duration: 100, busy: 20, cooldown: 200, blockChance: 0.5 },
  chain: { maxDist: 30, minDist: 8, windup: 40, busy: 50, cooldown: 70, damage: 16, startChance: 0.35, stayChance: 0.9 },
};

// แต้มเกราะรายชิ้น (ตามค่าในเกม ชุดที่ไม่อยู่ในตารางนับเป็น 0)
const SETS = {
  leather: [1, 3, 2, 1],
  chainmail: [2, 5, 4, 1],
  iron: [2, 6, 5, 2],
  golden: [2, 5, 3, 1],
  diamond: [3, 8, 6, 3],
  netherite: [3, 8, 6, 3],
};
export const ARMOR_POINTS = {};
for (const [name, pts] of Object.entries(SETS)) {
  ["helmet", "chestplate", "leggings", "boots"].forEach((piece, i) => {
    ARMOR_POINTS[`minecraft:${name}_${piece}`] = pts[i];
  });
}
ARMOR_POINTS["minecraft:turtle_helmet"] = 2;

export function armorTotal(typeIds) {
  return typeIds.reduce((sum, id) => sum + (ARMOR_POINTS[id] || 0), 0);
}

// ctx: { dist, targetHealth, targetArmor, nearbyEnemies, openArea, lastWeapon, rand, cd, now }
// คืนชื่ออาวุธ หรือ null (ไม่ทำอะไร ปล่อยให้ AI เดินเข้าตีปกติ)
export function chooseWeapon(c) {
  const T = TUNING;
  const ready = (w) => (c.cd[w] || 0) <= c.now;

  // โซ่ล็อกไว้: เมื่อใช้แล้วแทบไม่สลับ
  if (c.lastWeapon === "chain") {
    if (c.dist <= T.chain.maxDist && c.rand() < T.chain.stayChance) {
      return ready("chain") ? "chain" : null;
    }
  }
  if (c.nearbyEnemies >= T.yuun.gangUp && ready("yuun") && c.rand() < 0.8) return "yuun";
  if (c.openArea && c.dist >= T.chain.minDist && c.dist <= T.chain.maxDist && ready("chain") && c.rand() < T.chain.startChance) {
    return "chain";
  }
  if (c.dist <= 4 && c.targetArmor >= T.armorHeavy && ready("sword")) return "sword";
  if (
    c.targetHealth < T.lowHealth &&
    c.targetArmor < T.armorHeavy &&
    c.dist >= T.spear.minDist &&
    c.dist <= T.spear.maxDist &&
    ready("spear")
  ) {
    return "spear";
  }
  if (c.dist <= T.pistol.maxDist && ready("pistol")) return "pistol";
  return null;
}
