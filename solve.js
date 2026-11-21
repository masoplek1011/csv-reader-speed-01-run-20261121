// A fast, dependency-free re-implementation of csv-reader 1.0.0's readCsv.
//
// Same answers, different engine: instead of walking the text one character
// at a time, this parser jumps from one interesting character to the next
// with indexOf (comma, quote, LF, CR) and copies whole field segments with
// slice. A field that needs no repair is produced by a single slice; pieces
// are only joined when the field really contains an escaped quote, a line
// break inside quotes, or a stray CR that has to be dropped.
//
// The broken-row policy is csv-reader's own, kept exactly:
//   - a U+FEFF at the very start of the text is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is no
//     record;
//   - outside quotes a CR not followed by LF is dropped (stray_cr);
//   - a field that opens with a quote runs to the next quote that is not
//     doubled, "" inside it is one quote, and each CRLF or lone CR inside
//     it is read as LF; what follows its closing quote, up to the next comma
//     or line break, is appended as it stands (quote_junk, when the field
//     ends); a quote that never closes is a literal character, and the text
//     after it is read again as unquoted (unterminated_quote);
//   - a quote inside an unquoted field is a literal character; fields stay
//     strings, never trimmed or converted;
//   - columns is the first record when header is true, else null; rows holds
//     the records after it (every record when header is false), each padded
//     with "" (short_row, with fields: its field count) or cut (long_row,
//     with extra: the cut fields) to the first record's width;
//   - each error is {code, line, row}, in the order met, a record's
//     short_row or long_row when it ends: line the 1-based line its record
//     starts on, counting every LF, CRLF and lone CR inside quotes, and row
//     its record's index in rows (null for the header).
//
// Pure: no clock, no randomness, no locale, nothing kept from one call to
// the next.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input, {text, header}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;

  // The record being read: the line it starts on and the index in rows it
  // takes (null: the header). Every error below is stamped with these.
  let recordLine = 1;
  let recordRow = null;

  function pushError(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters from pos up to the next comma or line break.
  // `prefix` is text already belonging to the field (the opening quote of an
  // unterminated quoted field, or the content of a closed quoted field whose
  // trailing junk is being read); null for a plain unquoted field. `added`
  // counts the characters this call kept, not the prefix.
  function scanUnquoted(prefix) {
    let chunks = null;
    let added = 0;
    let cur = pos;
    for (;;) {
      const ci = text.indexOf(',', cur);
      const ni = text.indexOf('\n', cur);
      const ri = text.indexOf('\r', cur);
      let idx = -1;
      let kind = END;
      if (ci !== -1) {
        idx = ci;
        kind = COMMA;
      }
      if (ni !== -1 && (idx === -1 || ni < idx)) {
        idx = ni;
        kind = LINE_BREAK;
      }
      if (ri !== -1 && (idx === -1 || ri < idx)) {
        idx = ri;
        kind = LINE_BREAK;
      }
      if (idx === -1) {
        const tail = text.slice(cur, n);
        added += tail.length;
        pos = n;
        const value =
          chunks === null
            ? prefix === null
              ? tail
              : prefix + tail
            : (chunks.push(tail), chunks.join(''));
        return { value, ended: END, added };
      }
      if (kind === LINE_BREAK && text.charCodeAt(idx) === 13 && text.charCodeAt(idx + 1) !== 10) {
        // A lone CR outside quotes is dropped (stray_cr); the field goes on.
        const seg = text.slice(cur, idx);
        added += seg.length;
        if (chunks === null) chunks = prefix === null ? [seg] : [prefix, seg];
        else chunks.push(seg);
        pushError('stray_cr');
        cur = idx + 1;
        continue;
      }
      const tail = text.slice(cur, idx);
      added += tail.length;
      const value =
        chunks === null
          ? prefix === null
            ? tail
            : prefix + tail
          : (chunks.push(tail), chunks.join(''));
      if (kind === COMMA) {
        pos = idx + 1;
        return { value, ended: COMMA, added };
      }
      if (text.charCodeAt(idx) === 13) {
        pos = idx + 2; // CRLF: one line break.
      } else {
        pos = idx + 1;
      }
      line += 1;
      return { value, ended: LINE_BREAK, added };
    }
  }

  // Reads a quoted field whose opening quote is at pos.
  function scanQuoted() {
    const open = pos;
    const openLine = line;
    let chunks = null;
    let cur = pos + 1;
    for (;;) {
      const q = text.indexOf('"', cur);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the text
        // after it is read again as unquoted.
        pos = open + 1;
        line = openLine;
        pushError('unterminated_quote');
        return scanUnquoted('"');
      }
      // A line break inside the quotes, before the next quote, becomes one
      // LF in the value and moves the line count on.
      const ri = text.indexOf('\r', cur);
      const ni = text.indexOf('\n', cur);
      let m = -1;
      let isCR = false;
      if (ri !== -1 && ri < q) {
        m = ri;
        isCR = true;
      }
      if (ni !== -1 && ni < q && (m === -1 || ni < m)) {
        m = ni;
        isCR = false;
      }
      if (m !== -1) {
        const seg = text.slice(cur, m);
        if (chunks === null) chunks = [seg, '\n'];
        else {
          chunks.push(seg);
          chunks.push('\n');
        }
        line += 1;
        cur = isCR ? (text.charCodeAt(m + 1) === 10 ? m + 2 : m + 1) : m + 1;
        continue;
      }
      if (text.charCodeAt(q + 1) === 34) {
        // A doubled quote inside the field is one quote.
        const seg = text.slice(cur, q);
        if (chunks === null) chunks = [seg, '"'];
        else {
          chunks.push(seg);
          chunks.push('"');
        }
        cur = q + 2;
        continue;
      }
      // The closing quote.
      const tail = text.slice(cur, q);
      const value = chunks === null ? tail : (chunks.push(tail), chunks.join(''));
      pos = q + 1;
      if (pos >= n) return { value, ended: END };
      const c = text.charCodeAt(pos);
      if (c === 44) {
        pos += 1;
        return { value, ended: COMMA };
      }
      if (c === 10) {
        pos += 1;
        line += 1;
        return { value, ended: LINE_BREAK };
      }
      if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
        return { value, ended: LINE_BREAK };
      }
      // What follows the closing quote is appended as it stands, up to the
      // next comma or line break.
      const junk = scanUnquoted(value);
      if (junk.added > 0) pushError('quote_junk');
      return junk;
    }
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let field;
    let lastQuoted = false;
    do {
      lastQuoted = text.charCodeAt(pos) === 34;
      field = lastQuoted ? scanQuoted() : scanUnquoted(null);
      fields.push(field.value);
    } while (field.ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
