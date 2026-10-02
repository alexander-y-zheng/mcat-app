// Anki card templates are tiny HTML snippets with {{FieldName}} placeholders (see
// apkgImport.js for where qfmt/afmt come from). This swaps those placeholders for the note's
// actual field values so the template renders as real content instead of literal "{{...}}" text.
//
// {{FrontSide}} is a special placeholder meaning "whatever the question side rendered to" —
// it's how the answer side repeats the question above a divider.
//
// NOT handled yet (none of these appear in a typical "Basic"-style deck, so skipping them is a
// deliberate v1 shortcut, not a silent bug): conditional sections ({{#Field}}...{{/Field}}),
// and filters like {{cloze:Field}} or {{type:Field}}. Unsupported markers are just stripped so
// they don't show up as raw "{{...}}" text on the card.
function renderTemplate(template, fields, frontSideHtml) {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, rawName) => {
    const name = rawName.trim();
    if (name === 'FrontSide') return frontSideHtml ?? '';
    if (name.startsWith('#') || name.startsWith('^') || name.startsWith('/')) return '';
    const fieldName = name.includes(':') ? name.split(':')[1] : name;
    return fields[fieldName] ?? '';
  });
}

export function ReviewCard({ note, qfmt, afmt, showAnswer }) {
  const front = renderTemplate(qfmt, note.fields);

  // Anki templates are hand-authored HTML (fonts, colors, layout), so they need to be rendered
  // as HTML rather than plain text. This is safe for a trusted personal import (your friend's
  // own deck), but worth knowing: any HTML/script embedded in an .apkg would run as-is.
  if (!showAnswer) {
    return <div dangerouslySetInnerHTML={{ __html: front }} />;
  }

  const answer = renderTemplate(afmt, note.fields, front);
  return <div dangerouslySetInnerHTML={{ __html: answer }} />;
}
