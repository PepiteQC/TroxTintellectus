// src/troxtmod3d/constants.js
// ETHERWORLD RP — Constants v4.1 GTA-RP

export const JOBS = [
  { id: 'chomeur',         label: 'Sans-emploi',           icon: '🚫', salary: 0 },
  { id: 'etudiant',        label: 'Étudiant',              icon: '🎓', salary: 0 },
  { id: 'spvm',            label: 'Policier SPVM',         icon: '👮', salary: 45 },
  { id: 'sq',              label: 'Sûreté du Québec',      icon: '🚓', salary: 48 },
  { id: 'grc',             label: 'GRC',                   icon: '🍁', salary: 55 },
  { id: 'pompier',         label: 'Pompier',               icon: '🚒', salary: 42 },
  { id: 'ems',             label: 'Paramédic',             icon: '🚑', salary: 40 },
  { id: 'gardien_prison',  label: 'Gardien de prison',     icon: '🔒', salary: 38 },
  { id: 'taxi',            label: 'Chauffeur de taxi',     icon: '🚖', salary: 22 },
  { id: 'uber',            label: 'Uber / VTC',            icon: '📱', salary: 20 },
  { id: 'chauffeur_bus',   label: 'Chauffeur de bus',      icon: '🚌', salary: 30 },
  { id: 'camionneur',      label: 'Camionneur',            icon: '🚛', salary: 32 },
  { id: 'mecano',          label: 'Mécanicien',            icon: '🔧', salary: 28 },
  { id: 'garagiste',       label: 'Garagiste',             icon: '🔩', salary: 35 },
  { id: 'vendeur_auto',    label: 'Vendeur auto',          icon: '🚗', salary: 30 },
  { id: 'avocat',          label: 'Avocat',                icon: '⚖️', salary: 85 },
  { id: 'juge',            label: 'Juge',                  icon: '🔨', salary: 120 },
  { id: 'notaire',         label: 'Notaire',               icon: '📜', salary: 70 },
  { id: 'comptable',       label: 'Comptable',             icon: '🧾', salary: 55 },
  { id: 'medecin',         label: 'Médecin',               icon: '🩺', salary: 110 },
  { id: 'infirmier',       label: 'Infirmier',             icon: '💉', salary: 42 },
  { id: 'pharmacien',      label: 'Pharmacien',            icon: '💊', salary: 65 },
  { id: 'dentiste',        label: 'Dentiste',              icon: '🦷', salary: 90 },
  { id: 'journaliste',     label: 'Journaliste',           icon: '📰', salary: 40 },
  { id: 'animateur_radio', label: 'Animateur radio',       icon: '📻', salary: 38 },
  { id: 'streamer',        label: 'Streamer',              icon: '🎥', salary: 25 },
  { id: 'chef_cuisine',    label: 'Chef cuisinier',        icon: '👨‍🍳', salary: 45 },
  { id: 'barman',          label: 'Barman',                icon: '🍸', salary: 25 },
  { id: 'serveur',         label: 'Serveur',               icon: '🍽️', salary: 20 },
  { id: 'restaurateur',    label: 'Restaurateur',          icon: '🍴', salary: 60 },
  { id: 'caissier',        label: 'Caissier',              icon: '💰', salary: 18 },
  { id: 'vendeur',         label: 'Vendeur',               icon: '🛍️', salary: 22 },
  { id: 'gerant',          label: 'Gérant',                icon: '📊', salary: 50 },
  { id: 'patron',          label: 'Patron',                icon: '💼', salary: 95 },
  { id: 'agent_immobilier',label: 'Agent immobilier',      icon: '🏠', salary: 55 },
  { id: 'architecte',      label: 'Architecte',            icon: '📐', salary: 75 },
  { id: 'ingenieur',       label: 'Ingénieur',             icon: '⚙️', salary: 80 },
  { id: 'agriculteur',     label: 'Agriculteur',           icon: '🌾', salary: 28 },
  { id: 'pecheur',         label: 'Pêcheur',               icon: '🐟', salary: 25 },
  { id: 'forestier',       label: 'Forestier',             icon: '🌲', salary: 30 },
  { id: 'criminel',        label: 'Criminel',              icon: '🕵️', salary: 0 },
  { id: 'dealer',          label: 'Dealer',                icon: '💊', salary: 0 },
  { id: 'braqueur',        label: 'Braqueur',              icon: '💰', salary: 0 },
  { id: 'contrebandier',   label: 'Contrebandier',         icon: '📦', salary: 0 },
];

export const GANGS = [
  { id: 'aucun',           label: 'Aucun',                 icon: '🚫', color: '#666' },
  { id: 'civil',           label: 'Civil',                 icon: '👤', color: '#88aaff' },
  { id: 'hells_angels',    label: 'Hells Angels',          icon: '💀', color: '#aa0000' },
  { id: 'rock_machine',    label: 'Rock Machine',          icon: '🔥', color: '#ff6600' },
  { id: 'mafia_italienne', label: 'Mafia Italienne',       icon: '🍝', color: '#222' },
  { id: 'mafia_russe',     label: 'Mafia Russe',           icon: '🐻', color: '#cc0000' },
  { id: 'triades',         label: 'Triades',               icon: '🐉', color: '#ffdd00' },
  { id: 'yakuza',          label: 'Yakuza',                icon: '🌸', color: '#ff0080' },
  { id: 'gang_rue_mtl',    label: 'Gang de rue Montréal',  icon: '🏙️', color: '#00aaff' },
  { id: 'gang_rue_laval',  label: 'Gang de rue Laval',     icon: '🏘️', color: '#aa55ff' },
  { id: 'gang_rue_quebec', label: 'Gang de rue Québec',    icon: '🏰', color: '#44ff88' },
  { id: 'cartel_mexicain', label: 'Cartel Mexicain',       icon: '🌵', color: '#22aa22' },
  { id: 'cartel_colombien',label: 'Cartel Colombien',      icon: '☕', color: '#ffcc00' },
];

export const CRIMINAL_RECORDS = [
  { id: 'vierge',    label: 'Vierge',         icon: '✅', color: '#44ff88' },
  { id: 'mineur',    label: 'Casier mineur',  icon: '⚠️', color: '#ffcc00' },
  { id: 'majeur',    label: 'Casier majeur',  icon: '🚨', color: '#ff6600' },
  { id: 'recherche', label: 'Recherché',      icon: '🎯', color: '#ff0000' },
  { id: 'fichier',   label: 'Fiché S',        icon: '🔴', color: '#ff0055' },
];

export const VEHICLES = [
  { id: 'aucun',    label: 'Aucun',       icon: '🚫' },
  { id: 'sedan',    label: 'Berline',     icon: '🚗' },
  { id: 'suv',      label: 'SUV',         icon: '🚙' },
  { id: 'muscle',   label: 'Muscle car',  icon: '🏁' },
  { id: 'sport',    label: 'Sportive',    icon: '🏎️' },
  { id: 'supercar', label: 'Supercar',    icon: '🔥' },
  { id: 'pickup',   label: 'Pickup',      icon: '🛻' },
  { id: 'van',      label: 'Van',         icon: '🚐' },
  { id: 'moto',     label: 'Moto',        icon: '🏍️' },
  { id: 'scooter',  label: 'Scooter',     icon: '🛴' },
  { id: 'velo',     label: 'Vélo',        icon: '🚲' },
  { id: 'camion',   label: 'Camion',      icon: '🚛' },
  { id: 'bus',      label: 'Bus',         icon: '🚌' },
  { id: 'helico',   label: 'Hélicoptère', icon: '🚁' },
  { id: 'avion',    label: 'Avion',       icon: '✈️' },
  { id: 'bateau',   label: 'Bateau',      icon: '🚤' },
  { id: 'jet_ski',  label: 'Jet-ski',     icon: '🌊' },
];

export const DISTRICTS = [
  { id: 'montreal_nord',  label: 'Montréal-Nord',   icon: '🏙️' },
  { id: 'montreal_sud',   label: 'Montréal-Sud',    icon: '🌳' },
  { id: 'plateau',        label: 'Le Plateau',      icon: '🎨' },
  { id: 'rosemont',       label: 'Rosemont',        icon: '🏡' },
  { id: 'laval',          label: 'Laval',           icon: '🏘️' },
  { id: 'longueuil',      label: 'Longueuil',       icon: '🌉' },
  { id: 'brossard',       label: 'Brossard',        icon: '🏢' },
  { id: 'gatineau',       label: 'Gatineau',        icon: '🍁' },
  { id: 'quebec_city',    label: 'Québec',          icon: '🏰' },
  { id: 'sherbrooke',     label: 'Sherbrooke',      icon: '⛰️' },
  { id: 'trois_rivieres', label: 'Trois-Rivières',  icon: '🌊' },
  { id: 'saguenay',       label: 'Saguenay',        icon: '🐋' },
  { id: 'rimouski',       label: 'Rimouski',        icon: '🌅' },
];

export const DEFAULT_LICENSES = {
  conduire: false, armes: false, vol: false, bateau: false,
  chasse: false, peche: false, taxi: false,
};

export const DEFAULT_RP_PROFILE = {
  age: 25,
  district: 'montreal_nord',
  job: 'chomeur',
  jobTitle: '',
  employer: '',
  salary: 0,
  gang: 'aucun',
  gangRank: '',
  criminalRecord: 'vierge',
  wantedLevel: 0,
  cash: 500,
  bank: 2500,
  licenses: { ...DEFAULT_LICENSES },
  vehicleType: 'aucun',
  vehicleModel: '',
  vehicleColor: '#2c3e50',
  backstory: '',
  goals: '',
  phone: '514-555-0000',
};

export const DEFAULT_STATE = {
  step: 0,
  gender: 'male',
  name: 'Nouveau Personnage',
  nationality: 'canadian',
  personality: 'Neutre',
  voice: 'Standard',
  bio: '',
  skin: 1,
  faceShape: 0,
  eyeColor: 0,
  eyeShape: 0,
  noseBridge: 50,
  noseSize: 50,
  faceWidth: 50,
  cheekH: 50,
  jawWidth: 50,
  eyeSize: 50,
  eyeSpacing: 50,
  lipSize: 50,
  mouthShape: 0,
  eyebrowShape: 0,
  hairStyle: 1,
  hairColor: 0,
  facialHair: 0,
  bodyType: 1,
  height: 50,
  muscular: 45,
  fatness: 30,
  topStyle: 0,
  topColor: 1,
  pantsStyle: 0,
  pantsColor: 1,
  shoesStyle: 0,
  shoesColor: 0,
  glassesStyle: 0,
  hatStyle: 0,
  jewelryStyle: 0,
  glassesColor: 0,
  hatColor: 1,
  backpackStyle: 0,
  watchStyle: 0,
  activeAura: null,
  auraColor: '#00d4ff',
  auraEnabled: false,
  glowEnabled: false,
  emote: 'idle',
  race: 'human',
  rp: { ...DEFAULT_RP_PROFILE },
  accessories: {
    glasses: 'Aucun', hat: 'Aucun', jewelry: 'Aucun', wings: 'Aucune',
    tail: 'Aucune', halo: 'Aucun', mask: 'Aucun', cape: 'Aucune',
    backpack: 'Aucun', watch: 'Aucune',
  },
};

// Données de races (pour le rendu 3D)
export const RACES = [
  { id: 'human',   label: 'Humain',      icon: '👤', desc: 'Polyvalent, équilibré',         scaleY: 1,    scaleX: 1,    skinTint: null },
  { id: 'elf',     label: 'Elfe',        icon: '🧝', desc: 'Grand, mince, rapide',          scaleY: 1.12, scaleX: 0.88, skinTint: null,     trait: 'ears',    traitColor: '#e8c8a0' },
  { id: 'darkelf', label: 'Elfe Noir',   icon: '🧝‍♀️',desc: 'Élégant, nocturne',            scaleY: 1.12, scaleX: 0.88, skinTint: '#5c3a6c', trait: 'ears',   traitColor: '#3a1a4c' },
  { id: 'android', label: 'Androïde',    icon: '🤖', desc: 'Robuste, mécanique',            scaleY: 1.05, scaleX: 1.05, skinTint: null,     trait: 'visor',   traitColor: '#00aaff' },
  { id: 'demon',   label: 'Démon',       icon: '😈', desc: 'Puissant, sombre',              scaleY: 1.08, scaleX: 1.1,  skinTint: null,     trait: 'horns',   traitColor: '#660022' },
  { id: 'succubus',label: 'Succube',     icon: '🦹‍♀️',desc: 'Séduisante, dangereuse',       scaleY: 1.06, scaleX: 0.95, skinTint: '#e8a0a0', trait: 'horns',  traitColor: '#aa0044' },
  { id: 'angel',   label: 'Ange',        icon: '😇', desc: 'Céleste, lumineux',             scaleY: 1.08, scaleX: 0.95, skinTint: null,     trait: 'halo',    traitColor: '#ffe066' },
  { id: 'ghost',   label: 'Fantôme',     icon: '👻', desc: 'Éthéré, semi-transparent',      scaleY: 1,    scaleX: 0.9,  skinTint: null,     trait: 'aura',    traitColor: '#7dd3fc', ghost: true },
  { id: 'dwarf',   label: 'Nain',        icon: '⛏️', desc: 'Court, très solide',            scaleY: 0.82, scaleX: 1.2,  skinTint: null,     trait: 'beard' },
  { id: 'dragon',  label: 'Dragon-Né',   icon: '🐉', desc: 'Imposant, écailles',            scaleY: 1.1,  scaleX: 1.15, skinTint: null,     trait: 'wings',   traitColor: '#8b1a1a' },
  { id: 'ai',      label: 'Synthétique', icon: '⚡', desc: 'Corps numérique lumineux',      scaleY: 1,    scaleX: 1,    skinTint: null,     trait: 'ring',    traitColor: '#00ffaa' },
  { id: 'catfolk', label: 'Félin',       icon: '🐱', desc: 'Agile, queue, oreilles',        scaleY: 1.02, scaleX: 1,    skinTint: null,     trait: 'catEars', traitColor: '#c19a6b' },
  { id: 'wolfkin', label: 'Lycan',       icon: '🐺', desc: 'Féroce, sens aiguisés',         scaleY: 1.08, scaleX: 1.12, skinTint: null,     trait: 'catEars', traitColor: '#3a3a3a' },
  { id: 'orc',     label: 'Orc',         icon: '👹', desc: 'Brutal, puissant',              scaleY: 1.06, scaleX: 1.25, skinTint: '#7a8a3a', trait: 'tusks',  traitColor: '#ffffff' },
  { id: 'fairy',   label: 'Fée',         icon: '🧚', desc: 'Petite, ailée, lumineuse',      scaleY: 0.75, scaleX: 0.75, skinTint: null,     trait: 'wings',   traitColor: '#88ffcc' },
  { id: 'undead',  label: 'Mort-Vivant', icon: '💀', desc: 'Cadavérique, glaçant',          scaleY: 1.04, scaleX: 0.9,  skinTint: '#a8a898', trait: 'aura',    traitColor: '#5c2050' },
];

export const BODY_TYPES = [
  { id: 'slim',     label: 'Élancé',     scaleX: 0.85, scaleZ: 0.85 },
  { id: 'average',  label: 'Standard',   scaleX: 1,    scaleZ: 1    },
  { id: 'athletic', label: 'Athlétique', scaleX: 1.1,  scaleZ: 1.05 },
  { id: 'stocky',   label: 'Trapu',      scaleX: 1.25, scaleZ: 1.2  },
  { id: 'heavy',    label: 'Massif',     scaleX: 1.4,  scaleZ: 1.3  },
  { id: 'tall',     label: 'Grand',      scaleX: 0.95, scaleZ: 0.95 },
  { id: 'curvy',    label: 'Pulpeuse',   scaleX: 1.15, scaleZ: 1.1  },
  { id: 'child',    label: 'Jeune',      scaleX: 0.75, scaleZ: 0.75 },
];

export const HAIR_STYLES = [
  'Aucun', 'Court', 'Long', 'Mohawk', 'Tresses', 'Bouclés',
  'Ondulé', 'Rasé', 'Punk', 'Couettes', 'Chignon', 'Dreadlocks',
  'Carré', 'Frange', 'Queue de cheval', 'Afro',
];

export const FACIAL_HAIR = [
  'Aucun', 'Moustache', 'Bouc', 'Barbe complète', 'Stubble', 'Favoris',
];

export const EYE_SHAPES     = ['Standard', 'Amande', 'Ronds', 'Félins', 'Fendus', 'Grands'];
export const FACE_SHAPES    = ['Standard', 'Ovale', 'Carré', 'Rond', 'Diamant', 'Coeur', 'Allongé'];
export const NOSE_SHAPES    = ['Standard', 'Petit', 'Long', 'Épaté', 'Aquilin'];
export const MOUTH_SHAPES   = ['Standard', 'Fine', 'Charnue', 'Sourire', 'Sérieuse'];
export const EYEBROW_SHAPES = ['Standard', 'Fin', 'Épais', 'Arqué', 'Froncé'];

export const OUTFITS = [
  { id: 'casual',    label: 'Casual',    icon: '👕' },
  { id: 'military',  label: 'Militaire', icon: '🪖' },
  { id: 'police',    label: 'Police',    icon: '👮' },
  { id: 'mage',      label: 'Mage',      icon: '🧙' },
  { id: 'ninja',     label: 'Ninja',     icon: '🥷' },
  { id: 'medical',   label: 'Médecin',   icon: '🩺' },
  { id: 'robot',     label: 'Robot',     icon: '🦾' },
  { id: 'dragon',    label: 'Dragon',    icon: '🐉' },
  { id: 'space',     label: 'Spatial',   icon: '🚀' },
  { id: 'assassin',  label: 'Assassin',  icon: '🗡️' },
  { id: 'royal',     label: 'Royal',     icon: '👑' },
  { id: 'pirate',    label: 'Pirate',    icon: '🏴‍☠️' },
  { id: 'cyberpunk', label: 'Cyberpunk', icon: '🌆' },
  { id: 'samurai',   label: 'Samouraï',  icon: '🥋' },
  { id: 'viking',    label: 'Viking',    icon: '⚔️' },
  { id: 'wizard',    label: 'Sorcier',   icon: '🪄' },
  { id: 'steampunk', label: 'Steampunk', icon: '⚙️' },
  { id: 'kimono',    label: 'Kimono',    icon: '🎎' },
  { id: 'racer',     label: 'Pilote',    icon: '🏎️' },
  { id: 'chef',      label: 'Chef',      icon: '👨‍🍳' },
];

export const EQUIPMENTS = [
  { id: 'none',   label: 'Aucun',    icon: '✋' },
  { id: 'sword',  label: 'Épée',     icon: '⚔️' },
  { id: 'gun',    label: 'Pistolet', icon: '🔫' },
  { id: 'bow',    label: 'Arc',      icon: '🏹' },
  { id: 'staff',  label: 'Bâton',    icon: '🪄' },
  { id: 'shield', label: 'Bouclier', icon: '🛡️' },
  { id: 'lance',  label: 'Lance',    icon: '🗡️' },
  { id: 'bomb',   label: 'Bombe',    icon: '💣' },
  { id: 'axe',    label: 'Hache',    icon: '🪓' },
  { id: 'dagger', label: 'Dague',    icon: '🗡️' },
  { id: 'hammer', label: 'Marteau',  icon: '🔨' },
  { id: 'scythe', label: 'Faux',     icon: '🌾' },
  { id: 'wand',   label: 'Baguette', icon: '✨' },
  { id: 'rifle',  label: 'Fusil',    icon: '🔫' },
  { id: 'claws',  label: 'Griffes',  icon: '🐾' },
  { id: 'orb',    label: 'Orbe',     icon: '🔮' },
];

export const ACC_GLASSES = ['Aucun','Aviateurs','Ronds','Wayfarer','Sport','Visor','Monocle','Lunettes 3D'];
export const ACC_HATS    = ['Aucun','Casquette','Bonnet','Fedora','Capuche','Béret','Couronne','Chapeau de sorcière','Casque','Bandeau'];
export const ACC_JEWELRY = ['Aucun','Chaîne','Pendentif','Dog Tags','Perles','Choker','Boucles d\'oreilles','Anneaux','Bracelet'];
export const ACC_WINGS   = ['Aucune','Angéliques','Démoniaques','Draconiques','Féériques','Mécaniques','Papillon'];
export const ACC_TAIL    = ['Aucune','Féline','Démoniaque','Draconique','Renarde','Mécanique'];
export const ACC_HALO    = ['Aucun','Doré','Argenté','Néon','Ange déchu'];
export const ACC_MASK    = ['Aucun','Masque de bal','Masque de héros','Masque chirurgical','Masque de kitty','Masque futuriste'];
export const ACC_CAPE    = ['Aucune','Courte','Longue','Déchirée','Royale','Futuriste'];
export const ACC_BACKPACK= ['Aucun','Sac à dos','Sac tactique','Sac de sport','Ailes cyber'];
export const ACC_WATCH   = ['Aucune','Montre simple','Smartwatch','Chronographe','Rolex Or'];

export const PERSONALITIES = ['Neutre','Amical','Mystérieux','Héroïque','Sarcastique','Timide','Arrogant','Sage','Chaotique','Sombre'];
export const VOICES        = ['Standard','Grave','Aiguë','Rauque','Douce','Mécanique','Éthérée'];
export const NATIONALITIES = ['canadian','french','american','japanese','english','german','italian','spanish','russian','chinese','brazilian','indian','other'];

export const EMOTES = [
  { id: 'none',     label: 'Aucune',      icon: '⏸️' },
  { id: 'idle',     label: 'Idle',        icon: '🧘' },
  { id: 'wave',     label: 'Saluer',      icon: '👋' },
  { id: 'dance',    label: 'Danser',      icon: '💃' },
  { id: 'flex',     label: 'Flex',        icon: '💪' },
  { id: 'bow',      label: 'Révérence',   icon: '🙇' },
  { id: 'threaten', label: 'Menacer',     icon: '👊' },
  { id: 'sit',      label: 'S\'asseoir',  icon: '🪑' },
];

export const SKIN_PRESETS  = ['#fcd5b0','#e8b58a','#c68642','#8d5524','#4a2811','#f0e0c0','#ffe0bd','#ffcc99','#d4a76a','#b07040','#7a4a28','#ffffff','#5c3a6c','#7a8a3a','#a8a898'];
export const HAIR_COLORS   = ['#1a1a1a','#444444','#8b6914','#c19a6b','#ff6600','#ff0080','#4488ff','#44ff88','#aaaaaa','#ffffff','#660000','#cc3300','#00ffaa','#aa00ff'];
export const EYE_COLORS    = ['#1a5276','#196f3d','#7d6608','#784212','#922b21','#6c3483','#2e86c1','#0e6655','#00aaff','#ff4400','#ffffff','#00ff88','#ff0080','#ffff00'];
export const OUTFIT_COLORS = ['#2c3e50','#1a5276','#1e8449','#7d6608','#922b21','#6c3483','#1abc9c','#e74c3c','#e67e22','#f39c12','#95a5a6','#2c2c2c','#ffffff','#ff4488','#00ffaa','#aa55ff'];
export const AURA_COLORS   = ['#00d4ff','#aa55ff','#ff4488','#44ff88','#ffdd00','#ff6600','#ffffff'];