// Spec rule: skills may break man-made blocks only. Natural terrain, liquids,
// trees and plants are never broken.
const EXACT = new Set([
  'air', 'cave_air', 'void_air', 'bedrock', 'barrier', 'water', 'flowing_water', 'lava', 'flowing_lava',
  'dirt', 'coarse_dirt', 'rooted_dirt', 'grass_block', 'grass', 'podzol', 'mycelium', 'mud', 'dirt_with_roots', 'farmland', 'grass_path',
  'stone', 'granite', 'diorite', 'andesite', 'deepslate', 'tuff', 'calcite', 'dripstone_block', 'pointed_dripstone', 'smooth_basalt',
  'sand', 'red_sand', 'gravel', 'clay', 'sandstone', 'red_sandstone', 'suspicious_sand', 'suspicious_gravel',
  'snow', 'snow_layer', 'powder_snow', 'ice', 'packed_ice', 'blue_ice', 'obsidian', 'magma',
  'netherrack', 'soul_sand', 'soul_soil', 'basalt', 'blackstone', 'glowstone', 'crimson_nylium', 'warped_nylium', 'nether_wart_block', 'warped_wart_block', 'shroomlight',
  'end_stone', 'moss_block', 'moss_carpet', 'sculk', 'sculk_vein', 'amethyst_block', 'budding_amethyst',
  'terracotta', 'hardened_clay', 'stained_hardened_clay',
  // legacy (pre-flattening) Bedrock ids
  'log', 'log2', 'leaves', 'leaves2', 'tallgrass', 'double_plant', 'red_flower', 'yellow_flower', 'sapling',
  // plants
  'short_grass', 'tall_grass', 'fern', 'large_fern', 'dead_bush', 'vine', 'cave_vines', 'cave_vines_body_with_berries',
  'cave_vines_head_with_berries', 'weeping_vines', 'twisting_vines', 'glow_lichen', 'hanging_roots', 'spore_blossom',
  'cactus', 'reeds', 'sugar_cane', 'bamboo', 'kelp', 'seagrass', 'waterlily', 'lily_pad', 'sweet_berry_bush',
  'pumpkin', 'melon_block', 'brown_mushroom', 'red_mushroom', 'brown_mushroom_block', 'red_mushroom_block', 'mushroom_stem',
  'crimson_fungus', 'warped_fungus', 'crimson_roots', 'warped_roots', 'nether_sprouts', 'azalea', 'flowering_azalea',
  'big_dripleaf', 'small_dripleaf_block', 'mangrove_roots', 'muddy_mangrove_roots', 'pink_petals', 'pitcher_plant',
  'dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip',
  'oxeye_daisy', 'cornflower', 'lily_of_the_valley', 'wither_rose', 'sunflower', 'lilac', 'rose_bush', 'peony', 'torchflower',
  'sea_pickle', 'cocoa', 'chorus_plant', 'chorus_flower',
]);
const SUFFIX = ['_ore', '_log', '_leaves', '_stem', '_sapling', '_coral', '_coral_block', '_coral_fan', '_coral_wall_fan',
  '_terracotta', '_mushroom', '_propagule'];
const PREFIX = ['stripped_']; // stripped logs are still trees

/** @param {string} typeId e.g. "minecraft:oak_log" */
export function isNatural(typeId) {
  const [ns, id] = typeId.includes(':') ? typeId.split(':') : ['minecraft', typeId];
  if (ns !== 'minecraft') return false;
  if (EXACT.has(id)) return true;
  if (id.endsWith('_glazed_terracotta')) return false; // crafted
  if (id.startsWith('stripped_') && id.endsWith('_wood')) return false; // crafted bark block
  if (PREFIX.some((p) => id.startsWith(p))) return true;
  return SUFFIX.some((s) => id.endsWith(s));
}
