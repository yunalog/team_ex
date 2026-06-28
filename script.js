const STORAGE_KEY = "idleRpgTycoonPrototype";

const defaultState = {
  gold: 0,
  stage: 1,
  subStage: 1,
  hp: 100,
  maxHp: 100,
  baseAtk: 10,
  sound: true,
  officeLevel: 1,
  equipment: {
    weapon: null,
    armor: null,
    accessory: null,
  },
  buffs: [],
  companions: [],
  squad: [],
  lastSaveAt: Date.now(),
};

let state = loadState();

let currentEnemy = null;
let battleTimer = null;
let bossTimeLeft = 0;
let bossTimerInterval = null;

const itemPool = [
  { type: "weapon", typeName: "무기", name: "나무검", atk: 5, def: 0, hp: 0 },
  { type: "weapon", typeName: "무기", name: "철검", atk: 14, def: 0, hp: 0 },
  { type: "weapon", typeName: "무기", name: "용사의 검", atk: 30, def: 0, hp: 0 },
  { type: "armor", typeName: "방어구", name: "천 갑옷", atk: 0, def: 3, hp: 20 },
  { type: "armor", typeName: "방어구", name: "철 갑옷", atk: 0, def: 8, hp: 50 },
  { type: "accessory", typeName: "장신구", name: "작은 반지", atk: 3, def: 1, hp: 10 },
  { type: "accessory", typeName: "장신구", name: "빛나는 목걸이", atk: 8, def: 3, hp: 35 },
];

const buffPool = [
  { type: "buff", typeName: "기간제 버프", name: "공격력 물약", atk: 15, duration: 60 },
  { type: "buff", typeName: "기간제 버프", name: "체력 물약", hp: 50, duration: 60 },
];

const companionPool = [
  { name: "초보 기사", atk: 5, role: "딜러" },
  { name: "숲의 궁수", atk: 8, role: "딜러" },
  { name: "견습 힐러", atk: 3, role: "지원" },
  { name: "광산 관리자", atk: 4, role: "타운" },
];

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : structuredClone(defaultState);
}

function saveState() {
  state.lastSaveAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getStageNumber() {
  return `${state.stage}-${state.subStage}`;
}

function isBossStage() {
  return state.subStage === 5;
}

function getTotalAtk() {
  let atk = state.baseAtk;

  Object.values(state.equipment).forEach(item => {
    if (item) atk += item.atk || 0;
  });

  state.buffs.forEach(buff => {
    atk += buff.atk || 0;
  });

  state.squad.forEach(c => {
    atk += c.atk || 0;
  });

  return atk;
}

function getMaxHp() {
  let hp = state.maxHp;

  Object.values(state.equipment).forEach(item => {
    if (item) hp += item.hp || 0;
  });

  state.buffs.forEach(buff => {
    hp += buff.hp || 0;
  });

  return hp;
}

function createEnemy() {
  const stageValue = state.stage * 5 + state.subStage;

  if (isBossStage()) {
    return {
      name: `보스 거대 멧돼지 ${state.stage}`,
      icon: "🐗",
      maxHp: 180 + stageValue * 45,
      hp: 180 + stageValue * 45,
      atk: 8 + stageValue * 2,
      reward: 80 + stageValue * 12,
      isBoss: true,
    };
  }

  const monsters = [
    { name: "숲 늑대", icon: "🐺" },
    { name: "슬라임", icon: "🟢" },
    { name: "멧돼지", icon: "🐗" },
    { name: "버섯 몬스터", icon: "🍄" },
  ];

  const pick = monsters[Math.floor(Math.random() * monsters.length)];

  return {
    name: pick.name,
    icon: pick.icon,
    maxHp: 40 + stageValue * 18,
    hp: 40 + stageValue * 18,
    atk: 4 + stageValue,
    reward: 15 + stageValue * 4,
    isBoss: false,
  };
}

function startBattle() {
  clearInterval(battleTimer);
  clearInterval(bossTimerInterval);

  state.hp = getMaxHp();
  currentEnemy = createEnemy();

  if (currentEnemy.isBoss) {
    bossTimeLeft = 30;
    bossTimer.classList.remove("hidden");
    bossTimerInterval = setInterval(() => {
      bossTimeLeft--;
      bossTimer.textContent = `남은 시간: ${bossTimeLeft}초`;

      if (bossTimeLeft <= 0) {
        failStage("시간 초과! 보스 공략 실패");
      }
    }, 1000);
  } else {
    bossTimer.classList.add("hidden");
  }

  updateBattleUI();

  battleTimer = setInterval(() => {
    attackEnemy();
  }, 900);
}

function attackEnemy() {
  if (!currentEnemy) return;

  const damage = getTotalAtk();
  currentEnemy.hp -= damage;

  battleLog.textContent = `주인공이 ${currentEnemy.name}에게 ${damage} 피해!`;

  hero.style.left = "190px";
  setTimeout(() => {
    hero.style.left = "36px";
  }, 220);

  if (currentEnemy.hp <= 0) {
    clearInterval(battleTimer);
    clearInterval(bossTimerInterval);
    winStage();
    return;
  }

  state.hp -= Math.max(1, currentEnemy.atk - getDefense());

  if (state.hp <= 0) {
    failStage("체력 부족! 스테이지 공략 실패");
    return;
  }

  updateBattleUI();
}

function getDefense() {
  let def = 0;
  Object.values(state.equipment).forEach(item => {
    if (item) def += item.def || 0;
  });
  return def;
}

function winStage() {
  state.gold += currentEnemy.reward;

  if (isBossStage()) {
    state.stage++;
    state.subStage = 1;
    battleLog.textContent = `보스 클리어! 다음 지역으로 이동`;
  } else {
    state.subStage++;
    battleLog.textContent = `스테이지 클리어! ${currentEnemy.reward}골드 획득`;
  }

  saveState();
  updateAllUI();

  setTimeout(startBattle, 1200);
}

function failStage(reason) {
  clearInterval(battleTimer);
  clearInterval(bossTimerInterval);

  if (state.subStage > 1) {
    state.subStage--;
  }

  battleLog.textContent = `${reason}. 이전 스테이지에서 재화를 모으는 중`;
  saveState();
  updateAllUI();

  setTimeout(startBattle, 1600);
}

function updateBattleUI() {
  stageLabel.textContent = isBossStage()
    ? `Boss ${getStageNumber()}`
    : `Stage ${getStageNumber()}`;

  goldText.textContent = state.gold;
  powerText.textContent = getTotalAtk();

  enemyName.textContent = currentEnemy.name;
  monster.textContent = currentEnemy.icon;

  const hpPercent = Math.max(0, currentEnemy.hp / currentEnemy.maxHp * 100);
  enemyHpFill.style.width = `${hpPercent}%`;
  enemyHpText.textContent = `${Math.max(0, Math.ceil(currentEnemy.hp))} / ${currentEnemy.maxHp} (${Math.ceil(hpPercent)}%)`;

  if (currentEnemy.isBoss) {
    bossTimer.textContent = `남은 시간: ${bossTimeLeft}초`;
  }
}

function updateAllUI() {
  goldText.textContent = state.gold;
  powerText.textContent = getTotalAtk();

  equipmentList.innerHTML = `
    <p>무기: ${formatItem(state.equipment.weapon)}</p>
    <p>방어구: ${formatItem(state.equipment.armor)}</p>
    <p>장신구: ${formatItem(state.equipment.accessory)}</p>
  `;

  buffList.innerHTML = state.buffs.length
    ? state.buffs.map(b => `<p>${b.name} / ${b.duration}초</p>`).join("")
    : "보유 버프 없음";

  collectionList.innerHTML = state.companions.length
    ? state.companions.map(c => `<p>${c.name} / ${c.role} / 공격력 +${c.atk}</p>`).join("")
    : "수집한 동료 없음";

  squadList.innerHTML = state.squad.length
    ? state.squad.map(c => `<p>${c.name} 참여 중</p>`).join("")
    : "스쿼드에 편성된 동료 없음";

  officeName.textContent = `작은 사무실 Lv.${state.officeLevel}`;
  officeVisual.textContent = state.officeLevel >= 3 ? "🏢" : "🏠";

  townCompanions.textContent = state.companions.length
    ? state.companions.slice(0, state.officeLevel).map(c => c.name).join(", ")
    : "없음";
}

function formatItem(item) {
  if (!item) return "없음";
  return `${item.name} / 공격 +${item.atk || 0}, 방어 +${item.def || 0}, 체력 +${item.hp || 0}`;
}

function gatherItem() {
  const isBuff = Math.random() < 0.25;
  const item = isBuff
    ? randomPick(buffPool)
    : randomPick(itemPool);

  if (item.type === "buff") {
    showModal(
      "기간제 버프 획득!",
      `
        <p>${item.name}</p>
        <p>${item.atk ? `공격력 +${item.atk}` : ""}</p>
        <p>${item.hp ? `체력 +${item.hp}` : ""}</p>
      `,
      [
        {
          text: "적용하기",
          action: () => {
            state.buffs.push(item);
            saveState();
            updateAllUI();
            closeModal();
          },
        },
        { text: "드랍하기", action: closeModal },
      ]
    );
    return;
  }

  const current = state.equipment[item.type];

  showModal(
    `${item.typeName} 획득!`,
    `
      <p><strong>획득:</strong> ${formatItem(item)}</p>
      <hr />
      <p><strong>현재:</strong> ${formatItem(current)}</p>
    `,
    [
      {
        text: "적용하기",
        action: () => {
          state.equipment[item.type] = item;
          saveState();
          updateAllUI();
          closeModal();
        },
      },
      { text: "드랍하기", action: closeModal },
    ]
  );
}

function companionGacha() {
  if (state.gold < 100) {
    companionResult.textContent = "골드가 부족합니다.";
    return;
  }

  state.gold -= 100;
  const companion = randomPick(companionPool);
  state.companions.push(companion);

  if (state.squad.length < 3) {
    state.squad.push(companion);
  }

  companionResult.innerHTML = `${companion.name} 획득! / ${companion.role} / 공격력 +${companion.atk}`;
  saveState();
  updateAllUI();
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function showModal(title, content, buttons) {
  modalTitle.textContent = title;
  modalContent.innerHTML = content;
  modalButtons.innerHTML = "";

  buttons.forEach(btn => {
    const button = document.createElement("button");
    button.textContent = btn.text;
    button.onclick = btn.action;
    modalButtons.appendChild(button);
  });

  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(btn.dataset.screen).classList.add("active");

    updateAllUI();
  });
});

document.querySelectorAll(".inner-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".inner-tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".inner-content").forEach(c => c.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(btn.dataset.inner).classList.add("active");
  });
});

itemGatherBtn.addEventListener("click", gatherItem);
companionGachaBtn.addEventListener("click", companionGacha);

offlineRewardBtn.addEventListener("click", () => {
  const now = Date.now();
  const diffMin = Math.floor((now - state.lastSaveAt) / 60000);
  const reward = Math.min(diffMin * 10, 1000);

  state.gold += reward;
  saveState();
  updateAllUI();

  showModal(
    "비접속 보상",
    `<p>${reward}골드를 획득했습니다.</p>`,
    [{ text: "확인", action: closeModal }]
  );
});

upgradeOfficeBtn.addEventListener("click", () => {
  const cost = state.officeLevel * 200;

  if (state.gold < cost) {
    alert("골드가 부족합니다.");
    return;
  }

  state.gold -= cost;
  state.officeLevel++;
  saveState();
  updateAllUI();
});

soundToggleBtn.addEventListener("click", () => {
  state.sound = !state.sound;
  soundToggleBtn.textContent = state.sound ? "ON" : "OFF";
  saveState();
});

resetBtn.addEventListener("click", () => {
  if (!confirm("정말 데이터를 초기화할까요?")) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

updateAllUI();
startBattle();