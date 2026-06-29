const SAVE_KEY = "gameCompanyIdleV5";
const RECRUIT_COST = 200;
const MAX_SQUAD_SIZE = 3;

const defaultState = {
  gold: 0,
  world: 1,
  stage: 1,
  hp: 100,
  baseAtk: 10,
  sound: true,
  lastSave: Date.now(),
  equipment: {
    weapon: null,
    armor: null,
    accessory: null,
  },
  buff: null,
  ownedTeams: {},
  squad: [null, null, null],
};

let state = JSON.parse(localStorage.getItem(SAVE_KEY)) || structuredClone(defaultState);

state = {
  ...structuredClone(defaultState),
  ...state,
  equipment: {
    ...defaultState.equipment,
    ...(state.equipment || {}),
  },
  ownedTeams: {
    ...(state.ownedTeams || {}),
  },
  squad: Array.isArray(state.squad) ? [...state.squad, null, null, null].slice(0, 3) : [null, null, null],
};

let task = null;
let battleLoop = null;
let bossTimer = null;
let bossTime = 0;

const teamPool = [
  {
    id: "planner",
    icon: "📝",
    job: "기획",
    name: "꼼꼼한 기획자",
    desc: "업무 진행 안정성을 높이는 팀원",
    basePower: 7,
    upgradeCost: 120,
    rarity: "N",
    weight: 35,
  },
  {
    id: "developer",
    icon: "💻",
    job: "개발",
    name: "집중형 개발자",
    desc: "전투 업무력을 크게 올리는 팀원",
    basePower: 12,
    upgradeCost: 220,
    rarity: "R",
    weight: 25,
  },
  {
    id: "artist",
    icon: "🎨",
    job: "아트",
    name: "감각적인 아티스트",
    desc: "프로젝트 완성도를 올리는 팀원",
    basePower: 16,
    upgradeCost: 360,
    rarity: "R",
    weight: 20,
  },
  {
    id: "qa",
    icon: "🧪",
    job: "QA",
    name: "날카로운 QA 담당자",
    desc: "버그 업무 처리에 강한 팀원",
    basePower: 20,
    upgradeCost: 520,
    rarity: "SR",
    weight: 12,
  },
  {
    id: "marketer",
    icon: "📣",
    job: "사업",
    name: "성과형 마케터",
    desc: "비접속 보상 효율이 좋은 팀원",
    basePower: 26,
    upgradeCost: 760,
    rarity: "SR",
    weight: 8,
  },
];

const items = [
  { slot: "weapon", type: "업무장비", name: "낡은 노트북", atk: 5, hp: 0 },
  { slot: "weapon", type: "업무장비", name: "기계식 키보드", atk: 12, hp: 0 },
  { slot: "weapon", type: "업무장비", name: "고성능 개발 PC", atk: 25, hp: 0 },
  { slot: "armor", type: "복장", name: "회사 후드집업", atk: 0, hp: 30 },
  { slot: "armor", type: "복장", name: "편한 사무용 의자", atk: 0, hp: 70 },
  { slot: "accessory", type: "소지품", name: "사원증", atk: 4, hp: 10 },
  { slot: "accessory", type: "소지품", name: "명함지갑", atk: 8, hp: 30 },
];

const buffs = [
  { slot: "buff", type: "버프", name: "아이스 아메리카노", atk: 20, hp: 0 },
  { slot: "buff", type: "버프", name: "박카스", atk: 10, hp: 50 },
  { slot: "buff", type: "버프", name: "볼펜과 메모지", atk: 15, hp: 20 },
  { slot: "buff", type: "버프", name: "야근용 커피", atk: 30, hp: 0 },
];

function save() {
  state.lastSave = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function formatNumber(value) {
  return Math.floor(value).toLocaleString("ko-KR");
}

function getTeam(id) {
  return teamPool.find(team => team.id === id);
}

function getOwnedTeam(id) {
  return state.ownedTeams[id];
}

function isBoss() {
  return state.stage === 5;
}

function equipmentAtk() {
  let atk = state.baseAtk;

  Object.values(state.equipment).forEach(item => {
    if (item) atk += item.atk;
  });

  if (state.buff) atk += state.buff.atk;

  return atk;
}

function teamPower(id) {
  const team = getTeam(id);
  const owned = getOwnedTeam(id);
  if (!team || !owned) return 0;

  return team.basePower * owned.level;
}

function squadPower() {
  return state.squad.reduce((sum, teamId) => {
    if (!teamId) return sum;
    return sum + teamPower(teamId);
  }, 0);
}

function totalAtk() {
  return equipmentAtk() + squadPower();
}

function maxHp() {
  let hp = 100;

  Object.values(state.equipment).forEach(item => {
    if (item) hp += item.hp;
  });

  if (state.buff) hp += state.buff.hp;

  return hp;
}

function offlineRate() {
  return Math.max(5, Math.floor(squadPower() * 0.9 + equipmentAtk() * 0.25));
}

function ownedTeamCount() {
  return Object.keys(state.ownedTeams).length;
}

function getUpgradeCost(teamId) {
  const team = getTeam(teamId);
  const owned = getOwnedTeam(teamId);
  if (!team || !owned) return 0;

  return team.upgradeCost * owned.level;
}

function pickRandomTeam() {
  const totalWeight = teamPool.reduce((sum, team) => sum + team.weight, 0);
  let random = Math.random() * totalWeight;

  for (const team of teamPool) {
    random -= team.weight;
    if (random <= 0) return team;
  }

  return teamPool[0];
}

function makeTask() {
  const level = state.world * 5 + state.stage;

  if (isBoss()) {
    return {
      name: "대형 업데이트 출시",
      icon: "🚀",
      hp: 250 + level * 40,
      maxHp: 250 + level * 40,
      atk: 12 + level * 2,
      reward: 120 + level * 10,
    };
  }

  const pool = [
    ["버그 리포트", "🐞"],
    ["기획서 수정", "📄"],
    ["QA 이슈", "🧪"],
    ["VOC 대응", "💬"],
    ["KPI 분석", "📊"],
  ];

  const pick = pool[Math.floor(Math.random() * pool.length)];

  return {
    name: pick[0],
    icon: pick[1],
    hp: 60 + level * 18,
    maxHp: 60 + level * 18,
    atk: 5 + level,
    reward: 25 + level * 5,
  };
}

function startBattle() {
  clearInterval(battleLoop);
  clearInterval(bossTimer);

  state.hp = maxHp();
  task = makeTask();

  if (isBoss()) {
    bossTime = 30;
    timerText.textContent = `마감 ${bossTime}초`;

    bossTimer = setInterval(() => {
      bossTime--;
      timerText.textContent = `마감 ${bossTime}초`;

      if (bossTime <= 0) {
        failStage("출시 마감 실패");
      }
    }, 1000);
  } else {
    timerText.textContent = "";
  }

  updateUI();
  battleLoop = setInterval(work, 900);
}

function work() {
  hero.classList.add("attack");
  squadInBattle.classList.add("attack");

  setTimeout(() => {
    hero.classList.remove("attack");
    squadInBattle.classList.remove("attack");
  }, 220);

  const damage = totalAtk();
  task.hp -= damage;

  log.textContent = `${task.name} 처리 중! 총 업무력 ${formatNumber(damage)} 적용`;

  if (task.hp <= 0) {
    clearTask();
    return;
  }

  state.hp -= task.atk;

  if (state.hp <= 0) {
    failStage("번아웃");
    return;
  }

  updateUI();
}

function clearTask() {
  clearInterval(battleLoop);
  clearInterval(bossTimer);

  state.gold += task.reward;

  if (isBoss()) {
    state.world++;
    state.stage = 1;
    log.textContent = `출시 성공! 월급 ${formatNumber(task.reward)} 획득`;
  } else {
    state.stage++;
    log.textContent = `업무 완료! 월급 ${formatNumber(task.reward)} 획득`;
  }

  save();
  updateUI();
  setTimeout(startBattle, 1200);
}

function failStage(reason) {
  clearInterval(battleLoop);
  clearInterval(bossTimer);

  if (state.stage > 1) {
    state.stage--;
  } else {
    state.stage = 1;
  }

  log.textContent = `${reason}! 이전 업무에서 월급 파밍`;
  save();
  updateUI();
  setTimeout(startBattle, 1500);
}

function gatherItem() {
  const result = Math.random() < 0.3
    ? buffs[Math.floor(Math.random() * buffs.length)]
    : items[Math.floor(Math.random() * items.length)];

  const current = result.slot === "buff"
    ? state.buff
    : state.equipment[result.slot];

  showModal(
    `${result.type} 획득`,
    `
      <p><b>획득:</b> ${itemText(result)}</p>
      <p><b>현재:</b> ${current ? itemText(current) : "없음"}</p>
    `,
    [
      {
        text: "적용하기",
        action: () => {
          if (result.slot === "buff") {
            state.buff = result;
          } else {
            state.equipment[result.slot] = result;
          }

          closeModal();
          save();
          updateUI();
        },
      },
      {
        text: "드랍하기",
        action: closeModal,
      },
    ]
  );
}

function recruitTeam() {
  if (state.gold < RECRUIT_COST) {
    showModal(
      "월급 부족",
      `<p>팀원 채용에는 월급 ${formatNumber(RECRUIT_COST)}이 필요합니다.</p>`,
      [{ text: "확인", action: closeModal }]
    );
    return;
  }

  const result = pickRandomTeam();
  const alreadyOwned = !!state.ownedTeams[result.id];

  state.gold -= RECRUIT_COST;

  if (alreadyOwned) {
    state.ownedTeams[result.id].level++;
  } else {
    state.ownedTeams[result.id] = {
      level: 1,
      hiredAt: Date.now(),
    };
  }

  save();
  updateUI();

  showModal(
    alreadyOwned ? "중복 팀원 성장" : "신규 팀원 채용",
    `
      <div class="recruit-result">
        <div class="recruit-icon">${result.icon}</div>
        <h3>[${result.rarity}] ${result.name}</h3>
        <p>${result.desc}</p>
        <p><b>${alreadyOwned ? "레벨 +1" : "신규 합류"}</b></p>
      </div>
    `,
    [{ text: "확인", action: closeModal }]
  );
}

function upgradeTeam(teamId) {
  const owned = getOwnedTeam(teamId);
  const team = getTeam(teamId);
  if (!owned || !team) return;

  const cost = getUpgradeCost(teamId);

  if (state.gold < cost) {
    showModal(
      "월급 부족",
      `<p>${team.name} 레벨업에는 월급 ${formatNumber(cost)}이 필요합니다.</p>`,
      [{ text: "확인", action: closeModal }]
    );
    return;
  }

  state.gold -= cost;
  owned.level++;

  save();
  updateUI();
}

function setSquadSlot(slotIndex, teamId) {
  if (!getOwnedTeam(teamId)) return;

  const alreadyIndex = state.squad.indexOf(teamId);
  if (alreadyIndex !== -1) {
    state.squad[alreadyIndex] = null;
  }

  state.squad[slotIndex] = teamId;

  save();
  updateUI();
}

function removeSquadSlot(slotIndex) {
  state.squad[slotIndex] = null;

  save();
  updateUI();
}

function autoSetSquad(teamId) {
  if (!getOwnedTeam(teamId)) return;

  const alreadyIndex = state.squad.indexOf(teamId);
  if (alreadyIndex !== -1) {
    removeSquadSlot(alreadyIndex);
    return;
  }

  const emptyIndex = state.squad.findIndex(slot => slot === null);
  if (emptyIndex === -1) {
    showModal(
      "스쿼드 가득 참",
      `<p>스쿼드는 최대 ${MAX_SQUAD_SIZE}명까지 편성할 수 있습니다.</p><p>기존 슬롯을 해제한 뒤 다시 편성해 주세요.</p>`,
      [{ text: "확인", action: closeModal }]
    );
    return;
  }

  setSquadSlot(emptyIndex, teamId);
}

function claimOfflineReward() {
  const minutes = Math.floor((Date.now() - state.lastSave) / 60000);
  const cappedMinutes = Math.min(minutes, 720);
  const reward = cappedMinutes * offlineRate();

  state.gold += reward;
  save();
  updateUI();

  showModal(
    "비접속 보상",
    `
      <p>비접속 시간: <b>${formatNumber(minutes)}분</b></p>
      <p>적용 시간: <b>${formatNumber(cappedMinutes)}분</b> / 최대 720분</p>
      <p>편성 스쿼드 기준 분당 보상: <b>${formatNumber(offlineRate())}</b></p>
      <p>획득 월급: <b>${formatNumber(reward)}</b></p>
    `,
    [{ text: "확인", action: closeModal }]
  );
}

function itemText(item) {
  return `${item.name} / 업무력 +${item.atk}, 체력 +${item.hp}`;
}

function renderBattleSquad() {
  squadInBattle.innerHTML = "";

  state.squad.forEach(teamId => {
    if (!teamId) return;

    const team = getTeam(teamId);
    if (!team) return;

    const span = document.createElement("span");
    span.textContent = team.icon;
    squadInBattle.appendChild(span);
  });
}

function renderSquadSlots() {
  squadSlots.innerHTML = "";

  state.squad.forEach((teamId, index) => {
    const team = getTeam(teamId);
    const owned = teamId ? getOwnedTeam(teamId) : null;

    const slot = document.createElement("div");
    slot.className = `squad-slot ${team ? "filled" : ""}`;

    slot.innerHTML = team
      ? `
        <div class="slot-icon">${team.icon}</div>
        <div>
          <strong>${team.name}</strong>
          <p>Lv.${owned.level} / 업무력 +${formatNumber(teamPower(team.id))}</p>
        </div>
        <button>해제</button>
      `
      : `
        <div class="slot-icon empty">+</div>
        <div>
          <strong>${index + 1}번 슬롯</strong>
          <p>보유 팀원에서 편성하세요.</p>
        </div>
      `;

    const button = slot.querySelector("button");
    if (button) {
      button.onclick = () => removeSquadSlot(index);
    }

    squadSlots.appendChild(slot);
  });
}

function renderOwnedTeamList() {
  ownedTeamList.innerHTML = "";

  const ownedIds = Object.keys(state.ownedTeams);

  if (ownedIds.length === 0) {
    ownedTeamList.innerHTML = `<p class="empty-text">아직 보유한 팀원이 없습니다. 회사 탭에서 팀원을 채용해보세요.</p>`;
    return;
  }

  ownedIds.forEach(teamId => {
    const team = getTeam(teamId);
    const owned = getOwnedTeam(teamId);
    if (!team || !owned) return;

    const isInSquad = state.squad.includes(teamId);

    const card = document.createElement("article");
    card.className = `owned-team-card ${isInSquad ? "selected" : ""}`;

    card.innerHTML = `
      <div class="team-icon">${team.icon}</div>
      <div class="team-info">
        <strong>[${team.rarity}] ${team.name}</strong>
        <p>${team.job} / Lv.${owned.level} / 업무력 +${formatNumber(teamPower(teamId))}</p>
      </div>
      <button>${isInSquad ? "편성중" : "편성"}</button>
    `;

    card.querySelector("button").onclick = () => autoSetSquad(teamId);
    ownedTeamList.appendChild(card);
  });
}

function renderCompanyTeamList() {
  companyTeamList.innerHTML = "";

  teamPool.forEach(team => {
    const owned = getOwnedTeam(team.id);
    const isOwned = !!owned;
    const level = isOwned ? owned.level : 0;
    const cost = isOwned ? getUpgradeCost(team.id) : RECRUIT_COST;

    const card = document.createElement("article");
    card.className = `team-card ${isOwned ? "owned" : "locked"}`;

    card.innerHTML = `
      <div class="team-main">
        <div class="team-icon">${team.icon}</div>
        <div class="team-info">
          <div class="team-name-row">
            <strong>[${team.rarity}] ${team.name}</strong>
            <span>${isOwned ? `Lv.${level}` : "미보유"}</span>
          </div>
          <p>${team.desc}</p>
          <small>${team.job} / ${isOwned ? `현재 업무력 +${formatNumber(teamPower(team.id))}` : `기본 업무력 +${team.basePower}`}</small>
        </div>
      </div>
      <button class="team-action" ${isOwned ? "" : "disabled"}>
        ${isOwned ? `레벨업 ${formatNumber(cost)}` : "채용 필요"}
      </button>
    `;

    const button = card.querySelector(".team-action");
    if (isOwned) {
      button.onclick = () => upgradeTeam(team.id);
    }

    companyTeamList.appendChild(card);
  });
}

function updateUI() {
  stageText.textContent = isBoss()
    ? `Launch ${state.world}-${state.stage}`
    : `Project ${state.world}-${state.stage}`;

  goldText.textContent = formatNumber(state.gold);
  powerText.textContent = formatNumber(totalAtk());
  hpText.textContent = formatNumber(Math.max(0, state.hp));

  enemyName.textContent = task ? task.name : "";
  enemy.textContent = task ? task.icon : "🐞";

  if (task) {
    const percent = Math.max(0, (task.hp / task.maxHp) * 100);
    enemyHpBar.style.width = `${percent}%`;
    enemyHpText.textContent = `${formatNumber(Math.max(0, Math.ceil(task.hp)))} / ${formatNumber(task.maxHp)} (${Math.ceil(percent)}%)`;
  }

  weaponText.textContent = state.equipment.weapon ? itemText(state.equipment.weapon) : "없음";
  armorText.textContent = state.equipment.armor ? itemText(state.equipment.armor) : "없음";
  accessoryText.textContent = state.equipment.accessory ? itemText(state.equipment.accessory) : "없음";
  buffText.textContent = state.buff ? itemText(state.buff) : "없음";

  squadPowerText.textContent = `업무력 +${formatNumber(squadPower())}`;
  companySquadPowerText.textContent = formatNumber(squadPower());
  ownedCountText.textContent = `${ownedTeamCount()}명`;
  soundBtn.textContent = state.sound ? "ON" : "OFF";

  renderBattleSquad();
  renderSquadSlots();
  renderOwnedTeamList();
  renderCompanyTeamList();
}

function showModal(title, body, actions) {
  modalTitle.textContent = title;
  modalBody.innerHTML = body;
  modalActions.innerHTML = "";

  actions.forEach(action => {
    const button = document.createElement("button");
    button.textContent = action.text;
    button.onclick = action.action;
    modalActions.appendChild(button);
  });

  modal.classList.remove("hidden");
}

function closeModal() {
  modal.classList.add("hidden");
}

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));

    button.classList.add("active");
    document.getElementById(button.dataset.page).classList.add("active");
  });
});

gatherBtn.onclick = gatherItem;
offlineBtn.onclick = claimOfflineReward;
recruitBtn.onclick = recruitTeam;

soundBtn.onclick = () => {
  state.sound = !state.sound;
  save();
  updateUI();
};

resetBtn.onclick = () => {
  if (!confirm("데이터를 초기화할까요?")) return;

  localStorage.removeItem(SAVE_KEY);
  location.reload();
};

updateUI();
startBattle();