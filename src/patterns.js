// Pattern generator: mỗi pattern nhận reachable lanes trước đó và phải chứng
// minh ít nhất một action sequence hợp lệ (reachable sau không rỗng).
// Mô hình khả năng: giữa 2 hàng (cách 20m) player đổi tối đa 1 làn; rào thấp
// qua bằng nhảy, rào cao bằng trượt, tàu phải tránh hẳn.
const LANES_ALL = [0, 1, 2];

function withinOne(lanes) {
  const s = new Set();
  for (const r of lanes) {
    s.add(r);
    if (r > 0) s.add(r - 1);
    if (r < 2) s.add(r + 1);
  }
  return [...s];
}

// blocked: Map lane -> kind ('low'|'high'|'train'|undefined)
function prove(blocked, prevReachable) {
  const reachable = [];
  for (const l of withinOne(prevReachable)) {
    if (blocked.get(l) !== 'train') reachable.push(l);
  }
  if (reachable.length === 0) {
    throw new Error(`unbeatable pattern from [${prevReachable}]`);
  }
  return reachable;
}

function coinsLine(lane, n = 5, gap = 2) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ lane, dz: -i * gap });
  return out;
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

// Mỗi pattern: (prevReachable, rand) -> { rows: [{obstacles, coins}], reachable }
const PATTERNS = {
  straightCoins(prev, rand) {
    const lane = pick(rand, withinOne(prev));
    const blocked = new Map();
    return { rows: [{ obstacles: [], coins: coinsLine(lane) }], reachable: prove(blocked, prev) };
  },
  zigzagCoins(prev, rand) {
    const start = pick(rand, withinOne(prev));
    const dir = start === 0 ? 1 : start === 2 ? -1 : rand() < 0.5 ? 1 : -1;
    const coins = [];
    for (let i = 0; i < 5; i++) {
      const lane = Math.min(2, Math.max(0, start + (i % 2 === 0 ? 0 : dir)));
      coins.push({ lane, dz: -i * 2 });
    }
    return { rows: [{ obstacles: [], coins }], reachable: prove(new Map(), prev) };
  },
  coinArch(prev, rand) {
    const lanes = rand() < 0.5 ? [0, 1, 2, 1, 0] : [2, 1, 0, 1, 2];
    const coins = lanes.map((lane, i) => ({ lane, dz: -i * 2 }));
    return { rows: [{ obstacles: [], coins }], reachable: prove(new Map(), prev) };
  },
  jumpBarrier(prev, rand) {
    const free = pick(rand, withinOne(prev));
    const blocked = new Map();
    const obstacles = [];
    for (const l of LANES_ALL) {
      if (l === free) continue;
      blocked.set(l, 'low');
      obstacles.push({ lane: l, kind: 'low' });
    }
    const coins = coinsLine(rand() < 0.5 ? free : pick(rand, LANES_ALL.filter((l) => l !== free)));
    return { rows: [{ obstacles, coins }], reachable: prove(blocked, prev) };
  },
  slideBarrier(prev, rand) {
    const free = pick(rand, withinOne(prev));
    const blocked = new Map();
    const obstacles = [];
    for (const l of LANES_ALL) {
      if (l === free) continue;
      blocked.set(l, 'high');
      obstacles.push({ lane: l, kind: 'high' });
    }
    return { rows: [{ obstacles, coins: coinsLine(free) }], reachable: prove(blocked, prev) };
  },
  jumpCoinLine(prev, rand) {
    // Rào thấp cả 3 làn + hàng xu bay qua đúng nhịp nhảy (xu y=1.0 ăn được giữa không trung)
    const blocked = new Map(LANES_ALL.map((l) => [l, 'low']));
    const lane = pick(rand, withinOne(prev));
    return {
      rows: [{ obstacles: LANES_ALL.map((l) => ({ lane: l, kind: 'low' })), coins: coinsLine(lane) }],
      reachable: prove(blocked, prev),
    };
  },
  trainCorridor(prev, rand) {
    const trainLane = pick(rand, withinOne(prev));
    const free = pick(
      rand,
      withinOne(prev).filter((l) => l !== trainLane),
    );
    const blocked = new Map([[trainLane, 'train']]);
    return {
      rows: [{ obstacles: [{ lane: trainLane, kind: 'train' }], coins: coinsLine(free) }],
      reachable: prove(blocked, prev),
    };
  },
  forcedSwitch(prev, rand) {
    // Ép sang làn cụ thể: 2 làn còn lại bị tàu chặn
    const free = pick(rand, withinOne(prev));
    const blocked = new Map();
    const obstacles = [];
    for (const l of LANES_ALL) {
      if (l === free) continue;
      blocked.set(l, 'train');
      obstacles.push({ lane: l, kind: 'train' });
    }
    return { rows: [{ obstacles, coins: coinsLine(free, 3) }], reachable: prove(blocked, prev) };
  },
  doubleTrain(prev, rand) {
    const free = pick(rand, withinOne(prev));
    const blocked = new Map();
    const obstacles = [];
    for (const l of LANES_ALL) {
      if (l === free) continue;
      blocked.set(l, rand() < 0.6 ? 'train' : 'high');
      obstacles.push({ lane: l, kind: blocked.get(l) });
    }
    return { rows: [{ obstacles, coins: coinsLine(free, 3) }], reachable: prove(blocked, prev) };
  },
  sCurve(prev, rand) {
    // 2 hàng liên tiếp ép đổi làn A -> B
    const a = pick(rand, withinOne(prev));
    const b = pick(rand, withinOne([a]).filter((l) => l !== a));
    const mkRow = (free, otherKind) => {
      const blocked = new Map();
      const obstacles = [];
      for (const l of LANES_ALL) {
        if (l === free) continue;
        blocked.set(l, otherKind);
        obstacles.push({ lane: l, kind: otherKind });
      }
      return { blocked, obstacles };
    };
    const r1 = mkRow(a, 'train');
    const reach1 = prove(r1.blocked, prev);
    const r2 = mkRow(b, 'train');
    const reach2 = prove(r2.blocked, reach1);
    return {
      rows: [
        { obstacles: r1.obstacles, coins: coinsLine(a, 3) },
        { obstacles: r2.obstacles, coins: coinsLine(b, 3) },
      ],
      reachable: reach2,
    };
  },
};

export const PATTERN_NAMES = Object.keys(PATTERNS);

// Test seam: gọi 1 pattern cụ thể theo tên.
export function generatePattern(name, prevReachable, rand = Math.random) {
  if (!PATTERNS[name]) throw new Error(`unknown pattern ${name}`);
  return { name, ...PATTERNS[name]([...prevReachable], rand) };
}

// Mở khóa pattern khó dần theo quãng đường. Tốc độ do game.js sở hữu.
export function createDifficulty() {
  return {
    allowed(distanceM) {
      const list = [
        'straightCoins', 'zigzagCoins', 'coinArch', 'jumpBarrier',
        'slideBarrier', 'jumpCoinLine', 'trainCorridor', 'forcedSwitch',
      ];
      if (distanceM >= 400) list.push('sCurve');
      if (distanceM >= 800) list.push('doubleTrain');
      return list;
    },
  };
}

export function createPatternGen(opts = {}) {
  const rand = opts.random || Math.random;
  const difficulty = createDifficulty();
  return {
    patternNames: PATTERN_NAMES,
    next(prevReachable, distanceM = 0) {
      const allowed = difficulty.allowed(distanceM);
      const name = allowed[Math.floor(rand() * allowed.length)];
      return generatePattern(name, prevReachable, rand);
    },
    reset() {},
  };
}
