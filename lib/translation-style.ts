/**
 * How each of MemoValet's 21 languages actually sounds when people talk, and
 * the slang they talk in.
 *
 * Machine translation's usual failing in a meeting is not vocabulary — it is
 * register. "Yeah nah, let's park that till arvo" comes back as a polite
 * textbook sentence, addressed with the formal "you", in a dialect nobody in
 * the room speaks. Two things fix that, and they are what this file holds:
 *
 * `register` — how casual speech is written in that language: which "you" to
 * use, which dialect to prefer, which particles carry tone. This shapes what
 * comes out, and is sent every time that language is being read.
 *
 * `slang` — expressions that are common in speech and easy to mistranslate,
 * with what they actually mean. Only the ones that appear in what was just
 * said are sent (see translation-prompt), so the prompt stays short.
 *
 * These lists are a starting point, not a dictionary: every language here has
 * far more slang than this, and a lot of it is regional and changes yearly.
 * They are meant to be added to by people who speak these languages daily.
 */

export interface SlangEntry {
  /** As it is said or written, including the script it is said in. */
  term: string;
  /** What it means, plainly, for the translator to work from. */
  means: string;
}

export interface LanguageStyle {
  register: string;
  slang: SlangEntry[];
}

/** Work talk, which is where most of a meeting's slang actually comes from. */
const MEETING_ENGLISH: SlangEntry[] = [
  { term: "circle back", means: "come back to this later" },
  { term: "touch base", means: "have a quick catch-up" },
  { term: "park that", means: "leave it aside for now" },
  { term: "put a pin in it", means: "leave it aside for now" },
  { term: "take it offline", means: "discuss it separately, outside this meeting" },
  { term: "ballpark", means: "a rough estimate" },
  { term: "bandwidth", means: "time or capacity to take something on" },
  { term: "blocker", means: "something stopping the work" },
  { term: "quick win", means: "something easy that helps straight away" },
  { term: "low-hanging fruit", means: "the easiest worthwhile things to do first" },
  { term: "heads up", means: "advance warning" },
  { term: "EOD", means: "by the end of today" },
  { term: "COB", means: "by the end of the working day" },
  { term: "ASAP", means: "as soon as possible" },
  { term: "deep dive", means: "a detailed look at something" },
  { term: "loop in", means: "include someone in the conversation" },
  { term: "run it past", means: "check it with someone" },
  { term: "on my plate", means: "among the things I have to do" },
  { term: "double down", means: "commit harder to something" },
  { term: "move the needle", means: "make a real difference" },
];

export const LANGUAGE_STYLES: Record<string, LanguageStyle> = {
  English: {
    register:
      "Write English the way people speak it at work: contractions (we'll, don't, it's), short sentences, plain words. Keep hedges and fillers that carry meaning (\"sort of\", \"I reckon\", \"to be fair\"). Don't upgrade casual speech into formal business English.",
    slang: [
      ...MEETING_ENGLISH,
      { term: "arvo", means: "afternoon (Australian)" },
      { term: "servo", means: "petrol station (Australian)" },
      { term: "heaps", means: "a lot (Australian/NZ)" },
      { term: "reckon", means: "think or believe" },
      { term: "keen", means: "willing, eager" },
      { term: "yeah nah", means: "no, softened (Australian)" },
      { term: "nah yeah", means: "yes, softened (Australian)" },
      { term: "no worries", means: "that's fine / you're welcome" },
      { term: "fair enough", means: "that's reasonable" },
      { term: "dodgy", means: "unreliable or suspect" },
      { term: "faff", means: "waste time on fiddly things (British)" },
      { term: "knackered", means: "exhausted (British)" },
      { term: "chuffed", means: "pleased (British)" },
      { term: "gutted", means: "very disappointed (British)" },
      { term: "cheers", means: "thanks, or goodbye (British/Australian)" },
      { term: "sorted", means: "dealt with, arranged" },
      { term: "mate", means: "friendly address to anyone" },
      { term: "sus", means: "suspicious, dubious" },
      { term: "ghosted", means: "stopped replying with no explanation" },
      { term: "snowed under", means: "overwhelmed with work" },
    ],
  },

  Arabic: {
    register:
      "Match the dialect the speaker used — Egyptian, Levantine, Gulf, Maghrebi — rather than defaulting to Modern Standard Arabic, which reads like a news bulletin in a meeting. Keep the everyday spoken forms (مش, بدي, عايز, شو, إيه) and religious set phrases (إن شاء الله, الحمد لله) exactly where they were said; they are ordinary speech, not decoration.",
    slang: [
      { term: "يلا", means: "come on, let's go" },
      { term: "خلاص", means: "enough, that's done, fine" },
      { term: "تمام", means: "okay, all good" },
      { term: "ماشي", means: "okay, agreed" },
      { term: "معلش", means: "never mind, sorry about that" },
      { term: "كويس", means: "good, fine" },
      { term: "يعني", means: "I mean, sort of (filler)" },
      { term: "مش", means: "not (Egyptian/Levantine negation)" },
      { term: "بدي", means: "I want (Levantine)" },
      { term: "عايز", means: "I want (Egyptian)" },
      { term: "شو", means: "what (Levantine)" },
      { term: "إيه", means: "what (Egyptian)" },
      { term: "حبيبي", means: "term of affection, also used between colleagues" },
      { term: "والله", means: "honestly, I swear" },
      { term: "إن شاء الله", means: "hopefully, if all goes well — often a soft yes or a soft no" },
      { term: "على طول", means: "straight away" },
      { term: "شوية", means: "a bit, a little while" },
      { term: "زي ما بدك", means: "as you like (Levantine)" },
    ],
  },

  Cantonese: {
    register:
      "Write spoken Cantonese in traditional characters with the colloquial words people actually say (係, 唔, 冇, 嘅, 咗) rather than written Standard Chinese. Keep sentence-final particles — 啦, 囉, 喎, 呀, 嘛 — because they carry the tone of the sentence. English words mixed into Cantonese at work (meeting, deadline, send) stay in English.",
    slang: [
      { term: "唔該", means: "thanks / excuse me (for a service or favour)" },
      { term: "多謝", means: "thank you (for a gift or compliment)" },
      { term: "搞掂", means: "sorted, done" },
      { term: "冇問題", means: "no problem" },
      { term: "唔緊要", means: "never mind, it doesn't matter" },
      { term: "唔好意思", means: "sorry, excuse me" },
      { term: "犀利", means: "impressive, formidable" },
      { term: "勁", means: "great, powerful" },
      { term: "收工", means: "knock off work for the day" },
      { term: "加班", means: "work overtime" },
      { term: "撞板", means: "come unstuck, make a mess of it" },
      { term: "頂唔順", means: "can't stand it any more" },
      { term: "求其", means: "whatever, however it comes" },
      { term: "即係", means: "that is to say (filler)" },
      { term: "食飯未", means: "have you eaten? — an everyday greeting" },
      { term: "加油", means: "keep it up, you can do it" },
    ],
  },

  French: {
    register:
      "Use tu between colleagues who speak casually and vous where the speaker was being formal; follow the speaker. Spoken French drops ne (\"je sais pas\", \"c'est pas grave\") and uses on for we — keep that. Keep fillers like du coup, bref, franchement, quoi.",
    slang: [
      { term: "boulot", means: "job, work" },
      { term: "bosser", means: "to work" },
      { term: "truc", means: "thing, thingy" },
      { term: "ouais", means: "yeah" },
      { term: "nickel", means: "perfect, spot on" },
      { term: "ça marche", means: "that works, agreed" },
      { term: "du coup", means: "so, therefore (filler)" },
      { term: "grave", means: "totally, absolutely" },
      { term: "c'est chaud", means: "that's tough, that's tricky" },
      { term: "galère", means: "a hassle, a pain" },
      { term: "t'inquiète", means: "don't worry about it" },
      { term: "à la bourre", means: "running late" },
      { term: "relou", means: "annoying (verlan for lourd)" },
      { term: "chelou", means: "weird, dodgy (verlan for louche)" },
      { term: "kiffer", means: "to really like something" },
      { term: "mec", means: "guy, bloke" },
      { term: "bref", means: "anyway, in short" },
      { term: "on se cale ça", means: "let's lock that in (a time)" },
    ],
  },

  German: {
    register:
      "Follow the speaker on du and Sie. Spoken German leans on modal particles — mal, halt, eben, doch, ja — and they carry the tone, so keep them. Work German borrows English freely (Meeting, Deadline, Call); leave those words as they were said.",
    slang: [
      { term: "passt", means: "that's fine, that works" },
      { term: "alles klar", means: "all good, understood" },
      { term: "kein Ding", means: "no problem" },
      { term: "keine Ahnung", means: "no idea" },
      { term: "Feierabend", means: "the end of the working day" },
      { term: "Termin", means: "an appointment or scheduled slot" },
      { term: "Bescheid geben", means: "let someone know" },
      { term: "Ich melde mich", means: "I'll get back to you" },
      { term: "Bock haben", means: "to fancy doing something" },
      { term: "krass", means: "intense, wild — good or bad" },
      { term: "geil", means: "great, awesome (casual)" },
      { term: "Quatsch", means: "nonsense" },
      { term: "Kumpel", means: "mate, buddy" },
      { term: "Baustelle", means: "literally a building site; figuratively an unfinished mess" },
      { term: "Schnapsidee", means: "a daft idea" },
      { term: "zeitnah", means: "soon, promptly (office word)" },
    ],
  },

  Hebrew: {
    register:
      "Write everyday spoken Hebrew, not literary Hebrew. Israeli work talk is direct and informal by default, first names and second person singular, with English words mixed in (deadline, budget, call). Keep discourse particles like נו and אז.",
    slang: [
      { term: "סבבה", means: "cool, fine" },
      { term: "יאללה", means: "come on, let's go" },
      { term: "אחלה", means: "great, excellent" },
      { term: "בסדר", means: "okay, alright" },
      { term: "תכל'ס", means: "bottom line, in practice" },
      { term: "באסה", means: "a bummer, a letdown" },
      { term: "פדיחה", means: "an embarrassment" },
      { term: "בקטנה", means: "no big deal, casually" },
      { term: "על הפנים", means: "terrible, awful" },
      { term: "חבל על הזמן", means: "amazing — literally 'a waste of time', said as praise" },
      { term: "נו", means: "well? come on (impatient filler)" },
      { term: "מה נשמע", means: "how's it going?" },
      { term: "אין בעיה", means: "no problem" },
      { term: "כפרה עליך", means: "term of affection, roughly 'bless you'" },
    ],
  },

  Hindi: {
    register:
      "Hinglish is normal speech, not a mistake: keep the English words people actually use (meeting, update, deadline) inside Hindi sentences, in Devanagari. Follow the speaker on तुम and आप. Keep यार, अरे, अच्छा and मतलब where they were said — they carry the tone.",
    slang: [
      { term: "यार", means: "mate, friendly address" },
      { term: "जुगाड़", means: "a resourceful workaround" },
      { term: "चलेगा", means: "that'll do, good enough" },
      { term: "ठीक है", means: "okay, fine" },
      { term: "बकवास", means: "nonsense, rubbish" },
      { term: "फालतू", means: "useless, pointless" },
      { term: "देखते हैं", means: "we'll see — often a polite no" },
      { term: "मस्त", means: "great, brilliant" },
      { term: "टेंशन मत लो", means: "don't stress about it" },
      { term: "मतलब", means: "I mean, that is (filler)" },
      { term: "अच्छा", means: "oh I see / okay (filler)" },
      { term: "अरे", means: "hey, oh (exclamation)" },
      { term: "टाइमपास", means: "killing time, nothing serious" },
      { term: "हो जाएगा", means: "it'll get done" },
      { term: "थोड़ा सा", means: "just a little" },
    ],
  },

  Italian: {
    register:
      "Follow the speaker on tu and Lei. Spoken Italian is full of short tone-carrying words — boh, dai, magari, allora, eh — keep them rather than smoothing them out. Don't turn a casual remark into formal written Italian.",
    slang: [
      { term: "boh", means: "no idea, who knows" },
      { term: "dai", means: "come on" },
      { term: "magari", means: "maybe, or 'if only'" },
      { term: "allora", means: "so, well then (filler)" },
      { term: "figurati", means: "don't mention it, no trouble" },
      { term: "un attimo", means: "one moment" },
      { term: "che palle", means: "what a pain (vulgar-ish)" },
      { term: "casino", means: "a mess, chaos" },
      { term: "roba", means: "stuff" },
      { term: "cavolo", means: "darn (mild)" },
      { term: "in bocca al lupo", means: "good luck" },
      { term: "va bene", means: "okay, fine" },
      { term: "mannaggia", means: "damn (mild)" },
      { term: "sbrigati", means: "hurry up" },
      { term: "ci sto", means: "I'm in, count me in" },
    ],
  },

  Japanese: {
    register:
      "Match the politeness level the speaker used: plain form between close colleagues, です/ます in a normal meeting, 敬語 only if they were being properly formal. Keep the softeners — ちょっと, 一応, たぶん — because dropping them makes a polite hesitation sound like a flat refusal or a firm promise.",
    slang: [
      { term: "やばい", means: "amazing or terrible, depending on tone" },
      { term: "マジで", means: "seriously, for real" },
      { term: "めっちゃ", means: "very, really" },
      { term: "とりあえず", means: "for now, to begin with" },
      { term: "お疲れ様", means: "thanks for your work — a greeting and a sign-off" },
      { term: "よろしく", means: "please look after this / nice to work with you" },
      { term: "なるほど", means: "I see, that makes sense" },
      { term: "ちょっと", means: "a bit — also a soft no" },
      { term: "微妙", means: "iffy, not quite right" },
      { term: "ざっくり", means: "roughly, broadly" },
      { term: "了解", means: "got it, understood" },
      { term: "ドタキャン", means: "a last-minute cancellation" },
      { term: "ググる", means: "to google something" },
      { term: "残業", means: "overtime" },
      { term: "一応", means: "just in case, for what it's worth" },
    ],
  },

  Korean: {
    register:
      "Match the speech level: 반말 between close colleagues, 해요체 in an ordinary meeting, 합쇼체 when the speaker was being formal. Age and rank shape address — keep 님, 선배, and job titles rather than replacing them with names. Keep 좀 and 그냥; they soften a request.",
    slang: [
      { term: "대박", means: "amazing, incredible" },
      { term: "헐", means: "whoa, no way" },
      { term: "진짜", means: "really, seriously" },
      { term: "그냥", means: "just, no particular reason" },
      { term: "괜찮아요", means: "it's fine / no thanks" },
      { term: "파이팅", means: "you can do it, let's go" },
      { term: "수고하셨습니다", means: "thanks for your hard work (end of a meeting)" },
      { term: "꿀팁", means: "a great tip" },
      { term: "노잼", means: "not funny, boring" },
      { term: "짱", means: "the best" },
      { term: "빨리빨리", means: "hurry up, quickly quickly" },
      { term: "눈치", means: "reading the room, social awareness" },
      { term: "회식", means: "a work dinner" },
      { term: "언제 한번 밥 먹자", means: "let's eat sometime — usually a pleasantry, not a plan" },
      { term: "좀", means: "a little — softens a request" },
    ],
  },

  Malay: {
    register:
      "Write everyday spoken Malay, not formal Bahasa Baku. Keep the particles lah, lor, meh, kan — they carry the tone. Manglish mixing (English words inside Malay sentences) is normal at work and should be kept as said.",
    slang: [
      { term: "jom", means: "let's go, come on" },
      { term: "boleh", means: "can, that works" },
      { term: "tak apa", means: "never mind, it's fine" },
      { term: "sikit", means: "a little" },
      { term: "gila", means: "crazy — also 'very' as an intensifier" },
      { term: "leceh", means: "troublesome, a hassle" },
      { term: "cincai", means: "casually, any old how" },
      { term: "syok", means: "enjoyable, satisfying" },
      { term: "kantoi", means: "caught out, busted" },
      { term: "tapau", means: "takeaway food" },
      { term: "bojio", means: "you didn't invite me" },
      { term: "apa khabar", means: "how are you?" },
      { term: "makan", means: "eat — also 'a meal' generally" },
      { term: "on the way", means: "I'm coming (used as-is in Malay speech)" },
    ],
  },

  Mandarin: {
    register:
      "Write spoken Mandarin in simplified characters, the way people talk in a meeting: short sentences, 吧 and 呢 and 啊 kept for tone, 咱们 or 我们 as the speaker used. Don't inflate casual speech into formal written Chinese.",
    slang: [
      { term: "搞定", means: "done, sorted" },
      { term: "加油", means: "keep going, you've got this" },
      { term: "差不多", means: "roughly, close enough" },
      { term: "麻烦", means: "trouble, a nuisance — also 'may I trouble you'" },
      { term: "靠谱", means: "reliable, sound" },
      { term: "牛", means: "impressive, badass" },
      { term: "给力", means: "impressive, delivers" },
      { term: "随便", means: "whatever, up to you" },
      { term: "没事", means: "it's nothing, no worries" },
      { term: "行", means: "okay, fine" },
      { term: "加班", means: "work overtime" },
      { term: "对接", means: "coordinate with, interface with" },
      { term: "拉群", means: "start a group chat" },
      { term: "内卷", means: "pointless competitive grind" },
      { term: "躺平", means: "opting out of the grind" },
    ],
  },

  Russian: {
    register:
      "Follow the speaker on ты and вы. Spoken Russian uses ну, короче, типа, вот as tone-carrying fillers — keep them. Work Russian borrows English words (дедлайн, созвон, таска); leave them as said.",
    slang: [
      { term: "давай", means: "okay then / let's do it / bye" },
      { term: "нормально", means: "fine, alright" },
      { term: "круто", means: "cool, great" },
      { term: "ладно", means: "alright, fine then" },
      { term: "короче", means: "in short, anyway" },
      { term: "типа", means: "like, sort of" },
      { term: "блин", means: "darn (mild)" },
      { term: "слушай", means: "listen — opens a request" },
      { term: "договорились", means: "agreed, it's settled" },
      { term: "без проблем", means: "no problem" },
      { term: "по-любому", means: "definitely, either way" },
      { term: "запара", means: "a rush, a flap" },
      { term: "созвон", means: "a call (noun)" },
      { term: "чётко", means: "neat, well done" },
    ],
  },

  Sinhala: {
    register:
      "Write spoken Sinhala (කතා කරන සිංහල), not literary Sinhala — they differ in verb endings, and literary forms read like a government notice in a meeting. Singlish mixing is normal: keep the English words people say inside Sinhala sentences. Keep අයියා, අක්කා, මචං as address where they were used.",
    slang: [
      { term: "මචං", means: "mate, close friend" },
      { term: "පට්ට", means: "excellent, brilliant" },
      { term: "හරි", means: "okay, right" },
      { term: "කොහොමද", means: "how is it / how are you" },
      { term: "මොකද", means: "what, why" },
      { term: "පොඩ්ඩක්", means: "just a moment, a little" },
      { term: "නිකන්", means: "just, for no reason" },
      { term: "අයියා", means: "elder brother — used for any older man" },
      { term: "අක්කා", means: "elder sister — used for any older woman" },
      { term: "බලමු", means: "let's see" },
      { term: "වැඩේ හරි", means: "it worked out" },
      { term: "අනේ", means: "oh please / oh dear (softener)" },
      { term: "ඇයි", means: "why, what for" },
      { term: "සෙට් උනා", means: "it came together, it's sorted" },
    ],
  },

  Spanish: {
    register:
      "Match the speaker's variety — Peninsular, Mexican, Rioplatense, Andean, Caribbean — and their form of address: tú, vos or usted. Vosotros only for Spain. Keep the softeners and fillers (bueno, pues, o sea, ya) rather than tidying them away.",
    slang: [
      { term: "vale", means: "okay (Spain)" },
      { term: "guay", means: "cool (Spain)" },
      { term: "tío", means: "mate, dude (Spain)" },
      { term: "currar", means: "to work (Spain)" },
      { term: "mola", means: "it's cool (Spain)" },
      { term: "chido", means: "cool (Mexico)" },
      { term: "órale", means: "wow / come on / alright (Mexico)" },
      { term: "ahorita", means: "in a little while — not necessarily right now (Mexico)" },
      { term: "chévere", means: "great (Caribbean, Andean)" },
      { term: "pana", means: "mate (Venezuela, Colombia)" },
      { term: "boludo", means: "mate — or idiot, depending on tone (Argentina)" },
      { term: "laburo", means: "work, job (Argentina)" },
      { term: "no pasa nada", means: "it's fine, no worries" },
      { term: "o sea", means: "I mean (filler)" },
      { term: "quedamos", means: "let's agree a time to meet" },
      { term: "ya está", means: "that's it, done" },
    ],
  },

  Swahili: {
    register:
      "Write everyday spoken Swahili, and keep Sheng mixing (Swahili with English and slang) where the speaker used it, particularly in Nairobi work talk. Respect terms of address — bwana, dada, kaka, mzee — as said.",
    slang: [
      { term: "poa", means: "cool, fine" },
      { term: "sawa", means: "okay, agreed" },
      { term: "mambo", means: "what's up?" },
      { term: "vipi", means: "how's it going?" },
      { term: "safi", means: "great, clean, sorted" },
      { term: "hakuna shida", means: "no problem" },
      { term: "pole", means: "sorry (sympathy, not apology)" },
      { term: "asante sana", means: "thank you very much" },
      { term: "haraka", means: "quickly, in a hurry" },
      { term: "shughuli", means: "things on, busy with work" },
      { term: "chapa kazi", means: "get stuck into the work" },
      { term: "kaka", means: "brother — friendly address" },
      { term: "dada", means: "sister — friendly address" },
      { term: "tutaonana", means: "see you later" },
    ],
  },

  Tagalog: {
    register:
      "Taglish is how people actually talk at work in Manila: keep the English words inside Tagalog sentences rather than translating them out. Keep po and opo wherever respect was shown, and kuya/ate as address. Particles naman, na, pa, lang carry the tone.",
    slang: [
      { term: "sige", means: "okay, go ahead" },
      { term: "ayos", means: "fine, all good" },
      { term: "talaga", means: "really, is that so" },
      { term: "grabe", means: "wow, that's intense" },
      { term: "medyo", means: "somewhat, a bit" },
      { term: "bahala na", means: "we'll leave it to fate, we'll manage" },
      { term: "saka na", means: "later, not now" },
      { term: "kuya", means: "elder brother — address for an older man" },
      { term: "ate", means: "elder sister — address for an older woman" },
      { term: "charot", means: "just kidding" },
      { term: "lodi", means: "idol, someone admired" },
      { term: "petmalu", means: "amazing, savage" },
      { term: "sana all", means: "lucky them, wish that were me" },
      { term: "naman", means: "softening particle — 'come on', 'though'" },
    ],
  },

  Tamil: {
    register:
      "Write spoken Tamil (பேச்சு தமிழ்), not literary Tamil — the written form reads like a formal announcement in a meeting. Tanglish mixing is normal at work. Keep the address endings டா and டி only where the speaker's familiarity justified them, and அண்ணா/அக்கா as said.",
    slang: [
      { term: "மச்சான்", means: "mate, close friend" },
      { term: "செம", means: "excellent, superb" },
      { term: "வேற லெவல்", means: "next level, outstanding" },
      { term: "சரி", means: "okay, right" },
      { term: "என்ன", means: "what" },
      { term: "கொஞ்சம்", means: "a little, a moment" },
      { term: "ரொம்ப", means: "very, a lot" },
      { term: "பரவால்ல", means: "not bad, that's alright" },
      { term: "மொக்கை", means: "dull, a lame joke" },
      { term: "அண்ணா", means: "elder brother — address for an older man" },
      { term: "அக்கா", means: "elder sister — address for an older woman" },
      { term: "வாங்க", means: "come / welcome (polite)" },
      { term: "பார்க்கலாம்", means: "let's see" },
    ],
  },

  Thai: {
    register:
      "Keep the politeness particles ครับ and ค่ะ exactly as the speaker used them, and นะ, จ้า, ล่ะ which soften or sharpen a sentence. Thai work talk avoids blunt refusals — a hedge is a no, and should stay a hedge. Keep พี่ and น้อง as address.",
    slang: [
      { term: "ไม่เป็นไร", means: "never mind, it's fine, no worries" },
      { term: "โอเค", means: "okay" },
      { term: "เดี๋ยว", means: "in a moment, hang on" },
      { term: "สบายๆ", means: "relaxed, take it easy" },
      { term: "เกรงใจ", means: "reluctance to impose on someone" },
      { term: "สู้ๆ", means: "keep fighting, you've got this" },
      { term: "งง", means: "confused" },
      { term: "จริงดิ", means: "really? seriously?" },
      { term: "ชิล", means: "chill, relaxed" },
      { term: "แซ่บ", means: "spicy — also 'hot', impressive" },
      { term: "พี่", means: "older sibling — address for someone senior or older" },
      { term: "น้อง", means: "younger sibling — address for someone junior or younger" },
      { term: "อร่อย", means: "delicious" },
    ],
  },

  Turkish: {
    register:
      "Follow the speaker on sen and siz. Address by relationship — abi, abla, hocam — is normal at work and should be kept. Keep the fillers ya, işte, şey and the set phrases (kolay gelsin, eline sağlık); they carry warmth that a plain translation loses.",
    slang: [
      { term: "tamam", means: "okay, agreed" },
      { term: "hadi", means: "come on, let's go" },
      { term: "abi", means: "elder brother — address for an older man" },
      { term: "abla", means: "elder sister — address for an older woman" },
      { term: "kanka", means: "mate, close friend" },
      { term: "valla", means: "honestly, I swear" },
      { term: "kolay gelsin", means: "may it go easily — said to someone working" },
      { term: "eyvallah", means: "thanks / fair enough / see you" },
      { term: "bakarız", means: "we'll see — often a soft no" },
      { term: "hallederiz", means: "we'll sort it out" },
      { term: "naber", means: "what's up?" },
      { term: "işte", means: "you know, well (filler)" },
      { term: "şey", means: "thing, um (filler)" },
      { term: "inşallah", means: "hopefully, all being well" },
    ],
  },

  Yoruba: {
    register:
      "Write Yoruba with its tone marks, and keep the Nigerian Pidgin that mixes into everyday and work speech rather than translating it into standard English or standard Yoruba. Respect matters: keep ẹ (plural/respectful you) for elders and seniors, and titles like oga.",
    slang: [
      { term: "wahala", means: "trouble, hassle" },
      { term: "no wahala", means: "no problem" },
      { term: "abeg", means: "please (Pidgin)" },
      { term: "how far", means: "what's up? (Pidgin)" },
      { term: "oga", means: "boss, senior person" },
      { term: "omo", means: "wow / mate (exclamation)" },
      { term: "sha", means: "anyway, regardless" },
      { term: "abi", means: "right? isn't it?" },
      { term: "jare", means: "emphasis, roughly 'honestly'" },
      { term: "gist", means: "chat, the news, gossip" },
      { term: "japa", means: "to leave the country, to bolt" },
      { term: "padi", means: "friend (Pidgin)" },
      { term: "ẹ jọ̀ọ́", means: "please (respectful)" },
      { term: "ó dára", means: "it is good, that's fine" },
    ],
  },
};

export function styleFor(language: string): LanguageStyle | null {
  return LANGUAGE_STYLES[language] ?? null;
}
