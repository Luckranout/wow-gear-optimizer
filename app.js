const specs = {
  "Death Knight": ["Blood", "Frost", "Unholy"],
  "Demon Hunter": ["Havoc", "Vengeance", "Devourer"],
  "Druid": ["Balance", "Feral", "Guardian", "Restoration"],
  "Evoker": ["Devastation", "Preservation", "Augmentation"],
  "Hunter": ["Beast Mastery", "Marksmanship", "Survival"],
  "Mage": ["Arcane", "Fire", "Frost"],
  "Monk": ["Brewmaster", "Mistweaver", "Windwalker"],
  "Paladin": ["Holy", "Protection", "Retribution"],
  "Priest": ["Discipline", "Holy", "Shadow"],
  "Rogue": ["Assassination", "Outlaw", "Subtlety"],
  "Shaman": ["Elemental", "Enhancement", "Restoration"],
  "Warlock": ["Affliction", "Demonology", "Destruction"],
  "Warrior": ["Arms", "Fury", "Protection"]
};

const slots = [
  "Head", "Neck", "Shoulders", "Back",
  "Chest", "Wrists", "Hands", "Waist",
  "Legs", "Feet", "Ring 1", "Ring 2",
  "Trinket 1", "Trinket 2", "Main Hand", "Off Hand"
];

const classSelect = document.querySelector("#classSelect");
const specSelect = document.querySelector("#specSelect");
const slotGrid = document.querySelector("#slotGrid");
const resultMessage = document.querySelector("#resultMessage");

function renderSlots() {
  slotGrid.innerHTML = slots.map(slot => `
    <div class="slot">
      <div class="slot-name">${slot}</div>
      <div class="slot-status">Awaiting current Retail data</div>
    </div>
  `).join("");
}

classSelect.addEventListener("change", () => {
  const selected = classSelect.value;
  specSelect.innerHTML = "";
  if (!selected) {
    specSelect.disabled = true;
    specSelect.innerHTML = "<option>Select class first</option>";
    return;
  }
  specSelect.disabled = false;
  specSelect.innerHTML = '<option value="">Select specialization</option>' +
    specs[selected].map(spec => `<option>${spec}</option>`).join("");
});

document.querySelector("#optimizeBtn").addEventListener("click", () => {
  const cls = classSelect.value;
  const spec = specSelect.value;
  const goal = document.querySelector("#goalSelect").value;

  if (!cls || !spec) {
    resultMessage.textContent =
      "Select a class and specialization before optimizing.";
    return;
  }

  const character = WoWOptimizer.createCharacterProfile();

  character.className = cls;
  character.specialization = spec;
  character.goal = goal;

  const report = WoWOptimizer.createOptimizationReport({
    character,
    availableItems: WoWOptimizer.testData
  });

  const availableUpgrades = report.topUpgrades
    .map(upgrade => {
      const itemName =
        upgrade.recommendedItem?.name || "Recommended upgrade";

      return `${upgrade.slot}: ${itemName}`;
    })
    .join(" • ");

  resultMessage.textContent =
    availableUpgrades
      ? `${cls} • ${spec} • ${goal} — Optimizer running. Top available upgrades: ${availableUpgrades}`
      : `${cls} • ${spec} • ${goal} — Optimizer running. No current test-data upgrades are available yet.`;
});

document.querySelector("#clearBtn").addEventListener("click", () => {
  classSelect.value = "";
  specSelect.disabled = true;
  specSelect.innerHTML = "<option>Select class first</option>";
  document.querySelector("#goalSelect").value = "Mythic+";
  resultMessage.textContent = "Choose your class and specialization, then run the optimizer.";
});

renderSlots();
