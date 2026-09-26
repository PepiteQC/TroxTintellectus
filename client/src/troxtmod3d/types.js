// src/troxtmod3d/types.js
// ETHERWORLD RP — Types documentaires (JSDoc uniquement)

/**
 * @typedef {'male'|'female'|'other'} GenderType
 */

/**
 * @typedef {'none'|'idle'|'walk'|'run'|'wave'|'dance'|'flex'|'bow'|'threaten'|'sit'|'jump'|'power_pose'|'floating'|'crouch'|'lie'|'point'|'salute'|'meditate'|'combat_idle'|'combat_strike'|'cast_spell'|'injured'|'victory'} EmoteType
 */

/**
 * @typedef {Object} Licenses
 * @property {boolean} conduire
 * @property {boolean} armes
 * @property {boolean} vol
 * @property {boolean} bateau
 * @property {boolean} chasse
 * @property {boolean} peche
 * @property {boolean} taxi
 */

/**
 * @typedef {Object} RPProfile
 * @property {number} age
 * @property {string} district
 * @property {string} job
 * @property {string} jobTitle
 * @property {string} employer
 * @property {number} salary
 * @property {string} gang
 * @property {string} gangRank
 * @property {string} criminalRecord
 * @property {number} wantedLevel
 * @property {number} cash
 * @property {number} bank
 * @property {Licenses} licenses
 * @property {string} vehicleType
 * @property {string} vehicleModel
 * @property {string} vehicleColor
 * @property {string} backstory
 * @property {string} goals
 * @property {string} phone
 */

/**
 * @typedef {Object} Accessories
 * @property {string} glasses
 * @property {string} hat
 * @property {string} jewelry
 * @property {string} wings
 * @property {string} tail
 * @property {string} halo
 * @property {string} mask
 * @property {string} cape
 * @property {string} backpack
 * @property {string} watch
 */

/**
 * @typedef {Object} CharacterState
 * @property {number} step
 * @property {GenderType} gender
 * @property {string} name
 * @property {string} nationality
 * @property {string} [personality]
 * @property {string} [voice]
 * @property {string} [bio]
 * @property {number} skin
 * @property {number} faceShape
 * @property {number} eyeColor
 * @property {number} [eyeShape]
 * @property {number} noseBridge
 * @property {number} noseSize
 * @property {number} faceWidth
 * @property {number} cheekH
 * @property {number} jawWidth
 * @property {number} eyeSize
 * @property {number} eyeSpacing
 * @property {number} lipSize
 * @property {number} [mouthShape]
 * @property {number} [eyebrowShape]
 * @property {number} hairStyle
 * @property {number} hairColor
 * @property {number} facialHair
 * @property {number} bodyType
 * @property {number} height
 * @property {number} muscular
 * @property {number} fatness
 * @property {number} topStyle
 * @property {number} topColor
 * @property {number} pantsStyle
 * @property {number} pantsColor
 * @property {number} shoesStyle
 * @property {number} shoesColor
 * @property {number} glassesStyle
 * @property {number} hatStyle
 * @property {number} jewelryStyle
 * @property {number} glassesColor
 * @property {number} hatColor
 * @property {number} [backpackStyle]
 * @property {number} [watchStyle]
 * @property {Accessories} [accessories]
 * @property {string|null} [activeAura]
 * @property {string} [auraColor]
 * @property {boolean} [auraEnabled]
 * @property {boolean} [glowEnabled]
 * @property {string} [equipment]
 * @property {string} [equipmentColor]
 * @property {EmoteType} [emote]
 * @property {string} [race]
 * @property {RPProfile} [rp]
 */

/**
 * @typedef {Object} AuraDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} subtitle
 * @property {string} icon
 * @property {string} color
 * @property {number} lightColor
 * @property {number} particleColor
 * @property {number} [ringColor]
 * @property {number} [beamColor]
 * @property {string} [shader]
 * @property {number} [intensity]
 * @property {number} [particles]
 * @property {number} [rotationSpeed]
 */

/**
 * @typedef {Object} PreloadedCharacter
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {string} jobTitle
 * @property {string} description
 * @property {string} avatarIcon
 * @property {string} tagColor
 * @property {string} badge
 * @property {string|null} defaultAura
 * @property {CharacterState} state
 */

export {}; // module vide, juste pour les types JSDoc