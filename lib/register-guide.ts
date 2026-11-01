/**
 * Formal and informal, in each of MemoValet's 21 languages.
 *
 * English lets you be vague about this. Most of these languages do not: every
 * sentence picks a side. Tu or vous. Du or Sie. 반말 or 합니다체. Ты or вы. Sen or
 * siz. Tú, vos or usted. There is no neutral way to say "can you send that
 * today?" in French — you have already decided how close you are to the person
 * before the sentence is finished. Get it wrong and a colleague sounds like a
 * stranger, or a client sounds like they are being talked down to.
 *
 * So each language here carries three things: how informal is written, how
 * formal is written, and the same four everyday meeting lines rendered both
 * ways, which is what the translator is shown as an example. The `markers` are
 * the giveaways in speech — the pronouns, endings and particles that say which
 * register the speaker was in, so it can be worked out rather than asked about.
 */

export type Register = "informal" | "formal";

export interface RegisterExample {
  /** The same four lines in every language, so the pair can be compared. */
  en: string;
  informal: string;
  formal: string;
}

export interface RegisterGuide {
  informal: string;
  formal: string;
  examples: RegisterExample[];
  /** Words that give the speaker's register away when they say them. */
  markers: { informal: string[]; formal: string[] };
}

export const REGISTER_GUIDES: Record<string, RegisterGuide> = {
  English: {
    informal: "Contractions, short sentences, direct questions, slang. \"Can you…\", \"yeah\", \"no worries\".",
    formal: "Modal politeness and full forms: \"would you be able to…\", \"apologies\", \"I'll be in touch\". No slang, fewer contractions.",
    examples: [
      { en: "Can you send that today?", informal: "Can you send that today?", formal: "Would you be able to send that through today?" },
      { en: "Sorry, I didn't catch that.", informal: "Sorry, didn't catch that.", formal: "Apologies, I didn't quite catch that." },
      { en: "That won't work for us.", informal: "That's not going to work for us.", formal: "I'm afraid that wouldn't work for us." },
      { en: "Thanks — talk later.", informal: "Thanks, talk later!", formal: "Thank you — I'll be in touch." },
    ],
    markers: {
      informal: ["yeah", "yep", "nah", "gonna", "wanna", "mate", "cheers", "cool", "hey", "kinda", "no worries", "didn't catch", "let's", "that's not going to", "talk later", "send that today",],
      formal: ["could you please", "would you be able", "kind regards", "i would appreciate", "sir", "madam", "apologies", "i'm afraid", "i'll be in touch", "thank you", "would you", "i didn't quite",],
    },
  },

  Arabic: {
    informal: "The speaker's own dialect, second person singular, everyday words: تبعت, عايز, مش, يلا.",
    formal: "Closer to Modern Standard Arabic, plural or honorific address (حضرتك, يمكنكم), hedged requests (هل يمكن).",
    examples: [
      { en: "Can you send that today?", informal: "تبعتهولي النهارده؟", formal: "هل يمكنكم إرساله اليوم؟" },
      { en: "Sorry, I didn't catch that.", informal: "معلش، مسمعتش كويس.", formal: "عذراً، لم أسمع ذلك جيداً." },
      { en: "That won't work for us.", informal: "ده مش هينفع معانا.", formal: "أخشى أن هذا لا يناسبنا." },
      { en: "Thanks — talk later.", informal: "شكراً، نتكلم بعدين.", formal: "شكراً لكم، نبقى على تواصل." },
    ],
    markers: {
      informal: ["يلا", "عايز", "بدي", "مش", "إيه", "حبيبي", "معلش", "النهارده", "بعدين"],
      formal: ["حضرتك", "لو سمحت", "من فضلك", "يمكنكم", "تفضلوا", "سيادتك", "نبقى على تواصل", "إرساله", "لا يناسبنا", "لم أسمع",],
    },
  },

  Cantonese: {
    informal: "你, colloquial verbs and full particles (啦, 喎, 咩), English words dropped in freely.",
    formal: "您 and 請問, fewer particles, written-Chinese phrasing for anything that would be put in writing.",
    examples: [
      { en: "Can you send that today?", informal: "今日send得俾我嗎？", formal: "請問您今日方便send俾我嗎？" },
      { en: "Sorry, I didn't catch that.", informal: "唔好意思，聽唔清。", formal: "不好意思，我聽得唔太清楚。" },
      { en: "That won't work for us.", informal: "咁樣我哋做唔到喎。", formal: "恐怕呢個對我哋嚟講唔太可行。" },
      { en: "Thanks — talk later.", informal: "多謝，遲啲傾！", formal: "多謝您，保持聯絡。" },
    ],
    markers: {
      informal: ["搞掂", "咩", "喎", "啦", "邊個", "點解", "唔該晒", "唔到", "遲啲", "聽唔清", "得俾",],
      formal: ["您", "請問", "敬請", "麻煩您", "保持聯絡", "方便", "不好意思", "恐怕",],
    },
  },

  French: {
    informal: "Tu, dropped ne (\"ça va pas marcher\"), on for nous, à plus.",
    formal: "Vous, conditional politeness (pourriez-vous), full negation, à bientôt or cordialement.",
    examples: [
      { en: "Can you send that today?", informal: "Tu peux m'envoyer ça aujourd'hui ?", formal: "Pourriez-vous me l'envoyer aujourd'hui ?" },
      { en: "Sorry, I didn't catch that.", informal: "Pardon, j'ai pas capté.", formal: "Excusez-moi, je n'ai pas bien entendu." },
      { en: "That won't work for us.", informal: "Ça va pas le faire pour nous.", formal: "Cela ne nous conviendrait pas." },
      { en: "Thanks — talk later.", informal: "Merci, à plus !", formal: "Merci, à bientôt." },
    ],
    markers: {
      informal: ["ouais", "t'as", "t'es", "mec", "truc", "à plus", "grave", "bosser", "j'ai pas", "c'est pas", "ça va pas", "tu peux", "à plus",],
      formal: ["vous", "pourriez", "veuillez", "monsieur", "madame", "cordialement", "je vous prie", "excusez-moi", "conviendrait", "à bientôt",],
    },
  },

  German: {
    informal: "Du, short main clauses, mal and halt, English borrowings, Tschüss or bis später.",
    formal: "Sie with capitalised Ihnen/Ihre, könnten Sie, Entschuldigung rather than sorry, complete subordinate clauses.",
    examples: [
      { en: "Can you send that today?", informal: "Kannst du das heute schicken?", formal: "Könnten Sie mir das heute zusenden?" },
      { en: "Sorry, I didn't catch that.", informal: "Sorry, hab ich nicht mitbekommen.", formal: "Entschuldigung, das habe ich nicht verstanden." },
      { en: "That won't work for us.", informal: "Das klappt bei uns nicht.", formal: "Das lässt sich bei uns leider nicht umsetzen." },
      { en: "Thanks — talk later.", informal: "Danke, bis später!", formal: "Vielen Dank, bis später." },
    ],
    markers: {
      informal: ["kannst du", "hast du", "bist du", "dir", "dich", "krass", "kein ding", "passt", "kannst", "schicken?", "bis später", "klappt", "mitbekommen",],
      formal: ["könnten sie", "haben sie", "ihnen", "ihre", "sehr geehrte", "mit freundlichen grüßen", "zusenden", "entschuldigung", "umsetzen", "vielen dank",],
    },
  },

  Hebrew: {
    informal: "Second person singular, clipped speech, sababa and yalla, no softening.",
    formal: "Full forms, האם for questions, בבקשה, and titles where the speaker used them. Israeli formal is still fairly direct.",
    examples: [
      { en: "Can you send that today?", informal: "תשלח לי את זה היום?", formal: "האם תוכל לשלוח לי את זה היום?" },
      { en: "Sorry, I didn't catch that.", informal: "סליחה, לא קלטתי.", formal: "סליחה, לא הבנתי את זה." },
      { en: "That won't work for us.", informal: "זה לא הולך לעבוד לנו.", formal: "חוששני שזה לא יתאים לנו." },
      { en: "Thanks — talk later.", informal: "תודה, נדבר!", formal: "תודה רבה, נהיה בקשר." },
    ],
    markers: {
      informal: ["סבבה", "יאללה", "אחלה", "תכל'ס", "נו", "קלטתי", "נדבר", "קלטתי", "לא הולך", "תשלח",],
      formal: ["האם", "בבקשה", "אדוני", "גברתי", "חוששני", "נהיה בקשר", "תוכל", "לא יתאים", "לא הבנתי",],
    },
  },

  Hindi: {
    informal: "तुम, यार and अरे, Hinglish, short verb endings (भेज दोगे).",
    formal: "आप with -इए endings, कृपया, जी after names and titles, less English mixing.",
    examples: [
      { en: "Can you send that today?", informal: "ये आज भेज दोगे?", formal: "क्या आप यह आज भेज सकते हैं?" },
      { en: "Sorry, I didn't catch that.", informal: "अरे, समझ नहीं आया।", formal: "क्षमा करें, मैं समझ नहीं पाया।" },
      { en: "That won't work for us.", informal: "ये हमारे लिए नहीं चलेगा।", formal: "यह हमारे लिए उपयुक्त नहीं होगा।" },
      { en: "Thanks — talk later.", informal: "थैंक्स, बाद में बात करते हैं!", formal: "धन्यवाद, फिर बात करते हैं।" },
    ],
    markers: {
      informal: ["तुम", "यार", "अरे", "चलेगा", "बकवास", "टेंशन", "दोगे", "नहीं आया", "थैंक्स",],
      formal: ["आप", "कृपया", "क्षमा करें", "श्रीमान", "धन्यवाद", "सकते हैं", "उपयुक्त", "पाया",],
    },
  },

  Italian: {
    informal: "Tu, ciao, dai and boh, present tense for requests (me lo mandi oggi?).",
    formal: "Lei with third-person verbs, potrebbe, buongiorno, La ringrazio.",
    examples: [
      { en: "Can you send that today?", informal: "Me lo mandi oggi?", formal: "Potrebbe inviarmelo oggi?" },
      { en: "Sorry, I didn't catch that.", informal: "Scusa, non ho capito.", formal: "Mi scusi, non ho compreso bene." },
      { en: "That won't work for us.", informal: "Così non funziona per noi.", formal: "Temo che non sia praticabile per noi." },
      { en: "Thanks — talk later.", informal: "Grazie, ci sentiamo!", formal: "La ringrazio, a presto." },
    ],
    markers: {
      informal: ["ciao", "dai", "boh", "scusa", "figurati", "che palle", "scusa", "ci sentiamo", "mandi", "così non",],
      formal: ["lei", "potrebbe", "mi scusi", "buongiorno", "la ringrazio", "gentilmente", "inviarmelo", "compreso", "praticabile", "a presto",],
    },
  },

  Japanese: {
    informal: "Plain form (送ってくれる?), dropped particles, ごめん, sentence-final よ and ね.",
    formal: "です・ます throughout, humble and honorific verbs (いただけますでしょうか, 存じます), 恐れ入ります, full closing greetings.",
    examples: [
      { en: "Can you send that today?", informal: "今日送ってくれる？", formal: "本日中にお送りいただけますでしょうか。" },
      { en: "Sorry, I didn't catch that.", informal: "ごめん、聞き取れなかった。", formal: "恐れ入ります、聞き取れませんでした。" },
      { en: "That won't work for us.", informal: "それはうちだと無理だな。", formal: "そちらは弊社では難しいかと存じます。" },
      { en: "Thanks — talk later.", informal: "ありがと、またね！", formal: "ありがとうございます。引き続きよろしくお願いいたします。" },
    ],
    markers: {
      informal: ["だよ", "だね", "じゃん", "ごめん", "マジ", "やばい", "くれる？", "くれる", "なかった", "だな", "またね", "ありがと",],
      formal: [" です", "ます", "ございます", "恐れ入り", "いただけます", "存じます", "よろしくお願いいたします", "お送り", "いたします", "弊社", "かと",],
    },
  },

  Korean: {
    informal: "반말: 했어, 할게, 야, no 요 endings. Between close colleagues only.",
    formal: "합니다체 for anything official (하시겠습니까, 드리겠습니다); 해요체 is the everyday polite middle. Keep 님 and job titles.",
    examples: [
      { en: "Can you send that today?", informal: "오늘 보내줄 수 있어?", formal: "오늘 중으로 보내주실 수 있으십니까?" },
      { en: "Sorry, I didn't catch that.", informal: "미안, 잘 못 들었어.", formal: "죄송합니다, 잘 듣지 못했습니다." },
      { en: "That won't work for us.", informal: "그건 우리한테는 안 되겠는데.", formal: "그 부분은 저희 쪽에서는 어려울 것 같습니다." },
      { en: "Thanks — talk later.", informal: "고마워, 나중에 얘기하자!", formal: "감사합니다. 다시 연락드리겠습니다." },
    ],
    markers: {
      informal: ["했어", "할게", "그래", "미안", "고마워", "하자", "있어", "없어", "해줘", "줄래", "얘기하자", "겠는데",],
      formal: ["습니다", "십시오", "드리겠", "죄송합니다", "감사합니다", "이십니까", "십니까", "주실", "드리겠", "같습니다", "저희",],
    },
  },

  Malay: {
    informal: "Second person awak or kau, particles lah and kan, Manglish, shortened words (tak, ni).",
    formal: "Encik/Puan/Tuan, sila, complete words (tidak, ini), no particles, no English mixing.",
    examples: [
      { en: "Can you send that today?", informal: "Boleh hantar hari ni?", formal: "Boleh encik hantarkan hari ini?" },
      { en: "Sorry, I didn't catch that.", informal: "Sorry, tak dengar tadi.", formal: "Maaf, saya kurang jelas tadi." },
      { en: "That won't work for us.", informal: "Macam tu tak boleh lah untuk kami.", formal: "Maaf, itu kurang sesuai untuk pihak kami." },
      { en: "Thanks — talk later.", informal: "Thanks, nanti kita cakap!", formal: "Terima kasih, kita berhubung lagi." },
    ],
    markers: {
      informal: ["jom", "tak apa", "lah", "cincai", "gila", "macam tu", "ni ", "hari ni", "tak dengar", "nanti kita", "boleh hantar",],
      formal: ["encik", "puan", "tuan", "sila", "pihak", "terima kasih atas", "hantarkan", "kurang jelas", "pihak kami", "berhubung",],
    },
  },

  Mandarin: {
    informal: "你 and 咱们, 吧 and 啦, short verbs (发给我), 不好意思 for small apologies.",
    formal: "您, 请问 and 麻烦您, 贵公司 for the other side's company, 抱歉 rather than 不好意思.",
    examples: [
      { en: "Can you send that today?", informal: "今天能发给我吗？", formal: "您今天方便发给我吗？" },
      { en: "Sorry, I didn't catch that.", informal: "不好意思，没听清。", formal: "抱歉，我没有听清楚。" },
      { en: "That won't work for us.", informal: "这样我们这边行不通。", formal: "恐怕这对我们来说不太可行。" },
      { en: "Thanks — talk later.", informal: "谢谢，回聊！", formal: "谢谢您，保持联系。" },
    ],
    markers: {
      informal: ["咱们", "搞定", "行吧", "啥", "没事", "回聊", "回聊", "行不通", "没听清", "这边",],
      formal: ["您", "请问", "麻烦您", "贵公司", "敬请", "保持联系", "方便", "抱歉", "不太可行",],
    },
  },

  Russian: {
    informal: "Ты, perfective one-word requests (скинешь?), давай, до связи.",
    formal: "Вы with capital В in writing, не могли бы вы, пожалуйста, будем на связи.",
    examples: [
      { en: "Can you send that today?", informal: "Скинешь сегодня?", formal: "Не могли бы вы прислать это сегодня?" },
      { en: "Sorry, I didn't catch that.", informal: "Извини, не расслышал.", formal: "Простите, я не расслышал." },
      { en: "That won't work for us.", informal: "Нам так не подойдёт.", formal: "Боюсь, нам это не подойдёт." },
      { en: "Thanks — talk later.", informal: "Спасибо, до связи!", formal: "Спасибо, будем на связи." },
    ],
    markers: {
      informal: ["давай", "короче", "блин", "извини", "тебя", "тебе", "ладно", "скинешь", "до связи", "извини",],
      formal: ["не могли бы", "пожалуйста", "простите", "уважаемый", "вас", "вам", "прислать", "простите", "боюсь", "будем на связи",],
    },
  },

  Sinhala: {
    informal: "ඔයා or මචං, spoken endings (පුළුවන්ද), English words mixed in.",
    formal: "ඔබ, literary verb endings (හැකිද, වෙමු), කරුණාකර, no English mixing.",
    examples: [
      { en: "Can you send that today?", informal: "අද එවන්න පුළුවන්ද?", formal: "ඔබට අද එය එවීමට හැකිද?" },
      { en: "Sorry, I didn't catch that.", informal: "සොරි, ඇහුණේ නෑ.", formal: "සමාවන්න, මට හොඳට ඇහුණේ නැහැ." },
      { en: "That won't work for us.", informal: "ඒක අපිට හරියන්නේ නෑ.", formal: "එය අපට සුදුසු නොවේ." },
      { en: "Thanks — talk later.", informal: "තැන්ක්ස්, පස්සේ කතා කරමු!", formal: "ස්තූතියි, නැවත සම්බන්ධ වෙමු." },
    ],
    markers: {
      informal: ["මචං", "ඔයා", "පට්ට", "සොරි", "නෑ", "නිකන්", "පුළුවන්ද", "කතා කරමු", "හරියන්නේ",],
      formal: ["ඔබ", "කරුණාකර", "සමාවන්න", "ස්තූතියි", "මහත්මයා", "හැකිද", "සුදුසු", "සම්බන්ධ වෙමු",],
    },
  },

  Spanish: {
    informal: "Tú or vos, vale/dale, present tense requests, ¡hablamos!",
    formal: "Usted with third-person verbs, podría, disculpe, quedamos en contacto. Vosotros only in Spain, and only informally.",
    examples: [
      { en: "Can you send that today?", informal: "¿Me lo puedes mandar hoy?", formal: "¿Podría enviármelo hoy?" },
      { en: "Sorry, I didn't catch that.", informal: "Perdona, no te he pillado.", formal: "Disculpe, no le he entendido bien." },
      { en: "That won't work for us.", informal: "Así no nos va a funcionar.", formal: "Me temo que eso no nos funcionaría." },
      { en: "Thanks — talk later.", informal: "Gracias, ¡hablamos!", formal: "Gracias, quedamos en contacto." },
    ],
    markers: {
      informal: ["vale", "tío", "chido", "dale", "perdona", "puedes", "qué tal", "puedes", "perdona", "hablamos", "pillado",],
      formal: ["usted", "podría", "disculpe", "estimado", "le agradecería", "quedamos en contacto", "enviármelo", "entendido bien", "me temo", "funcionaría",],
    },
  },

  Swahili: {
    informal: "Second person singular, poa and sawa, Sheng mixing, clipped greetings (mambo, vipi).",
    formal: "Je to open a question, tafadhali, plural or respectful address, Bwana/Mama, shikamoo to elders.",
    examples: [
      { en: "Can you send that today?", informal: "Utatuma leo?", formal: "Je, mnaweza kutuma leo tafadhali?" },
      { en: "Sorry, I didn't catch that.", informal: "Samahani, sikusikia.", formal: "Samahani, sikusikia vizuri." },
      { en: "That won't work for us.", informal: "Hii haitatufaa.", formal: "Kwa bahati mbaya, hii haitatufaa." },
      { en: "Thanks — talk later.", informal: "Asante, tutaonana!", formal: "Asante sana, tutawasiliana." },
    ],
    markers: {
      informal: ["poa", "mambo", "vipi", "safi", "bro", "sawa sawa", "tutaonana", "haitatufaa", "utatuma",],
      formal: ["tafadhali", "bwana", "mheshimiwa", "shikamoo", "je,", "asante sana", "mnaweza", "kwa bahati mbaya", "tutawasiliana", "vizuri",],
    },
  },

  Tagalog: {
    informal: "No po, Taglish, kuya/ate for people slightly older, particles na and lang.",
    formal: "Po and opo in every sentence, maaari instead of pwede, ninyo instead of mo, fewer English words.",
    examples: [
      { en: "Can you send that today?", informal: "Pwede mo bang ipadala today?", formal: "Maaari po ba ninyong ipadala ngayong araw?" },
      { en: "Sorry, I didn't catch that.", informal: "Sorry, hindi ko na-gets.", formal: "Pasensya na po, hindi ko po naintindihan." },
      { en: "That won't work for us.", informal: "Hindi yata kakayanin namin yan.", formal: "Sa ngayon po, hindi namin ito kakayanin." },
      { en: "Thanks — talk later.", informal: "Salamat, usap tayo mamaya!", formal: "Maraming salamat po, mag-uusap po tayo muli." },
    ],
    markers: {
      informal: ["sige", "ayos", "grabe", "charot", "pwede", "yan", "na-gets"],
      formal: ["po", "opo", "maaari", "ninyo", "ginoo", "pasensya na po", "naintindihan", "kakayanin po",],
    },
  },

  Tamil: {
    informal: "நீ with டா/டி between close friends, spoken endings (முடியுமா), Tanglish.",
    formal: "நீங்கள் or தாங்கள், literary endings, தயவுசெய்து, ஐயா/அம்மா for seniors.",
    examples: [
      { en: "Can you send that today?", informal: "இன்னைக்கு அனுப்ப முடியுமா?", formal: "தாங்கள் இன்று அதை அனுப்ப முடியுமா?" },
      { en: "Sorry, I didn't catch that.", informal: "சாரி, சரியா கேட்கல.", formal: "மன்னிக்கவும், சரியாகக் கேட்கவில்லை." },
      { en: "That won't work for us.", informal: "அது எங்களுக்கு செட் ஆகாது.", formal: "அது எங்களுக்குப் பொருத்தமாக இருக்காது." },
      { en: "Thanks — talk later.", informal: "தேங்க்ஸ், அப்புறம் பேசலாம்!", formal: "நன்றி, மீண்டும் தொடர்பு கொள்வோம்." },
    ],
    markers: {
      informal: ["மச்சான்", "செம", "சாரி", "சரியா", "அப்புறம்", "கேட்கல", "பேசலாம்", "செட்", "தேங்க்ஸ்",],
      formal: ["தயவுசெய்து", "தாங்கள்", "மன்னிக்கவும்", "நன்றி", "ஐயா", "மீண்டும்", "பொருத்தமாக", "தொடர்பு",],
    },
  },

  Thai: {
    informal: "Particles dropped or replaced by จ้า/ดิ, nicknames, shortened words, no ครับ/ค่ะ on every line.",
    formal: "ครับ/ค่ะ on every sentence, รบกวน or กรุณา for requests, ขออภัย rather than โทษที, ผม/ดิฉัน for I.",
    examples: [
      { en: "Can you send that today?", informal: "ส่งให้วันนี้ได้ไหม", formal: "รบกวนส่งให้ภายในวันนี้ได้ไหมครับ" },
      { en: "Sorry, I didn't catch that.", informal: "โทษที ไม่ได้ยิน", formal: "ขออภัยครับ ผมฟังไม่ชัด" },
      { en: "That won't work for us.", informal: "แบบนี้ไม่เวิร์คสำหรับเรา", formal: "เกรงว่าแบบนี้อาจไม่เหมาะกับทางเราครับ" },
      { en: "Thanks — talk later.", informal: "ขอบใจ เดี๋ยวคุยกัน", formal: "ขอบคุณครับ ไว้ติดต่อกันอีกครั้ง" },
    ],
    markers: {
      informal: ["โทษที", "ขอบใจ", "ดิ", "จ้า", "ชิล", "ไม่เวิร์ค", "ไม่ได้ยิน", "คุยกัน", "ไม่เวิร์ค",],
      formal: ["ครับ", "ค่ะ", "กรุณา", "รบกวน", "ขออภัย", "ท่าน", "ภายในวันนี้", "ฟังไม่ชัด", "เกรงว่า", "ติดต่อ",],
    },
  },

  Turkish: {
    informal: "Sen endings (-sin), abi/kanka, tamam mı, sağ ol.",
    formal: "Siz endings (-siniz) even to one person, rica ederim, Sayın before a name, teşekkür ederim.",
    examples: [
      { en: "Can you send that today?", informal: "Bugün gönderebilir misin?", formal: "Bugün gönderebilir misiniz?" },
      { en: "Sorry, I didn't catch that.", informal: "Pardon, anlamadım.", formal: "Affedersiniz, tam duyamadım." },
      { en: "That won't work for us.", informal: "Bu bizde olmaz.", formal: "Maalesef bu bizim için uygun olmayacak." },
      { en: "Thanks — talk later.", informal: "Sağ ol, sonra konuşuruz!", formal: "Teşekkür ederim, tekrar görüşmek üzere." },
    ],
    markers: {
      informal: ["kanka", "abi", "sağ ol", "tamam mı", "misin", "naber", "misin", "olmaz", "konuşuruz", "anlamadım",],
      formal: ["misiniz", "rica ederim", "sayın", "lütfen", "teşekkür ederim", "affedersiniz", "olmayacak", "duyamadım", "görüşmek üzere",],
    },
  },

  Yoruba: {
    informal: "O for you, Pidgin mixed in freely (abeg, sha, no wahala), first names.",
    formal: "Ẹ for you — plural as respect, to anyone older or senior — ẹ jọ̀ọ́, full greetings, titles like ọ̀gá and Ẹ̀gbọ́n.",
    examples: [
      { en: "Can you send that today?", informal: "Ṣe o le fi ránṣẹ́ lónìí?", formal: "Ẹ jọ̀ọ́, ṣé ẹ lè fi ránṣẹ́ lónìí?" },
      { en: "Sorry, I didn't catch that.", informal: "Sorry o, mi ò gbọ́.", formal: "Ẹ jọ̀ọ́, mi ò gbọ́ dáadáa." },
      { en: "That won't work for us.", informal: "Èyí ò ní ṣiṣẹ́ fún wa.", formal: "Ẹ má bínú, èyí kò ní ṣiṣẹ́ fún wa." },
      { en: "Thanks — talk later.", informal: "O ṣé, a ó bá ara wa sọ̀rọ̀!", formal: "A dúpẹ́, a ó bá yín sọ̀rọ̀ lẹ́yìn." },
    ],
    markers: {
      informal: ["abeg", "sha", "omo", "padi", "wahala", "how far", "sorry o", "mi ò", "o ṣé", "èyí ò",],
      formal: ["ẹ jọ̀ọ́", "ẹ kú", "ọ̀gá", "a dúpẹ́", "ẹ ṣé", "yín", "ẹ lè", "dáadáa", "ẹ má bínú", "lẹ́yìn",],
    },
  },
};

export function registerGuideFor(language: string): RegisterGuide | null {
  return REGISTER_GUIDES[language] ?? null;
}
