const SAVE_KEY = "gameCompanyIdleV2";

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
};

let state = JSON.parse(localStorage.getItem(SAVE_KEY)) || structuredClone(defaultState);

let task = null;
let battleLoop = null;
let bossTimer = null;
let bossTime = 0;

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

function isBoss() {
  return state.stage === 5;
}

function totalAtk() {
  let atk = state.baseAtk;

  Object.values(state.equipment).forEach(item => {
    if (item) atk += item.atk;
  });

  if (state.buff) atk += state.buff.atk;

  return atk;
}

function maxHp() {
  let hp = 100;

  Object.values(state.equipment).forEach(item => {
    if (item) hp += item.hp;
  });

  if (state.buff) hp += state.buff.hp;

  return hp;
}

function makeTask() {
  const level = state.world * 5 + state.stage;

  if (isBoss()) {
    return {
      name: `대형 업데이트 출시`,
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
  setTimeout(() => hero.classList.remove("attack"), 220);

  const damage = totalAtk();
  task.hp -= damage;

  log.textContent = `${task.name} 처리 중! 업무력 ${damage} 적용`;

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
    log.textContent = `출시 성공! 월급 ${task.reward} 획득`;
  } else {
    state.stage++;
    log.textContent = `업무 완료! 월급 ${task.reward} 획득`;
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

function itemText(item) {
  return `${item.name} / 업무력 +${item.atk}, 체력 +${item.hp}`;
}

function updateUI() {
  stageText.textContent = isBoss()
    ? `Launch ${state.world}-${state.stage}`
    : `Project ${state.world}-${state.stage}`;

  goldText.textContent = state.gold;
  powerText.textContent = totalAtk();
  hpText.textContent = Math.max(0, state.hp);

  enemyName.textContent = task ? task.name : "";
  enemy.textContent = task ? task.icon : "🐞";

  if (task) {
    const percent = Math.max(0, (task.hp / task.maxHp) * 100);
    enemyHpBar.style.width = `${percent}%`;
    enemyHpText.textContent = `${Math.max(0, Math.ceil(task.hp))} / ${task.maxHp} (${Math.ceil(percent)}%)`;
  }

  weaponText.textContent = state.equipment.weapon ? itemText(state.equipment.weapon) : "없음";
  armorText.textContent = state.equipment.armor ? itemText(state.equipment.armor) : "없음";
  accessoryText.textContent = state.equipment.accessory ? itemText(state.equipment.accessory) : "없음";
  buffText.textContent = state.buff ? itemText(state.buff) : "없음";

  soundBtn.textContent = state.sound ? "ON" : "OFF";
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

offlineBtn.onclick = () => {
  const minutes = Math.floor((Date.now() - state.lastSave) / 60000);
  const reward = Math.min(minutes * 10, 1000);

  state.gold += reward;
  save();
  updateUI();

  showModal(
    "비접속 보상",
    `<p>비접속 동안 월급 ${reward}을 받았습니다.</p>`,
    [{ text: "확인", action: closeModal }]
  );
};

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