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
const INVENTORY_STORAGE_KEY = "webPouInventoryState";
const THEME_CLASS_MAP = /** @type {const} */ ({
  classic: "",
  night: "theme--night",
  cotton: "theme--cotton",
});
const SHOP_CATEGORIES = /** @type {const} */ ([
  { key: "theme", label: "테마" },
  { key: "head", label: "머리 장식" },
  { key: "background-basic", label: "배경 · 기본" },
  { key: "background-premium", label: "배경 · 프리미엄" },
]);

const SHOP_ITEMS = /** @type {const} */ ([
  {
    id: "theme-night",
    type: "theme",
    category: "theme",
    name: "야간 테마",
    price: 180,
    unlocksTheme: "night",
    thumbnailClass: "thumb--theme-night",
  },
  {
    id: "theme-cotton",
    type: "theme",
    category: "theme",
    name: "코튼캔디",
    price: 240,
    unlocksTheme: "cotton",
    thumbnailClass: "thumb--theme-cotton",
  },
  {
    id: "hat-star",
    type: "accessory",
    slot: "head",
    category: "head",
    name: "별 모자",
    price: 140,
    accessoryClass: "accessory-head--star",
    thumbnailClass: "thumb--hat-star",
    thumbnailEmoji: "★",
  },
  {
    id: "hat-bow",
    type: "accessory",
    slot: "head",
    category: "head",
    name: "리본 모자",
    price: 160,
    accessoryClass: "accessory-head--bow",
    thumbnailClass: "thumb--hat-bow",
    thumbnailEmoji: "🎀",
  },
  {
    id: "bg-sunrise",
    type: "accessory",
    slot: "background",
    category: "background-basic",
    name: "해돋이 하늘",
    price: 140,
    accessoryClass: "accessory-bg--sunrise",
    thumbnailClass: "thumb--bg-sunrise",
    thumbnailEmoji: "☀️",
  },
  {
    id: "bg-forest",
    type: "accessory",
    slot: "background",
    category: "background-basic",
    name: "숲속 산책",
    price: 160,
    accessoryClass: "accessory-bg--forest",
    thumbnailClass: "thumb--bg-forest",
    thumbnailEmoji: "🌲",
  },
  {
    id: "bg-coast",
    type: "accessory",
    slot: "background",
    category: "background-basic",
    name: "바닷가 휴일",
    price: 170,
    accessoryClass: "accessory-bg--coast",
    thumbnailClass: "thumb--bg-coast",
    thumbnailEmoji: "🏝️",
  },
  {
    id: "bg-playroom",
    type: "accessory",
    slot: "background",
    category: "background-basic",
    name: "놀이방",
    price: 180,
    accessoryClass: "accessory-bg--playroom",
    thumbnailClass: "thumb--bg-playroom",
    thumbnailEmoji: "🧸",
  },
  {
    id: "bg-space",
    type: "accessory",
    slot: "background",
    category: "background-premium",
    name: "프리미엄 우주",
    price: 240,
    accessoryClass: "accessory-bg--space",
    thumbnailClass: "thumb--bg-space",
    thumbnailEmoji: "🌌",
  },
  {
    id: "bg-sakura",
    type: "accessory",
    slot: "background",
    category: "background-premium",
    name: "프리미엄 벚꽃",
    price: 260,
    accessoryClass: "accessory-bg--sakura",
    thumbnailClass: "thumb--bg-sakura",
    thumbnailEmoji: "🌸",
  },
]);
const ACCESSORY_CLASS_MAP = /** @type {const} */ ({
  head: {
    "hat-star": "accessory-head--star",
    "hat-bow": "accessory-head--bow",
  },
  background: {
    "bg-sunrise": "accessory-bg--sunrise",
    "bg-forest": "accessory-bg--forest",
    "bg-coast": "accessory-bg--coast",
    "bg-playroom": "accessory-bg--playroom",
    "bg-space": "accessory-bg--space",
    "bg-sakura": "accessory-bg--sakura",
  },
});
const LEGACY_ACCESSORY_MAP = /** @type {const} */ ({
  "bg-balloon": "bg-sunrise",
});
const ACCESSORY_SLOT_LABELS = /** @type {const} */ ({
  head: "머리",
  background: "배경",
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
const ACTION_ANIMATION_MAP = {
  feed: "jump",
  clean: "shake",
  play: "jump",
  sleep: "jump",
};

let toastTimerId = 0;
let rewardQueue = [];
let currentReward = null;
let rewardReminderTimerId = 0;
let blinkTimerId = 0;
let isBlinking = false;
const rhythmGameState = {
  isActive: false,
  totalRounds: 8,
  currentRound: 0,
  hits: 0,
  misses: 0,
  activePad: -1,
  respondWindowId: 0,
  cooldownId: 0,
  allowInput: false,
  timerStart: 0,
  timerDuration: 0,
  timerFrameId: 0,
};

const MINIGAME_TYPES = Object.freeze({
  RHYTHM: "rhythm",
  DODGE: "dodge",
});

let activeMinigameKey = MINIGAME_TYPES.RHYTHM;

const DODGE_CONFIG = Object.freeze({
  timeLimit: 30,
  maxLives: 3,
  playerSpeed: 260, // px per second
  baseSpawnInterval: 1.2, // seconds
  minSpawnInterval: 0.45, // seconds
  spawnAcceleration: 0.015, // seconds reduction per second
  baseFallSpeed: 160, // px per second
  fallAcceleration: 22, // per second
  dropletSize: 42,
  maxDroplets: 6,
  clusterMin: 2,
  clusterMax: 5,
  clusterStagger: 90, // milliseconds between simultaneous spawns
});

const dodgeGameState = {
  isActive: false,
  lives: DODGE_CONFIG.maxLives,
  timeRemaining: DODGE_CONFIG.timeLimit,
  elapsed: 0,
  inputDirection: 0,
  lastTimestamp: 0,
  spawnAccumulator: 0,
  playerX: 0.5,
  playerVelocity: 0,
  droplets: [],
  animationFrameId: 0,
  keyDirections: new Set(),
  startTimestamp: 0,
  gameAreaWidth: 0,
  gameAreaHeight: 0,
  playerWidth: 56,
  playerHeight: 56,
  spawnTimeouts: [],
};

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
let inventoryState = loadInventory();

const barElements = {
  hunger: /** @type {HTMLDivElement} */ (document.getElementById("hungerBar")),
  cleanliness: /** @type {HTMLDivElement} */ (document.getElementById("cleanlinessBar")),
  energy: /** @type {HTMLDivElement} */ (document.getElementById("energyBar")),
  fun: /** @type {HTMLDivElement} */ (document.getElementById("funBar")),
};

const moodTextEl = /** @type {HTMLDivElement} */ (document.getElementById("moodText"));
const actionButtons = document.querySelectorAll("[data-action]");
const xpBarEl = /** @type {HTMLDivElement} */ (document.getElementById("xpBar"));
const levelValueEl = /** @type {HTMLSpanElement} */ (document.getElementById("levelValue"));
const xpTextEl = /** @type {HTMLSpanElement} */ (document.getElementById("xpText"));
const coinValueEl = /** @type {HTMLSpanElement | null} */ (
  document.getElementById("coinValue")
);
const themeSelectEl = /** @type {HTMLSelectElement | null} */ (
  document.getElementById("themeSelect")
);
const shopListEl = /** @type {HTMLDivElement | null} */ (document.getElementById("shopList"));
const shopCoinsEl = /** @type {HTMLSpanElement | null} */ (document.getElementById("shopCoins"));
const accessorySlotsEl = /** @type {HTMLDivElement | null} */ (document.getElementById("accessorySlots"));
const infoTabsEl = /** @type {HTMLDivElement | null} */ (document.querySelector(".info-tabs"));
const infoTabButtons = /** @type {NodeListOf<HTMLButtonElement>} */ (
  document.querySelectorAll(".info-tabs__button")
);
const infoTabPanels = /** @type {NodeListOf<HTMLDivElement>} */ (
  document.querySelectorAll(".info-tabs__panel")
);
const TAB_STORAGE_KEY = "webPouActiveTab";
const minigameOverlayEl = /** @type {HTMLDivElement | null} */ (
  document.getElementById("minigameOverlay")
);
const minigameTabButtons = /** @type {NodeListOf<HTMLButtonElement>} */ (
  document.querySelectorAll(".minigame__tab")
);
const minigamePanels = /** @type {NodeListOf<HTMLElement>} */ (
  document.querySelectorAll(".minigame__panel")
);
const minigamePadsEl = /** @type {HTMLDivElement | null} */ (
  document.getElementById("minigamePads")
);
const minigameStartBtn = /** @type {HTMLButtonElement | null} */ (
  document.getElementById("minigameStart")
);
const minigameGiveUpBtn = /** @type {HTMLButtonElement | null} */ (
  document.getElementById("minigameGiveUp")
);
const minigameCloseBtn = /** @type {HTMLButtonElement | null} */ (
  document.getElementById("minigameClose")
);
const minigameRoundEl = /** @type {HTMLSpanElement | null} */ (
  document.getElementById("minigameRound")
);
const minigameTotalEl = /** @type {HTMLSpanElement | null} */ (
  document.getElementById("minigameTotal")
);
const minigameHitsEl = /** @type {HTMLSpanElement | null} */ (
  document.getElementById("minigameHits")
);
const minigameMissesEl = /** @type {HTMLSpanElement | null} */ (
  document.getElementById("minigameMisses")
);
const minigameProgressEl = /** @type {HTMLDivElement | null} */ (
  document.getElementById("minigameProgress")
);
const minigameTimerFillEl = /** @type {HTMLDivElement | null} */ (
  document.getElementById("minigameTimer")
);
const minigameTimerTextEl = /** @type {HTMLSpanElement | null} */ (
  document.getElementById("minigameTimerText")
);
const dodgeTimeEl = /** @type {HTMLSpanElement | null} */ (
  document.getElementById("dodgeTime")
);
const dodgeLivesEl = /** @type {HTMLSpanElement | null} */ (
  document.getElementById("dodgeLives")
);
const dodgeGameAreaEl = /** @type {HTMLDivElement | null} */ (
  document.getElementById("dodgeGameArea")
);
const dodgePlayerEl = /** @type {HTMLDivElement | null} */ (
  document.getElementById("dodgePlayer")
);
const dodgeStartBtn = /** @type {HTMLButtonElement | null} */ (
  document.getElementById("dodgeStart")
);
const dodgeGiveUpBtn = /** @type {HTMLButtonElement | null} */ (
  document.getElementById("dodgeGiveUp")
);
const dodgeControlLeftBtn = /** @type {HTMLButtonElement | null} */ (
  document.getElementById("dodgeControlLeft")
);
const dodgeControlRightBtn = /** @type {HTMLButtonElement | null} */ (
  document.getElementById("dodgeControlRight")
);
const petFaceEl = /** @type {HTMLDivElement | null} */ (document.querySelector(".pet__face"));
const petBodyEl = /** @type {HTMLDivElement | null} */ (document.querySelector(".pet__body"));
const accessoryHeadEl = /** @type {HTMLDivElement | null} */ (
  document.querySelector(".pet__accessory--head")
);
const accessoryBackgroundEl = /** @type {HTMLDivElement | null} */ (
  document.querySelector(".pet__background")
);
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
  if (shopCoinsEl) {
    shopCoinsEl.textContent = Math.max(0, Math.floor(petState.coins)).toLocaleString("ko-KR");
  }
  applyEquippedAccessories();
  updateThemeSelectOptions();
  renderAccessorySlots();
  renderShopItems();
}

function renderAccessorySlots() {
  if (!accessorySlotsEl) {
    return;
  }
  const slots = Object.keys(ACCESSORY_SLOT_LABELS);
  accessorySlotsEl.innerHTML = "";

  slots.forEach((slotKey) => {
    const slotLabel = ACCESSORY_SLOT_LABELS[slotKey];
    const wrapper = document.createElement("div");
    wrapper.className = "inventory-slot";

    const header = document.createElement("div");
    header.className = "inventory-slot__title";
    const title = document.createElement("span");
    title.textContent = slotLabel;
    const equippedText = document.createElement("span");
    equippedText.className = "inventory-slot__equipped";
    const equippedId = inventoryState.equipped[slotKey];
    if (equippedId) {
      const item = SHOP_ITEMS.find((shopItem) => shopItem.id === equippedId);
      equippedText.textContent = item ? `장착 중: ${item.name}` : "장착 중";
    } else {
      equippedText.textContent = "장착 없음";
    }
    header.appendChild(title);
    header.appendChild(equippedText);

    const itemList = document.createElement("div");
    itemList.className = "inventory-slot__items";

    inventoryState.ownedAccessories
      .map((ownedId) => SHOP_ITEMS.find((shopItem) => shopItem.id === ownedId && shopItem.slot === slotKey))
      .filter(Boolean)
      .forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "inventory-item-button";
        button.textContent = item.name;
        const isEquipped = inventoryState.equipped[slotKey] === item.id;
        if (isEquipped) {
          button.classList.add("is-active");
          button.setAttribute("aria-pressed", "true");
        }
        button.addEventListener("click", () => {
          if (isEquipped) {
            unequipAccessory(slotKey);
          } else {
            equipAccessory(item);
          }
        });
        itemList.appendChild(button);
      });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "inventory-item-button inventory-item-button--remove";
    removeBtn.textContent = "해제";
    removeBtn.disabled = !inventoryState.equipped[slotKey];
    removeBtn.addEventListener("click", () => unequipAccessory(slotKey));
    itemList.appendChild(removeBtn);

    wrapper.appendChild(header);
    wrapper.appendChild(itemList);
    accessorySlotsEl.appendChild(wrapper);
  });
}

function renderShopItems() {
  if (!shopListEl) {
    return;
  }
  shopListEl.innerHTML = "";

  SHOP_CATEGORIES.forEach((category) => {
    const categoryItems = SHOP_ITEMS.filter((item) => item.category === category.key);
    if (categoryItems.length === 0) {
      return;
    }

    const section = document.createElement("section");
    section.className = "shop-category";

    const title = document.createElement("h3");
    title.className = "shop-category__title";
    title.textContent = category.label;
    section.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "shop-category__grid";

    categoryItems.forEach((item) => {
      grid.appendChild(createShopItemCard(item));
    });

    section.appendChild(grid);
    shopListEl.appendChild(section);
  });
}

function createShopItemCard(item) {
  const isTheme = item.type === "theme";
  const isAccessory = item.type === "accessory";
  const alreadyOwned = isItemOwned(item);
  const canAfford = petState.coins >= item.price;

  const wrapper = document.createElement("article");
  wrapper.className = "shop-item";

  const body = document.createElement("div");
  body.className = "shop-item__body";

  const thumb = document.createElement("div");
  thumb.className = `shop-item__thumb ${item.thumbnailClass ?? ""}`;
  if (item.thumbnailEmoji) {
    const emoji = document.createElement("span");
    emoji.className = "shop-item__thumb-emoji";
    emoji.textContent = item.thumbnailEmoji;
    thumb.appendChild(emoji);
  }
  body.appendChild(thumb);

  const info = document.createElement("div");
  info.className = "shop-item__info";

  const title = document.createElement("div");
  title.className = "shop-item__name";
  title.textContent = item.name;
  info.appendChild(title);

  const price = document.createElement("div");
  price.className = "shop-item__price";
  const priceText = `가격 <strong>${item.price.toLocaleString("ko-KR")}</strong>`;
  if (isAccessory && item.slot) {
    const slotLabel = ACCESSORY_SLOT_LABELS[item.slot] ?? "";
    price.innerHTML = `${priceText} <span class="shop-item__slot">슬롯: ${slotLabel}</span>`;
  } else {
    price.innerHTML = priceText;
  }
  info.appendChild(price);

  if (isTheme) {
    const description = document.createElement("div");
    description.className = "shop-item__description";
    description.textContent = "앱 전체 색감을 변경해요.";
    info.appendChild(description);
  } else if (isAccessory && item.slot === "background") {
    const description = document.createElement("div");
    description.className = "shop-item__description";
    description.textContent = "펫이 있는 공간의 분위기를 바꿔요.";
    info.appendChild(description);
  }

  body.appendChild(info);
  wrapper.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "shop-item__actions";

  if (!alreadyOwned) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-button";
    button.textContent = "구매";
    button.disabled = !canAfford;
    if (!canAfford) {
      button.classList.add("action-button--secondary");
      button.textContent = "코인 부족";
    }
    button.addEventListener("click", () => {
      handlePurchase(item);
    });
    actions.appendChild(button);
  } else if (isAccessory && item.slot) {
    const status = document.createElement("span");
    status.className = "shop-item__status";
    const equippedId = inventoryState.equipped[item.slot];
    if (equippedId === item.id) {
      status.textContent = "장착 중";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "action-button action-button--secondary";
      button.textContent = "해제";
      button.addEventListener("click", () => {
        unequipAccessory(item.slot);
      });
      actions.appendChild(status);
      actions.appendChild(button);
    } else {
      status.textContent = "보유 중";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "action-button";
      button.textContent = "장착";
      button.addEventListener("click", () => {
        equipAccessory(item);
      });
      actions.appendChild(status);
      actions.appendChild(button);
    }
  } else {
    const status = document.createElement("span");
    status.className = "shop-item__status";
    status.textContent = "보유 중";
    actions.appendChild(status);
  }

  wrapper.appendChild(actions);
  return wrapper;
}

function handlePurchase(item) {
  if (isItemOwned(item)) {
    return;
  }
  if (petState.coins < item.price) {
    showToastMessage({
      title: "코인이 부족해요!",
      description: "레벨업으로 코인을 더 모아보세요.",
      autoHide: true,
      duration: 2000,
    });
    return;
  }

  petState.coins = Math.max(0, petState.coins - item.price);
  if (item.type === "theme" && item.unlocksTheme) {
    if (!inventoryState.ownedThemes.includes(item.unlocksTheme)) {
      inventoryState.ownedThemes.push(item.unlocksTheme);
    }
    updateThemeSelectOptions();
    showToastMessage({
      title: `${item.name} 획득!`,
      description: "테마 선택에서 적용해 보세요.",
      autoHide: true,
      duration: 2200,
    });
  } else if (item.type === "accessory") {
    if (!inventoryState.ownedAccessories.includes(item.id)) {
      inventoryState.ownedAccessories.push(item.id);
    }
    showToastMessage({
      title: `${item.name} 획득!`,
      description: "장착 버튼으로 적용해 보세요.",
      autoHide: true,
      duration: 2200,
    });
  }

  persistState();
  persistInventory();
  syncInventoryUI();
  syncExperienceUI();
}

function isItemOwned(item) {
  if (item.type === "theme" && item.unlocksTheme) {
    return inventoryState.ownedThemes.includes(item.unlocksTheme);
  }
  if (item.type === "accessory") {
    return inventoryState.ownedAccessories.includes(item.id);
  }
  return false;
}

/**
 * 버튼 이벤트 묶기
 */
function bindEvents() {
  if (!actionButtons) {
    return;
  }
  actionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (!action) {
        return;
      }
      if (action === "play") {
        openMinigame();
        return;
      }
      if (action === "reset") {
        resetState();
        showToastMessage("상태가 초기화되었습니다.");
        triggerPetAnimation("jump");
        return;
      }

      applyAction(action);
    });
  });

  minigamePadsEl?.addEventListener("click", (event) => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (!target || !target.dataset.pad) {
      return;
    }
    handleRhythmPadInput(Number.parseInt(target.dataset.pad, 10));
  });

  minigameStartBtn?.addEventListener("click", () => {
    startRhythmGame();
  });

  minigameGiveUpBtn?.addEventListener("click", () => {
    if (rhythmGameState.isActive) {
      endRhythmGame(false, { showMessage: true });
    }
    closeMinigame();
  });

  minigameCloseBtn?.addEventListener("click", () => {
    stopActiveMinigame();
    closeMinigame();
  });

  dodgeStartBtn?.addEventListener("click", () => {
    startDodgeGame();
  });

  dodgeGiveUpBtn?.addEventListener("click", () => {
    if (dodgeGameState.isActive) {
      endDodgeGame(false, { showMessage: true });
    }
  });

  const handleControlPointer = (direction) => (event) => {
    event.preventDefault();
    if (!dodgeGameState.isActive) {
      return;
    }
    setDodgeInputDirection(direction);
  };

  ["pointerup", "pointerleave", "pointercancel"].forEach((type) => {
    dodgeControlLeftBtn?.addEventListener(type, handleControlPointer(0));
    dodgeControlRightBtn?.addEventListener(type, handleControlPointer(0));
  });
  dodgeControlLeftBtn?.addEventListener("pointerdown", handleControlPointer(-1));
  dodgeControlRightBtn?.addEventListener("pointerdown", handleControlPointer(1));
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
  inventoryState = {
    ownedThemes: ["classic"],
    ownedAccessories: [],
    equipped: { head: null, background: null },
  };
  persistInventory();
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

  applyIntensityVisuals(average);
}

function applyIntensityVisuals(average) {
  const panel = petBodyEl?.closest(".pet-panel");
  if (!panel || !petBodyEl) {
    return;
  }
  panel.classList.remove(
    "intensity-low",
    "intensity-medium",
    "intensity-high",
    "intensity-critical"
  );
  petBodyEl.classList.remove(
    "pet__body--intensity-low",
    "pet__body--intensity-medium",
    "pet__body--intensity-high",
    "pet__body--intensity-critical"
  );

  let intensityClass = "intensity-low";
  let bodyIntensity = "pet__body--intensity-low";
  if (average >= 70) {
    intensityClass = "intensity-low";
    bodyIntensity = "pet__body--intensity-low";
  } else if (average >= 55) {
    intensityClass = "intensity-medium";
    bodyIntensity = "pet__body--intensity-medium";
  } else if (average >= 35) {
    intensityClass = "intensity-high";
    bodyIntensity = "pet__body--intensity-high";
  } else {
    intensityClass = "intensity-critical";
    bodyIntensity = "pet__body--intensity-critical";
  }

  panel.classList.add(intensityClass);
  petBodyEl.classList.add(bodyIntensity);
}

function initializeThemeSelector() {
  if (themeSelectEl) {
    updateThemeSelectOptions();
    themeSelectEl.value = currentTheme;
    themeSelectEl.addEventListener("change", (event) => {
      const target = /** @type {HTMLSelectElement} */ (event.target);
      changeTheme(target.value);
    });
  }
}

function updateThemeSelectOptions() {
  if (!themeSelectEl) {
    return;
  }
  Array.from(themeSelectEl.options).forEach((option) => {
    if (option.value === "classic") {
      option.disabled = false;
      return;
    }
    option.disabled = !inventoryState.ownedThemes.includes(option.value);
  });
}

function changeTheme(themeKey) {
  const normalized = THEME_CLASS_MAP[themeKey] !== undefined ? themeKey : "classic";
  if (!inventoryState.ownedThemes.includes(normalized)) {
    showToastMessage({
      title: "잠금된 테마",
      description: "상점에서 잠금 해제 후 사용해 보세요.",
      autoHide: true,
      duration: 2000,
    });
    if (themeSelectEl) {
      themeSelectEl.value = currentTheme;
    }
    return;
  }
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

function applyEquippedAccessories() {
  if (accessoryHeadEl) {
    accessoryHeadEl.className = "pet__accessory pet__accessory--head";
    const equippedHead = inventoryState.equipped.head;
    if (equippedHead && ACCESSORY_CLASS_MAP.head[equippedHead]) {
      accessoryHeadEl.classList.add(ACCESSORY_CLASS_MAP.head[equippedHead]);
    }
  }
  if (accessoryBackgroundEl) {
    accessoryBackgroundEl.className = "pet__background";
    const equippedBg = inventoryState.equipped.background;
    if (equippedBg && ACCESSORY_CLASS_MAP.background[equippedBg]) {
      accessoryBackgroundEl.classList.add(ACCESSORY_CLASS_MAP.background[equippedBg]);
    }
  }
}

function equipAccessory(item) {
  if (item.type !== "accessory" || !item.slot) {
    return;
  }
  if (!inventoryState.ownedAccessories.includes(item.id)) {
    return;
  }
  inventoryState.equipped[item.slot] = item.id;
  persistInventory();
  applyEquippedAccessories();
  renderAccessorySlots();
  renderShopItems();
  showToastMessage({
    title: `${item.name} 착용!`,
    description: "캐릭터에 적용되었어요.",
    autoHide: true,
    duration: 2000,
  });
}

function unequipAccessory(slot) {
  if (!slot || !inventoryState.equipped[slot]) {
    return;
  }
  inventoryState.equipped[slot] = null;
  persistInventory();
  applyEquippedAccessories();
  renderAccessorySlots();
  renderShopItems();
  showToastMessage({
    title: "장착 해제",
    description: "액세서리를 해제했어요.",
    autoHide: true,
    duration: 1600,
  });
}

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
  const normalizedConfig =
    typeof config === "string"
      ? { title: config, description: undefined, actions: [], autoHide: true, duration: 2000 }
      : config;

  const { title, description, actions = [], autoHide = true, duration = 2000 } = normalizedConfig;

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

function loadInventory() {
  try {
    const raw = window.localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (!raw) {
      return {
        ownedThemes: ["classic"],
        ownedAccessories: [],
        equipped: { head: null, background: null },
      };
    }
    const parsed = JSON.parse(raw);
    const remapAccessory = (id) => {
      if (typeof id !== "string") {
        return id;
      }
      return LEGACY_ACCESSORY_MAP[id] ?? id;
    };
    const normalizedAccessories = Array.isArray(parsed.ownedAccessories)
      ? [...new Set(parsed.ownedAccessories.map(remapAccessory))]
      : [];
    const equippedHead = parsed?.equipped?.head ?? null;
    const equippedBackgroundRaw = parsed?.equipped?.background ?? null;
    const equippedBackground =
      equippedBackgroundRaw !== null ? remapAccessory(equippedBackgroundRaw) : null;
    return {
      ownedThemes: Array.isArray(parsed.ownedThemes)
        ? [...new Set(["classic", ...parsed.ownedThemes])]
        : ["classic"],
      ownedAccessories: normalizedAccessories,
      equipped: {
        head: equippedHead,
        background: equippedBackground,
      },
    };
  } catch (error) {
    console.error("[MY_LOG] 인벤토리 불러오기 오류", error);
    return {
      ownedThemes: ["classic"],
      ownedAccessories: [],
      equipped: { head: null, background: null },
    };
  }
}

function persistInventory() {
  try {
    window.localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventoryState));
  } catch (error) {
    console.error("[MY_LOG] 인벤토리 저장 오류", error);
  }
}

function initializeTabs() {
  if (!infoTabsEl || infoTabButtons.length === 0 || infoTabPanels.length === 0) {
    return;
  }
  const savedTab = loadActiveTab();
  activateTab(savedTab);
  infoTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetTab = button.dataset.tab ?? "status";
      activateTab(targetTab);
    });
  });
}

function activateTab(tabKey) {
  const normalized = ["status", "shop", "inventory"].includes(tabKey)
    ? tabKey
    : "status";
  infoTabButtons.forEach((button) => {
    const isActive = button.dataset.tab === normalized;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  infoTabPanels.forEach((panel) => {
    const isActive = panel.dataset.panel === normalized;
    panel.classList.toggle("is-active", isActive);
    if (isActive) {
      panel.removeAttribute("hidden");
    } else {
      panel.setAttribute("hidden", "");
    }
  });
  persistActiveTab(normalized);
}

function loadActiveTab() {
  try {
    const stored = window.localStorage.getItem(TAB_STORAGE_KEY);
    if (stored && ["status", "shop", "inventory"].includes(stored)) {
      return stored;
    }
  } catch (error) {
    console.error("[MY_LOG] 탭 불러오기 오류", error);
  }
  return "status";
}

function persistActiveTab(tabKey) {
  try {
    window.localStorage.setItem(TAB_STORAGE_KEY, tabKey);
  } catch (error) {
    console.error("[MY_LOG] 활성 탭 저장 오류", error);
  }
}

function initializeMinigameNavigation() {
  if (!minigameOverlayEl) {
    return;
  }
  minigameTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.minigameNav;
      if (key) {
        activateMinigamePanel(key);
      }
    });
  });
  activateMinigamePanel(activeMinigameKey);
}

function activateMinigamePanel(key) {
  const normalized =
    key === MINIGAME_TYPES.DODGE ? MINIGAME_TYPES.DODGE : MINIGAME_TYPES.RHYTHM;
  activeMinigameKey = normalized;
  minigameTabButtons.forEach((button) => {
    const isActive = button.dataset.minigameNav === normalized;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
  minigamePanels.forEach((panel) => {
    const isActive = panel.dataset.minigamePanel === normalized;
    panel.classList.toggle("is-active", isActive);
    if (isActive) {
      panel.removeAttribute("hidden");
    } else {
      panel.setAttribute("hidden", "");
    }
  });
  updateRhythmUI();
  updateDodgeUI();
}

function openMinigame(initialKey) {
  if (!minigameOverlayEl) {
    return;
  }
  activateMinigamePanel(initialKey ?? activeMinigameKey);
  resetRhythmGameState();
  resetDodgeGameState();
  minigameOverlayEl.classList.add("is-active");
  minigameOverlayEl.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeMinigame() {
  if (!minigameOverlayEl) {
    return;
  }
  minigameOverlayEl.classList.remove("is-active");
  minigameOverlayEl.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function stopActiveMinigame() {
  if (rhythmGameState.isActive) {
    endRhythmGame(false, { showMessage: false });
  }
  if (dodgeGameState.isActive) {
    endDodgeGame(false, { showMessage: false });
  }
}

function resetRhythmGameState() {
  rhythmGameState.currentRound = 0;
  rhythmGameState.hits = 0;
  rhythmGameState.misses = 0;
  rhythmGameState.activePad = -1;
  rhythmGameState.respondWindowId = 0;
  rhythmGameState.cooldownId = 0;
  rhythmGameState.allowInput = false;
  rhythmGameState.isActive = false;
  stopRhythmTimer();
  updateRhythmUI();
}

function updateRhythmUI() {
  if (minigameRoundEl) {
    minigameRoundEl.textContent = String(rhythmGameState.currentRound);
  }
  if (minigameTotalEl) {
    minigameTotalEl.textContent = String(rhythmGameState.totalRounds);
  }
  if (minigameHitsEl) {
    minigameHitsEl.textContent = String(rhythmGameState.hits);
  }
  if (minigameMissesEl) {
    minigameMissesEl.textContent = String(rhythmGameState.misses);
  }
  if (minigameProgressEl) {
    const progress = rhythmGameState.totalRounds
      ? (rhythmGameState.currentRound / rhythmGameState.totalRounds) * 100
      : 0;
    minigameProgressEl.style.width = `${progress}%`;
  }
  if (minigameStartBtn) {
    minigameStartBtn.disabled = rhythmGameState.isActive;
  }
  if (minigameGiveUpBtn) {
    minigameGiveUpBtn.disabled = !rhythmGameState.isActive;
  }
  if (minigamePadsEl) {
    const pads = /** @type {NodeListOf<HTMLButtonElement>} */ (
      minigamePadsEl.querySelectorAll(".minigame__pad")
    );
    pads.forEach((pad, index) => {
      pad.classList.toggle("is-target", index === rhythmGameState.activePad);
      pad.disabled = !rhythmGameState.isActive;
    });
  }
}

function clearRhythmTimers() {
  window.clearTimeout(rhythmGameState.respondWindowId);
  window.clearTimeout(rhythmGameState.cooldownId);
  rhythmGameState.respondWindowId = 0;
  rhythmGameState.cooldownId = 0;
  rhythmGameState.allowInput = false;
  stopRhythmTimer();
}

function startRhythmGame() {
  if (rhythmGameState.isActive) {
    return;
  }
  rhythmGameState.isActive = true;
  rhythmGameState.currentRound = 0;
  rhythmGameState.hits = 0;
  rhythmGameState.misses = 0;
  rhythmGameState.activePad = -1;
  rhythmGameState.allowInput = false;
  updateRhythmUI();
  scheduleNextRhythmRound();
}

function scheduleNextRhythmRound() {
  if (!rhythmGameState.isActive) {
    return;
  }
  if (rhythmGameState.currentRound >= rhythmGameState.totalRounds) {
    endRhythmGame(true);
    return;
  }
  rhythmGameState.currentRound += 1;
  rhythmGameState.allowInput = true;
  const pads = /** @type {NodeListOf<HTMLButtonElement>} */ (
    minigamePadsEl?.querySelectorAll(".minigame__pad") ?? []
  );
  const targetIndex = Math.floor(Math.random() * Math.max(pads.length, 1));
  rhythmGameState.activePad = targetIndex;
  pads.forEach((pad, index) => {
    pad.disabled = false;
    pad.classList.toggle("is-target", index === targetIndex);
    pad.classList.remove("is-miss");
  });
  updateRhythmUI();
  const baseWindow = 1300;
  const difficultyStep = 160;
  const reactionWindowMs = Math.max(
    300,
    baseWindow - Math.max(0, rhythmGameState.hits) * difficultyStep
  );
  startRhythmTimer(reactionWindowMs);
  rhythmGameState.respondWindowId = window.setTimeout(() => {
    registerRhythmMiss();
  }, reactionWindowMs);
}

function handleRhythmPadInput(padIndex) {
  if (!rhythmGameState.isActive || !rhythmGameState.allowInput) {
    return;
  }
  const pads = /** @type {NodeListOf<HTMLButtonElement>} */ (
    minigamePadsEl?.querySelectorAll(".minigame__pad") ?? []
  );
  rhythmGameState.allowInput = false;
  window.clearTimeout(rhythmGameState.respondWindowId);
  stopRhythmTimer();
  if (padIndex === rhythmGameState.activePad) {
    rhythmGameState.hits += 1;
    pads[padIndex]?.classList.add("is-target");
    scheduleRhythmCooldown();
  } else {
    rhythmGameState.misses += 1;
    pads[padIndex]?.classList.add("is-miss");
    registerRhythmMiss(true);
  }
  updateRhythmUI();
}

function registerRhythmMiss(fromInput = false) {
  const pads = /** @type {NodeListOf<HTMLButtonElement>} */ (
    minigamePadsEl?.querySelectorAll(".minigame__pad") ?? []
  );
  if (!fromInput) {
    rhythmGameState.misses += 1;
    const targetPad = pads[rhythmGameState.activePad];
    targetPad?.classList.add("is-miss");
  }
  rhythmGameState.allowInput = false;
  stopRhythmTimer();
  updateRhythmUI();
  scheduleRhythmCooldown();
}

function scheduleRhythmCooldown() {
  const pads = /** @type {NodeListOf<HTMLButtonElement>} */ (
    minigamePadsEl?.querySelectorAll(".minigame__pad") ?? []
  );
  rhythmGameState.cooldownId = window.setTimeout(() => {
    pads.forEach((pad) => {
      pad.classList.remove("is-target", "is-miss");
    });
    rhythmGameState.activePad = -1;
    stopRhythmTimer();
    updateRhythmUI();
    scheduleNextRhythmRound();
  }, 450);
}

function startRhythmTimer(durationMs) {
  if (!minigameTimerFillEl) {
    return;
  }
  stopRhythmTimer();
  rhythmGameState.timerDuration = durationMs;
  rhythmGameState.timerStart = performance.now();
  const update = (now) => {
    const elapsed = now - rhythmGameState.timerStart;
    const remaining = Math.max(0, rhythmGameState.timerDuration - elapsed);
    const ratio = rhythmGameState.timerDuration
      ? remaining / rhythmGameState.timerDuration
      : 0;
    minigameTimerFillEl.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    if (minigameTimerTextEl) {
      minigameTimerTextEl.textContent = `${(remaining / 1000).toFixed(1)}s`;
    }
    if (remaining > 0 && rhythmGameState.allowInput) {
      rhythmGameState.timerFrameId = window.requestAnimationFrame(update);
    } else {
      stopRhythmTimer(false);
    }
  };
  minigameTimerFillEl.style.width = "100%";
  if (minigameTimerTextEl) {
    minigameTimerTextEl.textContent = `${(durationMs / 1000).toFixed(1)}s`;
  }
  rhythmGameState.timerFrameId = window.requestAnimationFrame(update);
}

function stopRhythmTimer(resetText = true) {
  window.cancelAnimationFrame(rhythmGameState.timerFrameId);
  rhythmGameState.timerFrameId = 0;
  rhythmGameState.timerDuration = 0;
  if (minigameTimerFillEl) {
    minigameTimerFillEl.style.width = "0%";
  }
  if (minigameTimerTextEl && resetText) {
    minigameTimerTextEl.textContent = "0.0s";
  }
}

function endRhythmGame(completed, options = {}) {
  clearRhythmTimers();
  rhythmGameState.isActive = false;
  updateRhythmUI();
  const { showMessage = true } = options;
  if (!completed) {
    if (showMessage) {
      showToastMessage("미니게임을 중단했어요.");
    }
    return;
  }
  const performanceRatio = rhythmGameState.totalRounds
    ? rhythmGameState.hits / rhythmGameState.totalRounds
    : 0;
  finalizePlayMinigameOutcome("패드 리듬", performanceRatio, true);
  closeMinigame();
}

function resetDodgeGameState() {
  cleanupDodgeGame();
  dodgeGameState.isActive = false;
  dodgeGameState.lives = DODGE_CONFIG.maxLives;
  dodgeGameState.timeRemaining = DODGE_CONFIG.timeLimit;
  dodgeGameState.elapsed = 0;
  dodgeGameState.inputDirection = 0;
  dodgeGameState.lastTimestamp = 0;
  dodgeGameState.spawnAccumulator = 0;
  dodgeGameState.playerX = 0.5;
  dodgeGameState.playerVelocity = 0;
  dodgeGameState.startTimestamp = 0;
  dodgeGameState.keyDirections.clear();
  clearDodgeSpawnTimeouts();
  dodgeGameState.spawnTimeouts = [];
  dodgeGameState.gameAreaWidth = 0;
  dodgeGameState.gameAreaHeight = 0;
  dodgeGameState.playerWidth = 56;
  dodgeGameState.playerHeight = 56;
  updateDodgeUI();
}

function updateDodgeUI() {
  if (dodgeTimeEl) {
    dodgeTimeEl.textContent = `${dodgeGameState.timeRemaining.toFixed(1)}s`;
  }
  if (dodgeLivesEl) {
    const hearts =
      "♥".repeat(dodgeGameState.lives) +
      "♡".repeat(Math.max(0, DODGE_CONFIG.maxLives - dodgeGameState.lives));
    dodgeLivesEl.textContent = hearts;
  }
  if (dodgeStartBtn) {
    dodgeStartBtn.disabled = dodgeGameState.isActive;
  }
  if (dodgeGiveUpBtn) {
    dodgeGiveUpBtn.disabled = !dodgeGameState.isActive;
  }
  if (dodgeControlLeftBtn && dodgeControlRightBtn) {
    dodgeControlLeftBtn.disabled = !dodgeGameState.isActive;
    dodgeControlRightBtn.disabled = !dodgeGameState.isActive;
  }
}

function clearDodgeSpawnTimeouts() {
  dodgeGameState.spawnTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
  dodgeGameState.spawnTimeouts = [];
}

function startDodgeGame() {
  if (dodgeGameState.isActive || !dodgeGameAreaEl || !dodgePlayerEl) {
    return;
  }
  resetDodgeGameState();
  dodgeGameState.isActive = true;
  dodgeGameState.startTimestamp = performance.now();
  dodgeGameState.lastTimestamp = dodgeGameState.startTimestamp;
  dodgeGameState.gameAreaWidth = dodgeGameAreaEl.clientWidth;
  dodgeGameState.gameAreaHeight = dodgeGameAreaEl.clientHeight;
  dodgeGameState.playerWidth = dodgePlayerEl.offsetWidth || 56;
  dodgeGameState.playerHeight = dodgePlayerEl.offsetHeight || 56;
  dodgeGameState.playerX = 0.5;
  dodgePlayerEl.style.left = "50%";
  dodgeGameState.droplets = [];
  dodgeGameState.spawnAccumulator = 0;
  updateDodgeUI();
  window.addEventListener("keydown", handleDodgeKeyDown);
  window.addEventListener("keyup", handleDodgeKeyUp);
  dodgeGameState.animationFrameId = window.requestAnimationFrame(dodgeGameLoop);
}

function handleDodgeKeyDown(event) {
  if (!dodgeGameState.isActive) {
    return;
  }
  if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
    dodgeGameState.keyDirections.add("left");
    setDodgeInputDirection(-1);
    event.preventDefault();
  } else if (
    event.key === "ArrowRight" ||
    event.key === "d" ||
    event.key === "D"
  ) {
    dodgeGameState.keyDirections.add("right");
    setDodgeInputDirection(1);
    event.preventDefault();
  }
}

function handleDodgeKeyUp(event) {
  if (!dodgeGameState.isActive) {
    return;
  }
  if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
    dodgeGameState.keyDirections.delete("left");
  }
  if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
    dodgeGameState.keyDirections.delete("right");
  }
  if (dodgeGameState.keyDirections.has("left")) {
    setDodgeInputDirection(-1);
  } else if (dodgeGameState.keyDirections.has("right")) {
    setDodgeInputDirection(1);
  } else {
    setDodgeInputDirection(0);
  }
}

function setDodgeInputDirection(direction) {
  dodgeGameState.inputDirection = direction;
}

function spawnDodgeDropletCluster() {
  if (!dodgeGameAreaEl) {
    return;
  }
  const capacity = DODGE_CONFIG.maxDroplets - dodgeGameState.droplets.length;
  if (capacity <= 0) {
    return;
  }
  const desiredCount = Math.floor(
    randomInRange(DODGE_CONFIG.clusterMin, DODGE_CONFIG.clusterMax + 1)
  );
  const spawnCount =
    capacity < DODGE_CONFIG.clusterMin
      ? capacity
      : Math.min(capacity, Math.max(DODGE_CONFIG.clusterMin, desiredCount));

  for (let index = 0; index < spawnCount; index += 1) {
    const delay = index * DODGE_CONFIG.clusterStagger;
    const timeoutId = window.setTimeout(() => {
      if (!dodgeGameState.isActive) {
        return;
      }
      createDodgeDroplet();
      dodgeGameState.spawnTimeouts = dodgeGameState.spawnTimeouts.filter(
        (id) => id !== timeoutId
      );
    }, delay);
    dodgeGameState.spawnTimeouts.push(timeoutId);
  }
}

function createDodgeDroplet() {
  if (!dodgeGameAreaEl) {
    return;
  }
  if (dodgeGameState.droplets.length >= DODGE_CONFIG.maxDroplets) {
    return;
  }
  const tentativeWidth = DODGE_CONFIG.dropletSize;
  const tentativeMaxX = Math.max(dodgeGameState.gameAreaWidth - tentativeWidth, 0);
  const x = Math.random() * Math.max(tentativeMaxX, 1);
  const droplet = document.createElement("div");
  droplet.className = "dodge-game__droplet";
  droplet.style.setProperty("--dodge-tilt", `${randomInRange(-6, 6)}deg`);
  droplet.style.left = `${x}px`;
  dodgeGameAreaEl.appendChild(droplet);
  const dropletWidth = droplet.offsetWidth || DODGE_CONFIG.dropletSize;
  const dropletHeight = droplet.offsetHeight || DODGE_CONFIG.dropletSize;
  const adjustedX = Math.min(
    Math.max(0, x),
    Math.max(0, dodgeGameState.gameAreaWidth - dropletWidth)
  );
  droplet.style.left = `${adjustedX}px`;
  dodgeGameState.droplets.push({
    el: droplet,
    x: adjustedX,
    y: -dropletHeight,
    speed: DODGE_CONFIG.baseFallSpeed,
    width: dropletWidth,
    height: dropletHeight,
  });
}

function playDodgeHitEffect(element) {
  element.classList.add("is-hit");
  window.setTimeout(() => element.remove(), 220);
}

function playDodgeMissEffect(element) {
  element.classList.add("is-missed");
  window.setTimeout(() => element.remove(), 320);
}

function dodgeGameLoop(timestamp) {
  if (!dodgeGameState.isActive || !dodgeGameAreaEl || !dodgePlayerEl) {
    return;
  }
  const delta = Math.min((timestamp - dodgeGameState.lastTimestamp) / 1000, 0.05);
  dodgeGameState.lastTimestamp = timestamp;
  dodgeGameState.elapsed = (timestamp - dodgeGameState.startTimestamp) / 1000;
  dodgeGameState.timeRemaining = Math.max(
    0,
    DODGE_CONFIG.timeLimit - dodgeGameState.elapsed
  );

  const playerMargin =
    (dodgeGameState.playerWidth / 2) / Math.max(dodgeGameState.gameAreaWidth, 1);
  const movement =
    dodgeGameState.inputDirection *
    DODGE_CONFIG.playerSpeed *
    delta /
    Math.max(dodgeGameState.gameAreaWidth, 1);
  dodgeGameState.playerX = clamp(
    dodgeGameState.playerX + movement,
    playerMargin,
    1 - playerMargin
  );
  dodgePlayerEl.style.left = `${(dodgeGameState.playerX * 100).toFixed(2)}%`;

  const elapsedSeconds = dodgeGameState.elapsed;
  const spawnInterval = Math.max(
    DODGE_CONFIG.minSpawnInterval,
    DODGE_CONFIG.baseSpawnInterval - elapsedSeconds * DODGE_CONFIG.spawnAcceleration
  );
  dodgeGameState.spawnAccumulator += delta;
  if (dodgeGameState.spawnAccumulator >= spawnInterval) {
    spawnDodgeDropletCluster();
    dodgeGameState.spawnAccumulator = 0;
  }

  const baseFall = DODGE_CONFIG.baseFallSpeed;
  const fallSpeed =
    baseFall + elapsedSeconds * DODGE_CONFIG.fallAcceleration;

  const playerCenterX = dodgeGameState.playerX * dodgeGameState.gameAreaWidth;
  const playerLeft = playerCenterX - dodgeGameState.playerWidth / 2;
  const playerRight = playerCenterX + dodgeGameState.playerWidth / 2;
  const playerBottom = dodgeGameState.gameAreaHeight - 12;
  const playerTop = playerBottom - (dodgeGameState.playerHeight ?? 56);

  dodgeGameState.droplets.forEach((droplet) => {
    droplet.y += fallSpeed * delta;
    droplet.el.style.top = `${droplet.y}px`;
  });

  dodgeGameState.droplets = dodgeGameState.droplets.filter((droplet) => {
    const dropletBottom = droplet.y + droplet.height;
    if (
      dropletBottom >= playerTop &&
      droplet.y <= playerBottom &&
      droplet.x + droplet.width >= playerLeft &&
      droplet.x <= playerRight
    ) {
      playDodgeHitEffect(droplet.el);
      dodgeGameState.lives = Math.max(0, dodgeGameState.lives - 1);
      if (dodgeGameState.lives <= 0) {
        updateDodgeUI();
        endDodgeGame(false, { reason: "hit" });
        return false;
      }
      updateDodgeUI();
      return false;
    }
    if (droplet.y > dodgeGameState.gameAreaHeight) {
      playDodgeMissEffect(droplet.el);
      return false;
    }
    return true;
  });

  updateDodgeUI();

  if (dodgeGameState.timeRemaining <= 0) {
    endDodgeGame(true);
    return;
  }

  dodgeGameState.animationFrameId = window.requestAnimationFrame(dodgeGameLoop);
}

function endDodgeGame(success, options = {}) {
  const { showMessage = true } = options;
  if (!dodgeGameState.isActive) {
    if (showMessage && !success) {
      showToastMessage("미니게임을 중단했어요.");
    }
    return;
  }
  dodgeGameState.isActive = false;
  window.cancelAnimationFrame(dodgeGameState.animationFrameId);
  dodgeGameState.animationFrameId = 0;
  window.removeEventListener("keydown", handleDodgeKeyDown);
  window.removeEventListener("keyup", handleDodgeKeyUp);
  setDodgeInputDirection(0);
  clearDodgeSpawnTimeouts();

  const survivalTime = DODGE_CONFIG.timeLimit - dodgeGameState.timeRemaining;
  const performanceRatio = clamp(survivalTime / DODGE_CONFIG.timeLimit, 0, 1);

  if (!success) {
    if (showMessage) {
      showToastMessage("미니게임을 중단했어요.");
    }
    finalizePlayMinigameOutcome("똥 피하기", performanceRatio, false);
    cleanupDodgeGame();
    closeMinigame();
    return;
  }

  finalizePlayMinigameOutcome("똥 피하기", 1, true);
  cleanupDodgeGame();
  closeMinigame();
}

function cleanupDodgeGame() {
  clearDodgeSpawnTimeouts();
  dodgeGameState.droplets.forEach((droplet) => {
    droplet.el.remove();
  });
  dodgeGameState.droplets = [];
  if (dodgePlayerEl) {
    dodgePlayerEl.style.left = "50%";
  }
  updateDodgeUI();
}

function finalizePlayMinigameOutcome(label, performanceRatio, success) {
  const ratio = clamp(performanceRatio, 0, 1);
  PRIMARY_STATS.forEach((key) => {
    if (key === "fun") {
      return;
    }
    const delta = ACTION_EFFECTS.play[key] ?? 0;
    petState[key] = clamp(petState[key] + delta);
  });

  const funBase = success ? 18 : 12;
  const funReward = clamp(Math.round(funBase + ratio * 16), 0, 32);
  if (funReward > 0) {
    petState.fun = clamp(petState.fun + funReward, 0, 100);
  }

  const coinReward = Math.max(
    0,
    Math.round(ratio * 28 + (success ? 12 : 4))
  );
  if (coinReward > 0) {
    petState.coins += coinReward;
  }

  const baseXp = getActionXpReward("play");
  const xpMultiplierBase = success ? 0.75 : 0.55;
  const xpReward = Math.max(
    1,
    Math.round(baseXp * (xpMultiplierBase + ratio * (success ? 0.7 : 0.5)))
  );
  const experienceResult = xpReward > 0 ? gainExperience(xpReward) : null;
  const leveledUp = Boolean(experienceResult?.leveledUp);

  persistState();
  syncUI();

  triggerActionFeedback("play", {
    xpReward,
    leveledUp,
    level: experienceResult?.level ?? petState.level,
    xp: experienceResult?.xp ?? petState.xp,
    levelsGained: experienceResult?.levelsGained ?? 0,
  });

  const toastText = success
    ? `${label} 성공! 즐거움 +${funReward}, 코인 +${coinReward}`
    : `${label} 종료! 즐거움 +${funReward}, 코인 +${coinReward}`;
  const showToastLater = () => showToastMessage(toastText);
  if (leveledUp) {
    window.setTimeout(showToastLater, 2600);
  } else {
    showToastLater();
  }
}

// 초기 실행
applyThemeClass(currentTheme);
applyEquippedAccessories();
syncUI();
bindEvents();
initializeThemeSelector();
initializeMinigameNavigation();
initializeTabs();
startDecayLoop();
initializeRewardSystem();
startIdleAnimations();

