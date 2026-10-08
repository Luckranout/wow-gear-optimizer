const COACH_PROFILES = {
  Warrior: {
    Protection: {
      role: "Tank",
abilities: { primary: ["Shield Slam", "Thunder Clap", "Revenge"], resource: "Rage", cooldowns: ["Avatar", "Demoralizing Shout", "Shield Wall", "Ravager"] },
      beginnerPriority: ["Shield Slam whenever available.", "Thunder Clap on cooldown and to maintain Rend.", "Use Revenge and react to free or proc opportunities.", "Spend excess Rage on Ignore Pain.", "Use Execute against low-health targets.", "Use Impending Victory when you need the heal."],
      cooldownGuidance: "Use Avatar and other major cooldowns frequently rather than sitting on them. Use Shield Wall proactively for dangerous damage.",
      commonMistakes: ["Waiting until you are nearly dead before using a defensive.", "Capping Rage instead of spending it.", "Sitting on Shield Slam or other core abilities."],
      preCombat: ["Battle Shout active.", "Correct stance selected.", "Food/flask/weapon buffs ready for serious content."],
      talentGuidance: [] ,
      loop: "Build and spend Rage while keeping your active defenses and mitigation ready for the damage that is coming.",
      priorities: [
        "Keep your main defensive tools available for dangerous damage instead of waiting until you are nearly dead.",
        "Build Rage consistently and spend it where it improves your survival or damage for the situation.",
        "Use your major cooldowns deliberately around large pulls, boss mechanics, and other predictable danger."
      ],
      defensive: "Plan defensives before a big hit. The goal is to reduce or prepare for damage before it lands, not after your health has already dropped.",
      why: "Protection is about controlling incoming damage while keeping enough resources and cooldowns available for the next dangerous moment."
    },
    Fury: {
      role: "Damage",
abilities: { primary: ["Rampage", "Bloodthirst", "Raging Blow", "Execute"], resource: "Rage", cooldowns: ["Recklessness", "Avatar", "Bladestorm", "Odyn's Fury"] },
      beginnerPriority: ["Keep attacking; downtime is one of the biggest performance losses.", "Use Rampage to maintain Enrage and avoid Rage waste.", "Use Bloodthirst and Raging Blow to keep Rage flowing.", "Use Execute when available or appropriate.", "Use Whirlwind or Thunder Clap to maintain the multi-target setup when needed."],
      cooldownGuidance: "Use major cooldowns frequently. Align them when that happens naturally, but do not delay them so long that you lose an entire use.",
      commonMistakes: ["Letting Enrage fall because Rampage was delayed.", "Standing idle or staying out of melee unnecessarily.", "Holding cooldowns too long for a theoretical perfect window."],
      preCombat: ["Battle Shout active.", "Food/flask/weapon buffs ready for serious content."],
      talentGuidance: [],
      loop: "Keep your core damage cycle moving, spend Rage efficiently, and use cooldowns during strong damage windows.",
      priorities: [
        "Keep your core damage abilities flowing instead of sitting on unused resources or important procs.",
        "Spend Rage efficiently and avoid letting your main resource stay capped.",
        "Line up major cooldowns with strong damage windows when the encounter allows it."
      ],
      defensive: "Use defensive tools proactively when a mechanic is predictable; staying alive is always a larger gain than squeezing out one more attack.",
      why: "Fury rewards a steady damage rhythm. Lost global cooldowns, wasted Rage, and poorly timed cooldowns all reduce that rhythm."
    },
    Arms: {
      role: "Damage",
abilities: { primary: ["Mortal Strike", "Overpower", "Rend", "Execute"], resource: "Rage", cooldowns: ["Colossus Smash", "Avatar", "Bladestorm", "Demolish"] },
      beginnerPriority: ["Keep Colossus Smash available and use it regularly.", "Keep Mortal Strike and other core abilities moving.", "Use Overpower or Slam to fill the gaps in the priority.", "Use Execute when its conditions or procs make it valuable.", "Keep Rage moving without overcapping or starving yourself."],
      cooldownGuidance: "Keep Colossus Smash, Avatar, and your major hero-talent cooldown available on a regular cycle. Delay only for a meaningful upcoming target or damage window.",
      commonMistakes: ["Letting downtime break Rage generation.", "Delaying several cooldowns until they desynchronize.", "Spending so much Rage that you cannot fill your next global."],
      preCombat: ["Battle Shout active.", "Food/flask/weapon buffs ready for serious content."],
      loop: "Follow your priority system, manage Rage, and make your strongest abilities and cooldown windows count.",
      priorities: [
        "Follow the priority order rather than pressing abilities randomly when several choices are available.",
        "Spend Rage before it becomes wasted and keep important damage windows moving.",
        "Use major cooldowns where they can hit valuable targets for a meaningful portion of the fight."
      ],
      defensive: "Use defensive tools for predictable mechanics and avoid trading survivability for a small amount of extra damage.",
      why: "Arms gets more value from disciplined ability priority and planned burst windows than from simply pressing buttons faster."
    }
  }
};


const CONTENT_GUIDANCE = {
  "Mythic+": {
    label: "Mythic+",
    focus: "Handle dangerous pulls, keep damage moving between targets, and save enough resources and defensives for the next mechanic.",
    priorities: [
      "Plan defensives and major cooldowns around dangerous pulls instead of using everything on the first few seconds.",
      "Keep your priority moving while switching targets; avoid unnecessary downtime between packs.",
      "Treat interrupts, movement, and surviving mechanics as part of your damage plan."
    ],
    defensive: "In Mythic+, use defensives before predictable pull damage and keep an emergency option available for mistakes or unexpected hits.",
    cooldowns: "Use major cooldowns to make dangerous packs or important priority targets easier, but avoid holding them indefinitely for a perfect pull.",
    mistakes: [
      "Using every major cooldown on a low-value pack and entering the next dangerous pull empty.",
      "Ignoring mechanics because the damage rotation feels more important.",
      "Standing idle while moving between targets or waiting for the perfect target."
    ],
    why: "Mythic+ rewards consistent value across many short encounters. Good planning means your character is strong now and still prepared for what comes next."
  },
  Raid: {
    label: "Raid",
    focus: "Prioritize the encounter's important targets and mechanics while keeping your normal rotation or priority moving.",
    priorities: [
      "Plan major cooldowns around meaningful boss damage windows rather than using them automatically on pull.",
      "Keep your core priority active while moving only when the encounter requires it.",
      "Survive mechanics first; a missed mechanic costs more than a small amount of theoretical damage."
    ],
    defensive: "Use defensives proactively for known boss damage and follow encounter mechanics rather than waiting for your health bar to tell you to react.",
    cooldowns: "Hold a major cooldown only when there is a clear upcoming value window; otherwise, use it often enough to avoid losing uses.",
    mistakes: [
      "Holding cooldowns for an imagined perfect window that never arrives.",
      "Letting movement or mechanics create unnecessary downtime.",
      "Treating survival mechanics as optional because the rotation is going well."
    ],
    why: "Raid performance comes from combining your class priority with encounter timing. The best plan is the one you can execute while handling mechanics."
  },
  PvP: {
    label: "PvP",
    focus: "Control your resources and defensive cooldowns while reacting to enemy pressure, positioning, and crowd control.",
    priorities: [
      "Stay aware of enemy pressure and do not spend every defensive tool at the first sign of damage.",
      "Use your offensive windows when the enemy is vulnerable rather than following a completely fixed script.",
      "Keep positioning and target awareness ahead of button optimization."
    ],
    defensive: "Use defensives with intent: respond to real kill pressure, crowd-control setups, or dangerous enemy cooldowns rather than reacting to every small health loss.",
    cooldowns: "Major offensive cooldowns are strongest when they create a real threat window. Coordinate them with control or enemy vulnerability when practical.",
    mistakes: [
      "Using major defensives without identifying the threat they are answering.",
      "Tunnel-visioning your rotation while losing track of enemy cooldowns or positioning.",
      "Forcing a scripted rotation when the PvP situation has changed."
    ],
    why: "PvP is less predictable than PvE. A strong player adapts the class priority to the opponent instead of following a rigid sequence."
  },
  "Solo / Open World": {
    label: "Solo / Open World",
    focus: "Stay efficient and safe while keeping the gameplay simple enough to handle unexpected enemies and movement.",
    priorities: [
      "Keep your core rotation or priority moving without overcomplicating routine enemies.",
      "Use defensives and self-healing before an unexpected situation becomes dangerous.",
      "Save a useful cooldown when you are about to enter an unknown or harder encounter."
    ],
    defensive: "For solo play, prioritize reliable survival. Use self-healing and defensives early enough that an unexpected enemy does not force a panic response.",
    cooldowns: "Use cooldowns freely on meaningful enemies; do not save everything for a theoretical future pull if it will be ready again when you need it.",
    mistakes: [
      "Overusing every cooldown on trivial enemies and having nothing for an elite or rare.",
      "Ignoring positioning because the content feels easy.",
      "Trying to execute advanced optimization when a simple safe priority would work."
    ],
    why: "Solo content is about dependable results. A simple plan you can execute while exploring is more useful than a fragile perfect rotation."
  },
  "General / All-around": {
    label: "General / All-around",
    focus: "Learn the core character loop first, then adapt it to the situation instead of memorizing separate rotations.",
    priorities: [
      "Learn the core resource and ability priority before adding advanced optimization.",
      "Use major cooldowns regularly and deliberately instead of holding them without a reason.",
      "Treat movement and survival as part of good play, not as separate from the rotation."
    ],
    defensive: "Use defensives proactively for predictable danger and keep at least one answer available for unexpected damage.",
    cooldowns: "Use major cooldowns regularly unless a clearly better upcoming opportunity is known.",
    mistakes: [
      "Waiting too long for a perfect cooldown window.",
      "Letting resources cap or important abilities sit unused.",
      "Focusing on damage while ignoring mechanics or survivability."
    ],
    why: "A strong general foundation makes it easier to adapt the same character to Mythic+, raids, solo content, or PvP."
  }
};

function getContentGuidance(goal = "General / All-around") {
  return CONTENT_GUIDANCE[goal] || CONTENT_GUIDANCE["General / All-around"];
}

function createBuildSynthesis({ character = {}, report = {}, gameplay = null } = {}) {
  const talentCount = Array.isArray(character.talents) ? character.talents.length : 0;
  const statSource = report.optimizationContext?.source || "Goal/spec baseline";
  const tracked = report.currentStats?.trackedStats || {};
  const topStats = Object.entries(tracked)
    .sort((a,b) => Number(b[1]) - Number(a[1]))
    .slice(0,3)
    .map(([name,value]) => `${name}: ${Number(value).toLocaleString()}`);
  const gearCount = Array.isArray(report.topUpgrades) ? report.topUpgrades.length : 0;
  const talentLine = gameplay?.talentAware
    ? gameplay.talentAdjustments?.length
      ? "Your selected talents have curated gameplay adjustments, so the play guidance should be used together with the gear plan."
      : "Your selected talents are known, but there is no curated talent-specific adjustment yet; the coach will not invent one."
    : "Live talent selections are not available, so the coach is keeping the build guidance conservative.";
  return {
    headline: "Your talents, stats, and gear should reinforce the same game plan.",
    talentLine,
    statLine: statSource === "SimulationCraft"
      ? "Your gear is being evaluated with SimulationCraft-derived stat weights."
      : "Your gear is being evaluated with the current goal/spec baseline weights.",
    statSnapshot: topStats.length ? `Current tracked stats: ${topStats.join(", ")}.` : "No tracked stat snapshot is available yet.",
    gearLine: gearCount
      ? `${gearCount} direct gear upgrades are currently available; prioritize the highest-value changes without losing the build's overall direction.`
      : "No direct gear replacement is currently available in the dataset.",
    talentCount,
    next: talentCount && gearCount
      ? "Keep your talent choices, stat priorities, and gear upgrades pointed at the same content goal rather than optimizing each piece in isolation."
      : "As more character data becomes available, use the build synthesis to keep talents, stats, and gear aligned."
  };
}

function createEncounterGuidance({ encounter = null } = {}) {
  if (!encounter) {
    return {
      available: false,
      title: "No encounter selected",
      summary: "Select an encounter when current encounter data is available. The coach will add mechanic-specific reminders without replacing your class priority.",
      mechanics: []
    };
  }
  const mechanics = Array.isArray(encounter.mechanics) ? encounter.mechanics : [];
  const mapped = mechanics.map(mechanic => {
    const type = String(mechanic?.type || mechanic?.category || "mechanic").toLowerCase();
    const name = String(mechanic?.name || mechanic?.title || "Encounter mechanic");
    const description = String(mechanic?.description || "").trim();
    let action = "Handle the mechanic first, then return to your normal priority.";
    if (type.includes("movement")) action = "Move early and return to your priority as soon as the movement requirement is complete.";
    else if (type.includes("interrupt")) action = "Be ready to interrupt this cast; missing it can be more important than continuing your normal priority.";
    else if (type.includes("defensive") || type.includes("damage")) action = "Prepare the appropriate defensive before this damage when the encounter allows it.";
    else if (type.includes("target")) action = "Prepare to change targets and re-establish important target-dependent effects.";
    return { name, description, action };
  });
  return {
    available: true,
    title: String(encounter.name || encounter.title || "Selected encounter"),
    summary: String(encounter.description || "Encounter-specific guidance is available from the current dataset."),
    mechanics: mapped
  };
}

function createSituationalGuidance({ profile = null } = {}) {
  const role = profile?.role || "Character";
  return {
    incomingDamage: role === "Tank"
      ? "If a large hit is coming, prepare a defensive before the damage lands and make sure your resource is ready for the follow-up."
      : "If a large hit is coming, prioritize the mechanic and use a defensive before the damage lands when appropriate.",
    lowHealth: role === "Tank"
      ? "When health drops, stabilize first: use the appropriate defensive or recovery tool rather than sacrificing survival for damage."
      : "When health drops, use available recovery or defensive tools and return to damage once you are safe.",
    movement: "When movement is required, use useful instant or movement-compatible actions where the priority allows and return to your core priority immediately.",
    targetSwap: "When changing targets, re-establish the important target-dependent effects and resume your priority without waiting for a perfect setup.",
    multipleTargets: "When several targets are present, use your multi-target priority when appropriate, but keep important single-target or priority-target actions in view.",
    cooldownReady: "When a major cooldown is ready, use it if the current situation is valuable; delay only when a clear better window is imminent.",
    resourceHigh: "When your main resource is near its cap, spend it according to your priority rather than continuing to generate waste.",
    outOfRange: "When you are out of range, fix positioning first. A technically perfect priority cannot help if the character cannot reach the target.",
    interruption: "If a mechanic or interrupt requires attention, handle it first. Resume the normal priority as soon as the situation is safe.",
    note: profile
      ? "These are situation rules layered on top of your specialization priority; they are not a replacement for the core rotation."
      : "This is general situation guidance. A specialization-specific rotation is not invented until that spec has curated coaching data."
  };
}

function createCombatPreparation({ character = {}, goal = "General / All-around" } = {}) {
  const consumables = character.consumables || {};
  const equipment = character.equipment || {};
  const trinkets = [equipment["Trinket 1"], equipment["Trinket 2"]].filter(Boolean);
  return {
    food: consumables.food ? "A food buff is present on the character profile." : "Use an appropriate current food buff for serious content.",
    flask: consumables.flaskOrPhial ? "A flask or phial is present on the character profile." : "Use the current flask or phial appropriate to your character when available.",
    potions: Array.isArray(consumables.potions) && consumables.potions.length
      ? "Combat potions are present in the character profile; use them during meaningful offensive windows."
      : "Keep combat potions available and use them during meaningful offensive windows.",
    trinkets: trinkets.length
      ? "Treat equipped trinkets as part of your cooldown plan; use them deliberately with your strongest windows when practical."
      : "No equipped trinkets were returned, so the coach will not invent a trinket cooldown plan.",
    enchants: Array.isArray(character.enchants) && character.enchants.length
      ? "Known enchants are present; keep them current as gear changes."
      : "Keep applicable gear enchanted; exact recommendations require current enchant data.",
    racials: "Use your racial ability as part of an offensive or defensive window when the character data identifies one.",
    professions: "Use profession cooldowns or crafted effects when they meaningfully support the goal; exact profession advice requires profession data.",
    content: goal
  };
}

function createGearPriority(upgrade, index) {
  return {
    rank: index + 1,
    type: "gear",
    slot: upgrade.slot,
    title: upgrade.recommendedItem?.name || "Recommended upgrade",
    current: upgrade.currentItem?.name || "Empty slot",
    improvement: Number(upgrade.improvement || 0),
    explanation: upgrade.currentItem
      ? "This is one of the largest available weighted gear improvements in the current dataset."
      : "This slot is empty, so filling it is an immediate gear opportunity."
  };
}

function createUpgradePriority(plan, index) {
  const next = plan.nextUpgrade;
  if (!next) return {
    rank: index + 1,
    type: "upgrade",
    slot: plan.slot,
    title: plan.item?.name || "Equipped item",
    status: "At the end of its current upgrade track.",
    explanation: "There is no further rank on this item's current track in the current upgrade data."
  };
  const crestPlan = plan.crestPlan || {};
  const required = Object.entries(crestPlan.required || {})
    .map(([crest, amount]) => `${amount} ${crest}`)
    .join(", ");
  return {
    rank: index + 1,
    type: "upgrade",
    slot: plan.slot,
    title: `${plan.item?.name || "Equipped item"} → rank ${next.toRank}`,
    status: `${next.track} ${next.fromRank} → ${next.toRank} (${next.toItemLevel} iLvl)`,
    resources: required || "No crest requirement reported",
    weeklyFit: crestPlan.fitsWeeklyCap ? "Fits the current weekly cap." : "Exceeds the current weekly cap.",
    explanation: "This is the next legal rank on the item's current upgrade track; the plan uses the upgrade data rather than inventing a cross-track jump."
  };
}

function createTalentContext(talents = []) {
  return (Array.isArray(talents) ? talents : [])
    .map(talent => ({
      id: talent?.id ?? null,
      name: String(talent?.name || "").trim(),
      rank: Number(talent?.rank || 0)
    }))
    .filter(talent => talent.name || talent.id != null);
}

function applyTalentGuidance(gameplay, profile, talents) {
  const context = createTalentContext(talents);
  const names = new Set(context.map(talent => talent.name.toLowerCase()));
  const rules = profile?.talentGuidance || [];
  const matched = rules.filter(rule =>
    (rule.matches || []).some(name => names.has(String(name).toLowerCase()))
  );
  if (!matched.length) return {
    ...gameplay,
    talentAware: context.length > 0,
    talentSummary: context.length
      ? `Your live character has ${context.length} selected talent entries. No additional curated talent-specific rule is active yet.`
      : "No live talent selections were returned for this character.",
    talentAdjustments: []
  };
  return {
    ...gameplay,
    talentAware: true,
    talentSummary: `Your selected talents change the gameplay emphasis: ${matched.map(rule => rule.title).join(", ")}.`,
    talentAdjustments: matched.map(rule => rule.guidance)
  };
}

function createCharacterCoach({ character = {}, report = {}, goal = "General / All-around", encounter = null } = {}) {
  const className = character.className || "";
  const specialization = character.specialization || "";
  const profile = COACH_PROFILES[className]?.[specialization] || null;
  const upgrades = Array.isArray(report.topUpgrades) ? report.topUpgrades.slice(0, 3) : [];
  const upgradePlans = Array.isArray(report.upgradePlans) ? report.upgradePlans : [];
  const gearPriorities = upgrades.map(createGearPriority);
  const upgradePriorities = upgradePlans
    .filter(plan => plan.nextUpgrade)
    .sort((a, b) => Number(b.nextUpgrade?.toItemLevel || 0) - Number(a.nextUpgrade?.toItemLevel || 0))
    .slice(0, 3)
    .map(createUpgradePriority);

  const statWeights = report.optimizationContext?.source === "SimulationCraft"
    ? "SimulationCraft-derived weights are driving the optimization."
    : "The current goal/spec baseline weights are driving the optimization.";

  const directUpgradeCount = upgrades.length;
  const largestGearGain = upgrades[0]?.improvement ? Number(upgrades[0].improvement) : 0;
  const occupiedSlots = Object.values(character.equipment || {}).filter(Boolean).length;
  const equipmentSlots = Number(report.equipmentSlots || Object.keys(character.equipment || {}).length || 0);
  const missingSlots = Math.max(0, equipmentSlots - occupiedSlots);

  const strengths = [];
  if (occupiedSlots > 0) strengths.push(`${occupiedSlots} of ${equipmentSlots || occupiedSlots} equipment slots are populated and ready to evaluate.`);
  if (!directUpgradeCount) strengths.push("No direct gear replacement was found in the current available-item dataset.");
  if (profile) strengths.push(`${specialization} has curated gameplay guidance in the current coach knowledge.`);
  if (report.currentStats?.trackedStats && Object.keys(report.currentStats.trackedStats).length) {
    strengths.push("Current character statistics are available as a baseline for the optimizer.");
  }

  const attention = [];
  if (directUpgradeCount) attention.push(`${directUpgradeCount} direct gear upgrade opportunit${directUpgradeCount === 1 ? "y" : "ies"} are currently ranked for you.`);
  if (missingSlots) attention.push(`${missingSlots} equipment slot${missingSlots === 1 ? "" : "s"} are empty or not present in the imported character.`);
  if (upgradePriorities.length) attention.push("Some equipped items can still advance on their current upgrade tracks.");
  if (!profile) attention.push("Detailed gameplay guidance is not yet curated for this specialization, so the coach will not invent a rotation.");

  const priorities = [
    ...gearPriorities.map(item => ({ ...item, section: "Gear" })),
    ...upgradePriorities.map(item => ({ ...item, section: "Upgrades", rank: gearPriorities.length + item.rank }))
  ].slice(0, 5);

  const nextAction = priorities[0]
    ? priorities[0].type === "gear"
      ? `Start with ${priorities[0].slot}: compare your current item with ${priorities[0].title}.`
      : `Work on the next upgrade for ${priorities[0].slot}: ${priorities[0].title}.`
    : profile
      ? "Your next step is to practice the gameplay loop below and use the optimizer again after your gear changes."
      : "Your next step is to add more supported character/spec data before relying on detailed gameplay advice.";

  return {
    identity: {
      name: character.characterName || "Your character",
      className,
      specialization,
      level: character.level ?? null,
      realm: character.realm || null,
      role: profile?.role || "Character",
      goal
    },
    summary: {
      headline: profile ? `You are a ${profile.role.toLowerCase()} focused on ${goal}.` : `Your character is being optimized for ${goal}.`,
      nextAction,
      gearOpportunityCount: directUpgradeCount,
      largestGearGain,
      occupiedSlots,
      equipmentSlots,
      statSource: statWeights
    },
    strengths,
    attention,
    priorities,
    gearPlan: gearPriorities,
    upgradePlan: upgradePriorities,
    content: getContentGuidance(goal),
    preparation: createCombatPreparation({ character, goal }),
    situations: createSituationalGuidance({ profile }),
    encounter: createEncounterGuidance({ encounter }),
    buildSynthesis: createBuildSynthesis({ character, report, gameplay: null }),
    gameplay: applyTalentGuidance({
      abilities: profile?.abilities || { primary: [], resource: "Resource", cooldowns: [] },
      beginnerPriority: profile?.beginnerPriority || [],
      cooldownGuidance: profile?.cooldownGuidance || "Use important cooldowns deliberately and avoid inventing timing rules when the specialization is unsupported.",
      commonMistakes: profile?.commonMistakes || [],
      preCombat: profile?.preCombat || [],
      priorities: profile?.priorities || [],
      loop: profile?.loop || "Use the recommendations below as your starting point. A detailed class guide will be added when this specialization has a curated coach profile.",
      defensive: profile?.defensive || "Use defensives proactively for predictable danger and follow your specialization's trusted priority system.",
      why: profile?.why || getContentGuidance(goal).why,
      supported: Boolean(profile)
    }, profile, character.talents)
  };
}

if (typeof module !== "undefined") module.exports = { COACH_PROFILES, CONTENT_GUIDANCE, getContentGuidance, createCombatPreparation, createSituationalGuidance, createEncounterGuidance, createCharacterCoach };
if (typeof window !== "undefined") window.WoWCharacterCoach = { COACH_PROFILES, CONTENT_GUIDANCE, getContentGuidance, createCharacterCoach };
