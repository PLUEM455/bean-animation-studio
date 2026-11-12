// Every particle / sound / animation id the scripts use. tests/refs.test.mjs checks
// that each one exists in the resource pack.
export const PX = {
  gojoHit: 'jjk:gojo_hit',
  blueOrb: 'jjk:blue_orb', blueSwirl: 'jjk:blue_swirl',
  redOrb: 'jjk:red_orb', redBurst: 'jjk:red_burst',
  purpleBeam: 'jjk:purple_beam', purpleCore: 'jjk:purple_core',
  domainShell: 'jjk:domain_shell', domainStar: 'jjk:domain_star',
  blackFlash: 'jjk:black_flash', rct: 'jjk:rct_aura', blink: 'jjk:blink', infinity: 'jjk:infinity_ripple',
  debris: 'jjk:debris',
  slash: 'jjk:toji_slash', chainLink: 'jjk:chain_link', spearTip: 'jjk:spear_tip', negate: 'jjk:negate',
  muzzle: 'jjk:muzzle', tracer: 'jjk:tracer', afterimage: 'jjk:afterimage', skm: 'jjk:skm_aura',
  slamDust: 'jjk:slam_dust', wormSpit: 'jjk:worm_spit', cloudTrail: 'jjk:cloud_trail',
};

export const SFX = {
  gojoPunch: 'jjk.gojo.attack', blue: 'jjk.gojo.blue', redCharge: 'jjk.gojo.red_charge', redBoom: 'jjk.gojo.red_boom',
  purpleCharge: 'jjk.gojo.purple_charge', purpleFire: 'jjk.gojo.purple_fire', domain: 'jjk.gojo.domain',
  blink: 'jjk.gojo.blink', blackFlash: 'jjk.gojo.black_flash', rct: 'jjk.gojo.rct', infinity: 'jjk.gojo.infinity',
  katana: 'jjk.toji.attack', cloud: 'jjk.toji.cloud', slam: 'jjk.toji.slam', fist: 'jjk.toji.fist',
  spear: 'jjk.toji.spear', negate: 'jjk.toji.negate', chainThrow: 'jjk.toji.chain_throw', chainClink: 'jjk.toji.chain_clink',
  gun: 'jjk.toji.gun', blitz: 'jjk.toji.blitz', inventory: 'jjk.toji.inventory', skm: 'jjk.toji.skm',
};

const g = (n) => `animation.jjk.gojo.${n}`;
const t = (n) => `animation.jjk.toji.${n}`;
export const ANIM = {
  gojo: {
    combo: g('combo'), blackFlash: g('black_flash'), blue: g('blue'), red: g('red'), purpleCharge: g('purple_charge'),
    purpleFire: g('purple_fire'), domain: g('domain'), blink: g('blink'), rct: g('rct'), pull: g('pull'),
  },
  toji: {
    katana: t('attack'), cloud: t('cloud'), slam: t('slam'), fists: t('fists'), spear: t('spear'),
    chainAim: t('chain_aim'), chainSweep: t('chain_sweep'), gun: t('gun'), blitz: t('blitz'), backstab: t('backstab'),
    inventory: t('inventory'), skm: t('skm'),
  },
};

/** Toji weapon property values (render controller shows the matching bone) */
export const WEAPON = { none: 0, katana: 1, cloud: 2, spear: 3, chainSpear: 4, chainOnly: 5, pistol: 6 };
