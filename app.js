const $ = id => document.getElementById(id);
let state = null, position = 0, timer = null, pending = null, revision = 0;
let lesson = 'compare';
const quote = value => JSON.stringify(value);
function stopAnimation() {
  clearInterval(timer); timer = null; $('play').textContent = '▶ 播放動畫';
}
function lockPlayback(locked) {
  for (const id of ['play', 'back', 'next', 'reset']) $(id).disabled = locked;
}
function modeUI() {
  const mode = Number($('mode').value);
  $('stop').disabled = mode === 0;
  $('step').disabled = mode < 2;
}
function expressionFromFields() {
  return `text[${['start', 'stop', 'step'].slice(0, Number($('mode').value) + 1).map(id => $(id).value.trim()).join(':')}]`;
}
function invalidate(message, isError = false) {
  lockPlayback(true);
  $('error').hidden = !isError; $('error').textContent = isError ? message : '';
  $('expression').setAttribute('aria-invalid', String(isError));
  $('result').textContent = '—'; $('count').textContent = '';
  $('cells').replaceChildren(); $('path').textContent = '—';
  $('explanation').textContent = isError ? '修正輸入後，觀察台會重新計算。' : '正在更新索引與結果…';
  $('syntax').textContent = $('expression').value;
  $('direction').textContent = '—'; $('kind').textContent = '';
  $('progress').textContent = '—'; $('code').textContent = '';
  $('triangle').hidden = true;
  $('examples').replaceChildren();
}
function schedule(source) {
  stopAnimation(); clearTimeout(pending); ++revision; position = 0;
  state = null;
  if (source === 'fields') { modeUI(); $('expression').value = expressionFromFields(); }
  invalidate('計算中…');
  pending = setTimeout(() => update(revision), 140);
}
function update(id) {
  if (id !== revision) return;
  const data = Slicing.evaluate($('text').value, $('expression').value);
  // Parsed syntax remains synchronized even for step=0 or an out-of-range index.
  if (data.fields) {
    $('mode').value = data.colons;
    ['start', 'stop', 'step'].forEach((key, i) => $(key).value = data.fields[i]);
    modeUI();
  }
  if (data.error) {
    state = null;
    invalidate(data.error, true);
    return;
  }
  state = data;
  $('error').hidden = true;
  $('expression').setAttribute('aria-invalid', 'false');
  render(); renderLessons();
}
function render() {
  if (!state) return;
  const chars = Array.from($('text').value), selected = new Set(state.indices);
  const visited = new Set(state.indices.slice(0, position));
  const boundary = state.colons ? state.normalized[1] : null;
  $('cells').replaceChildren();
  chars.forEach((char, index) => {
    const cell = document.createElement('div'); cell.className = 'cell';
    if (selected.has(index)) cell.classList.add('selected');
    if (visited.has(index)) cell.classList.add('visited');
    if (index === state.normalized[0]) cell.classList.add('origin');
    if (index === boundary) cell.classList.add('boundary');
    if (state.indices[position] === index) cell.classList.add('upcoming');
    cell.title = `索引 ${index} / ${index - chars.length}：${quote(char)}`;
    for (const [text, cls] of [[index, 'idx'], [char === ' ' ? '␣' : char === '\n' ? '↵' : char === '\t' ? '⇥' : char, 'char'], [index - chars.length, 'idx negative']]) {
      const part = document.createElement('span'); part.className = cls; part.textContent = text; cell.append(part);
    }
    $('cells').append(cell);
  });
  if (!chars.length) $('cells').textContent = '文字序列是空的。切片會得到空字串。';
  $('syntax').textContent = state.expression;
  $('kind').textContent = ['單一索引 · 取一個字元', '一個冒號 · 預設步長 1', '兩個冒號 · 可指定步長'][state.colons];
  $('direction').textContent = state.colons === 0 ? '定位單一字元' : state.step < 0 ? '← 向左取值' : '向右取值 →';
  $('result').textContent = quote(state.result);
  $('count').textContent = `${state.indices.length} 個字元${state.result === '' ? ' · 空字串' : ''}`;
  const path = state.indices.map(i => `${quote(chars[i])} (${i})`);
  $('path').textContent = path.length ? path.join(' → ') : '沒有選取任何字元';
  $('progress').textContent = `已走過 ${position} / ${state.indices.length}`;
  lockPlayback(false);
  $('play').disabled = $('reset').disabled = !state.indices.length;
  $('back').disabled = position === 0; $('next').disabled = position === state.indices.length;
  if (state.colons === 0) {
    $('explanation').textContent = `單一索引 ${state.fields[0]} 對應正索引 ${state.normalized[0]}，取得一個字元。沒有冒號，所以不是範圍切片。`;
  } else {
    const [a, b, step] = state.normalized;
    const distance = (state.fields[2] || '1').replace(/^[+-]/, '');
    const stopText = state.fields[1] === '' ? (step < 0 ? 'stop 省略，邊界位於第一個字元左側，可包含索引 0。' : 'stop 省略，邊界位於最後一個字元右側。') : `stop ${state.fields[1]} 換算並裁切後的停止邊界是 ${b}，不包含該位置。`;
    $('explanation').textContent = chars.length ? `裁切後的起點為 ${a}，每次向${step < 0 ? '左' : '右'}移動 ${distance} 格。${stopText}${state.indices.length ? '' : '目前起點無法沿此方向到達範圍內的字元，因此得到空字串。'}` : '文字序列是空的，沒有可以選取的字元，因此切片結果是空字串。';
  }
  $('code').textContent = `text = ${quote($('text').value)}\nprint(${state.expression})\n# 結果：${quote(state.result)}`;
  $('triangle').hidden = lesson !== 'triangle';
  $('triangle').textContent = `text + ${state.expression} = ${quote($('text').value + state.result)}`;
}
function renderLessons() {
  if (!state) return;
  $('lesson-tabs').replaceChildren();
  for (const item of state.lessons) {
    const button = document.createElement('button'); button.textContent = item.title;
    button.setAttribute('aria-pressed', String(item.key === lesson));
    button.onclick = () => { lesson = item.key; renderLessons(); render(); };
    $('lesson-tabs').append(button);
  }
  const current = state.lessons.find(item => item.key === lesson);
  $('lesson-description').textContent = current.description;
  $('examples').replaceChildren();
  for (const row of current.rows) {
    const tr = document.createElement('tr');
    if (row.expression === state.expression) tr.classList.add('active-row');
    const syntaxCell = document.createElement('td'), button = document.createElement('button');
    button.className = 'example-button'; button.textContent = row.expression;
    button.setAttribute('aria-label', `套用 ${row.expression}`);
    button.onclick = () => { $('expression').value = row.expression; schedule('expression'); };
    syntaxCell.append(button);
    const resultCell = document.createElement('td'), result = document.createElement('code');
    result.textContent = row.error ? 'IndexError' : quote(row.result);
    if (row.error) result.title = row.error;
    resultCell.append(result);
    const parameters = document.createElement('td');
    const parts = row.expression.slice(5, -1).split(':');
    parameters.className = 'example-parameters';
    parameters.textContent = parts.length === 1 ? `index = ${parts[0]}` :
      `start = ${parts[0] || '省略'}\nstop = ${parts[1] || '省略'}\nstep = ${parts.length === 3 && parts[2] ? parts[2] : '1（預設）'}`;
    const description = document.createElement('td');
    const rule = document.createElement('p'); rule.textContent = row.explanation;
    const detail = document.createElement('p'); detail.className = 'example-detail';
    if (row.error) {
      detail.textContent = row.error;
    } else if (parts.length === 1) {
      detail.textContent = `目前字串長度為 ${Array.from($('text').value).length}，索引 ${parts[0]} 對應正索引 ${row.normalized[0]}。單一索引只取得該位置的一個字元；超出範圍會產生 IndexError。`;
    } else {
      const [start, stop, step] = row.normalized;
      const boundary = parts[1] === '' ? (step < 0 ? 'stop 省略，走到第一個字元的左側，所以索引 0 也可以被選到。' : 'stop 省略，走到字串右側的邊界。') : `stop 換算並裁切後是索引 ${stop}，該位置不會被取出。`;
      const path = row.indices.length ? `依序取出正索引 ${row.indices.slice(0, 12).join(' → ')}${row.indices.length > 12 ? ' → …' : ''}。` : '沿這個方向沒有可以取得的字元，因此結果是空字串。';
      detail.textContent = $('text').value === '' ? '文字序列是空的，沒有可以選取的字元，因此切片結果是空字串。' : `裁切後的起點為 ${start}，每次向${step < 0 ? '左' : '右'}移動 ${Math.abs(step)} 格。${boundary}${path}`;
    }
    description.append(rule, detail);
    tr.append(syntaxCell, parameters, resultCell, description); $('examples').append(tr);
  }
}
for (const id of ['text', 'expression']) $(id).addEventListener('input', () => schedule(id));
for (const id of ['start', 'stop', 'step']) $(id).addEventListener('input', () => schedule('fields'));
$('mode').addEventListener('change', () => {
  if (Number($('mode').value) < 2) $('step').value = '';
  if (Number($('mode').value) === 0) $('stop').value = '';
  schedule('fields');
});
$('next').onclick = () => { stopAnimation(); position = Math.min(position + 1, state.indices.length); render(); };
$('back').onclick = () => { stopAnimation(); position = Math.max(position - 1, 0); render(); };
$('reset').onclick = () => { stopAnimation(); position = 0; render(); };
$('play').onclick = () => {
  if (timer) { stopAnimation(); return; }
  if (position >= state.indices.length) position = 0;
  $('play').textContent = 'Ⅱ 暫停';
  timer = setInterval(() => { position++; render(); if (position >= state.indices.length) stopAnimation(); }, 550);
};
modeUI(); schedule('expression');
