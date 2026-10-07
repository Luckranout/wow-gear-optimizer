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
let retailDataset = null;

async function loadCurrentRetailData() {
  try {
    retailDataset = await WoWData.loadRetailDataset();
    document.querySelector(".status").textContent = `● ${retailDataset.expansion} Season ${retailDataset.season} data loaded`;
    return true;
  } catch (error) {
    resultMessage.textContent = `Current Retail data could not be loaded: ${error.message}`;
    return false;
  }
}

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
    availableItems: retailDataset?.items || [],
    dataset: retailDataset
  });

  const availableUpgrades = report.topUpgrades
    .map(upgrade => {
      const itemName =
        upgrade.recommendedItem?.name || "Recommended upgrade";

      return `${upgrade.slot}: ${itemName}`;
    })
    .join(" • ");

  const upgradeCount = report.upgradePlans.length;
  resultMessage.textContent =
    availableUpgrades
      ? `${cls} • ${spec} • ${goal} — ${upgradeCount} upgrade plans evaluated. Top available upgrades: ${availableUpgrades}`
      : `${cls} • ${spec} • ${goal} — ${upgradeCount} upgrade plans evaluated. No matching gear upgrades are available in the current dataset.`;
});

document.querySelector("#clearBtn").addEventListener("click", () => {
  classSelect.value = "";
  specSelect.disabled = true;
  specSelect.innerHTML = "<option>Select class first</option>";
  document.querySelector("#goalSelect").value = "Mythic+";
  resultMessage.textContent = "Choose your class and specialization, then run the optimizer.";
});

renderSlots();
loadCurrentRetailData();
