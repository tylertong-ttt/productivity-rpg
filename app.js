/* =========================================================
   PRODUCTIVITY RPG
   Main Game Engine
========================================================= */


/* =========================================================
   GAME CONFIG
========================================================= */

const GAME_CONFIG = {

    maxHp: 100,

    difficulties: {

        easy: {
            name: "Dễ",
            icon: "🟢",
            exp: 10,
            gold: 1
        },

        medium: {
            name: "Vừa",
            icon: "🟡",
            exp: 20,
            gold: 2
        },

        hard: {
            name: "Khó",
            icon: "🟠",
            exp: 50,
            gold: 6
        },

        extreme: {
            name: "Cực Khó",
            icon: "🔴",
            exp: 100,
            gold: 15
        }

    },


    items: {

        healthPotion: {
            id: "healthPotion",
            name: "Health Potion",
            icon: "🧪",
            cost: 5,
            maxStack: 5,
            description: "Hồi ngay 30 HP.",
            type: "consumable"
        },

        fullElixir: {
            id: "fullElixir",
            name: "Full Elixir",
            icon: "🍶",
            cost: 12,
            maxStack: 2,
            description: "Hồi đầy 100% HP.",
            type: "consumable"
        },

        streakFreeze: {
            id: "streakFreeze",
            name: "Streak Freeze",
            icon: "❄️",
            cost: 25,
            maxStack: 2,
            description: "Bảo vệ Streak khi bỏ lỡ 1 ngày.",
            type: "passive"
        },

        tomeWisdom: {
            id: "tomeWisdom",
            name: "Tome of Wisdom",
            icon: "📖",
            cost: 25,
            maxStack: 2,
            description: "x2 EXP đến 23:59 hôm nay.",
            type: "buff"
        },

        midasTouch: {
            id: "midasTouch",
            name: "Midas Touch",
            icon: "✨",
            cost: 35,
            maxStack: 2,
            description: "x2 Gold đến 23:59 hôm nay.",
            type: "buff"
        },

        focusIncense: {
            id: "focusIncense",
            name: "Focus Incense",
            icon: "🕯️",
            cost: 10,
            maxStack: 3,
            description: "+5 EXP mỗi Pomodoro đến 23:59.",
            type: "buff"
        },

        rerollDice: {
            id: "rerollDice",
            name: "Reroll Dice",
            icon: "🎲",
            cost: 15,
            maxStack: 3,
            description: "Cho phép reroll phần thưởng rương.",
            type: "special"
        },

        soulShield: {
            id: "soulShield",
            name: "Soul Shield",
            icon: "🛡️",
            cost: 20,
            maxStack: 2,
            description: "Chặn 1 lần phạt HP do Deadline.",
            type: "passive"
        }

    }

};


/* =========================================================
   DEFAULT STATE
========================================================= */

const DEFAULT_STATE = {

    profile: {

        name: "Hero",

        avatar:
            "https://api.dicebear.com/9.x/adventurer/svg?seed=Hero",

        background: "",

        hp: 100,

        level: 1,

        exp: 0,

        gold: 0,

        streak: 0,

        lastActivityDate: null,

        lastDailyResetDate: null,

        todayExp: 0,

        todayTasks: 0,

        todayPomodoros: 0

    },


    tasks: [],


    inventory: {},


    customRewards: [],


    achievements: [],


    chests: {

        wood: 0,

        silver: 0,

        gold: 0

    },


    buffs: {

        expMultiplierUntil: null,

        goldMultiplierUntil: null,

        focusIncenseUntil: null,

        focusIncenseStacks: 0

    },


    statistics: {

        totalTasksCompleted: 0,

        totalPomodoros: 0,

        totalExpEarned: 0,

        totalGoldEarned: 0

    }

};


/* =========================================================
   STATE
========================================================= */

let state = loadState();

let currentTaskFilter = "all";

let pomodoroMode = "focus";

let pomodoroRunning = false;

let pomodoroTargetEndTime = null;

let pomodoroInterval = null;


/* =========================================================
   STORAGE
========================================================= */

function cloneDefaultState() {

    return JSON.parse(
        JSON.stringify(DEFAULT_STATE)
    );

}


function loadState() {

    try {

        const saved =
            localStorage.getItem(
                "productivityRPGState"
            );

        if (!saved) {

            return cloneDefaultState();

        }

        const parsed =
            JSON.parse(saved);

        return mergeObjects(
            cloneDefaultState(),
            parsed
        );

    } catch (error) {

        console.error(error);

        return cloneDefaultState();

    }

}


function mergeObjects(base, incoming) {

    if (
        typeof base !== "object" ||
        base === null
    ) {
        return incoming;
    }

    const result = Array.isArray(base)
        ? [...base]
        : { ...base };

    for (const key in incoming) {

        if (
            incoming[key] &&
            typeof incoming[key] === "object" &&
            !Array.isArray(incoming[key]) &&
            typeof result[key] === "object" &&
            result[key] !== null
        ) {

            result[key] =
                mergeObjects(
                    result[key],
                    incoming[key]
                );

        } else {

            result[key] =
                incoming[key];

        }

    }

    return result;

}


function saveState() {

    localStorage.setItem(
        "productivityRPGState",
        JSON.stringify(state)
    );

}


/* =========================================================
   DATE HELPERS
========================================================= */

function dateKey(date = new Date()) {

    const y =
        date.getFullYear();

    const m =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const d =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${y}-${m}-${d}`;

}


function endOfToday() {

    const date =
        new Date();

    date.setHours(
        23,
        59,
        59,
        999
    );

    return date.getTime();

}


function isYesterday(dateString) {

    if (!dateString) {

        return false;

    }

    const yesterday =
        new Date();

    yesterday.setDate(
        yesterday.getDate() - 1
    );

    return dateKey(yesterday) ===
        dateString;

}


/* =========================================================
   DAILY SYSTEM
========================================================= */

function processDailySystems() {

    const today =
        dateKey();

    const lastReset =
        state.profile.lastDailyResetDate;


    if (lastReset === today) {

        checkMissedDay();

        return;

    }


    /*
       Reset daily task completion
    */

    if (lastReset !== today) {

        state.tasks.forEach(task => {

            if (task.isDaily) {

                task.isCompleted = false;

                task.completedAt = null;

                task.rewardClaimed = false;

            }

        });

    }


    /*
       Reset today's counters
    */

    state.profile.todayExp = 0;

    state.profile.todayTasks = 0;

    state.profile.todayPomodoros = 0;


    /*
       Daily buffs expire automatically
    */

    if (
        state.buffs.expMultiplierUntil &&
        Date.now() >
            state.buffs.expMultiplierUntil
    ) {

        state.buffs.expMultiplierUntil =
            null;

    }


    if (
        state.buffs.goldMultiplierUntil &&
        Date.now() >
            state.buffs.goldMultiplierUntil
    ) {

        state.buffs.goldMultiplierUntil =
            null;

    }


    if (
        state.buffs.focusIncenseUntil &&
        Date.now() >
            state.buffs.focusIncenseUntil
    ) {

        state.buffs.focusIncenseUntil =
            null;

        state.buffs.focusIncenseStacks =
            0;

    }


    state.profile.lastDailyResetDate =
        today;


    saveState();

    checkMissedDay();

}


function checkMissedDay() {

    const today =
        dateKey();

    const lastActivity =
        state.profile.lastActivityDate;


    if (!lastActivity) {

        return;

    }


    if (lastActivity === today) {

        return;

    }


    if (isYesterday(lastActivity)) {

        /*
           Player has not worked today yet.
           We don't punish immediately.
           The daily penalty is handled
           when the new day actually passes.
        */

        return;

    }

}


/* =========================================================
   HP
========================================================= */

function damageHp(amount, reason = "") {

    state.profile.hp =
        Math.max(
            0,
            state.profile.hp - amount
        );


    showToast(
        `❤️ -${amount} HP${reason ? " — " + reason : ""}`,
        "danger"
    );


    if (
        state.profile.hp <= 0
    ) {

        faintCharacter();

    }

}


function healHp(amount) {

    const oldHp =
        state.profile.hp;

    state.profile.hp =
        Math.min(
            GAME_CONFIG.maxHp,
            state.profile.hp + amount
        );

    const healed =
        state.profile.hp - oldHp;

    showToast(
        `💚 +${healed} HP`,
        "success"
    );

}


function faintCharacter() {

    const currentGold =
        state.profile.gold;

    let penalty =
        Math.floor(
            currentGold * 0.20
        );


    if (currentGold > 0) {

        penalty =
            Math.max(
                10,
                penalty
            );

        penalty =
            Math.min(
                penalty,
                currentGold
            );

    }


    state.profile.gold =
        Math.max(
            0,
            currentGold - penalty
        );

    state.profile.hp = 50;


    showToast(
        `💀 Kiệt sức! Mất ${penalty} Gold và hồi phục về 50 HP.`,
        "danger"
    );

}


/* =========================================================
   LEVEL SYSTEM
========================================================= */

function getExpRequired(level) {

    if (level >= 50) {

        return 500;

    }

    if (level >= 10) {

        return 300;

    }

    return 100;

}


function addExp(amount, source = "") {

    let multiplier = 1;


    if (
        state.buffs.expMultiplierUntil &&
        Date.now() <
            state.buffs.expMultiplierUntil
    ) {

        multiplier *= 2;

    }


    const finalAmount =
        Math.floor(
            amount * multiplier
        );


    state.profile.exp +=
        finalAmount;

    state.profile.todayExp +=
        finalAmount;

    state.statistics.totalExpEarned +=
        finalAmount;


    if (multiplier > 1) {

        showToast(
            `⭐ +${finalAmount} EXP (x2)`,
            "success"
        );

    } else {

        showToast(
            `⭐ +${finalAmount} EXP`,
            "success"
        );

    }


    checkLevelUp();

}


function checkLevelUp() {

    let leveledUp = false;


    while (
        state.profile.exp >=
        getExpRequired(
            state.profile.level
        )
    ) {

        const required =
            getExpRequired(
                state.profile.level
            );

        state.profile.exp -=
            required;

        state.profile.level++;

        leveledUp = true;


        /*
           Wooden chest every level
        */

        state.chests.wood++;


        /*
           Silver chest every level
           divisible by 5
        */

        if (
            state.profile.level % 5 === 0
        ) {

            state.chests.silver++;

        }


        showToast(
            `🎉 LEVEL UP! Bạn đã đạt Level ${state.profile.level}!`,
            "success"
        );

    }


    if (leveledUp) {

        confettiBurst();

    }

}


/* =========================================================
   GOLD
========================================================= */

function addGold(amount, source = "") {

    let multiplier = 1;


    if (
        state.buffs.goldMultiplierUntil &&
        Date.now() <
            state.buffs.goldMultiplierUntil
    ) {

        multiplier *= 2;

    }


    const finalAmount =
        Math.floor(
            amount * multiplier
        );


    state.profile.gold +=
        finalAmount;

    state.statistics.totalGoldEarned +=
        finalAmount;


    showToast(
        `🪙 +${finalAmount} Gold`,
        "gold"
    );

}


/* =========================================================
   STREAK
========================================================= */

function registerActivity() {

    const today =
        dateKey();

    const last =
        state.profile.lastActivityDate;


    if (last === today) {

        return;

    }


    if (!last) {

        state.profile.streak = 1;

    } else if (
        isYesterday(last)
    ) {

        state.profile.streak++;

    } else {

        /*
           Missed one or more days.
           Check for Streak Freeze.
        */

        const freezes =
            getInventoryCount(
                "streakFreeze"
            );

        if (freezes > 0) {

            removeInventoryItem(
                "streakFreeze",
                1
            );

            showToast(
                "❄️ Streak Freeze đã bảo vệ chuỗi!",
                "success"
            );

            /*
               Keep streak.
            */

        } else {

            state.profile.streak = 1;

            showToast(
                "🔥 Streak bắt đầu lại từ 1.",
                "warning"
            );

        }

    }


    state.profile.lastActivityDate =
        today;


    checkStreakMilestone();

}


function checkStreakMilestone() {

    const streak =
        state.profile.streak;


    if (
        streak === 21 ||
        streak === 50 ||
        (
            streak >= 100 &&
            (streak - 100) % 50 === 0
        )
    ) {

        state.chests.gold++;

        confettiBurst();

        showToast(
            `👑 Streak ${streak}! Bạn nhận được Rương Vàng!`,
            "gold"
        );

    }

}


/* =========================================================
   TASKS
========================================================= */

function createTask(event) {

    event.preventDefault();


    const title =
        document
            .getElementById("taskTitle")
            .value
            .trim();

    const difficulty =
        document
            .getElementById("taskDifficulty")
            .value;

    const deadline =
        document
            .getElementById("taskDeadline")
            .value;

    const isDaily =
        document
            .getElementById("taskDaily")
            .checked;


    if (!title) {

        return;

    }


    const task = {

        id:
            generateId(),

        title,

        difficulty,

        deadline:
            deadline || null,

        isDaily,

        isCompleted:
            false,

        rewardClaimed:
            false,

        deadlinePenaltyApplied:
            false,

        createdAt:
            new Date().toISOString(),

        completedAt:
            null

    };


    state.tasks.unshift(task);

    saveState();

    renderAll();

    event.target.reset();


    showToast(
        "📋 Đã tạo nhiệm vụ!",
        "success"
    );

}


function completeTask(taskId) {

    const task =
        state.tasks.find(
            t => t.id === taskId
        );


    if (!task) {

        return;

    }


    if (task.isCompleted) {

        return;

    }


    const difficulty =
        GAME_CONFIG
            .difficulties[
                task.difficulty
            ];


    task.isCompleted = true;

    task.rewardClaimed = true;

    task.completedAt =
        new Date().toISOString();


    addExp(
        difficulty.exp,
        "task"
    );

    addGold(
        difficulty.gold,
        "task"
    );


    state.profile.todayTasks++;

    state.statistics.totalTasksCompleted++;


    registerActivity();

    saveState();

    renderAll();


    confettiSmall();

}


function deleteTask(taskId) {

    const index =
        state.tasks.findIndex(
            t => t.id === taskId
        );


    if (index === -1) {

        return;

    }


    state.tasks.splice(index, 1);

    saveState();

    renderAll();


    showToast(
        "🗑 Đã xóa nhiệm vụ.",
        "warning"
    );

}


function checkDeadlinePenalties() {

    const now =
        Date.now();


    state.tasks.forEach(task => {

        if (
            task.isCompleted ||
            !task.deadline ||
            task.deadlinePenaltyApplied
        ) {

            return;

        }


        const deadlineTime =
            new Date(
                task.deadline
            ).getTime();


        if (
            now > deadlineTime
        ) {

            /*
               Soul Shield
            */

            const shields =
                getInventoryCount(
                    "soulShield"
                );


            if (shields > 0) {

                removeInventoryItem(
                    "soulShield",
                    1
                );

                task.deadlinePenaltyApplied =
                    true;

                showToast(
                    `🛡️ Soul Shield đã chặn phạt Deadline: ${task.title}`,
                    "success"
                );

            } else {

                damageHp(
                    15,
                    `Deadline: ${task.title}`
                );

                task.deadlinePenaltyApplied =
                    true;

            }

        }

    });


    saveState();

}


/* =========================================================
   POMODORO
========================================================= */

const POMODORO_DURATIONS = {

    focus: 25 * 60 * 1000,

    short: 5 * 60 * 1000,

    long: 15 * 60 * 1000

};


function setPomodoroMode(mode) {

    if (pomodoroRunning) {

        showToast(
            "⏸ Hãy dừng Pomodoro trước khi đổi chế độ.",
            "warning"
        );

        return;

    }


    pomodoroMode = mode;


    document
        .querySelectorAll(
            ".pomodoro-mode"
        )
        .forEach(
            button =>
                button.classList.remove(
                    "active"
                )
        );


    const button =
        document.getElementById(
            mode === "focus"
                ? "modeFocus"
                : mode === "short"
                    ? "modeShort"
                    : "modeLong"
        );


    button.classList.add("active");


    resetPomodoro();

}


function togglePomodoro() {

    if (pomodoroRunning) {

        pausePomodoro();

    } else {

        startPomodoro();

    }

}


function startPomodoro() {

    if (!pomodoroTargetEndTime) {

        pomodoroTargetEndTime =
            Date.now() +
            POMODORO_DURATIONS[
                pomodoroMode
            ];

    }


    pomodoroRunning = true;


    document
        .getElementById(
            "pomodoroStart"
        )
        .textContent =
            "⏸ Tạm dừng";


    document
        .getElementById(
            "pomodoroStatus"
        )
        .textContent =
            pomodoroMode === "focus"
                ? "🔥 Đang tập trung..."
                : "☕ Đang nghỉ...";


    clearInterval(
        pomodoroInterval
    );


    pomodoroInterval =
        setInterval(
            updatePomodoroTimer,
            250
        );


    updatePomodoroTimer();

}


function pausePomodoro() {

    pomodoroRunning = false;


    clearInterval(
        pomodoroInterval
    );


    document
        .getElementById(
            "pomodoroStart"
        )
        .textContent =
            "▶ Tiếp tục";


    document
        .getElementById(
            "pomodoroStatus"
        )
        .textContent =
            "⏸ Đã tạm dừng";


    /*
       Preserve remaining duration
       by converting target time
       into a new future target.
    */

    if (pomodoroTargetEndTime) {

        const remaining =
            Math.max(
                0,
                pomodoroTargetEndTime -
                Date.now()
            );

        pomodoroTargetEndTime =
            Date.now() +
            remaining;

    }

}


function resetPomodoro() {

    pomodoroRunning = false;

    clearInterval(
        pomodoroInterval
    );

    pomodoroTargetEndTime =
        null;


    const duration =
        POMODORO_DURATIONS[
            pomodoroMode
        ];


    updateTimerDisplay(
        duration
    );


    document
        .getElementById(
            "pomodoroStart"
        )
        .textContent =
            "▶ Bắt đầu";


    document
        .getElementById(
            "pomodoroStatus"
        )
        .textContent =
            "Sẵn sàng tập trung?";

}


function updatePomodoroTimer() {

    if (!pomodoroTargetEndTime) {

        return;

    }


    const remaining =
        Math.max(
            0,
            pomodoroTargetEndTime -
            Date.now()
        );


    updateTimerDisplay(
        remaining
    );


    if (remaining <= 0) {

        finishPomodoro();

    }

}


function updateTimerDisplay(
    milliseconds
) {

    const totalSeconds =
        Math.ceil(
            milliseconds / 1000
        );


    const minutes =
        Math.floor(
            totalSeconds / 60
        );

    const seconds =
        totalSeconds % 60;


    document
        .getElementById(
            "pomodoroTimer"
        )
        .textContent =
            `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

}


function finishPomodoro() {

    clearInterval(
        pomodoroInterval
    );


    pomodoroRunning = false;


    const completedMode =
        pomodoroMode;


    pomodoroTargetEndTime =
        null;


    document
        .getElementById(
            "pomodoroStart"
        )
        .textContent =
            "▶ Bắt đầu";


    if (
        completedMode === "focus"
    ) {

        /*
           Base:
           10 + (Level - 1)
        */

        let exp =
            10 +
            (
                state.profile.level - 1
            );


        /*
           Focus Incense
        */

        if (
            state.buffs.focusIncenseUntil &&
            Date.now() <
                state.buffs.focusIncenseUntil
        ) {

            exp += 5;

        }


        addExp(
            exp,
            "pomodoro"
        );

        addGold(
            1,
            "pomodoro"
        );


        state.profile.todayPomodoros++;

        state.statistics.totalPomodoros++;


        registerActivity();


        showToast(
            "🔔 Pomodoro hoàn thành! Phần thưởng đã nhận.",
            "success"
        );


        confettiSmall();


    } else {

        showToast(
            completedMode === "short"
                ? "☕ Nghỉ ngắn hoàn thành!"
                : "🌙 Nghỉ dài hoàn thành!",
            "success"
        );

    }


    saveState();

    renderAll();

}


/* =========================================================
   INVENTORY
========================================================= */

function getInventoryCount(itemId) {

    return state.inventory[itemId] || 0;

}


function addInventoryItem(
    itemId,
    amount = 1
) {

    const item =
        GAME_CONFIG.items[
            itemId
        ];


    if (!item) {

        return false;

    }


    const current =
        getInventoryCount(
            itemId
        );


    const next =
        Math.min(
            item.maxStack,
            current + amount
        );


    const added =
        next - current;


    state.inventory[itemId] =
        next;


    if (added < amount) {

        showToast(
            `🎒 Kho đầy: chỉ nhận thêm ${added}.`,
            "warning"
        );

    }


    return added > 0;

}


function removeInventoryItem(
    itemId,
    amount = 1
) {

    const current =
        getInventoryCount(
            itemId
        );


    if (
        current < amount
    ) {

        return false;

    }


    state.inventory[itemId] =
        current - amount;


    if (
        state.inventory[itemId] <= 0
    ) {

        delete state.inventory[itemId];

    }


    return true;

}


/* =========================================================
   SHOP
========================================================= */

function renderShop() {

    const container =
        document.getElementById(
            "shopList"
        );


    if (!container) {

        return;

    }


    container.innerHTML =
        Object.values(
            GAME_CONFIG.items
        )
        .map(item => {

            const owned =
                getInventoryCount(
                    item.id
                );


            return `

                <div class="shop-item">

                    <div class="shop-icon">
                        ${item.icon}
                    </div>

                    <h3 class="font-bold mt-3">
                        ${item.name}
                    </h3>

                    <p class="text-xs text-white/45 mt-2 min-h-[40px]">
                        ${item.description}
                    </p>

                    <div class="flex justify-between items-center mt-4">

                        <span class="shop-cost">
                            🪙 ${item.cost}
                        </span>

                        <span class="stack-badge">
                            x${owned}/${item.maxStack}
                        </span>

                    </div>

                    <button
                        onclick="buyItem('${item.id}')"
                        class="primary-button w-full mt-3"
                        ${owned >= item.maxStack ? "disabled" : ""}
                    >
                        ${owned >= item.maxStack
                            ? "Đã đầy"
                            : "Mua"}
                    </button>

                </div>

            `;

        })
        .join("");


    document
        .getElementById(
            "shopGold"
        )
        .textContent =
            state.profile.gold;

}


function buyItem(itemId) {

    const item =
        GAME_CONFIG.items[
            itemId
        ];


    if (!item) {

        return;

    }


    const owned =
        getInventoryCount(
            itemId
        );


    if (
        owned >= item.maxStack
    ) {

        showToast(
            "🎒 Vật phẩm đã đạt giới hạn.",
            "warning"
        );

        return;

    }


    if (
        state.profile.gold <
        item.cost
    ) {

        showToast(
            "🪙 Không đủ Gold.",
            "danger"
        );

        return;

    }


    state.profile.gold -=
        item.cost;


    addInventoryItem(
        itemId,
        1
    );


    saveState();

    renderAll();


    showToast(
        `🛒 Đã mua ${item.name}!`,
        "success"
    );

}


/* =========================================================
   USE ITEMS
========================================================= */

function useItem(itemId) {

    const count =
        getInventoryCount(
            itemId
        );


    if (count <= 0) {

        return;

    }


    if (
        itemId === "healthPotion"
    ) {

        removeInventoryItem(
            itemId,
            1
        );

        healHp(30);

    }


    else if (
        itemId === "fullElixir"
    ) {

        removeInventoryItem(
            itemId,
            1
        );

        state.profile.hp =
            100;

        showToast(
            "🍶 HP đã hồi phục 100%.",
            "success"
        );

    }


    else if (
        itemId === "tomeWisdom"
    ) {

        removeInventoryItem(
            itemId,
            1
        );

        state.buffs.expMultiplierUntil =
            endOfToday();

        showToast(
            "📖 Tome of Wisdom kích hoạt: x2 EXP đến 23:59.",
            "success"
        );

    }


    else if (
        itemId === "midasTouch"
    ) {

        removeInventoryItem(
            itemId,
            1
        );

        state.buffs.goldMultiplierUntil =
            endOfToday();

        showToast(
            "✨ Midas Touch kích hoạt: x2 Gold đến 23:59.",
            "gold"
        );

    }


    else if (
        itemId === "focusIncense"
    ) {

        removeInventoryItem(
            itemId,
            1
        );

        state.buffs.focusIncenseUntil =
            endOfToday();

        state.buffs.focusIncenseStacks =
            Math.min(
                3,
                (
                    state.buffs.focusIncenseStacks || 0
                ) + 1
            );

        showToast(
            "🕯️ Focus Incense kích hoạt: +5 EXP/Pomodoro.",
            "success"
        );

    }


    else {

        showToast(
            "🛡️ Vật phẩm này hoạt động tự động hoặc khi cần.",
            "warning"
        );

    }


    saveState();

    renderAll();

}


/* =========================================================
   CUSTOM REWARDS
========================================================= */

function createCustomReward(event) {

    event.preventDefault();


    const name =
        document
            .getElementById(
                "rewardName"
            )
            .value
            .trim();

    const cost =
        Number(
            document
                .getElementById(
                    "rewardCost"
                )
                .value
        );


    if (
        !name ||
        !cost ||
        cost < 1
    ) {

        return;

    }


    state.customRewards.push({

        id:
            generateId(),

        name,

        cost,

        redeemed:
            false,

        redeemedAt:
            null

    });


    event.target.reset();

    saveState();

    renderAll();


    showToast(
        "🎁 Đã thêm phần thưởng!",
        "success"
    );

}


function redeemCustomReward(
    rewardId
) {

    const reward =
        state.customRewards.find(
            r => r.id === rewardId
        );


    if (!reward) {

        return;

    }


    if (
        state.profile.gold <
        reward.cost
    ) {

        showToast(
            "🪙 Không đủ Gold.",
            "danger"
        );

        return;

    }


    state.profile.gold -=
        reward.cost;

    reward.redeemed = true;

    reward.redeemedAt =
        new Date().toISOString();


    saveState();

    renderAll();


    showToast(
        `🎁 Đã đổi thưởng: ${reward.name}`,
        "success"
    );

}


/* =========================================================
   CHESTS
========================================================= */

function openChest(type) {

    if (
        !state.chests[type] ||
        state.chests[type] <= 0
    ) {

        return;

    }


    state.chests[type]--;


    let min;
    let max;


    if (type === "wood") {

        min = 1;
        max = 10;

    }

    else if (
        type === "silver"
    ) {

        min = 10;
        max = 20;

    }

    else {

        min = 20;
        max = 50;

    }


    const reward =
        randomInt(
            min,
            max
        );


    addGold(
        reward,
        "chest"
    );


    if (
        type === "gold"
    ) {

        confettiBurst();

        showToast(
            `👑 Rương Vàng mở ra ${reward} Gold!`,
            "gold"
        );

    } else {

        showToast(
            `🧰 Rương mở ra ${reward} Gold!`,
            "success"
        );

    }


    saveState();

    renderAll();

}


/* =========================================================
   ACHIEVEMENTS
========================================================= */

function createAchievement(event) {

    event.preventDefault();


    const name =
        document
            .getElementById(
                "achievementName"
            )
            .value
            .trim();

    const description =
        document
            .getElementById(
                "achievementDescription"
            )
            .value
            .trim();

    const date =
        document
            .getElementById(
                "achievementDate"
            )
            .value ||
        dateKey();

    const badge =
        document
            .getElementById(
                "achievementBadge"
            )
            .value;


    state.achievements.unshift({

        id:
            generateId(),

        name,

        description,

        date,

        badge

    });


    event.target.reset();

    saveState();

    renderAll();


    showToast(
        "🏆 Đã lưu thành tựu!",
        "success"
    );


    confettiSmall();

}


/* =========================================================
   SETTINGS
========================================================= */

function openSettings() {

    document
        .getElementById(
            "settingsName"
        )
        .value =
            state.profile.name;

    document
        .getElementById(
            "settingsAvatar"
        )
        .value =
            state.profile.avatar;

    document
        .getElementById(
            "settingsBackground"
        )
        .value =
            state.profile.background;


    document
        .getElementById(
            "settingsModal"
        )
        .classList.remove(
            "hidden"
        );

}


function closeSettings() {

    document
        .getElementById(
            "settingsModal"
        )
        .classList.add(
            "hidden"
        );

}


function saveSettings() {

    const name =
        document
            .getElementById(
                "settingsName"
            )
            .value
            .trim();

    const avatar =
        document
            .getElementById(
                "settingsAvatar"
            )
            .value
            .trim();

    const background =
        document
            .getElementById(
                "settingsBackground"
            )
            .value
            .trim();


    if (name) {

        state.profile.name =
            name;

    }


    if (avatar) {

        state.profile.avatar =
            avatar;

    }


    state.profile.background =
        background;


    saveState();

    closeSettings();

    renderAll();


    showToast(
        "⚙️ Đã cập nhật nhân vật!",
        "success"
    );

}


/* =========================================================
   RENDER PROFILE
========================================================= */

function renderProfile() {

    const p =
        state.profile;


    document
        .getElementById(
            "characterName"
        )
        .textContent =
            p.name;

    document
        .getElementById(
            "levelBadge"
        )
        .textContent =
            `Lv.${p.level}`;

    document
        .getElementById(
            "avatarImage"
        )
        .src =
            p.avatar;


    /*
       Header
    */

    document
        .getElementById(
            "headerHp"
        )
        .textContent =
            `${p.hp}/100`;

    document
        .getElementById(
            "headerLevel"
        )
        .textContent =
            `Lv.${p.level}`;

    document
        .getElementById(
            "headerGold"
        )
        .textContent =
            p.gold;

    document
        .getElementById(
            "headerStreak"
        )
        .textContent =
            p.streak;


    /*
       HP
    */

    document
        .getElementById(
            "hpText"
        )
        .textContent =
            `${p.hp} / 100`;

    document
        .getElementById(
            "hpBar"
        )
        .style.width =
            `${p.hp}%`;


    /*
       EXP
    */

    const required =
        getExpRequired(
            p.level
        );

    const expPercent =
        Math.min(
            100,
            (
                p.exp /
                required
            ) * 100
        );


    document
        .getElementById(
            "expText"
        )
        .textContent =
            `${p.exp} / ${required}`;

    document
        .getElementById(
            "expBar"
        )
        .style.width =
            `${expPercent}%`;


    /*
       Mini stats
    */

    document
        .getElementById(
            "goldDisplay"
        )
        .textContent =
            p.gold;

    document
        .getElementById(
            "streakDisplay"
        )
        .textContent =
            p.streak;

    document
        .getElementById(
            "taskCountDisplay"
        )
        .textContent =
            state.tasks.length;

    document
        .getElementById(
            "pomodoroCountDisplay"
        )
        .textContent =
            state.statistics.totalPomodoros;


    /*
       Dashboard
    */

    document
        .getElementById(
            "dashboardTasks"
        )
        .textContent =
            p.todayTasks;

    document
        .getElementById(
            "dashboardPomodoros"
        )
        .textContent =
            p.todayPomodoros;

    document
        .getElementById(
            "dashboardExp"
        )
        .textContent =
            p.todayExp;


    document
        .getElementById(
            "survivalHp"
        )
        .textContent =
            p.hp;

    document
        .getElementById(
            "survivalStreak"
        )
        .textContent =
            p.streak;

    document
        .getElementById(
            "survivalLevel"
        )
        .textContent =
            p.level;

    document
        .getElementById(
            "survivalGold"
        )
        .textContent =
            p.gold;


    document
        .getElementById(
            "todayDate"
        )
        .textContent =
            new Date()
                .toLocaleDateString(
                    "vi-VN",
                    {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                    }
                );

}


/* =========================================================
   RENDER TASKS
========================================================= */

function filterTasks(filter) {

    currentTaskFilter =
        filter;


    document
        .querySelectorAll(
            ".filter-button"
        )
        .forEach(
            button =>
                button.classList.remove(
                    "active"
                )
        );


    const map = {

        all: "filterAll",

        pending: "filterPending",

        completed: "filterCompleted"

    };


    document
        .getElementById(
            map[filter]
        )
        .classList.add(
            "active"
        );


    renderTasks();

}


function renderTasks() {

    const container =
        document.getElementById(
            "taskList"
        );


    let tasks =
        [...state.tasks];


    if (
        currentTaskFilter ===
        "pending"
    ) {

        tasks =
            tasks.filter(
                t =>
                    !t.isCompleted
            );

    }


    if (
        currentTaskFilter ===
        "completed"
    ) {

        tasks =
            tasks.filter(
                t =>
                    t.isCompleted
            );

    }


    if (!tasks.length) {

        container.innerHTML = `

            <div class="text-center py-12 text-white/40">

                <div class="text-4xl mb-3">
                    📭
                </div>

                Chưa có nhiệm vụ nào.

            </div>

        `;

        return;

    }


    container.innerHTML =
        tasks.map(task => {

            const difficulty =
                GAME_CONFIG
                    .difficulties[
                        task.difficulty
                    ];


            const overdue =
                !task.isCompleted &&
                task.deadline &&
                Date.now() >
                    new Date(
                        task.deadline
                    ).getTime();


            const deadlineText =
                task.deadline
                    ? new Date(
                        task.deadline
                    ).toLocaleString(
                        "vi-VN"
                    )
                    : "Không có deadline";


            return `

                <div class="
                    task-card
                    ${task.isCompleted ? "completed" : ""}
                    ${overdue ? "overdue" : ""}
                ">

                    <div class="flex justify-between gap-3">

                        <div class="flex-1">

                            <div class="flex flex-wrap items-center gap-2">

                                <span class="task-title">
                                    ${escapeHtml(task.title)}
                                </span>

                                ${
                                    task.isCompleted
                                        ? `<span class="task-badge">✅ Hoàn thành</span>`
                                        : ""
                                }

                                ${
                                    task.isDaily
                                        ? `<span class="task-badge">🔄 Daily</span>`
                                        : ""
                                }

                                ${
                                    overdue
                                        ? `<span class="task-badge overdue-badge">⚠️ Trễ hạn</span>`
                                        : ""
                                }

                            </div>


                            <div class="task-meta">

                                <span class="task-badge">
                                    ${difficulty.icon}
                                    ${difficulty.name}
                                </span>

                                <span class="task-badge">
                                    ⭐ ${difficulty.exp} EXP
                                </span>

                                <span class="task-badge">
                                    🪙 ${difficulty.gold} Gold
                                </span>

                                <span class="task-badge">
                                    ⏰ ${deadlineText}
                                </span>

                            </div>

                        </div>

                    </div>


                    <div class="task-actions">

                        ${
                            !task.isCompleted
                                ? `
                                    <button
                                        onclick="completeTask('${task.id}')"
                                        class="primary-button"
                                    >
                                        ✓ Hoàn thành
                                    </button>
                                `
                                : ""
                        }

                        <button
                            onclick="deleteTask('${task.id}')"
                            class="danger-button"
                        >
                            🗑 Xóa
                        </button>

                    </div>

                </div>

            `;

        })
        .join("");

}


/* =========================================================
   RENDER INVENTORY
========================================================= */

function renderInventory() {

    const container =
        document.getElementById(
            "inventoryList"
        );


    const ownedItems =
        Object.entries(
            state.inventory
        );


    if (!ownedItems.length) {

        container.innerHTML = `

            <div class="col-span-full text-center py-12 text-white/40">

                <div class="text-4xl mb-3">
                    🎒
                </div>

                Kho đồ đang trống.

            </div>

        `;

    } else {

        container.innerHTML =
            ownedItems.map(
                ([id, count]) => {

                    const item =
                        GAME_CONFIG.items[
                            id
                        ];


                    if (!item) {

                        return "";

                    }


                    const usable =
                        [
                            "healthPotion",
                            "fullElixir",
                            "tomeWisdom",
                            "midasTouch",
                            "focusIncense"
                        ].includes(id);


                    return `

                        <div class="inventory-item">

                            <div class="inventory-icon">
                                ${item.icon}
                            </div>

                            <h3 class="font-bold mt-2">
                                ${item.name}
                            </h3>

                            <p class="text-xs text-white/45 mt-1">
                                ${item.description}
                            </p>

                            <div class="flex justify-between items-center mt-4">

                                <span class="stack-badge">
                                    x${count}
                                </span>

                                ${
                                    usable
                                        ? `
                                            <button
                                                onclick="useItem('${id}')"
                                                class="secondary-button"
                                            >
                                                Dùng
                                            </button>
                                        `
                                        : ""
                                }

                            </div>

                        </div>

                    `;

                }
            ).join("");

    }


    renderChests();

}


function renderChests() {

    const container =
        document.getElementById(
            "chestList"
        );


    const chests = [

        {
            type: "wood",
            icon: "🪵",
            name: "Rương Gỗ",
            description: "1 – 10 Gold",
            count:
                state.chests.wood
        },

        {
            type: "silver",
            icon: "🥈",
            name: "Rương Bạc",
            description: "10 – 20 Gold",
            count:
                state.chests.silver
        },

        {
            type: "gold",
            icon: "👑",
            name: "Rương Vàng",
            description: "20 – 50 Gold",
            count:
                state.chests.gold
        }

    ];


    container.innerHTML =
        chests.map(chest => `

            <div
                class="chest ${chest.count <= 0 ? "locked" : ""}"
                onclick="
                    ${chest.count > 0
                        ? `openChest('${chest.type}')`
                        : ""}
                "
            >

                <div class="flex items-center gap-3">

                    <div class="chest-icon">
                        ${chest.icon}
                    </div>

                    <div class="flex-1">

                        <strong>
                            ${chest.name}
                        </strong>

                        <p class="text-xs text-white/45">
                            ${chest.description}
                        </p>

                    </div>

                    <span class="stack-badge">
                        x${chest.count}
                    </span>

                </div>

            </div>

        `).join("");

}


/* =========================================================
   RENDER REWARDS
========================================================= */

function renderCustomRewards() {

    const container =
        document.getElementById(
            "customRewardList"
        );


    if (
        !state.customRewards.length
    ) {

        container.innerHTML = `

            <div class="text-white/35 text-sm">
                Chưa có Custom Reward.
            </div>

        `;

        return;

    }


    container.innerHTML =
        state.customRewards
            .map(reward => `

                <div class="reward-preview justify-between">

                    <div class="text-left">

                        <strong>
                            🎁 ${escapeHtml(reward.name)}
                        </strong>

                        <div class="text-xs text-white/40">
                            🪙 ${reward.cost} Gold
                        </div>

                    </div>

                    ${
                        reward.redeemed
                            ? `
                                <span class="task-badge">
                                    ✅ Đã đổi
                                </span>
                            `
                            : `
                                <button
                                    onclick="redeemCustomReward('${reward.id}')"
                                    class="primary-button"
                                >
                                    Đổi
                                </button>
                            `
                    }

                </div>

            `)
            .join("");

}


/* =========================================================
   RENDER ACHIEVEMENTS
========================================================= */

function renderAchievements() {

    const container =
        document.getElementById(
            "achievementList"
        );


    if (
        !state.achievements.length
    ) {

        container.innerHTML = `

            <div class="text-center py-12 text-white/40">

                <div class="text-4xl mb-3">
                    🏆
                </div>

                Chưa có thành tựu nào.

            </div>

        `;

        return;

    }


    container.innerHTML =
        state.achievements
            .map(
                achievement => `

                <div class="achievement-card">

                    <div class="achievement-badge">
                        ${achievement.badge}
                    </div>

                    <div class="flex-1">

                        <div class="flex justify-between gap-3">

                            <h3 class="font-bold">
                                ${escapeHtml(achievement.name)}
                            </h3>

                            <span class="text-xs text-white/35">
                                ${achievement.date}
                            </span>

                        </div>

                        <p class="text-sm text-white/50 mt-2">
                            ${escapeHtml(
                                achievement.description
                            )}
                        </p>

                    </div>

                </div>

            `
            )
            .join("");

}


/* =========================================================
   RENDER BUFFS
========================================================= */

function renderBuffs() {

    const container =
        document.getElementById(
            "buffList"
        );


    const buffs = [];


    if (
        state.buffs.expMultiplierUntil &&
        Date.now() <
            state.buffs.expMultiplierUntil
    ) {

        buffs.push(
            "📖 x2 EXP"
        );

    }


    if (
        state.buffs.goldMultiplierUntil &&
        Date.now() <
            state.buffs.goldMultiplierUntil
    ) {

        buffs.push(
            "✨ x2 Gold"
        );

    }


    if (
        state.buffs.focusIncenseUntil &&
        Date.now() <
            state.buffs.focusIncenseUntil
    ) {

        buffs.push(
            "🕯️ +5 EXP/Pomodoro"
        );

    }


    if (!buffs.length) {

        container.innerHTML = `

            <span class="text-xs text-white/35">
                Không có buff — x1
            </span>

        `;

        return;

    }


    container.innerHTML =
        buffs
            .map(
                buff =>
                    `<span class="buff-chip">${buff}</span>`
            )
            .join("");

}


/* =========================================================
   RENDER EVERYTHING
========================================================= */

function renderAll() {

    renderProfile();

    renderTasks();

    renderShop();

    renderInventory();

    renderCustomRewards();

    renderAchievements();

    renderBuffs();

}


/* =========================================================
   TAB SYSTEM
========================================================= */

function switchTab(tab) {

    document
        .querySelectorAll(
            ".tab-content"
        )
        .forEach(
            section =>
                section.classList.remove(
                    "active"
                )
        );


    document
        .getElementById(
            `tab-${tab}`
        )
        .classList.add(
            "active"
        );


    document
        .querySelectorAll(
            ".nav-button"
        )
        .forEach(
            button => {

                button.classList.toggle(
                    "active",
                    button.dataset.tab ===
                        tab
                );

            }
        );


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}


function toggleMobileMenu() {

    const nav =
        document.getElementById(
            "mainNavigation"
        );


    nav.scrollIntoView({
        behavior: "smooth"
    });

}


/* =========================================================
   EXPORT / IMPORT
========================================================= */

function exportData() {

    const data =
        JSON.stringify(
            state,
            null,
            2
        );


    const blob =
        new Blob(
            [data],
            {
                type:
                    "application/json"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href = url;

    link.download =
        `productivity-rpg-backup-${dateKey()}.json`;


    link.click();


    URL.revokeObjectURL(url);


    showToast(
        "📥 Đã xuất file backup JSON.",
        "success"
    );

}


function importData(event) {

    const file =
        event.target.files[0];


    if (!file) {

        return;

    }


    const reader =
        new FileReader();


    reader.onload =
        function(e) {

            try {

                const imported =
                    JSON.parse(
                        e.target.result
                    );


                if (
                    !imported.profile ||
                    !imported.tasks ||
                    !imported.inventory
                ) {

                    throw new Error(
                        "Invalid backup"
                    );

                }


                state =
                    mergeObjects(
                        cloneDefaultState(),
                        imported
                    );


                saveState();

                processDailySystems();

                renderAll();


                showToast(
                    "📤 Import dữ liệu thành công!",
                    "success"
                );

            } catch (error) {

                console.error(error);

                showToast(
                    "❌ File JSON không hợp lệ.",
                    "danger"
                );

            }

        };


    reader.readAsText(file);

}


/* =========================================================
   RESET
========================================================= */

function resetGame() {

    const confirmed =
        window.confirm(
            "Bạn chắc chắn muốn RESET toàn bộ Productivity RPG?"
        );


    if (!confirmed) {

        return;

    }


    state =
        cloneDefaultState();


    saveState();

    renderAll();

    resetPomodoro();


    showToast(
        "🗑 Game đã reset.",
        "warning"
    );

}


/* =========================================================
   FX
========================================================= */

function confettiBurst() {

    if (
        typeof confetti !==
        "function"
    ) {

        return;

    }


    confetti({
        particleCount: 180,
        spread: 100,
        origin: {
            y: 0.6
        }
    });

}


function confettiSmall() {

    if (
        typeof confetti !==
        "function"
    ) {

        return;

    }


    confetti({
        particleCount: 60,
        spread: 70,
        origin: {
            y: 0.7
        }
    });

}


/* =========================================================
   TOAST
========================================================= */

function showToast(
    message,
    type = "info"
) {

    const container =
        document.getElementById(
            "toastContainer"
        );


    const toast =
        document.createElement(
            "div"
        );


    toast.className =
        "toast";


    toast.innerHTML =
        message;


    container.appendChild(
        toast
    );


    setTimeout(
        () => {

            toast.style.opacity =
                "0";

            toast.style.transform =
                "translateX(30px)";

            setTimeout(
                () =>
                    toast.remove(),
                300
            );

        },
        3200
    );

}


/* =========================================================
   UTILITIES
========================================================= */

function generateId() {

    return (
        Date.now().toString(36) +
        Math.random()
            .toString(36)
            .substring(2, 9)
    );

}


function randomInt(min, max) {

    return Math.floor(
        Math.random() *
        (max - min + 1)
    ) + min;

}


function escapeHtml(value) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        value;

    return div.innerHTML;

}


/* =========================================================
   EVENT LISTENERS
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        /*
           Navigation
        */

        document
            .querySelectorAll(
                ".nav-button"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () =>
                            switchTab(
                                button.dataset.tab
                            )
                    );

                }
            );


        /*
           Forms
        */

        document
            .getElementById(
                "taskForm"
            )
            .addEventListener(
                "submit",
                createTask
            );


        document
            .getElementById(
                "rewardForm"
            )
            .addEventListener(
                "submit",
                createCustomReward
            );


        document
            .getElementById(
                "achievementForm"
            )
            .addEventListener(
                "submit",
                createAchievement
            );


        /*
           Import
        */

        document
            .getElementById(
                "importFile"
            )
            .addEventListener(
                "change",
                importData
            );


        /*
           Daily systems
        */

        processDailySystems();


        /*
           Deadline check
        */

        checkDeadlinePenalties();


        /*
           Background
        */

        applyBackground();


        /*
           Initial render
        */

        renderAll();


        /*
           Keep deadline system alive
        */

        setInterval(
            () => {

                checkDeadlinePenalties();

                processDailySystems();

                renderTasks();

                renderBuffs();

            },
            30000
        );

    }
);


/* =========================================================
   BACKGROUND
========================================================= */

function applyBackground() {

    const layer =
        document.getElementById(
            "backgroundLayer"
        );


    if (
        state.profile.background
    ) {

        layer.style.backgroundImage =
            `url("${state.profile.background}")`;

    } else {

        layer.style.backgroundImage =
            `
                radial-gradient(
                    circle at 20% 20%,
                    rgba(99,102,241,0.25),
                    transparent 35%
                ),
                radial-gradient(
                    circle at 80% 80%,
                    rgba(20,184,166,0.18),
                    transparent 35%
                )
            `;

    }

}


/* =========================================================
   KEYBOARD SHORTCUT
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        /*
           Space = Pomodoro only when
           user isn't typing.
        */

        const tag =
            document.activeElement
                ?.tagName
                ?.toLowerCase();


        if (
            event.code === "Space" &&
            !["input", "textarea", "select"]
                .includes(tag)
        ) {

            const focusTab =
                document.getElementById(
                    "tab-focus"
                );


            if (
                focusTab.classList.contains(
                    "active"
                )
            ) {

                event.preventDefault();

                togglePomodoro();

            }

        }

    }
);

