"use strict";

/**
 * 가상 펫 상태 형태 정의
 * @typedef {Object} PetState
 * @property {number} hunger
 * @property {number} cleanliness
 * @property {number} energy
 * @property {number} fun
 * @property {number} xp
 * @property {number} level
 * @property {number} coins
 * @property {Reward[]} pendingRewards
 */

/**
 * 보상 데이터 형태 정의
 * @typedef {Object} Reward
 * @property {"coins"} type
 * @property {number} amount
 * @property {number} level
 */

// 주요 상태 키 상수 정의
const PRIMARY_STATS = /** @type {const} */ (["hunger", "cleanliness", "energy", "fun"]);
const THEME_STORAGE_KEY = "webPouPrototypeTheme";
const THEME_CLASS_MAP = /** @type {const} */ ({
  classic: "",
  night: "theme--night",
  cotton: "theme--cotton",
});
const EXPRESSION_BODY_CLASSES = /** @type {const} */ ([
  "pet__body--happy",
  "pet__body--neutral",
  "pet__body--tired",
  "pet__body--sad",
]);
const EXPRESSION_FACE_CLASSES = /** @type {const} */ ([
  "pet__face--happy",
  "pet__face--neutral",
  "pet__face--tired",
  "pet__face--sad",
]);

// 로컬 스토리지 키
const STORAGE_KEY = "webPouPrototypeState";

// 보상 규칙
const REWARD_RULES = Object.freeze({
  baseCoins: 60,
  bonusPerLevel: 12,
  reminderDelay: 6000,
});

/**
 * 기본 상태 객체 생성
 * @returns {PetState}
 */
function createDefaultState() {
  return {
    hunger: 75,
    cleanliness: 75,
    energy: 75,
    fun: 75,
    xp: 0,
    level: 1,
    coins: 0,
    pendingRewards: [],
  };
}

// 행동에 따른 변화량 정의
const ACTION_EFFECTS = {
  feed: { hunger: +20, cleanliness: -5, energy: +5, fun: 0 },
  clean: { hunger: -5, cleanliness: +25, energy: -5, fun: 0 },
  play: { hunger: -10, cleanliness: -8, energy: -15, fun: +30 },
  sleep: { hunger: -15, cleanliness: -5, energy: +35, fun: +5 },
};

// 행동에 따른 경험치 보상 정의
const ACTION_XP_REWARD = {
  feed: 12,
  clean: 14,
  play: 22,
  sleep: 10,
};

// 주기적 감소 값
const DECAY_PER_TICK = {
  hunger: -1.2,
  cleanliness: -0.8,
  energy: -0.9,
  fun: -1.1,
};

// 상태 변화 주기(ms)
const TICK_INTERVAL = 4000;

// 경험치 계산 설정
const XP_CONFIG = Object.freeze({
  baseRequired: 120,
  growthRate: 1.18,
  maxLevel: 99,
});

/** @type {PetState} */
let petState = loadState();
let currentTheme = loadTheme();

const barElements = {
  hunger: /** @type {HTMLDivElement} */ (document.getElementById("hungerBar")),
  cleanliness: /** @type {HTMLDivElement} */ (document.getElementById("cleanlinessBar")),
  energy: /** @type {HTMLDivElement} */ (document.getElementById("energyBar")),
  fun: /** @type {HTMLDivElement} */ (document.getElementById("funBar")),
};

const moodTextEl = /** @type {HTMLDivElement} */ (document.getElementById("moodText"));
const actionButtons = document.querySelectorAll(".action-button");
const xpBarEl = /** @type {HTMLDivElement} */ (document.getElementById("xpBar"));
const levelValueEl = /** @type {HTMLSpanElement} */ (document.getElementById("levelValue"));
const xpTextEl = /** @type {HTMLSpanElement} */ (document.getElementById("xpText"));
const themeSelectEl = /** @type {HTMLSelectElement | null} */ (
  document.getElementById("themeSelect")
);
const petFaceEl = /** @type {HTMLDivElement | null} */ (document.querySelector(".pet__face"));
const petBodyEl = /** @type {HTMLDivElement | null} */ (document.querySelector(".pet__body"));
const levelCardEl = /** @type {HTMLDivElement | null} */ (document.querySelector(".level-card"));
const toastEl = /** @type {HTMLDivElement | null} */ (document.getElementById("toast"));

/**
 * 간단한 Web Audio 기반 효과음 관리 클래스
 */
class AudioManager {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.effectMap = {
      feed: { type: "sine", frequency: 420, duration: 0.18, volume: 0.26 },
      clean: { type: "triangle", frequency: 520, duration: 0.22, volume: 0.24 },
      play: { type: "sawtooth", frequency: 660, frequencyEnd: 520, duration: 0.28, volume: 0.22 },
      sleep: { type: "sine", frequency: 320, duration: 0.32, volume: 0.18 },
      levelUp: { type: "triangle", frequency: 660, frequencyEnd: 880, duration: 0.45, volume: 0.3 },
      reward: { type: "sine", frequency: 560, frequencyEnd: 760, duration: 0.34, volume: 0.26 },
    };
  }

  /**
   * 오디오 컨텍스트 초기화
   */
  ensureContext() {
    if (this.context) {
      if (this.context.state === "suspended") {
        this.context.resume().catch(() => {});
      }
      return true;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return false;
    }
    this.context = new AudioCtx();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.18;
    this.masterGain.connect(this.context.destination);
    return true;
  }

  /**
   * 효과음 재생
   * @param {keyof AudioManager["effectMap"]} effectName
   */
  playEffect(effectName) {
    const config = this.effectMap[effectName];
    if (!config) {
      return;
    }
    if (!this.ensureContext() || !this.context || !this.masterGain) {
      return;
    }

    const ctx = this.context;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(config.frequency, now);
    if (config.frequencyEnd) {
      oscillator.frequency.linearRampToValueAtTime(config.frequencyEnd, now + config.duration);
    }

    const volume = config.volume ?? 0.25;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.02);
    gainNode.gain.linearRampToValueAtTime(volume * 0.8, now + config.duration * 0.6);
    gainNode.gain.linearRampToValueAtTime(0.0001, now + config.duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start(now);
    oscillator.stop(now + config.duration + 0.05);
  }
}

const audioManager = new AudioManager();
let rewardQueue = [];
let currentReward = null;
let rewardReminderTimerId = 0;
let blinkTimerId = 0;
let isBlinking = false;

// UI 초기화
applyThemeClass(currentTheme);
syncUI();
bindEvents();
initializeThemeSelector();
startDecayLoop();
initializeRewardSystem();
startIdleAnimations();

/**
 * UI와 상태를 동기화
 */
function syncUI() {
  PRIMARY_STATS.forEach((key) => {
    const value = clamp(petState[key]);
    const el = barElements[key];
    if (!el) {
      return;
    }
    el.style.width = `${value}%`;
    if (value < 25) {
      el.style.filter = "brightness(0.7)";
    } else if (value > 70) {
      el.style.filter = "brightness(1.1)";
    } else {
      el.style.filter = "brightness(1)";
    }
  });

  const average = getStatsAverage();
  moodTextEl.textContent = createMoodMessage(average);
  updateExpressionState(average);
  syncExperienceUI();
  syncInventoryUI();
}

/**
 * 레벨 및 경험치 UI 동기화
 */
function syncExperienceUI() {
  const currentLevel = Math.max(1, Math.min(petState.level, XP_CONFIG.maxLevel));
  const requiredXp = calculateRequiredXp(currentLevel);
  const progressRatio = requiredXp > 0 ? clamp((petState.xp / requiredXp) * 100) : 0;

  if (xpBarEl) {
    xpBarEl.style.width = `${progressRatio}%`;
  }
  if (levelValueEl) {
    levelValueEl.textContent = `Lv. ${currentLevel}`;
  }
  if (xpTextEl) {
    const displayedXp = Math.floor(petState.xp);
    xpTextEl.textContent = `${displayedXp} / ${requiredXp} XP`;
  }
}

/**
 * 인벤토리 UI 동기화
 */
function syncInventoryUI() {
  if (coinValueEl) {
    const coins = Math.max(0, Math.floor(petState.coins));
    coinValueEl.textContent = coins.toLocaleString("ko-KR");
  }
}

/**
 * 버튼 이벤트 묶기
 */
function bindEvents() {
  actionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (!action) {
        return;
      }

      if (action === "reset") {
        resetState();
        return;
      }

      applyAction(action);
    });
  });
}

/**
 * 행동 적용
 * @param {keyof typeof ACTION_EFFECTS} action
 */
function applyAction(action) {
  const effect = ACTION_EFFECTS[action];
  if (!effect) {
    return;
  }

  // 상태 범위 보정
  PRIMARY_STATS.forEach((key) => {
    petState[key] = clamp(petState[key] + (effect[key] ?? 0));
  });

  const xpReward = getActionXpReward(action);
  const experienceResult = xpReward > 0 ? gainExperience(xpReward) : null;

  if (experienceResult) {
    console.info(
      "[MY_LOG] 행동 처리",
      JSON.stringify({
        action,
        xpReward: experienceResult.reward,
        level: experienceResult.level,
        xp: Math.floor(experienceResult.xp),
        leveledUp: experienceResult.leveledUp,
      })
    );
  }

  triggerActionFeedback(action, {
    xpReward,
    leveledUp: Boolean(experienceResult?.leveledUp),
    level: experienceResult?.level ?? petState.level,
    xp: experienceResult?.xp ?? petState.xp,
    levelsGained: experienceResult?.levelsGained ?? 0,
  });

  persistState();
  syncUI();
}

/**
 * 상태 초기화
 */
function resetState() {
  petState = createDefaultState();
  rewardQueue = [];
  currentReward = null;
  petState.pendingRewards = rewardQueue;
  window.clearTimeout(rewardReminderTimerId);
  window.clearTimeout(blinkTimerId);
  isBlinking = false;
  hideToast();
  persistState();
  syncUI();
  scheduleRewardProcessing();
  scheduleBlink();
}

/**
 * 감쇠 루프 시작
 */
function startDecayLoop() {
  window.setInterval(() => {
    let changed = false;

    PRIMARY_STATS.forEach((key) => {
      const nextValue = clamp(petState[key] + DECAY_PER_TICK[key]);
      if (nextValue !== petState[key]) {
        petState[key] = nextValue;
        changed = true;
      }
    });

    if (changed) {
      persistState();
      syncUI();
    }
  }, TICK_INTERVAL);
}

/**
 * 기분 메시지 생성
 * @param {number} [averageValue]
 * @returns {string}
 */
function createMoodMessage(averageValue = getStatsAverage()) {
  const average = averageValue;
  if (average >= 80) {
    return "기분 최고!";
  }
  if (average >= 60) {
    return "괜찮아요.";
  }
  if (average >= 40) {
    return "좀 피곤해 보여요...";
  }
  return "위험해요! 빨리 돌봐주세요!";
}

/**
 * 주요 상태 평균 계산
 * @returns {number}
 */
function getStatsAverage() {
  return (
    PRIMARY_STATS.reduce((acc, key) => acc + petState[key], 0) / PRIMARY_STATS.length
  );
}

/**
 * 표정 상태를 갱신
 * @param {number} average
 */
function updateExpressionState(average) {
  if (!petBodyEl || !petFaceEl) {
    return;
  }

  let bodyClass = "pet__body--happy";
  if (average >= 75) {
    bodyClass = "pet__body--happy";
  } else if (average >= 55) {
    bodyClass = "pet__body--neutral";
  } else if (average >= 35) {
    bodyClass = "pet__body--tired";
  } else {
    bodyClass = "pet__body--sad";
  }

  const faceClass = bodyClass.replace("pet__body", "pet__face");

  EXPRESSION_BODY_CLASSES.forEach((cls) => petBodyEl.classList.remove(cls));
  EXPRESSION_FACE_CLASSES.forEach((cls) => petFaceEl.classList.remove(cls));

  petBodyEl.classList.add(bodyClass);
  petFaceEl.classList.add(faceClass);
}

function initializeThemeSelector() {
  if (themeSelectEl) {
    themeSelectEl.value = currentTheme;
    themeSelectEl.addEventListener("change", (event) => {
      const target = /** @type {HTMLSelectElement} */ (event.target);
      changeTheme(target.value);
    });
  }
}

function changeTheme(themeKey) {
  const normalized = THEME_CLASS_MAP[themeKey] !== undefined ? themeKey : "classic";
  if (normalized === currentTheme) {
    if (themeSelectEl && themeSelectEl.value !== normalized) {
      themeSelectEl.value = normalized;
    }
    return;
  }
  currentTheme = normalized;
  applyThemeClass(currentTheme);
  persistTheme(currentTheme);
}

function applyThemeClass(themeKey) {
  const className = THEME_CLASS_MAP[themeKey] !== undefined ? THEME_CLASS_MAP[themeKey] : "";
  const bodyEl = document.body;
  Object.values(THEME_CLASS_MAP).forEach((value) => {
    if (value) {
      bodyEl.classList.remove(value);
    }
  });
  if (className) {
    bodyEl.classList.add(className);
  }
  if (themeSelectEl && themeSelectEl.value !== themeKey) {
    themeSelectEl.value = themeKey;
  }
}

function loadTheme() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && THEME_CLASS_MAP[stored] !== undefined) {
      return stored;
    }
  } catch (error) {
    console.error("[MY_LOG] 테마 불러오기 오류", error);
  }
  return "classic";
}

function persistTheme(themeKey) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeKey);
  } catch (error) {
    console.error("[MY_LOG] 테마 저장 오류", error);
  }
}

const ACTION_ANIMATION_MAP = {
  feed: "jump",
  clean: "shake",
  play: "jump",
  sleep: "jump",
};

let toastTimerId = 0;

/**
 * 행동별 피드백 연출 실행
 * @param {keyof typeof ACTION_EFFECTS} action
 * @param {{ xpReward: number, leveledUp: boolean, level: number, xp: number, levelsGained: number }} context
 */
function triggerActionFeedback(action, context) {
  const averageStat =
    PRIMARY_STATS.reduce((acc, key) => acc + petState[key], 0) / PRIMARY_STATS.length;
  const animationType = context.leveledUp
    ? "jump"
    : averageStat < 35
    ? "shake"
    : ACTION_ANIMATION_MAP[action] ?? "jump";

  triggerPetAnimation(animationType);
  audioManager.playEffect(action);

  if (context.leveledUp) {
    const levelsGained = Math.max(0, context.levelsGained || 0);
    if (levelsGained > 0) {
      const startLevel = context.level - levelsGained + 1;
      enqueueLevelRewards(startLevel, levelsGained);
    }
    window.setTimeout(() => {
      audioManager.playEffect("levelUp");
    }, 140);
    flashLevelCard();
    scheduleRewardProcessing();
  }
}

/**
 * 펫 애니메이션 트리거
 * @param {"jump" | "shake"} type
 */
function triggerPetAnimation(type) {
  if (!petBodyEl) {
    return;
  }
  const className = type === "shake" ? "pet__body--shake" : "pet__body--jump";
  petBodyEl.classList.remove(className);
  // 강제 리플로우로 애니메이션 재시작
  void petBodyEl.offsetWidth;
  petBodyEl.classList.add(className);
  const handler = () => {
    petBodyEl.classList.remove(className);
    petBodyEl.removeEventListener("animationend", handler);
  };
  petBodyEl.addEventListener("animationend", handler);
}

/**
 * 레벨 카드 반짝임 애니메이션
 */
function flashLevelCard() {
  if (!levelCardEl) {
    return;
  }
  levelCardEl.classList.remove("level-card--flash");
  void levelCardEl.offsetWidth;
  levelCardEl.classList.add("level-card--flash");
}

/**
 * 상시 애니메이션 시작
 */
function startIdleAnimations() {
  if (petBodyEl) {
    petBodyEl.classList.add("pet__body--idle");
  }
  scheduleBlink();
}

/**
 * 눈 깜박임 예약
 * @param {number} [delay]
 */
function scheduleBlink(delay) {
  const fallbackDelay = randomInRange(3200, 6200);
  const timeout = Math.max(160, Math.round(delay ?? fallbackDelay));
  window.clearTimeout(blinkTimerId);
  blinkTimerId = window.setTimeout(() => {
    triggerBlink();
  }, timeout);
}

/**
 * 눈 깜박임 트리거
 */
function triggerBlink() {
  if (!petFaceEl) {
    scheduleBlink();
    return;
  }
  if (isBlinking) {
    return;
  }
  isBlinking = true;
  petFaceEl.classList.add("pet__face--blink");
  window.setTimeout(() => {
    petFaceEl?.classList.remove("pet__face--blink");
    isBlinking = false;
    const wantsDoubleBlink = Math.random() < 0.2;
    if (wantsDoubleBlink) {
      scheduleBlink(randomInRange(200, 360));
    } else {
      scheduleBlink();
    }
  }, 180);
}

/**
 * 범위 내 랜덤 값
 * @param {number} min
 * @param {number} max
 */
function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * 보상 큐 초기화
 */
function initializeRewardSystem() {
  rewardQueue = Array.isArray(petState.pendingRewards)
    ? petState.pendingRewards
    : [];
  petState.pendingRewards = rewardQueue;
  currentReward = null;
  if (toastEl && !toastEl.dataset.listenerBound) {
    toastEl.addEventListener("click", handleToastAction);
    toastEl.dataset.listenerBound = "true";
  }
  if (rewardQueue.length) {
    scheduleRewardProcessing(500);
  }
}

/**
 * 레벨 보상 큐에 추가
 * @param {number} startLevel
 * @param {number} levelsGained
 */
function enqueueLevelRewards(startLevel, levelsGained) {
  if (!Number.isFinite(startLevel) || !Number.isFinite(levelsGained)) {
    return;
  }
  for (let offset = 0; offset < levelsGained; offset += 1) {
    const levelValue = Math.max(1, Math.floor(startLevel + offset));
    const exists = rewardQueue.some(
      (reward) => reward.type === "coins" && reward.level === levelValue
    );
    if (exists) {
      continue;
    }
    const reward = createLevelReward(levelValue);
    rewardQueue.push(reward);
  }
  persistState();
}

/**
 * 레벨에 따른 코인 보상 생성
 * @param {number} level
 */
function createLevelReward(level) {
  const coins =
    REWARD_RULES.baseCoins + Math.max(0, level - 1) * REWARD_RULES.bonusPerLevel;
  return {
    type: "coins",
    amount: Math.max(10, Math.round(coins)),
    level: Math.max(1, Math.floor(level)),
  };
}

/**
 * 보상 큐 처리 예약
 * @param {number} delay
 */
function scheduleRewardProcessing(delay = 360) {
  window.clearTimeout(rewardReminderTimerId);
  rewardReminderTimerId = window.setTimeout(() => {
    processRewardQueue();
  }, delay);
}

/**
 * 보상 큐 처리
 */
function processRewardQueue() {
  if (!toastEl) {
    return;
  }
  if (currentReward || rewardQueue.length === 0) {
    return;
  }
  const reward = rewardQueue[0];
  displayRewardToast(reward);
}

/**
 * 보상 토스트 표시
 * @param {Reward} reward
 */
function displayRewardToast(reward) {
  currentReward = reward;
  showToastMessage({
    title: `레벨 ${reward.level} 보상`,
    description: `코인 ${reward.amount.toLocaleString("ko-KR")}개를 획득할 수 있어요.`,
    actions: [
      { label: "나중에", style: "ghost", action: "later" },
      { label: "보상 받기", style: "primary", action: "claim" },
    ],
    autoHide: false,
  });
}

/**
 * 토스트 메시지 노출
 * @param {{
 *   title: string;
 *   description?: string;
 *   actions?: Array<{ label: string; style?: "primary" | "ghost"; action: string }>;
 *   autoHide?: boolean;
 *   duration?: number;
 * }} config
 */
function showToastMessage(config) {
  if (!toastEl) {
    return;
  }
  window.clearTimeout(toastTimerId);

  const { title, description, actions = [], autoHide = true, duration = 2000 } = config;

  const actionHtml = actions
    .map(
      (action) =>
        `<button type="button" class="toast__button ${
          action.style === "ghost" ? "toast__button--ghost" : "toast__button--primary"
        }" data-toast-action="${action.action}">${action.label}</button>`
    )
    .join("");

  const descriptionHtml = description
    ? `<p class="toast__details">${description}</p>`
    : "";

  toastEl.innerHTML = `
    <div class="toast__body">
      <div class="toast__content">
        <p class="toast__title">${title}</p>
        ${descriptionHtml}
      </div>
      ${
        actions.length
          ? `<div class="toast__actions" data-actions="true">${actionHtml}</div>`
          : ""
      }
    </div>
  `;

  toastEl.classList.add("toast--visible");
  toastEl.dataset.interactive = actions.length ? "true" : "false";

  if (autoHide) {
    toastTimerId = window.setTimeout(() => {
      hideToast();
    }, duration);
  }
}

/**
 * 토스트 숨김 처리
 */
function hideToast() {
  if (!toastEl) {
    return;
  }
  window.clearTimeout(toastTimerId);
  toastEl.classList.remove("toast--visible");
  toastEl.dataset.interactive = "false";
  window.setTimeout(() => {
    if (toastEl && toastEl.dataset.interactive !== "true") {
      toastEl.innerHTML = "";
    }
  }, 220);
}

/**
 * 토스트 액션 클릭 핸들러
 * @param {MouseEvent} event
 */
function handleToastAction(event) {
  const target = /** @type {HTMLElement | null} */ (
    event.target instanceof HTMLElement ? event.target.closest("[data-toast-action]") : null
  );
  if (!target || !toastEl?.contains(target)) {
    return;
  }

  const action = target.dataset.toastAction;
  if (action === "claim") {
    event.preventDefault();
    claimCurrentReward();
  } else if (action === "later") {
    event.preventDefault();
    deferCurrentReward();
  }
}

/**
 * 현재 보상 수령 처리
 */
function claimCurrentReward() {
  if (!currentReward) {
    return;
  }
  const reward = currentReward;
  rewardQueue.shift();
  petState.coins = Math.max(0, Math.floor(petState.coins) + reward.amount);
  currentReward = null;
  persistState();
  syncInventoryUI();
  audioManager.playEffect("reward");
  showToastMessage({
    title: "보상을 획득했어요!",
    description: `코인 ${reward.amount.toLocaleString("ko-KR")}개를 받았습니다.`,
    autoHide: true,
    duration: 1800,
  });
  scheduleRewardProcessing(2200);
}

/**
 * 보상 수령 연기 처리
 */
function deferCurrentReward() {
  if (!currentReward) {
    return;
  }
  hideToast();
  currentReward = null;
  scheduleRewardProcessing(REWARD_RULES.reminderDelay);
}

/**
 * 경험치 보상 조회
 * @param {keyof typeof ACTION_EFFECTS} action
 */
function getActionXpReward(action) {
  if (petState.level >= XP_CONFIG.maxLevel) {
    return 0;
  }

  const baseReward = ACTION_XP_REWARD[action] ?? 0;
  if (baseReward <= 0) {
    return 0;
  }

  const averageStat =
    PRIMARY_STATS.reduce((acc, key) => acc + petState[key], 0) / PRIMARY_STATS.length;
  let multiplier = 1;
  if (averageStat >= 80) {
    multiplier = 1.2;
  } else if (averageStat <= 40) {
    multiplier = 0.7;
  }

  return Math.max(1, Math.round(baseReward * multiplier));
}

/**
 * 경험치 적용 및 레벨업 처리
 * @param {number} amount
 */
function gainExperience(amount) {
  if (amount <= 0 || petState.level >= XP_CONFIG.maxLevel) {
    return null;
  }

  const previousLevel = Math.max(
    1,
    Math.min(Math.floor(petState.level), XP_CONFIG.maxLevel)
  );
  let currentLevel = previousLevel;
  let currentXp = Math.max(0, petState.xp + amount);

  while (currentLevel < XP_CONFIG.maxLevel) {
    const required = calculateRequiredXp(currentLevel);
    if (currentXp < required) {
      break;
    }
    currentXp -= required;
    currentLevel += 1;
  }

  const leveledUp = currentLevel > previousLevel;
  const levelsGained = Math.max(0, currentLevel - previousLevel);

  if (currentLevel >= XP_CONFIG.maxLevel) {
    petState.level = XP_CONFIG.maxLevel;
    petState.xp = 0;
    return {
      level: petState.level,
      xp: petState.xp,
      reward: amount,
      leveledUp,
      levelsGained,
    };
  }

  petState.level = currentLevel;
  petState.xp = currentXp;
  return {
    level: petState.level,
    xp: petState.xp,
    reward: amount,
    leveledUp,
    levelsGained,
  };
}

/**
 * 레벨에 따른 필요 경험치 계산
 * @param {number} level
 */
function calculateRequiredXp(level) {
  const normalizedLevel = Math.max(1, Math.min(level, XP_CONFIG.maxLevel));
  const rawRequired =
    XP_CONFIG.baseRequired * Math.pow(XP_CONFIG.growthRate, normalizedLevel - 1);
  return Math.max(50, Math.round(rawRequired));
}

/**
 * 경험치 데이터를 안전하게 정규화
 * @param {PetState} state
 */
function normalizeExperienceState(state) {
  let normalizedLevel = Math.max(
    1,
    Math.min(Number.isFinite(state.level) ? Math.floor(state.level) : 1, XP_CONFIG.maxLevel)
  );
  let normalizedXp = Math.max(0, Number.isFinite(state.xp) ? state.xp : 0);

  while (normalizedLevel < XP_CONFIG.maxLevel) {
    const required = calculateRequiredXp(normalizedLevel);
    if (normalizedXp < required) {
      break;
    }
    normalizedXp -= required;
    normalizedLevel += 1;
  }

  if (normalizedLevel >= XP_CONFIG.maxLevel) {
    state.level = XP_CONFIG.maxLevel;
    state.xp = 0;
  } else {
    state.level = normalizedLevel;
    state.xp = normalizedXp;
  }
}

/**
 * 상태값을 0~100 사이로 보정
 * @param {number} value
 */
function clamp(value) {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

/**
 * 로컬 스토리지에서 상태 불러오기
 * @returns {PetState}
 */
function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultState();
    }
    const parsed = JSON.parse(raw);
    const xpValue = Number(parsed.xp);
    const levelValue = Number(parsed.level);
    const nextState = {
      hunger: clamp(Number(parsed.hunger)),
      cleanliness: clamp(Number(parsed.cleanliness)),
      energy: clamp(Number(parsed.energy)),
      fun: clamp(Number(parsed.fun)),
      xp: Number.isFinite(xpValue) ? Math.max(0, xpValue) : 0,
      level: Number.isFinite(levelValue) ? levelValue : 1,
      coins: Math.max(0, Number(parsed.coins) || 0),
      pendingRewards: Array.isArray(parsed.pendingRewards)
        ? parsed.pendingRewards
            .map((entry) => ({
              type: entry?.type === "coins" ? "coins" : "coins",
              amount: Math.max(0, Number(entry?.amount) || 0),
              level: Math.max(1, Number(entry?.level) || 1),
            }))
        : [],
    };
    normalizeExperienceState(nextState);
    return nextState;
  } catch (error) {
    console.error("[MY_LOG] 상태 불러오기 중 오류", error);
    return createDefaultState();
  }
}

/**
 * 로컬 스토리지에 상태 저장
 */
function persistState() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(petState));
  } catch (error) {
    console.error("[MY_LOG] 상태 저장 중 오류", error);
  }
}

