/* Python-compatible string indexing and slicing. No eval, network, or persistence. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./lessons.js'));
  else root.Slicing = factory(root.SlicingLessons);
})(globalThis, function (lessons) {
  'use strict';
  function integer(value) {
    if (value === '') return null;
    if (!/^[+-]?[0-9]{1,100}$/u.test(value)) throw new Error('索引與步長只能是整數，或留空表示省略。');
    return BigInt(value);
  }
  function parse(expression) {
    if (typeof expression !== 'string' || Array.from(expression).length > 400) throw new Error('請輸入 text[-2::-1] 這樣的索引或切片語法。');
    expression = expression.trim();
    const match = /^(?:text)?\[([^\[\]]*)\]$/u.exec(expression);
    const parts = (match ? match[1] : expression).split(':');
    if (parts.length > 3) throw new Error('切片最多只有兩個冒號：text[start:stop:step]。');
    const values = parts.map(part => integer(part.trim()));
    if (parts.length === 1 && values[0] === null) throw new Error('單一索引不能留空；取得全部請輸入 text[:]。');
    return { values, colons: parts.length - 1 };
  }
  function metadata({values, colons}) {
    const parts = values.map(value => value === null ? '' : String(value));
    return {expression:`text[${parts.join(':')}]`, colons, fields:parts.concat(['','','']).slice(0,3)};
  }
  function calculate(chars, {values, colons}) {
    const length = BigInt(chars.length);
    if (colons === 0) {
      let index = values[0];
      if (index < -length || index >= length) throw new Error('IndexError：單一索引超出字串範圍；切片超界則會自動裁切。');
      if (index < 0n) index += length;
      const n = Number(index);
      return {result:chars[n], indices:[n], normalized:[n], step:null};
    }
    const step = values[2] === undefined || values[2] === null ? 1n : values[2];
    if (step === 0n) throw new Error('ValueError：step 不可為 0，因為每次必須移動至少一格。');
    const positive = step > 0n;
    const low = positive ? 0n : -1n, high = positive ? length : length - 1n;
    function bound(value, omitted) {
      // An omitted negative stop is the left boundary, not the character at -1.
      if (value === null || value === undefined) return omitted;
      if (value < 0n) value += length;
      return value < low ? low : value > high ? high : value;
    }
    const start = bound(values[0], positive ? 0n : length - 1n);
    const stop = bound(values[1], positive ? length : -1n);
    const indices = [];
    // All arithmetic stays exact, even beyond Number.MAX_SAFE_INTEGER.
    for (let i = start; positive ? i < stop : i > stop; i += step) indices.push(Number(i));
    return {result:indices.map(i => chars[i]).join(''), indices,
      normalized:[Number(start), Number(stop), Number(step)], step:Number(step)};
  }
  function evaluate(text, expression) {
    let info = {};
    try {
      if (typeof text !== 'string' || Array.from(text).length > 500) throw new Error('請輸入 500 個 Unicode 字元以內的文字。');
      const chars = Array.from(text), parsed = parse(expression);
      info = metadata(parsed);
      const result = {...calculate(chars, parsed), ...info};
      result.lessons = lessons.map(({key, title, description, examples}) => ({key, title, description,
        rows:examples.map(([inner, explanation]) => {
          const row = {expression:`text[${inner}]`, explanation};
          try { return {...row, ...calculate(chars, parse(inner))}; }
          catch (error) { return {...row, error:error.message}; }
        })}));
      return result;
    } catch (error) { return {...info, error:error.message}; }
  }
  return {parse, calculate, evaluate};
});
