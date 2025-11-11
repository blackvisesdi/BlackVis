function normalizeKey(s) {
  if (!s && s !== 0) return "";
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const getId = (v) => (typeof v === "object" ? v.id : v);
