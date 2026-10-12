function normalizeEquipmentSockets(item = {}) {
  const sockets = Array.isArray(item.sockets) ? item.sockets : [];
  const gems = Array.isArray(item.gems) ? item.gems : [];

  if (!sockets.length && !gems.length) {
    return { status: "unavailable", sockets: [] };
  }

  if (!sockets.length && gems.length) {
    return {
      status: "available",
      sockets: gems.map((gem, index) => {
        const installed = hasGemEvidence(gem);
        return {
          label: `Socket ${index + 1}`,
          gemName: readGemName(gem),
          gemId: readGemId(gem),
          itemForStats: gem,
          state: installed ? "installed" : "empty"
        };
      })
    };
  }

  return {
    status: "available",
    sockets: sockets.map((socket, index) => {
      // Blizzard's character-equipment response represents a socketed gem as
      // socket.item (name/key href) and may expose its media ID separately.
      const socketItem = socket?.item || socket?.gem || null;
      const fallbackGem = gems[index] || null;
      const gem = hasGemEvidence(socketItem) ? socketItem : fallbackGem;
      const installed = hasGemEvidence(gem);
      return {
        label: readSocketType(socket) || `Socket ${index + 1}`,
        gemName: readGemName(gem),
        gemId: readGemId(gem) || readGemId(socket?.media) || readGemId(fallbackGem),
        itemForStats: gem,
        state: installed ? "installed" : "empty"
      };
    })
  };
}

function hasGemEvidence(gem) {
  if (typeof gem === "string") return Boolean(gem.trim());
  if (!gem || typeof gem !== "object") return false;
  return Boolean(readGemName(gem) || readGemId(gem) || gem.key?.href || gem.item?.key?.href);
}

function readGemName(gem) {
  if (typeof gem === "string" && gem.trim()) return gem.trim();
  if (!gem || typeof gem !== "object") return null;
  const value = gem.name || gem.gem?.name || gem.item?.name;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readGemStats(gem) {
  if (!gem || typeof gem !== "object") return null;
  const stats = gem.stats || gem.item?.stats || gem.gem?.stats;
  if (Array.isArray(stats)) {
    const result = {};
    for (const entry of stats) {
      const name = entry?.type?.name || entry?.stat?.name || entry?.name || entry?.type || entry?.stat;
      const value = Number(entry?.value ?? entry?.amount);
      if (typeof name === "string" && name.trim() && Number.isFinite(value)) {
        result[name.trim()] = (result[name.trim()] || 0) + value;
      }
    }
    return Object.keys(result).length ? result : null;
  }
  if (stats && typeof stats === "object") {
    const result = Object.fromEntries(Object.entries(stats).filter(([, value]) =>
      typeof value === "number" && Number.isFinite(value)
    ));
    return Object.keys(result).length ? result : null;
  }
  return null;
}

function summarizeEquipmentGems(equipment = []) {
  const summary = { installed: 0, empty: 0, socketsKnown: 0, stats: {}, statsKnownGems: 0 };
  for (const item of Array.isArray(equipment) ? equipment : []) {
    const normalized = normalizeEquipmentSockets(item);
    if (normalized.status !== "available") continue;
    for (const socket of normalized.sockets) {
      summary.socketsKnown += 1;
      if (socket.state === "empty") {
        summary.empty += 1;
        continue;
      }
      summary.installed += 1;
      const stats = readGemStats(socket.itemForStats);
      if (!stats) continue;
      summary.statsKnownGems += 1;
      for (const [name, value] of Object.entries(stats)) {
        summary.stats[name] = (summary.stats[name] || 0) + value;
      }
    }
  }
  return summary;
}

function readGemId(gem) {
  if (!gem || typeof gem !== "object") return null;
  const direct = gem.id ?? gem.item?.id ?? gem.gem?.id;
  if (direct != null && String(direct).trim()) return String(direct);
  const href = gem.key?.href || gem.item?.key?.href;
  if (typeof href === "string") {
    const match = href.match(/\/item\/(\d+)(?:[/?#]|$)/i);
    if (match) return match[1];
  }
  return null;
}

function readSocketType(socket) {
  if (!socket || typeof socket !== "object") return null;
  const type = socket.socket_type || socket.socketType || socket.type;
  if (typeof type === "string" && type.trim()) return type.trim();
  if (type && typeof type.name === "string" && type.name.trim()) return type.name.trim();
  return null;
}

const equipmentSocketApi = { normalizeEquipmentSockets, summarizeEquipmentGems };
if (typeof module !== "undefined" && module.exports) module.exports = equipmentSocketApi;
if (typeof window !== "undefined") window.WoWEquipmentSockets = equipmentSocketApi;
