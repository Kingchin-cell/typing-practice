(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // ---- DOM 引用 ----
  const textDisplay = $('text-display');
  const ghostInput = $('ghost-input');
  const hint = $('hint');
  const finishBtn = $('finish-btn');
  const statSpeed = $('stat-speed');
  const statAccuracy = $('stat-accuracy');
  const statProgress = $('stat-progress');
  const statTimer = $('stat-timer');
  const timerLabel = $('timer-label');
  const modal = $('result-modal');
  const resultTitle = $('result-title');
  const rSpeed = $('r-speed');
  const rAccuracy = $('r-accuracy');
  const rChars = $('r-chars');
  const rTime = $('r-time');
  const bookSelect = $('book-select');
  const bookPicker = $('book-picker');
  const bookAuthor = $('book-author');
  const bookProgress = $('book-progress');
  const jumpInput = $('jump-input');
  const jumpBtn = $('jump-btn');
  const historyBtn = $('history-btn');
  const historyModal = $('history-modal');
  const historyList = $('history-list');

  // ---- 状态 ----
  let mode = 'zh';        // zh | en | classic
  let duration = 60;      // 秒；0 = 无尽
  let bookKey = Object.keys(CLASSICS)[0]; // 名著模式下当前作品
  let passageIndex = 0;   // 名著模式下当前段落索引（顺序播放）
  let currentPassage = 0;  // 名著模式当前显示段（0-based）
  let text = '';          // 当前段落
  let spans = [];         // 字符 span 引用
  let charResults = [];   // 每位置是否正确（true/false/undefined）
  let cursor = 0;         // 当前待打位置
  let correctCount = 0;   // 正确字符累计
  let wrongCount = 0;     // 错误字符累计
  let startTime = 0;
  let running = false;
  let finished = false;
  let intervalId = null;
  let composing = false;  // 输入法组合中
  let lastValue = '';     // 英文模式 textarea 上次值

  // ---- 文本工具 ----
  function randomText() {
    if (mode === 'classic') {
      // 名著：按顺序取段，最后一段打完回到第一段（循环）
      const passages = CLASSICS[bookKey].passages;
      currentPassage = passageIndex % passages.length;
      const t = passages[currentPassage];
      passageIndex++;
      return t;
    }
    const pool = TEXT_LIBRARY[mode];
    let t = pool[Math.floor(Math.random() * pool.length)];
    if (t === text && pool.length > 1) {
      t = pool[Math.floor(Math.random() * pool.length)];
    }
    return t;
  }

  // ---- 渲染 ----
  function render() {
    textDisplay.textContent = '';
    spans = [];
    charResults = [];
    for (let i = 0; i < text.length; i++) {
      const span = document.createElement('span');
      span.className = 'char';
      span.textContent = text[i];
      textDisplay.appendChild(span);
      spans.push(span);
    }
    cursor = 0;
    updateCaret();
  }

  function updateCaret() {
    for (let i = 0; i < spans.length; i++) {
      if (i === cursor) {
        spans[i].classList.add('caret');
      } else {
        spans[i].classList.remove('caret');
      }
    }
  }

  // ---- 计时 ----
  function fmtTime(sec) {
    sec = Math.floor(sec);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function start() {
    running = true;
    finished = false;
    startTime = Date.now();
    hint.textContent = mode === 'en' ? '英文：直接敲键盘输入' : '中文：用输入法打字上屏';
    finishBtn.classList.toggle('hidden', duration !== 0);
    timerLabel.textContent = duration === 0 ? '用时' : '剩余';
    intervalId = setInterval(tick, 1000);
    tick();
  }

  function tick() {
    if (!running) return;
    const elapsed = (Date.now() - startTime) / 1000;
    updateSpeed(elapsed);
    if (duration === 0) {
      statTimer.textContent = fmtTime(elapsed);
    } else {
      const remaining = Math.max(0, duration - elapsed);
      statTimer.textContent = fmtTime(remaining);
      if (remaining <= 0) {
        finish();
        return;
      }
    }
  }

  // ---- 打字引擎 ----
  function processChars(input) {
    if (finished) return;
    if (!running) start();
    let consumed = 0;
    for (const ch of input) {
      if (cursor >= text.length) break;
      const expected = text[cursor];
      if (ch === expected) {
        correctCount++;
        charResults[cursor] = true;
        spans[cursor].classList.add('done');
      } else {
        wrongCount++;
        charResults[cursor] = false;
        spans[cursor].classList.add('error');
      }
      cursor++;
      consumed++;
    }
    if (consumed > 0) {
      if (cursor >= text.length) {
        loadNext();
        return;
      }
      updateCaret();
      updateStats();
    }
  }

  function backspace() {
    if (finished || cursor <= 0) return;
    cursor--;
    if (charResults[cursor] === true) correctCount--;
    else if (charResults[cursor] === false) wrongCount--;
    charResults[cursor] = undefined;
    spans[cursor].classList.remove('done', 'error');
    updateCaret();
    updateStats();
  }

  function updateBookProgress() {
    if (mode !== 'classic') return;
    const total = CLASSICS[bookKey].passages.length;
    bookProgress.textContent = (currentPassage + 1) + ' / ' + total;
  }

  function loadNext() {
    text = randomText();
    if (mode === 'classic') setProgress(bookKey, passageIndex);
    render();
    updateStats();
    updateBookProgress();
  }

  // ---- 统计 ----
  function updateStats() {
    const total = correctCount + wrongCount;
    const acc = total > 0 ? Math.round((correctCount / total) * 100) : 100;
    statAccuracy.textContent = acc + '%';
    statProgress.textContent = Math.round((cursor / text.length) * 100) + '%';
  }

  function updateSpeed(elapsed) {
    statSpeed.textContent = elapsed > 0 ? Math.round((correctCount / elapsed) * 60) : 0;
  }

  // ---- 输入事件 ----
  ghostInput.addEventListener('input', () => {
    const v = ghostInput.value;
    if (composing) return;
    if (mode === 'zh') {
      ghostInput.value = '';
      lastValue = '';
      return;
    }
    if (v.length > lastValue.length) {
      processChars(v.slice(lastValue.length));
    } else if (v.length < lastValue.length) {
      const diff = lastValue.length - v.length;
      for (let i = 0; i < diff; i++) backspace();
    }
    lastValue = v;
  });

  ghostInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault();
    // 中文/名著模式：上屏后退格修正（输入法组合中交给输入法；英文模式由 input 事件处理）
    if (e.key === 'Backspace' && mode !== 'en' && !composing && !e.isComposing) {
      e.preventDefault();
      backspace();
    }
  });

  // 中文模式：输入法上屏后逐字对比
  ghostInput.addEventListener('compositionstart', () => {
    composing = true;
  });

  ghostInput.addEventListener('compositionend', (e) => {
    composing = false;
    if (e.data) processChars(e.data);
    ghostInput.value = '';
    lastValue = '';
  });

  // ---- 重置 ----
  function restart() {
    finished = false;
    running = false;
    clearInterval(intervalId);
    intervalId = null;
    correctCount = 0;
    wrongCount = 0;
    ghostInput.value = '';
    lastValue = '';
    statSpeed.textContent = '0';
    statAccuracy.textContent = '100%';
    statProgress.textContent = '0%';
    statTimer.textContent = duration === 0 ? '0:00' : fmtTime(duration);
    timerLabel.textContent = duration === 0 ? '用时' : '剩余';
    finishBtn.classList.add('hidden');
    hint.textContent = '点击任意处，直接开始打字';
    modal.classList.add('hidden');
    // 名著模式：显示/更新作品选择器
    bookSelect.classList.toggle('hidden', mode !== 'classic');
    if (mode === 'classic') {
      bookPicker.value = bookKey;
      bookAuthor.textContent = CLASSICS[bookKey].author;
      // 从上次保存的进度继续（无记录则从第一段开始）
      passageIndex = loadProgress()[bookKey] || 0;
    }
    text = randomText();
    render();
    updateBookProgress();
  }

  // ---- 结束与结算 ----
  function finish() {
    if (finished) return;
    finished = true;
    running = false;
    clearInterval(intervalId);
    intervalId = null;
    finishBtn.classList.add('hidden');
    const elapsed = Math.max(1, (Date.now() - startTime) / 1000);
    const total = correctCount + wrongCount;
    const acc = total > 0 ? Math.round((correctCount / total) * 100) : 100;
    const speed = Math.round((correctCount / elapsed) * 60);
    resultTitle.textContent = duration === 0 ? '练习结束！' : '时间到！';
    rSpeed.textContent = speed;
    rAccuracy.textContent = acc + '%';
    rChars.textContent = correctCount;
    rTime.textContent = fmtTime(elapsed);
    modal.classList.remove('hidden');
    // 保存名著进度（下次从当前段落继续）
    if (mode === 'classic') setProgress(bookKey, passageIndex);
    // 保存练习记录
    const list = loadHistory();
    list.unshift({
      time: new Date().toLocaleString('zh-CN', { hour12: false }),
      mode: recordModeLabel(),
      speed: speed,
      acc: acc,
      chars: correctCount
    });
    saveHistory(list.slice(0, 50));
  }

  $('restart-btn').addEventListener('click', restart);
  finishBtn.addEventListener('click', finish);

  // ---- 模式 / 时长切换（练习中禁止切换） ----
  function bindSwitch(selector, onPick) {
    const btns = document.querySelectorAll(selector + ' .switch-btn');
    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        onPick(btn);
        btns.forEach((b) => b.classList.toggle('active', b === btn));
        restart();
      });
    });
  }

  bindSwitch('#mode-switch', (btn) => { mode = btn.dataset.mode; });
  bindSwitch('#duration-switch', (btn) => { duration = parseInt(btn.dataset.duration, 10); });

  // ---- 名著进度记忆（书签续练） ----
  const PROGRESS_KEY = 'classic-progress';

  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_KEY)) || {};
    } catch (e) {
      return {};
    }
  }

  function saveProgress(map) {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
    } catch (e) { /* 忽略 */ }
  }

  function setProgress(book, index) {
    const map = loadProgress();
    map[book] = index;
    saveProgress(map);
  }

  function clearProgress(book) {
    const map = loadProgress();
    delete map[book];
    saveProgress(map);
  }

  // ---- 练习记录（本地记忆） ----
  const HISTORY_KEY = 'typing-history';

  function loadHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch (e) { /* 存储失败忽略 */ }
  }

  function recordModeLabel() {
    if (mode === 'classic') return '名著·' + CLASSICS[bookKey].author;
    return mode === 'zh' ? '中文' : '英文';
  }

  function renderHistory() {
    const list = loadHistory();
    if (!list.length) {
      historyList.innerHTML = '<p class="history-empty">还没有练习记录，快去打一局吧！</p>';
      return;
    }
    historyList.innerHTML = list.map((r) =>
      '<div class="history-item">' +
      '<span class="h-time">' + r.time + '</span>' +
      '<span class="h-mode">' + r.mode + '</span>' +
      '<span class="h-speed">' + r.speed + '字/分</span>' +
      '<span class="h-acc">' + r.acc + '%</span>' +
      '<span class="h-chars">' + r.chars + '字</span>' +
      '</div>'
    ).join('');
  }

  historyBtn.addEventListener('click', () => {
    renderHistory();
    historyModal.classList.remove('hidden');
  });

  $('history-close').addEventListener('click', () => {
    historyModal.classList.add('hidden');
  });

  $('history-clear').addEventListener('click', () => {
    if (window.confirm('确定清空全部练习记录吗？')) {
      saveHistory([]);
      renderHistory();
    }
  });

  // ---- 名著作品选择器 ----
  for (const key of Object.keys(CLASSICS)) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    bookPicker.appendChild(opt);
  }

  bookPicker.addEventListener('change', () => {
    bookKey = bookPicker.value;
    bookAuthor.textContent = CLASSICS[bookKey].author;
    restart();
  });

  $('reset-progress').addEventListener('click', () => {
    if (window.confirm('确定从头开始吗？将清除「' + bookKey + '」的进度记录。')) {
      clearProgress(bookKey);
      restart();
    }
  });

  jumpBtn.addEventListener('click', () => {
    const n = parseInt(jumpInput.value, 10);
    const total = CLASSICS[bookKey].passages.length;
    if (!n || n < 1 || n > total) return;
    setProgress(bookKey, n - 1);
    restart();
  });

  jumpInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') jumpBtn.click();
  });

  // ---- 点击页面任意处聚焦输入（select 除外，避免抢走作品下拉焦点） ----
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('select')) return;
    ghostInput.focus({ preventScroll: true });
  });

  // ---- 初始化 ----
  restart();
})();
