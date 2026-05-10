const welcomeScreenEl = document.getElementById("welcomeScreen");
const quizViewEl = document.getElementById("quizView");
const quizEl = document.getElementById("quiz");
const questionSlotEl = document.getElementById("questionSlot");
const templateEl = document.getElementById("questionTemplate");
const progressTextEl = document.getElementById("progressText");
const toastEl = document.getElementById("toastEl");
const timerTextEl = document.getElementById("timerText");
const resultCardEl = document.getElementById("resultCard");
const resultTitleEl = document.getElementById("resultTitle");
const resultTextEl = document.getElementById("resultText");
const resultScoreEl = document.getElementById("resultScore");
const resultTimeEl = document.getElementById("resultTime");
const quizTopicBadgeEl = document.getElementById("quizTopicBadge");
const backBtn = document.getElementById("backBtn");

/* ─── Progress persistence ─── */
const STORAGE_KEY = "smallmath_v1";

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function saveProgress(diff, elapsedMs) {
  const progress = loadProgress();
  const s = Math.max(0, Math.round(elapsedMs / 1000));
  const timeStr = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  if (!progress[diff] || elapsedMs < (progress[diff].ms || Infinity)) {
    progress[diff] = { completed: true, time: timeStr, ms: elapsedMs };
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function resetProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

const DIFF_NAMES  = { easy: "Просто", medium: "Средне", hard: "Сложно" };
const DIFF_COUNTS = { easy: "8", medium: "16", hard: "24" };
const UNLOCK_REQ  = { easy: null, medium: "easy", hard: "medium" };

const LOCK_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;

function updateDiffButtons() {
  const progress = loadProgress();
  document.querySelectorAll(".diff-btn").forEach((btn) => {
    const level = btn.dataset.level;
    const req = UNLOCK_REQ[level];
    const unlocked = !req || progress[req]?.completed;
    const done = progress[level]?.completed;

    btn.disabled = !unlocked;
    btn.classList.toggle("completed", !!done);

    const nameEl = btn.querySelector(".diff-name");
    nameEl.textContent = done
      ? `${DIFF_NAMES[level]} (${progress[level].time})`
      : DIFF_NAMES[level];

    const countEl = btn.querySelector(".diff-count");
    if (unlocked) {
      countEl.textContent = DIFF_COUNTS[level];
    } else {
      countEl.innerHTML = LOCK_SVG;
    }
  });
}

const DIFF_CONFIG = {
  easy:   { total: 8,  multRange: [2,3,4,5],    compMin: 5,  compMax: 50,  coordMax: 4 },
  medium: { total: 16, multRange: [6,7,8,9],    compMin: 10, compMax: 99,  coordMax: 6 },
  hard:   { total: 24, multRange: [9,10,11,12], compMin: 50, compMax: 150, coordMax: 6 },
};

let currentDiff = "medium";

let questions = [];
let currentIndex = 0;
let score = 0;
let locked = false;
let advanceTimer = null;
let timerInterval = null;
let startedAt = 0;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sample(array) {
  return array[randInt(0, array.length - 1)];
}

function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatElapsedTime(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes} мин ${String(seconds).padStart(2, "0")} сек`;
  }
  return `${seconds} сек`;
}

function makeMathQuestion() {
  const cfg = DIFF_CONFIG[currentDiff];
  const mult = sample(cfg.multRange);
  const a = randInt(2, 9);
  return {
    topic: "Умножение",
    title: `Сколько будет ${a} × ${mult}?`,
    type: "input",
    answer: a * mult,
    hint: "Впиши только число.",
  };
}

function makeOrderQuestion() {
  const bracketFirst = randInt(0, 1) === 0;
  const useSubtraction = randInt(0, 1) === 0;

  const multMax = currentDiff === "easy" ? 4 : currentDiff === "hard" ? 8 : 6;
  const mult = randInt(2, multMax);

  let innerA, innerB, op, inner, title, answer;

  if (useSubtraction) {
    const subMax = currentDiff === "easy" ? 10 : currentDiff === "hard" ? 20 : 15;
    innerA = randInt(5, subMax);
    innerB = randInt(2, innerA - 1);
    op = "-";
  } else {
    const addMax = currentDiff === "easy" ? 6 : currentDiff === "hard" ? 12 : 9;
    innerA = randInt(2, addMax);
    innerB = randInt(2, addMax);
    op = "+";
  }
  inner = op === "+" ? innerA + innerB : innerA - innerB;

  if (bracketFirst) {
    title = `Вычисли: (${innerA} ${op} ${innerB}) × ${mult}`;
    answer = inner * mult;
  } else {
    title = `Вычисли: ${mult} × (${innerA} ${op} ${innerB})`;
    answer = mult * inner;
  }

  return {
    topic: "Порядок действий",
    title,
    type: "input",
    answer,
    hint: "Сначала скобки, потом умножение.",
  };
}

function makeComparisonNumberQuestion() {
  const { compMin, compMax } = DIFF_CONFIG[currentDiff];
  const left = randInt(compMin, compMax);
  let right = randInt(compMin, compMax);
  while (right === left) right = randInt(compMin, compMax);
  const answer = left < right ? "<" : left > right ? ">" : "=";
  return {
    topic: "Сравнение чисел",
    title: "Поставь нужный знак между числами:",
    type: "choice",
    left,
    right,
    options: ["<", "=", ">"],
    answer,
    hint: "Выбери один знак.",
  };
}

function evalExpression(expr) {
  return Function(`"use strict"; return (${expr});`)();
}

function makeComparisonExpressionQuestion() {
  const buildPair = () => {
    if (currentDiff === "easy") return sample([
      [`${randInt(2, 4)} × ${randInt(2, 4)}`, `${randInt(3, 6)} × ${randInt(2, 3)}`],
      [`${randInt(8, 15)} - ${randInt(2, 5)}`, `${randInt(2, 6)} + ${randInt(2, 5)}`],
    ]);
    if (currentDiff === "hard") return sample([
      [`${randInt(5, 9)} × ${randInt(5, 9)}`, `${randInt(6, 9)} × ${randInt(5, 8)}`],
      [`${randInt(15, 30)} - ${randInt(2, 12)}`, `${randInt(5, 12)} + ${randInt(5, 10)}`],
      [`${randInt(3, 7)} + ${randInt(3, 8)} × ${randInt(3, 6)}`, `${randInt(4, 9)} × ${randInt(3, 8)}`],
    ]);
    return sample([
      [`${randInt(2, 6)} × ${randInt(2, 6)}`, `${randInt(5, 9)} × ${randInt(2, 5)}`],
      [`${randInt(10, 20)} - ${randInt(2, 8)}`, `${randInt(2, 9)} + ${randInt(3, 7)}`],
      [`${randInt(2, 5)} + ${randInt(2, 5)} × ${randInt(2, 4)}`, `${randInt(2, 6)} × ${randInt(2, 5)}`],
    ]);
  };

  let left;
  let right;
  let leftValue;
  let rightValue;
  do {
    [left, right] = buildPair();
    leftValue = evalExpression(left.replaceAll("×", "*"));
    rightValue = evalExpression(right.replaceAll("×", "*"));
  } while (leftValue === rightValue);

  const answer = leftValue < rightValue ? "<" : leftValue > rightValue ? ">" : "=";
  return {
    topic: "Сравнение выражений",
    title: "Поставь знак между выражениями:",
    type: "choice",
    left,
    right,
    options: ["<", "=", ">"],
    answer,
    hint: "Сравни значения выражений.",
  };
}

function makeAngleQuestion() {
  const angles = [30, 45, 60, 90, 120, 135, 150];
  const angle = sample(angles);
  const point = angle < 90 ? "острый" : angle === 90 ? "прямой" : "тупой";
  return {
    topic: "Углы",
    title: "Определи вид угла по рисунку:",
    type: "choice",
    answer: point,
    kind: angle,
    options: ["острый", "прямой", "тупой"],
    hint: "Острый меньше 90°, прямой ровно 90°, тупой больше 90°.",
  };
}

function makeCoordinateQuestion() {
  const max = DIFF_CONFIG[currentDiff].coordMax;
  const x = randInt(1, max);
  const y = randInt(1, max);
  return {
    topic: "Координаты",
    title: "Определи координаты точки на сетке:",
    type: "input",
    answer: { x, y },
    x,
    y,
    coordMax: max,
    hint: "Заполни оба поля отдельно.",
  };
}

const TIME_ORDINALS = [
  "", "первого", "второго", "третьего", "четвёртого", "пятого",
  "шестого", "седьмого", "восьмого", "девятого", "десятого", "одиннадцатого", "двенадцатого",
];
const TIME_CARDINALS = [
  "двенадцать", "час", "два", "три", "четыре", "пять",
  "шесть", "семь", "восемь", "девять", "десять", "одиннадцать", "двенадцать",
];

function makeTimeQuestion() {
  const periods = [
    { label: "ночи",   hours: [1, 2, 3, 4] },
    { label: "утра",   hours: [6, 7, 8, 9, 10] },
    { label: "дня",    hours: [13, 14, 15, 16] },
    { label: "вечера", hours: [18, 19, 20, 21] },
  ];
  const period = sample(periods);
  const hour24 = sample(period.hours);
  const hour12 = hour24 > 12 ? hour24 - 12 : hour24;
  const minutes = sample([0, 15, 30, 45, 50, 55]);
  const nextHour12 = hour12 + 1;

  const pad2 = (n) => String(n).padStart(2, "0");
  const answer = `${pad2(hour24)}:${pad2(minutes)}`;

  let title;
  if (minutes === 0) {
    const hourWord = hour12 === 1 ? "час" : `${TIME_CARDINALS[hour12]} ${hour12 <= 4 ? "часа" : "часов"}`;
    title = `Ровно ${hourWord} ${period.label}`;
  } else if (minutes === 15) {
    title = `Четверть ${TIME_ORDINALS[nextHour12]} ${period.label}`;
  } else if (minutes === 30) {
    title = `Половина ${TIME_ORDINALS[nextHour12]} ${period.label}`;
  } else if (minutes === 45) {
    title = `Без пятнадцати ${nextHour12} ${period.label}`;
  } else if (minutes === 50) {
    title = `Без десяти ${nextHour12} ${period.label}`;
  } else {
    title = `Без пяти ${nextHour12} ${period.label}`;
  }

  return {
    topic: "Время",
    title,
    type: "time",
    answer,
    hint: "Введи 4 цифры — двоеточие появится само",
  };
}

function buildQuestionPool() {
  const poolDefs = {
    easy: [
      [makeMathQuestion, makeMathQuestion],
      [makeOrderQuestion, makeOrderQuestion],
      [makeComparisonNumberQuestion, makeComparisonNumberQuestion],
      [makeComparisonExpressionQuestion],
      [makeCoordinateQuestion],
    ],
    medium: [
      [makeMathQuestion, makeMathQuestion, makeMathQuestion, makeMathQuestion],
      [makeOrderQuestion, makeOrderQuestion, makeOrderQuestion],
      [makeComparisonNumberQuestion, makeComparisonNumberQuestion, makeComparisonNumberQuestion],
      [makeComparisonExpressionQuestion, makeComparisonExpressionQuestion],
      [makeAngleQuestion, makeAngleQuestion],
      [makeCoordinateQuestion, makeCoordinateQuestion],
    ],
    hard: [
      [makeMathQuestion, makeMathQuestion, makeMathQuestion, makeMathQuestion],
      [makeOrderQuestion, makeOrderQuestion, makeOrderQuestion, makeOrderQuestion],
      [makeComparisonNumberQuestion, makeComparisonNumberQuestion, makeComparisonNumberQuestion, makeComparisonNumberQuestion],
      [makeComparisonExpressionQuestion, makeComparisonExpressionQuestion, makeComparisonExpressionQuestion],
      [makeAngleQuestion, makeAngleQuestion, makeAngleQuestion],
      [makeCoordinateQuestion, makeCoordinateQuestion, makeCoordinateQuestion],
      [makeTimeQuestion, makeTimeQuestion, makeTimeQuestion],
    ],
  };

  const groups = shuffleArray(poolDefs[currentDiff]).map(g => [...g]);
  const total = DIFF_CONFIG[currentDiff].total;

  // Greedy interleave: always pick from the largest group that differs from the previous
  const result = [];
  let lastIdx = -1;

  while (result.length < total) {
    const eligible = groups
      .map((pool, i) => ({ pool, i }))
      .filter(({ pool, i }) => pool.length > 0 && i !== lastIdx);

    if (eligible.length === 0) break;

    const maxLen = Math.max(...eligible.map(e => e.pool.length));
    const top = eligible.filter(e => e.pool.length === maxLen);
    const chosen = top[randInt(0, top.length - 1)];

    result.push(chosen.pool.shift());
    lastIdx = chosen.i;
  }

  return result.map((factory, index) => ({ id: index, ...factory() }));
}

function makeGridSvg(pointX, pointY) {
  const size = 198;
  const step = 20;
  const offset = 30;
  const max = 6;
  const x = offset + pointX * step;
  const y = offset + (max - pointY) * step;

  const lines = [];
  for (let i = 0; i <= max; i += 1) {
    const pos = offset + i * step;
    lines.push(`<line class="grid-line" x1="${offset}" y1="${pos}" x2="${offset + max * step}" y2="${pos}"></line>`);
    lines.push(`<line class="grid-line" x1="${pos}" y1="${offset}" x2="${pos}" y2="${offset + max * step}"></line>`);
  }

  const labels = [];
  for (let i = 0; i <= max; i += 1) {
    labels.push(`<text class="grid-label" text-anchor="end" x="${offset - 10}" y="${offset + (max - i) * step + 4}">${i}</text>`);
    labels.push(`<text class="grid-label" text-anchor="middle" x="${offset + i * step}" y="${offset + max * step + 16}">${i}</text>`);
  }

  return `
    <svg class="grid-svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="Координатная сетка">
      ${lines.join("")}
      <line class="axis-line" x1="${offset}" y1="${offset + max * step}" x2="${offset + max * step}" y2="${offset + max * step}"></line>
      <line class="axis-line" x1="${offset}" y1="${offset}" x2="${offset}" y2="${offset + max * step}"></line>
      <text class="axis-label" x="${offset + max * step + 18}" y="${offset + max * step + 6}">X</text>
      <text class="axis-label" x="${offset - 14}" y="${offset - 10}">Y</text>
      ${labels.join("")}
      <circle class="point" cx="${x}" cy="${y}" r="9"></circle>
      <text class="point-label" x="${x + 13}" y="${y - 12}">A</text>
    </svg>
  `;
}

function renderAngleGraphic(angle) {
  const baseX = 70;
  const baseY = 155;
  const radius = 75;
  const radians = (angle * Math.PI) / 180;
  const endX = baseX + Math.cos(radians) * radius;
  const endY = baseY - Math.sin(radians) * radius;
  const largeArc = angle > 180 ? 1 : 0;
  const d = `M ${baseX + radius} ${baseY} A ${radius} ${radius} 0 ${largeArc} 0 ${endX} ${endY}`;

  return `
    <svg class="grid-svg" viewBox="0 0 240 180" role="img" aria-label="Изображение угла">
      <line x1="${baseX}" y1="${baseY}" x2="${baseX + 95}" y2="${baseY}" stroke="#2f7df6" stroke-width="4" stroke-linecap="round"></line>
      <line x1="${baseX}" y1="${baseY}" x2="${endX}" y2="${endY}" stroke="#2f7df6" stroke-width="4" stroke-linecap="round"></line>
      <path d="${d}" fill="none" stroke="#ff9f43" stroke-width="5" stroke-linecap="round"></path>
      <circle cx="${baseX}" cy="${baseY}" r="6" fill="#16324f"></circle>
      <text x="${baseX + 28}" y="${baseY - 12}" class="point-label">${angle}°</text>
    </svg>
  `;
}

function createQuestionView(question, index) {
  const node = templateEl.content.cloneNode(true);
  const questionEl = node.querySelector(".question");
  const titleEl = node.querySelector(".question-title");
  const bodyEl = node.querySelector(".question-body");

  questionEl.dataset.id = String(question.id);
  quizTopicBadgeEl.textContent = question.topic;
  quizTopicBadgeEl.dataset.topic = question.topic;
  titleEl.textContent = `${index + 1}. ${question.title}`;
  bodyEl.innerHTML = "";

  if (question.type === "input") {
    if (question.topic === "Координаты") {
      const box = document.createElement("div");
      box.className = "geo-box";
      box.innerHTML = makeGridSvg(question.x, question.y);
      bodyEl.append(box);

      const coord = document.createElement("div");
      coord.className = "coordinate-inputs";

      const xField = document.createElement("label");
      xField.className = "coordinate-field";
      const xLabel = document.createElement("span");
      xLabel.textContent = "X";
      const xInput = document.createElement("input");
      xInput.type = "number";
      xInput.min = "1";
      xInput.max = String(question.coordMax);
      xInput.inputMode = "numeric";
      xInput.placeholder = "X";
      xInput.dataset.coordinate = "x";
      xField.append(xLabel, xInput);

      const yField = document.createElement("label");
      yField.className = "coordinate-field";
      const yLabel = document.createElement("span");
      yLabel.textContent = "Y";
      const yInput = document.createElement("input");
      yInput.type = "number";
      yInput.min = "1";
      yInput.max = String(question.coordMax);
      yInput.inputMode = "numeric";
      yInput.placeholder = "Y";
      yInput.dataset.coordinate = "y";
      yField.append(yLabel, yInput);

      coord.append(xField, yField);
      bodyEl.append(coord);

      const hint = document.createElement("div");
      hint.className = "answer-hint";
      hint.textContent = question.hint;
      bodyEl.append(hint);

      const actions = document.createElement("div");
      actions.className = "question-actions";

      const submit = document.createElement("button");
      submit.type = "button";
      submit.className = "btn btn-primary question-submit";
      submit.textContent = "Ответить";
      submit.addEventListener("click", () => {
        submitCurrentAnswer(questionEl, question);
      });

      actions.append(submit);
      bodyEl.append(actions);

      [xInput, yInput].forEach((input) => {
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submitCurrentAnswer(questionEl, question);
          }
        });
      });
    } else {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "answer-input";
      input.placeholder = "Впиши ответ";
      input.dataset.answerInput = "true";
      bodyEl.append(input);

      const hint = document.createElement("div");
      hint.className = "answer-hint";
      hint.textContent = question.hint;
      bodyEl.append(hint);

      const actions = document.createElement("div");
      actions.className = "question-actions";

      const submit = document.createElement("button");
      submit.type = "button";
      submit.className = "btn btn-primary question-submit";
      submit.textContent = "Ответить";
      submit.addEventListener("click", () => {
        submitCurrentAnswer(questionEl, question);
      });

      actions.append(submit);
      bodyEl.append(actions);

      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submitCurrentAnswer(questionEl, question);
        }
      });
    }
  }

  if (question.type === "time") {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "answer-input answer-input--time";
    input.placeholder = "ЧЧ:ММ";
    input.maxLength = 5;
    input.inputMode = "numeric";
    input.dataset.answerInput = "true";

    input.addEventListener("input", () => {
      const digits = input.value.replace(/\D/g, "").slice(0, 4);
      input.value = digits.length >= 3 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
    });

    bodyEl.append(input);

    const hint = document.createElement("div");
    hint.className = "answer-hint";
    hint.textContent = question.hint;
    bodyEl.append(hint);

    const actions = document.createElement("div");
    actions.className = "question-actions";

    const submit = document.createElement("button");
    submit.type = "button";
    submit.className = "btn btn-primary question-submit";
    submit.textContent = "Ответить";
    submit.addEventListener("click", () => submitCurrentAnswer(questionEl, question));
    actions.append(submit);
    bodyEl.append(actions);

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); submitCurrentAnswer(questionEl, question); }
    });
  }

  if (question.type === "choice") {
    if (question.topic === "Сравнение чисел") {
      const row = document.createElement("div");
      row.className = "comparison-row";
      row.innerHTML = `
        <div class="comparison-box">${question.left}</div>
        <div class="comparison-sign">?</div>
        <div class="comparison-box">${question.right}</div>
      `;
      bodyEl.append(row);
    }

    if (question.topic === "Сравнение выражений") {
      const row = document.createElement("div");
      row.className = "comparison-row";
      row.innerHTML = `
        <div class="comparison-box">${question.left}</div>
        <div class="comparison-sign">?</div>
        <div class="comparison-box">${question.right}</div>
      `;
      bodyEl.append(row);
    }

    if (question.topic === "Углы") {
      const geo = document.createElement("div");
      geo.className = "geo-box";
      geo.innerHTML = renderAngleGraphic(question.kind);
      bodyEl.append(geo);
    }

    const group = document.createElement("div");
    const isComparison = question.topic === "Сравнение чисел" || question.topic === "Сравнение выражений";
    group.className = isComparison ? "choice-group choice-group--comparison" : "choice-group";
    question.options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice";
      button.textContent = option;
      button.dataset.choice = option;
      button.addEventListener("click", () => {
        if (locked) {
          return;
        }
        group.querySelectorAll(".choice").forEach((el) => el.classList.remove("selected"));
        button.classList.add("selected");
        submitCurrentAnswer(questionEl, question, option);
      });
      group.append(button);
    });
    bodyEl.append(group);

    const hint = document.createElement("div");
    hint.className = "answer-hint";
    hint.textContent = question.hint;
    bodyEl.append(hint);
  }

  return questionEl;
}

function normalizeText(value) {
  return value.replace(/\s+/g, "").replace(/×/g, "*").replace(/,/g, ",");
}

function disableQuestionInteractions(questionNode) {
  questionNode.querySelectorAll("button, input").forEach((element) => {
    element.disabled = true;
  });
}

function showFeedback(questionNode, ok, correctText) {
  toastEl.className = `app-toast ${ok ? "correct" : "wrong"}`;
  toastEl.textContent = ok ? "✓ Верно!" : `✗ Неверно. Правильный ответ: ${correctText}`;
}

function hideToast() {
  toastEl.className = "app-toast hidden";
}

function updateTimerDisplay() {
  if (timerTextEl) {
    timerTextEl.textContent = formatElapsedTime(Date.now() - startedAt);
  }
}

function showWelcomeScreen() {
  clearTimeout(advanceTimer);
  stopTimer();
  locked = false;
  currentIndex = 0;
  score = 0;
  questionSlotEl.innerHTML = "";
  resultCardEl.classList.add("hidden");
  quizViewEl.classList.add("hidden");
  welcomeScreenEl.classList.remove("hidden");
  updateDiffButtons();
  hideToast();
  timerTextEl.textContent = "0 сек";
}

function showQuizScreen() {
  welcomeScreenEl.classList.add("hidden");
  quizViewEl.classList.remove("hidden");
}

function startTimer() {
  clearInterval(timerInterval);
  updateTimerDisplay();
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function finishQuestion(isCorrect, questionNode, correctText) {
  if (locked) {
    return;
  }

  locked = true;
  if (isCorrect) {
    score += 1;
  }

  showFeedback(questionNode, isCorrect, correctText);
  disableQuestionInteractions(questionNode);

  clearTimeout(advanceTimer);
  advanceTimer = setTimeout(() => {
    locked = false;
    currentIndex += 1;
    renderCurrentQuestion();
  }, 1800);
}

function showResult() {
  const total = questions.length;
  const errors = total - score;
  quizEl.classList.add("hidden");
  resultCardEl.classList.remove("hidden");
  resultScoreEl.textContent = `${score} / ${total}`;

  progressTextEl.textContent = `${total} / ${total}`;
  hideToast();
  questionSlotEl.innerHTML = "";
  stopTimer();
  const elapsedMs = Date.now() - startedAt;
  const timeText = formatElapsedTime(elapsedMs);
  resultTimeEl.textContent = timeText;
  saveProgress(currentDiff, elapsedMs);

  if (errors === 0) {
    resultTitleEl.textContent = "🌟 Отлично!";
    resultTextEl.textContent = `Все ${total} заданий решены верно! Ты настоящий математик!`;
  } else if (errors <= 3) {
    resultTitleEl.textContent = "👍 Хорошо!";
    resultTextEl.textContent = "Совсем немного ошибок — ещё чуть-чуть тренировки, и будет идеально!";
  } else {
    resultTitleEl.textContent = "💪 Продолжай!";
    resultTextEl.textContent = "Ошибки — это нормально, так мы учимся! Попробуй ещё раз.";
  }
}

function parseCoordinateValue(questionNode) {
  const x = questionNode.querySelector("[data-coordinate='x']");
  const y = questionNode.querySelector("[data-coordinate='y']");
  return {
    x: x ? x.value.trim() : "",
    y: y ? y.value.trim() : "",
  };
}

function submitCurrentAnswer(questionNode, question, explicitChoice) {
  if (locked || !questionNode) {
    return;
  }

  if (question.type === "time") {
    const input = questionNode.querySelector("[data-answer-input='true']");
    const value = input.value.trim();
    finishQuestion(value === question.answer, questionNode, question.answer);
    return;
  }

  if (question.type === "input") {
    if (question.topic === "Координаты") {
      const values = parseCoordinateValue(questionNode);
      const ok = values.x === String(question.answer.x) && values.y === String(question.answer.y);
      finishQuestion(ok, questionNode, `${question.answer.x} и ${question.answer.y}`);
      return;
    }

    const input = questionNode.querySelector("[data-answer-input='true']");
    const value = normalizeText(input.value.trim());
    const expected = normalizeText(String(question.answer));
    finishQuestion(value === expected, questionNode, String(question.answer));
    return;
  }

  const value = explicitChoice || questionNode.querySelector(".choice.selected")?.dataset.choice || "";
  finishQuestion(value === question.answer, questionNode, String(question.answer));
}

function updateProgress() {
  const total = questions.length;
  progressTextEl.textContent = `${Math.min(currentIndex + 1, total)} / ${total}`;
}

function renderCurrentQuestion() {
  clearTimeout(advanceTimer);
  hideToast();

  if (currentIndex >= questions.length) {
    showResult();
    return;
  }

  quizEl.classList.remove("hidden");
  questionSlotEl.innerHTML = "";
  questionSlotEl.append(createQuestionView(questions[currentIndex], currentIndex));
  resultCardEl.classList.add("hidden");
  updateProgress();

  const firstInput = questionSlotEl.querySelector("input[data-answer-input], input[data-coordinate]");
  if (firstInput) firstInput.focus();
}

function showTimerStart() {
  startedAt = Date.now();
  startTimer();
}

function startQuiz() {
  clearTimeout(advanceTimer);
  stopTimer();
  questions = buildQuestionPool();
  currentIndex = 0;
  score = 0;
  locked = false;
  showQuizScreen();
  showTimerStart();

  resultTitleEl.textContent = "Готово";
  resultTextEl.textContent = "";
  resultScoreEl.textContent = `0 / ${questions.length}`;

  renderCurrentQuestion();
}

document.querySelectorAll(".diff-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    currentDiff = btn.dataset.level;
    startQuiz();
  });
});

document.getElementById("resetBtn").addEventListener("click", () => {
  if (confirm("Сбросить весь прогресс?\nУровни Средне и Сложно снова заблокируются.")) {
    resetProgress();
    updateDiffButtons();
  }
});

backBtn.addEventListener("click", showWelcomeScreen);
showWelcomeScreen();
