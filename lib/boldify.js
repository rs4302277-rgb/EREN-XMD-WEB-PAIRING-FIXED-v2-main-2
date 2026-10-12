const MONO_UPPER = 0x1d670;
const MONO_LOWER = 0x1d68a;
const SANS_BOLD_UPPER = 0x1d5d4;
const SANS_BOLD_LOWER = 0x1d5ee;

function mapLatin(text, upperBase, lowerBase) {
  return String(text ?? "").replace(/[A-Za-z]/g, (ch) => {
    const c = ch.charCodeAt(0);
    return String.fromCodePoint(
      (c >= 65 && c <= 90 ? upperBase : lowerBase) +
        (c >= 65 && c <= 90 ? c - 65 : c - 97)
    );
  });
}

export function monoCaps(text) {
  return mapLatin(text, MONO_UPPER, MONO_LOWER);
}

export function sansBold(text) {
  // Mathematical Sans-Serif Bold has a few code points that are not letters;
  // Latin letters map cleanly, while other scripts remain unchanged.
  return mapLatin(text, SANS_BOLD_UPPER, SANS_BOLD_LOWER);
}

export default { monoCaps, sansBold };
