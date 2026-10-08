const COACH_PROFILES = {
  Warrior: {
    Protection: {
      role: "Tank",
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
    gameplay: {
      priorities: profile?.priorities || [],
      loop: profile?.loop || "Use the recommendations below as your starting point. A detailed class guide will be added when this specialization has a curated coach profile.",
      defensive: profile?.defensive || "Use defensives proactively for predictable danger and follow your specialization's trusted priority system.",
      why: profile?.why || "The optimizer can explain gear and stat recommendations, but this specialization does not yet have enough curated gameplay guidance for us to safely invent a rotation.",
      supported: Boolean(profile)
    }
  };
}

if (typeof module !== "undefined") module.exports = { COACH_PROFILES, createCharacterCoach };
if (typeof window !== "undefined") window.WoWCharacterCoach = { COACH_PROFILES, createCharacterCoach };
