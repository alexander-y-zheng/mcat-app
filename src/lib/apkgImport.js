import initSqlJs from 'sql.js';
import JSZip from 'jszip'; // npm install jszip
import { dbPromise } from './db';

// sql.js returns { columns: [...], values: [[...], [...]] } per query.
// This turns that into an array of plain objects, one per row.
function rowsToObjects(result) {
  if (!result || result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

// Builds a map of modelId -> ordered field names, e.g. { "123": ["Front", "Back"] }
// so we know what each \x1f-separated chunk of a note's `flds` actually represents.
function buildFieldNamesByModel(modelsJson) {
  const models = JSON.parse(modelsJson);
  const fieldNamesByModel = {};
  for (const modelId of Object.keys(models)) {
    const model = models[modelId];
    const sortedFields = [...model.flds].sort((a, b) => a.ord - b.ord);
    fieldNamesByModel[modelId] = sortedFields.map((f) => f.name);
  }
  return fieldNamesByModel;
}

// Anki note types don't actually have fields called "Front"/"Back" — a note type can name its
// fields anything (e.g. "Altius - Physics - Definition - Front"). What makes a card show a
// front/back at all is its *card template*: a small HTML snippet with {{FieldName}} placeholders
// (qfmt = question format, afmt = answer format). A note can have multiple templates (multiple
// cards per note); `cards.ord` says which template a given card uses.
//
// So instead of guessing field names, we grab each model's templates here (in field-name-agnostic
// form — the {{...}} placeholders get resolved later, at render time, in ReviewCard) and store
// the raw qfmt/afmt text per card.
function buildTemplatesByModel(modelsJson) {
  const models = JSON.parse(modelsJson);
  const templatesByModel = {};
  for (const modelId of Object.keys(models)) {
    const model = models[modelId];
    const sortedTemplates = [...model.tmpls].sort((a, b) => a.ord - b.ord);
    templatesByModel[modelId] = sortedTemplates.map((t) => ({ qfmt: t.qfmt, afmt: t.afmt }));
  }
  return templatesByModel;
}

export async function importApkg(file) {
  const zip = await JSZip.loadAsync(file);
  const dbFile = zip.file('collection.anki21') || zip.file('collection.anki2');
  if (!dbFile) {
    throw new Error('This .apkg doesn\'t contain a collection.anki21 or collection.anki2 database — is it a valid Anki export?');
  }
  const dbBuffer = await dbFile.async('uint8array');

  const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
  const sqliteDb = new SQL.Database(dbBuffer);

  const col = rowsToObjects(sqliteDb.exec('SELECT * FROM col'))[0];
  if (!col) {
    throw new Error('This .apkg\'s collection database has no rows in its "col" table — the file may be corrupt.');
  }
  const noteRows = rowsToObjects(sqliteDb.exec('SELECT * FROM notes'));
  const cardRows = rowsToObjects(sqliteDb.exec('SELECT * FROM cards'));
  const fieldNamesByModel = buildFieldNamesByModel(col.models);
  const templatesByModel = buildTemplatesByModel(col.models);

  // cards rows only reference a note by id (nid), not by model id directly — we need the
  // note's model id to know which model's templates apply to a given card.
  const modelIdByNoteId = new Map(noteRows.map((row) => [row.id, row.mid]));

  const notes = noteRows.map((row) => {
    const fieldNames = fieldNamesByModel[row.mid] || [];
    const fieldValues = row.flds.split('\x1f');
    const fields = {};
    fieldNames.forEach((name, i) => {
      fields[name] = fieldValues[i] ?? '';
    });

    return {
      id: row.id,
      modelId: row.mid,
      fields,
      sortField: row.sfld,
      tags: row.tags.trim().split(/\s+/).filter(Boolean),
    };
  });

  // Freshly imported cards are treated as brand-new: due immediately, no review history yet.
  // We don't carry over Anki's own scheduling state (due/ivl/factor) — our own scheduler owns that from here on.
  const now = Date.now();
  const cards = cardRows.map((row) => {
    const modelId = modelIdByNoteId.get(row.nid);
    const templates = templatesByModel[modelId] || [];
    // row.ord selects which of the note type's templates this particular card uses
    // (e.g. a "Basic (and reversed card)" note type produces 2 cards from 1 template list).
    const template = templates[row.ord] || { qfmt: '', afmt: '' };

    return {
      id: row.id,
      noteId: row.nid,
      deckId: row.did,
      ord: row.ord,
      interval: 0,
      easeFactor: 2.5,
      due: now,
      qfmt: template.qfmt,
      afmt: template.afmt,
    };
  });

  const db = await dbPromise;
  const tx = db.transaction(['notes', 'cards'], 'readwrite');
  for (const note of notes) {
    tx.objectStore('notes').put(note);
  }
  for (const card of cards) {
    tx.objectStore('cards').put(card);
  }
  await tx.done;

  // media: zip also contains a "media" file (JSON map) + numbered media files —
  // fine to skip tonight if her test deck has no images; handle before showing her anything with pictures
}
