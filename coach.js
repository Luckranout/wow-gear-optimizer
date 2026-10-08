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

function createCharacterCoach({ character = {}, report = {}, goal = "General / All-around" } = {}) {
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
    gameplay: applyTalentGuidance({
      abilities: profile?.abilities || { primary: [], resource: "Resource", cooldowns: [] },
      beginnerPriority: profile?.beginnerPriority || [],
      cooldownGuidance: profile?.cooldownGuidance || "Use important cooldowns deliberately and avoid inventing timing rules when the specialization is unsupported.",
      commonMistakes: profile?.commonMistakes || [],
      preCombat: profile?.preCombat || [],
      priorities: profile?.priorities || [],
      loop: profile?.loop || "Use the recommendations below as your starting point. A detailed class guide will be added when this specialization has a curated coach profile.",
      defensive: profile?.defensive || "Use defensives proactively for predictable danger and follow your specialization's trusted priority system.",
      why: profile?.why || "The optimizer can explain gear and stat recommendations, but this specialization does not yet have enough curated gameplay guidance for us to safely invent a rotation.",
      supported: Boolean(profile)
    }, profile, character.talents)
  };
}

if (typeof module !== "undefined") module.exports = { COACH_PROFILES, createCharacterCoach };
if (typeof window !== "undefined") window.WoWCharacterCoach = { COACH_PROFILES, createCharacterCoach };
