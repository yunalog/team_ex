const $ = (id) => document.getElementById(id);

const state = {
  chapter: 1,
  stageInChapter: 1,
  stageType: "normal",
  gold: 0,
  level: 1,
  exp: 0,
  expToNext: 20,
  atk: 10,
  attackInterval: 850,
  atkCost: 20,
  speedCost: 30,
  monsters: [],
  targetId: null,
  killed: 0,
  killGoal: 0,
  bossTimeLimit: 30,
  bossTimeLeft: 30,
  lastAttackAt: 0,
  lastTickAt: performance.now(),
  paused: false,
};

const stageNames = [
  "푸른 버섯 숲",
  "돌도끼 언덕",
  "고대 들판",
  "바람 협곡",
  "잠든 화산",
];

const monsterIcons = ["🍄", "🐗", "🦇", "🪨", "🦖", "🐺"];
const bossIcons = ["👹", "🐲", "🦣", "🧌", "🔥"];

const els = {
  chapterText: $("chapterText"),
  stageText: $("stageText"),
  goldText: $("goldText"),
  stageTypeText: $("stageTypeText"),
  stageTitle: $("stageTitle"),
  timerBox: $("timerBox"),
  bossTimerText: $("bossTimerText"),
  monsterLayer: $("monsterLayer"),
  damageLayer: $("damageLayer"),
  hero: $("hero"),
  goalText: $("goalText"),
  powerText: $("powerText"),
  progressFill: $("progressFill"),
  levelText: $("levelText"),
  expText: $("expText"),
  atkText: $("atkText"),
  atkUpgradeBtn: $("atkUpgradeBtn"),
  speedUpgradeBtn: $("speedUpgradeBtn"),
  atkCostText: $("atkCostText"),
  speedCostText: $("speedCostText"),
  toast: $("toast"),
};

function getStageNumber() {
  return (state.chapter - 1) * 5 + state.stageInChapter;
}

function isBossStage() {
  return state.stageInChapter === 5;
}

function normalMonsterCount() {
  return 4 + state.stageInChapter + Math.floor(state.chapter / 2);
}

function createStage() {
  state.stageType = isBossStage() ? "boss" : "normal";
  state.monsters = [];
  state.targetId = null;
  state.killed = 0;
  state.lastAttackAt = 0;
  els.monsterLayer.innerHTML = "";
  els.damageLayer.innerHTML = "";

  if (state.stageType === "boss") {
    createBoss();
  } else {
    createNormalMonsters();
  }

  selectNextTarget();
  render();
}

function createNormalMonsters() {
  const count = normalMonsterCount();
  state.killGoal = count;

  const positions = getMonsterPositions(count);
  for (let i = 0; i < count; i += 1) {
    const maxHp = Math.floor(22 + getStageNumber() * 7 + i * 3);
    const monster = {
      id: crypto.randomUUID(),
      type: "normal",
      icon: monsterIcons[(i + state.chapter + state.stageInChapter) % monsterIcons.length],
      x: positions[i].x,
      y: positions[i].y,
      hp: maxHp,
      maxHp,
      gold: 5 + state.chapter * 2 + state.stageInChapter,
      exp: 4 + state.stageInChapter,
      alive: true,
    };
    state.monsters.push(monster);
    els.monsterLayer.appendChild(createMonsterElement(monster));
  }
}

function createBoss() {
  const stageNumber = getStageNumber();
  const maxHp = Math.floor(260 + stageNumber * 70 + state.chapter * 130);
  state.killGoal = 1;
  state.bossTimeLimit = Math.max(18, 32 - state.chapter);
  state.bossTimeLeft = state.bossTimeLimit;

  const boss = {
    id: crypto.randomUUID(),
    type: "boss",
    icon: bossIcons[(state.chapter - 1) % bossIcons.length],
    x: 50,
    y: 32,
    hp: maxHp,
    maxHp,
    gold: 70 + state.chapter * 35,
    exp: 28 + state.chapter * 12,
    alive: true,
  };

  state.monsters.push(boss);
  els.monsterLayer.appendChild(createMonsterElement(boss));
}

function getMonsterPositions(count) {
  const base = [
    { x: 25, y: 26 },
    { x: 75, y: 27 },
    { x: 18, y: 48 },
    { x: 82, y: 49 },
    { x: 32, y: 72 },
    { x: 68, y: 72 },
    { x: 50, y: 22 },
    { x: 50, y: 78 },
    { x: 13, y: 64 },
    { x: 87, y: 64 },
  ];

  return base.slice(0, count).map((pos, index) => ({
    x: clamp(pos.x + randomBetween(-3, 3), 10, 90),
    y: clamp(pos.y + randomBetween(-3, 3), 18, 80),
    order: index,
  }));
}

function createMonsterElement(monster) {
  const el = document.createElement("div");
  el.className = `monster ${monster.type === "boss" ? "boss" : ""}`;
  el.dataset.id = monster.id;
  el.style.left = `${monster.x}%`;
  el.style.top = `${monster.y}%`;
  el.innerHTML = `
    <div class="monster-body">${monster.icon}</div>
    <div class="monster-hp"><div class="monster-hp-fill"></div></div>
  `;
  return el;
}

function selectNextTarget() {
  const alive = state.monsters.filter((monster) => monster.alive);
  if (alive.length === 0) {
    state.targetId = null;
    return;
  }

  alive.sort((a, b) => {
    const da = distanceToHero(a);
    const db = distanceToHero(b);
    return da - db;
  });

  state.targetId = alive[0].id;
  updateTargetClass();
}

function distanceToHero(monster) {
  const heroX = 50;
  const heroY = 56;
  return Math.hypot(monster.x - heroX, monster.y - heroY);
}

function updateTargetClass() {
  document.querySelectorAll(".monster").forEach((el) => {
    el.classList.toggle("target", el.dataset.id === state.targetId);
  });
}

function gameLoop(now) {
  const delta = (now - state.lastTickAt) / 1000;
  state.lastTickAt = now;

  if (!state.paused) {
    if (state.stageType === "boss") {
      state.bossTimeLeft -= delta;
      if (state.bossTimeLeft <= 0) {
        state.bossTimeLeft = 0;
        failBossStage();
      }
    }

    if (now - state.lastAttackAt >= state.attackInterval) {
      attackTarget(now);
    }
  }

  render();
  requestAnimationFrame(gameLoop);
}

function attackTarget(now) {
  let target = state.monsters.find((monster) => monster.id === state.targetId && monster.alive);
  if (!target) {
    selectNextTarget();
    target = state.monsters.find((monster) => monster.id === state.targetId && monster.alive);
  }

  if (!target) return;

  state.lastAttackAt = now;
  const damage = Math.floor(state.atk * randomBetween(0.86, 1.18));
  target.hp = Math.max(0, target.hp - damage);

  playAttackAnimation(target, damage);
  updateMonsterHp(target);

  if (target.hp <= 0) {
    killMonster(target);
  }
}

function playAttackAnimation(target, damage) {
  els.hero.classList.remove("attack");
  void els.hero.offsetWidth;
  els.hero.classList.add("attack");

  const monsterEl = document.querySelector(`[data-id="${target.id}"]`);
  if (monsterEl) {
    monsterEl.classList.add("hit");
    setTimeout(() => monsterEl.classList.remove("hit"), 130);
  }

  const slash = document.createElement("div");
  slash.className = "slash";
  slash.style.left = `${target.x}%`;
  slash.style.top = `${target.y}%`;
  els.damageLayer.appendChild(slash);
  setTimeout(() => slash.remove(), 300);

  const damageText = document.createElement("div");
  damageText.className = "damage-text";
  damageText.style.left = `${target.x}%`;
  damageText.style.top = `${target.y - 5}%`;
  damageText.textContent = `-${damage}`;
  els.damageLayer.appendChild(damageText);
  setTimeout(() => damageText.remove(), 700);
}

function updateMonsterHp(monster) {
  const monsterEl = document.querySelector(`[data-id="${monster.id}"]`);
  if (!monsterEl) return;
  const fill = monsterEl.querySelector(".monster-hp-fill");
  fill.style.width = `${(monster.hp / monster.maxHp) * 100}%`;
}

function killMonster(monster) {
  monster.alive = false;
  state.killed += 1;
  state.gold += monster.gold;
  gainExp(monster.exp);

  const monsterEl = document.querySelector(`[data-id="${monster.id}"]`);
  if (monsterEl) {
    monsterEl.classList.add("dead");
    setTimeout(() => monsterEl.remove(), 260);
  }

  if (state.killed >= state.killGoal) {
    setTimeout(clearStage, 500);
  } else {
    selectNextTarget();
  }
}

function clearStage() {
  if (state.paused) return;
  showToast(state.stageType === "boss" ? "보스 클리어! 다음 챕터로 이동" : "스테이지 클리어!");

  if (state.stageInChapter >= 5) {
    state.chapter += 1;
    state.stageInChapter = 1;
  } else {
    state.stageInChapter += 1;
  }

  setTimeout(createStage, 650);
}

function failBossStage() {
  state.paused = true;
  showToast("보스 실패! 공격력을 강화하고 재도전");

  setTimeout(() => {
    state.paused = false;
    createStage();
  }, 1200);
}

function gainExp(amount) {
  state.exp += amount;
  while (state.exp >= state.expToNext) {
    state.exp -= state.expToNext;
    state.level += 1;
    state.atk += 3;
    state.expToNext = Math.floor(state.expToNext * 1.25 + 8);
    showToast(`레벨 업! LV.${state.level}`);
  }
}

function buyAtkUpgrade() {
  if (state.gold < state.atkCost) {
    showToast("골드가 부족해");
    return;
  }

  state.gold -= state.atkCost;
  state.atk += 5;
  state.atkCost = Math.floor(state.atkCost * 1.35 + 8);
  showToast("공격력 강화 완료!");
  render();
}

function buySpeedUpgrade() {
  if (state.gold < state.speedCost) {
    showToast("골드가 부족해");
    return;
  }

  state.gold -= state.speedCost;
  state.attackInterval = Math.max(360, state.attackInterval - 55);
  state.speedCost = Math.floor(state.speedCost * 1.45 + 10);
  showToast("공격속도 강화 완료!");
  render();
}

function render() {
  els.chapterText.textContent = state.chapter;
  els.stageText.textContent = `${state.chapter}-${state.stageInChapter}`;
  els.goldText.textContent = formatNumber(state.gold);
  els.stageTypeText.textContent = state.stageType === "boss" ? "보스 스테이지" : "일반 스테이지";
  els.stageTitle.textContent = state.stageType === "boss" ? `챕터 ${state.chapter} 보스` : stageNames[(state.stageInChapter - 1) % stageNames.length];
  els.timerBox.classList.toggle("hidden", state.stageType !== "boss");
  els.bossTimerText.textContent = state.bossTimeLeft.toFixed(1);

  if (state.stageType === "boss") {
    const boss = state.monsters[0];
    els.goalText.textContent = boss ? `보스 HP ${Math.ceil(boss.hp)} / ${boss.maxHp}` : "보스 HP 0 / 0";
    els.progressFill.style.width = boss ? `${100 - (boss.hp / boss.maxHp) * 100}%` : "100%";
  } else {
    els.goalText.textContent = `몬스터 ${state.killed} / ${state.killGoal}`;
    els.progressFill.style.width = `${(state.killed / state.killGoal) * 100}%`;
  }

  els.powerText.textContent = `전투력 ${formatNumber(getPower())}`;
  els.levelText.textContent = state.level;
  els.expText.textContent = `${state.exp} / ${state.expToNext}`;
  els.atkText.textContent = state.atk;
  els.atkCostText.textContent = `비용 ${state.atkCost}G`;
  els.speedCostText.textContent = `비용 ${state.speedCost}G`;
}

function getPower() {
  const speedBonus = Math.round((900 - state.attackInterval) / 10);
  return state.atk * 2 + state.level * 7 + speedBonus;
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.remove("hidden");
  toastTimer = setTimeout(() => els.toast.classList.add("hidden"), 1300);
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatNumber(value) {
  return Math.floor(value).toLocaleString("ko-KR");
}

els.atkUpgradeBtn.addEventListener("click", buyAtkUpgrade);
els.speedUpgradeBtn.addEventListener("click", buySpeedUpgrade);

createStage();
requestAnimationFrame(gameLoop);
