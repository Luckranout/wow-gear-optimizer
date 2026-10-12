function normalizeEquipmentSockets(item = {}) {
  const sockets = Array.isArray(item.sockets) ? item.sockets : [];
  const gems = Array.isArray(item.gems) ? item.gems : [];

  if (!sockets.length && !gems.length) {
    return { status: "unavailable", sockets: [] };
  }

  if (!sockets.length && gems.length) {
    return {
      status: "available",
      sockets: gems.map((gem, index) => ({
        label: `Socket ${index + 1}`,
        gemName: readGemName(gem),
        gemId: readGemId(gem),
        state: gem ? "installed" : "empty"
      }))
    };
  }

  return {
    status: "available",
    sockets: sockets.map((socket, index) => {
      const socketItem = socket?.item || socket?.gem || null;
      const fallbackGem = gems[index] || null;
      const gem = socketItem || fallbackGem;
      const gemName = readGemName(gem) || readGemName(fallbackGem);
      const gemId = readGemId(gem) || readGemId(fallbackGem);
      return {
        label: readSocketType(socket) || `Socket ${index + 1}`,
        gemName,
        gemId,
        state: gem ? "installed" : "empty"
      };
    })
  };
}

function readGemName(gem) {
  if (typeof gem === "string" && gem.trim()) return gem.trim();
  if (!gem || typeof gem !== "object") return null;
  const value = gem.name || gem.gem?.name || gem.item?.name;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readGemId(gem) {
  if (!gem || typeof gem !== "object") return null;
  const id = gem.id ?? gem.item?.id ?? gem.gem?.id;
  return id != null && String(id).trim() ? String(id) : null;
}

function readSocketType(socket) {
  if (!socket || typeof socket !== "object") return null;
  const type = socket.socket_type || socket.socketType || socket.type;
  if (typeof type === "string" && type.trim()) return type.trim();
  if (type && typeof type.name === "string" && type.name.trim()) return type.name.trim();
  return null;
}

const equipmentSocketApi = { normalizeEquipmentSockets };
if (typeof module !== "undefined" && module.exports) module.exports = equipmentSocketApi;
if (typeof window !== "undefined") window.WoWEquipmentSockets = equipmentSocketApi;
