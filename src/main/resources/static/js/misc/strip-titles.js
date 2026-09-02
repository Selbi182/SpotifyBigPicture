const USELESS_WORDS = [
  "radio",
  "anniversary",
  "bonus",
  "deluxe",
  "special",
  "edition",
  "explicit",
  "extended",
  "expansion",
  "expanded",
  "version",
  "ver\.",
  "cover",
  "original",
  "single",
  "ep",
  "motion\\spicture",
  "ost",
  "sound.?track",
  "theme",
  "from",
  "re.?master",
  "re.?issue",
  "re.?record",
  "re.?imagine",
  "mono",
  "stereo",
  "\\d{4}"
];
const WHITELISTED_WORDS = [
  "instrumental",
  "orchestral",
  "symphonic",
  "live",
  "classic",
  "demo",
  "session",
  "reprise",
  "re.?mix",
  "re.?visit",
  "take",
  "edit",
  "alternate",
  "alternative",
  "alt"
];

function buildUselessWordRegex(words) {
  const w = words.join("|");
  return new RegExp(
    "\\s*(?:"
    + "\\([^)]*?(" + w + ")[^)]*?\\)\\s*$|"
    + "\\[[^\\]]*?(" + w + ")[^\\]]*?\\]\\s*$|"
    + "-\\s[^-]*?(" + w + ").*$|"
    + ":\\s[^:]*?(" + w + ").*$|"
    + ",\\s[^,]*?(" + w + ").*$"
    + ")",
    "ig"
  );
}
const USELESS_WORDS_REGEX = buildUselessWordRegex(USELESS_WORDS);
const USELESS_WORDS_REGEX_JUST_WHITELIST = buildUselessWordRegex(WHITELISTED_WORDS);
const USELESS_WORDS_REGEX_WITH_WHITELIST = buildUselessWordRegex([...USELESS_WORDS, ...WHITELISTED_WORDS]);

function separateUnimportantTitleInfo(title) {
  const aggressive = isPrefEnabled("strip-titles-aggressive");
  const uselessWordRegex = aggressive ? USELESS_WORDS_REGEX_WITH_WHITELIST : USELESS_WORDS_REGEX;
  let index = title.search(uselessWordRegex);
  let containsWhitelisted = title.search(USELESS_WORDS_REGEX_JUST_WHITELIST);
  if (index >= 0 && (aggressive || containsWhitelisted < 0)) {
    let mainTitle = title.substring(0, index);
    let extraTitle = title.substring(index, title.length);
    return {
      main: mainTitle,
      extra: extraTitle
    };
  }
  return {
    main: title,
    extra: ""
  };
}