// Chat en vivo (spec 006): la lista se actualiza por partes para que se pueda deslizar
// sin que cada mensaje nuevo la regrese al final.

// Compara lo que ya está pintado con la lista nueva (de más viejo a más nuevo).
// Devuelve qué quitar, qué agregar arriba (mensajes anteriores) y qué agregar abajo (nuevos).
export function planChatUpdate(renderedIds, messages) {
  const nextIds = messages.map(m => m.id);
  const nextSet = new Set(nextIds);
  const remove = renderedIds.filter(id => !nextSet.has(id));
  const kept = renderedIds.filter(id => nextSet.has(id));
  if (!kept.length) return { rebuild: false, remove, prepend: [], append: messages };
  const start = nextIds.indexOf(kept[0]);
  const sameOrder = kept.every((id, i) => nextIds[start + i] === id);
  if (!sameOrder) return { rebuild: true, remove: [], prepend: [], append: messages };
  return {
    rebuild: false,
    remove,
    prepend: messages.slice(0, start),
    append: messages.slice(start + kept.length)
  };
}

export function isNearBottom({ scrollHeight, scrollTop, clientHeight }, threshold = 80) {
  return scrollHeight - scrollTop - clientHeight < threshold;
}

export function newMessagesLabel(count) {
  return count === 1 ? "1 mensaje nuevo" : `${count} mensajes nuevos`;
}
