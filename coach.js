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

function createCharacterCoach({ character = {}, report = {}, goal = "General / All-around" } = {}) {
  const className = character.className || "";
  const specialization = character.specialization || "";
  const profile = COACH_PROFILES[className]?.[specialization] || null;
  const upgrades = Array.isArray(report.topUpgrades) ? report.topUpgrades.slice(0, 3) : [];
  return {
    identity: { name: character.characterName || "Your character", className, specialization, level: character.level ?? null, realm: character.realm || null, role: profile?.role || "Character", goal },
    assessment: {
      headline: profile ? `You are a ${profile.role.toLowerCase()} focused on ${goal}.` : `Your character is being optimized for ${goal}.`,
      loop: profile?.loop || "Use the recommendations below as your starting point. A detailed class guide will be added when this specialization has a curated coach profile.",
      why: profile?.why || "The optimizer can explain gear and stat recommendations, but this specialization does not yet have enough curated gameplay guidance for us to safely invent a rotation."
    },
    priorities: upgrades.map((upgrade, index) => ({
      rank: index + 1, slot: upgrade.slot, current: upgrade.currentItem?.name || "Empty slot",
      recommended: upgrade.recommendedItem?.name || "Recommended upgrade", improvement: Number(upgrade.improvement || 0)
    })),
    gameplay: {
      priorities: profile?.priorities || [],
      defensive: profile?.defensive || "Use defensives proactively for predictable danger and follow your specialization's trusted priority system.",
      supported: Boolean(profile)
    }
  };
}

if (typeof module !== "undefined") module.exports = { COACH_PROFILES, createCharacterCoach };
if (typeof window !== "undefined") window.WoWCharacterCoach = { COACH_PROFILES, createCharacterCoach };
