// AI-based order priority scoring
// Score = waitTime weight + orderSize weight + statusUrgency weight
// Higher score = higher priority

export interface PriorityScore {
  score: number;
  label: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';
  color: string;
  reasons: string[];
}

export function computePriority(order: {
  createdAt: Date | string;
  items: Array<{ quantity: number }>;
  status: string;
  total: number;
}): PriorityScore {
  const now = Date.now();
  const createdMs = new Date(order.createdAt).getTime();
  const waitMins = (now - createdMs) / 60000;
  const totalItems = order.items.reduce((s, i) => s + i.quantity, 0);

  let score = 0;
  const reasons: string[] = [];

  // Wait time factor (0–50 pts)
  if (waitMins > 30) { score += 50; reasons.push('Waiting 30+ min'); }
  else if (waitMins > 20) { score += 35; reasons.push('Waiting 20+ min'); }
  else if (waitMins > 10) { score += 20; reasons.push('Waiting 10+ min'); }
  else { score += Math.round(waitMins * 1.5); }

  // Order size factor (0–20 pts) — larger orders need more prep time, prioritise early
  if (totalItems >= 8) { score += 20; reasons.push('Large order'); }
  else if (totalItems >= 5) { score += 12; }
  else if (totalItems >= 3) { score += 6; }

  // High value order (0–15 pts)
  if (order.total >= 2000) { score += 15; reasons.push('High-value order'); }
  else if (order.total >= 1000) { score += 8; }

  // Status urgency — pending orders that haven't been confirmed yet get a boost
  if (order.status === 'pending') { score += 15; reasons.push('Awaiting confirmation'); }

  const label: PriorityScore['label'] =
    score >= 70 ? 'URGENT' :
    score >= 45 ? 'HIGH' :
    score >= 20 ? 'NORMAL' : 'LOW';

  const color =
    label === 'URGENT' ? 'bg-red-500 text-white' :
    label === 'HIGH'   ? 'bg-orange-500 text-white' :
    label === 'NORMAL' ? 'bg-blue-500 text-white' :
                         'bg-gray-400 text-white';

  return { score, label, color, reasons };
}

// Predict wait time in minutes based on item count and kitchen load
export function predictWaitTime(
  itemCount: number,
  activeOrdersInKitchen: number,
  status: string
): { minMins: number; maxMins: number; label: string } {
  // Base: 3 min per item, kitchen load adds 2 min per concurrent order
  const base = itemCount * 3;
  const load = activeOrdersInKitchen * 2;
  const total = base + load;

  if (status === 'served') return { minMins: 0, maxMins: 0, label: 'Served' };
  if (status === 'preparing') {
    const min = Math.max(2, Math.round(total * 0.3));
    const max = Math.round(total * 0.6);
    return { minMins: min, maxMins: max, label: `${min}–${max} min` };
  }
  if (status === 'confirmed') {
    const min = Math.round(total * 0.6);
    const max = total + 5;
    return { minMins: min, maxMins: max, label: `${min}–${max} min` };
  }
  // pending
  const min = total + 3;
  const max = total + 10;
  return { minMins: min, maxMins: max, label: `${min}–${max} min` };
}
