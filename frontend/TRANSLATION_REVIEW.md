# Tamil translation review

Tamil strings were written to be simple and natural, but they need a native speaker to check them.
Tick each line once it reads right. Edit `frontend/locales/ta.json` (website) or `backend/src/core/messages.ts` (server messages), then run `npm run check:locales` in `frontend/` to regenerate this file.

## Website strings (frontend/locales/ta.json)

| ✓ | key | English | Tamil |
|---|---|---|---|
| [ ] | `common.appName` | Companion | Companion |
| [ ] | `common.save` | Save | சேமி |
| [ ] | `common.cancel` | Cancel | ரத்து |
| [ ] | `common.done` | Done | முடிந்தது |
| [ ] | `common.next` | Next | அடுத்து |
| [ ] | `common.back` | Back | பின்செல் |
| [ ] | `common.edit` | Edit | திருத்து |
| [ ] | `common.delete` | Delete | நீக்கு |
| [ ] | `common.remove` | Remove | நீக்கு |
| [ ] | `common.undo` | Undo | திரும்பப் பெறு |
| [ ] | `common.close` | Close | மூடு |
| [ ] | `common.add` | Add | சேர் |
| [ ] | `common.yes` | Yes | ஆம் |
| [ ] | `common.no` | No | இல்லை |
| [ ] | `common.loading` | Loading… | ஏற்றுகிறது… |
| [ ] | `common.retry` | Try again | மீண்டும் முயற்சி செய் |
| [ ] | `common.offline` | You're offline. Messages will send when you're back. | இணைய இணைப்பு இல்லை. இணைப்பு வந்ததும் மெசேஜ் அனுப்பப்படும். |
| [ ] | `common.error` | Something went wrong. Please try again. | ஏதோ தவறு நடந்தது. மீண்டும் முயற்சி செய். |
| [ ] | `common.today` | Today | இன்று |
| [ ] | `common.yesterday` | Yesterday | நேற்று |
| [ ] | `common.notSure` | Not sure | தெரியல |
| [ ] | `common.optional` | Optional | விருப்பம் |
| [ ] | `common.on` | On | ஆன் |
| [ ] | `common.off` | Off | ஆஃப் |
| [ ] | `common.days_one` | {{count}} day | {{count}} நாள் |
| [ ] | `common.days_other` | {{count}} days | {{count}} நாட்கள் |
| [ ] | `common.disclaimer` | Companion supports you. It does not replace a doctor. | Companion உனக்கு துணையா இருக்கும். ஆனா டாக்டருக்கு மாற்று இல்லை. |
| [ ] | `common.wakingUp` | Waking up the server… this can take up to a minute the first time. | சர்வர் விழித்துக்கொண்டிருக்கிறது… முதல் முறை ஒரு நிமிடம் வரை ஆகலாம். |
| [ ] | `common.comingSoon` | This page is coming in the next update. | இந்த பக்கம் அடுத்த அப்டேட்டில் வரும். |
| [ ] | `common.notFoundTitle` | Page not found | பக்கம் கிடைக்கவில்லை |
| [ ] | `common.goHome` | Go to chat | அரட்டைக்கு செல் |
| [ ] | `common.skipToContent` | Skip to content | உள்ளடக்கத்துக்கு செல் |
| [ ] | `tabs.chat` | Chat | அரட்டை |
| [ ] | `tabs.today` | Today | இன்று |
| [ ] | `tabs.cycle` | Cycle | சுழற்சி |
| [ ] | `tabs.me` | Me | நான் |
| [ ] | `auth.title` | Welcome | வணக்கம் |
| [ ] | `auth.subtitle` | Your private PCOS companion | உன்னோட தனிப்பட்ட PCOS துணை |
| [ ] | `auth.email` | Email | மின்னஞ்சல் |
| [ ] | `auth.password` | Password | கடவுச்சொல் |
| [ ] | `auth.signIn` | Sign in | உள்நுழை |
| [ ] | `auth.signUp` | Create account | கணக்கு உருவாக்கு |
| [ ] | `auth.switchToSignUp` | New here? Create an account | புதுசா? கணக்கு உருவாக்கு |
| [ ] | `auth.switchToSignIn` | Already have an account? Sign in | ஏற்கனவே கணக்கு இருக்கா? உள்நுழை |
| [ ] | `auth.checkEmail` | Check your email to confirm your account, then sign in. | உன் மின்னஞ்சலை பார்த்து கணக்கை உறுதி செய், பிறகு உள்நுழை. |
| [ ] | `auth.invalid` | Please enter a valid email and a password of at least 8 characters. | சரியான மின்னஞ்சலும் குறைந்தது 8 எழுத்து கடவுச்சொல்லும் கொடு. |
| [ ] | `auth.signOut` | Sign out | வெளியேறு |
| [ ] | `auth.google` | Continue with Google | Google மூலம் தொடரவும் |
| [ ] | `auth.or` | or | அல்லது |
| [ ] | `auth.forgot` | Forgot password? | கடவுச்சொல் மறந்துவிட்டதா? |
| [ ] | `auth.resetSent` | If that email has an account, a reset link is on its way. | அந்த மின்னஞ்சலுக்கு கணக்கு இருந்தால், மீட்டமைப்பு இணைப்பு வரும். |
| [ ] | `auth.popupBlocked` | The sign-in window was blocked. Please allow pop-ups and try again. | உள்நுழைவு சாளரம் தடுக்கப்பட்டது. pop-ups-ஐ அனுமதித்து மீண்டும் முயற்சி செய். |
| [ ] | `auth.notConfigured` | Sign-in isn't set up yet: the Firebase settings are missing in this deployment. | உள்நுழைவு இன்னும் அமைக்கப்படவில்லை: இந்த deployment-ல் Firebase அமைப்புகள் இல்லை. |
| [ ] | `lock.title` | Companion is locked | Companion பூட்டப்பட்டுள்ளது |
| [ ] | `lock.unlock` | Unlock | திற |
| [ ] | `lock.prompt` | Unlock Companion | Companion-ஐ திற |
| [ ] | `onboarding.step` | Step {{current}} of {{total}} | படி {{current}} / {{total}} |
| [ ] | `onboarding.languageTitle` | Which language do you like? | உனக்கு எந்த மொழி பிடிக்கும்? |
| [ ] | `onboarding.languageHint` | You can change this any time in settings. | இதை எப்போ வேணும்னாலும் அமைப்புகளில் மாத்தலாம். |
| [ ] | `onboarding.uiLanguage` | App language | ஆப் மொழி |
| [ ] | `onboarding.replyLanguage` | How should your companion reply? | உன் துணை எந்த மொழியில் பதில் சொல்லணும்? |
| [ ] | `onboarding.replyAuto` | Same as me (auto) | நான் பேசுற மாதிரியே (தானாக) |
| [ ] | `onboarding.replyEn` | English | ஆங்கிலம் |
| [ ] | `onboarding.replyTa` | Tamil (தமிழ்) | தமிழ் |
| [ ] | `onboarding.replyTanglish` | Tanglish | Tanglish |
| [ ] | `onboarding.companionTitle` | Meet your companion | உன் துணையை சந்தி |
| [ ] | `onboarding.companionName` | What would you like to call your companion? | உன் துணையை என்ன பேர் சொல்லி கூப்பிடணும்? |
| [ ] | `onboarding.companionNamePlaceholder` | Companion | Companion |
| [ ] | `onboarding.persona` | Personality | குணம் |
| [ ] | `onboarding.addressForm` | In Tamil, how should it talk to you? | தமிழில் உன்கிட்ட எப்படி பேசணும்? |
| [ ] | `onboarding.addressCasual` | Casual, like a close friend (nee) | நெருங்கிய நண்பர் மாதிரி (நீ) |
| [ ] | `onboarding.addressRespectful` | Respectful (neenga) | மரியாதையா (நீங்க) |
| [ ] | `onboarding.caloriesTitle` | Calories | கலோரிகள் |
| [ ] | `onboarding.caloriesQuestion` | Do you want to see calorie numbers? | கலோரி எண்களை பார்க்கணுமா? |
| [ ] | `onboarding.caloriesShow` | Show calories | கலோரிகளை காட்டு |
| [ ] | `onboarding.caloriesHide` | Hide calories | கலோரிகளை மறை |
| [ ] | `onboarding.caloriesHint` | Many people feel better without numbers. Your food still gets a gentle balance score. | நிறைய பேருக்கு எண்கள் இல்லாம இருக்கிறது நிம்மதியா இருக்கும். உன் சாப்பாட்டுக்கு ஒரு மென்மையான சமநிலை மதிப்பெண் இருக்கும். |
| [ ] | `onboarding.cycleTitle` | Your cycle | உன் சுழற்சி |
| [ ] | `onboarding.lastPeriod` | When did your last period start? | உன் கடைசி பீரியட் எப்போ ஆரம்பிச்சது? |
| [ ] | `onboarding.lastPeriodHint` | Pick a date or skip if you don't remember. | ஒரு தேதியை தேர்ந்தெடு, ஞாபகம் இல்லைன்னா தவிர். |
| [ ] | `onboarding.cycleLength` | How long is your cycle usually? | உன் சுழற்சி வழக்கமா எத்தனை நாள்? |
| [ ] | `onboarding.cycleLengthDays` | {{count}} days | {{count}} நாட்கள் |
| [ ] | `onboarding.medsTitle` | Medicines and supplements | மருந்துகளும் சப்ளிமெண்ட்களும் |
| [ ] | `onboarding.medsHint` | Add anything you take regularly, like metformin, inositol or vitamin D. You can add more later. | metformin, inositol, vitamin D மாதிரி நீ தொடர்ந்து எடுக்கிறதை சேர். அப்புறமும் சேர்க்கலாம். |
| [ ] | `onboarding.checkinTitle` | Daily check-ins | தினசரி விசாரிப்பு |
| [ ] | `onboarding.morning` | Morning check-in | காலை விசாரிப்பு |
| [ ] | `onboarding.evening` | Evening check-in | மாலை விசாரிப்பு |
| [ ] | `onboarding.notificationsAllow` | Allow notifications | அறிவிப்புகளை அனுமதி |
| [ ] | `onboarding.notificationsHint` | Only gentle reminders. Never more than 4 a day, and quiet at night. | மென்மையான நினைவூட்டல்கள் மட்டும். ஒரு நாளைக்கு 4-க்கு மேல் இல்லை, இரவில் அமைதி. |
| [ ] | `onboarding.lockTitle` | Keep it private | தனிப்பட்டதாக வை |
| [ ] | `onboarding.lockQuestion` | Lock the app with your fingerprint, face or phone PIN? | கைரேகை, முகம் அல்லது போன் PIN மூலம் ஆப்பை பூட்டணுமா? |
| [ ] | `onboarding.lockEnable` | Turn on app lock | ஆப் பூட்டை இயக்கு |
| [ ] | `onboarding.privacyTitle` | Your privacy | உன் தனியுரிமை |
| [ ] | `onboarding.privacyBody` | Your data is stored in your own private database. To reply, your companion sends short, anonymous context (never your name, email, phone or photos of you) to free AI models, some of whose providers may keep logs. Food photos are processed and deleted. You can export or delete everything any time. | உன் தகவல்கள் உனக்கு மட்டுமான தனிப்பட்ட database-ல சேமிக்கப்படும். பதில் சொல்ல, உன் துணை சின்ன, பெயர் இல்லாத context-ஐ (உன் பெயர், மின்னஞ்சல், போன் நம்பர், உன் புகைப்படங்கள் எதுவும் இல்லாம) இலவச AI மாடல்களுக்கு அனுப்பும். அவற்றில் சில நிறுவனங்கள் logs வைத்திருக்கலாம். சாப்பாட்டு புகைப்படங்கள் பார்த்ததும் நீக்கப்படும். எப்போ வேணும்னாலும் எல்லாத்தையும் export அல்லது நீக்கலாம். |
| [ ] | `onboarding.finish` | Let's start | ஆரம்பிக்கலாம் |
| [ ] | `onboarding.skip` | Skip | தவிர் |
| [ ] | `persona.bestie` | Caring bestie | அக்கறையான தோழி |
| [ ] | `persona.bestieDesc` | Warm, playful, lots of encouragement | அன்பா, விளையாட்டா, நிறைய ஊக்கம் |
| [ ] | `persona.calm` | Gentle and calm | மென்மையா, அமைதியா |
| [ ] | `persona.calmDesc` | Soft, slow, reassuring | மெதுவா, ஆறுதலா |
| [ ] | `persona.coach` | Motivating coach | ஊக்கமளிக்கும் பயிற்சியாளர் |
| [ ] | `persona.coachDesc` | Upbeat and goal-focused, never harsh | உற்சாகமா, இலக்கை நோக்கி, ஆனா கடுமையா இல்லை |
| [ ] | `chat.placeholder` | Message… | மெசேஜ்… |
| [ ] | `chat.send` | Send | அனுப்பு |
| [ ] | `chat.typing` | typing… | டைப் பண்ணுது… |
| [ ] | `chat.emptyTitle` | Say hi 👋 | ஹாய் சொல்லு 👋 |
| [ ] | `chat.emptyBody` | Tell me how your day is going, what you ate, or how you feel. | உன் நாள் எப்படி போகுது, என்ன சாப்பிட்ட, எப்படி இருக்கன்னு சொல்லு. |
| [ ] | `chat.quickFood` | Log food | சாப்பாடு பதிவு |
| [ ] | `chat.quickPeriod` | Period started | பீரியட் ஆரம்பம் |
| [ ] | `chat.quickLow` | Feeling low | மனசு சரியில்ல |
| [ ] | `chat.quickFoodText` | I ate  | நான் சாப்பிட்டது  |
| [ ] | `chat.quickPeriodText` | My period started today | இன்னைக்கு பீரியட் ஆரம்பிச்சுது |
| [ ] | `chat.quickLowText` | I'm feeling low today | இன்னைக்கு மனசு சரியில்ல |
| [ ] | `chat.camera` | Log food with a photo | புகைப்படம் மூலம் சாப்பாடு பதிவு |
| [ ] | `chat.queued` | Saved. Reply coming soon | சேமிக்கப்பட்டது. பதில் சீக்கிரம் வரும் |
| [ ] | `chat.sending` | Sending… | அனுப்புகிறது… |
| [ ] | `chat.notSent` | Not sent yet | இன்னும் அனுப்பப்படவில்லை |
| [ ] | `chat.logged` | Logged: {{label}} | பதிவானது: {{label}} |
| [ ] | `chat.undone` | Removed | நீக்கப்பட்டது |
| [ ] | `chat.confirmPeriodStart` | Log period start on {{date}}? | {{date}} அன்று பீரியட் ஆரம்பம் என்று பதிவு செய்யவா? |
| [ ] | `chat.confirmPeriodEnd` | Log period end on {{date}}? | {{date}} அன்று பீரியட் முடிவு என்று பதிவு செய்யவா? |
| [ ] | `chat.periodLogged` | Period logged for {{date}} | {{date}} பீரியட் பதிவானது |
| [ ] | `chat.crisisTitle` | You're not alone 💛 | நீ தனியா இல்லை 💛 |
| [ ] | `chat.crisisBody` | If you're thinking about hurting yourself, please reach out now to someone you trust, or call Tele-MANAS, India's free mental health helpline. They speak Tamil too. | உன்னை நீயே காயப்படுத்திக்கணும்னு தோணினா, இப்போவே உனக்கு நம்பிக்கையானவர்கிட்ட பேசு, இல்லன்னா இந்தியாவின் இலவச மனநல உதவி எண் Tele-MANAS-ஐ அழை. அவங்க தமிழிலும் பேசுவாங்க. |
| [ ] | `chat.crisisCall` | Call Tele-MANAS 14416 | Tele-MANAS 14416 அழை |
| [ ] | `chat.crisisDismiss` | I'm okay for now | இப்போதைக்கு நான் சரியா இருக்கேன் |
| [ ] | `chat.logNames.food_logs` | {{label}} | {{label}} |
| [ ] | `chat.logNames.symptom_logs` | symptom: {{label}} | அறிகுறி: {{label}} |
| [ ] | `chat.logNames.mood_logs` | mood | மனநிலை |
| [ ] | `chat.logNames.med_intake` | {{label}} taken | {{label}} எடுத்தாச்சு |
| [ ] | `chat.logNames.lifestyle_logs` | sleep, water or exercise | தூக்கம், தண்ணீர் அல்லது உடற்பயிற்சி |
| [ ] | `photo.title` | What's on the plate? | தட்டில் என்ன இருக்கு? |
| [ ] | `photo.analyzing` | Looking at your photo… | உன் புகைப்படத்தை பார்க்கிறேன்… |
| [ ] | `photo.hint` | Check the items. Edit or remove anything before saving. | பொருட்களை சரிபார். சேமிக்கும் முன் திருத்தலாம் அல்லது நீக்கலாம். |
| [ ] | `photo.notFood` | I couldn't spot food in that photo. Try another one? | அந்த புகைப்படத்தில் சாப்பாடு தெரியல. வேற ஒன்னு முயற்சி பண்ணலாமா? |
| [ ] | `photo.unavailable` | Photo logging isn't available right now. You can type what you ate in chat. | இப்போ புகைப்பட பதிவு கிடைக்கல. சாப்பிட்டதை அரட்டையில் டைப் பண்ணலாம். |
| [ ] | `photo.itemName` | Item | பொருள் |
| [ ] | `photo.quantity` | Qty | அளவு |
| [ ] | `photo.unit` | Unit | அலகு |
| [ ] | `photo.addItem` | Add item | பொருள் சேர் |
| [ ] | `photo.meal` | Meal | உணவு நேரம் |
| [ ] | `photo.save` | Save to today | இன்றைக்கு சேமி |
| [ ] | `photo.saved` | Saved to today ✓ | இன்றைக்கு சேமிக்கப்பட்டது ✓ |
| [ ] | `photo.privacy` | The photo is not stored. | புகைப்படம் சேமிக்கப்படாது. |
| [ ] | `photo.pickCamera` | Take photo | புகைப்படம் எடு |
| [ ] | `photo.pickLibrary` | Choose from gallery | கேலரியிலிருந்து தேர்வு செய் |
| [ ] | `meals.breakfast` | Breakfast | காலை உணவு |
| [ ] | `meals.lunch` | Lunch | மதிய உணவு |
| [ ] | `meals.snack` | Snack | சிற்றுண்டி |
| [ ] | `meals.dinner` | Dinner | இரவு உணவு |
| [ ] | `meals.other` | Other | மற்றவை |
| [ ] | `today.title` | Today | இன்று |
| [ ] | `today.balanceTitle` | Food balance | உணவு சமநிலை |
| [ ] | `today.balanceScore` | {{score}}/10 | {{score}}/10 |
| [ ] | `today.balanceEmpty` | Nothing logged yet. Tell me what you ate in chat, or snap a photo. | இன்னும் எதுவும் பதிவு இல்லை. என்ன சாப்பிட்டன்னு அரட்டையில் சொல்லு, இல்லன்னா ஒரு புகைப்படம் எடு. |
| [ ] | `today.kcal` | {{count}} kcal | {{count}} kcal |
| [ ] | `today.estimate` | estimate | தோராயம் |
| [ ] | `today.highlights.protein` | good protein today | இன்னைக்கு நல்ல புரதம் |
| [ ] | `today.highlights.fiber` | nice fiber | நல்ல நார்ச்சத்து |
| [ ] | `today.highlights.low_gi` | lots of slow carbs | மெதுவா செரிக்கும் மாவுச்சத்து நிறைய |
| [ ] | `today.highlights.low_sugar` | easy on added sugar | சேர்த்த சர்க்கரை குறைவு |
| [ ] | `today.highlights.veggies` | plenty of veggies | காய்கறிகள் நிறைய |
| [ ] | `today.ideas.add_protein` | Idea: some dal, curd, egg or sundal could add protein | யோசனை: பருப்பு, தயிர், முட்டை அல்லது சுண்டல் புரதம் சேர்க்கும் |
| [ ] | `today.ideas.add_fiber` | Idea: a poriyal or fruit adds easy fiber | யோசனை: ஒரு பொரியல் அல்லது பழம் ஈஸியா நார்ச்சத்து சேர்க்கும் |
| [ ] | `today.ideas.add_veggies` | Idea: a small bowl of kootu or poriyal | யோசனை: ஒரு சின்ன கிண்ணம் கூட்டு அல்லது பொரியல் |
| [ ] | `today.ideas.swap_low_gi` | Idea: millets or brown rice now and then | யோசனை: அப்பப்போ சிறுதானியம் அல்லது கைக்குத்தல் அரிசி |
| [ ] | `today.water` | Water | தண்ணீர் |
| [ ] | `today.waterAmount` | {{ml}} ml | {{ml}} ml |
| [ ] | `today.addWater` | +250 ml | +250 ml |
| [ ] | `today.mood` | Mood | மனநிலை |
| [ ] | `today.moodEmpty` | No mood logged | மனநிலை பதிவு இல்லை |
| [ ] | `today.symptoms` | Symptoms | அறிகுறிகள் |
| [ ] | `today.symptomsEmpty` | None logged | எதுவும் பதிவு இல்லை |
| [ ] | `today.meds` | Medicines | மருந்துகள் |
| [ ] | `today.medsEmpty` | No medicines added | மருந்துகள் சேர்க்கப்படவில்லை |
| [ ] | `today.taken` | Taken | எடுத்தாச்சு |
| [ ] | `today.notTaken` | Not yet | இன்னும் இல்லை |
| [ ] | `today.quickLog` | Quick log | விரைவு பதிவு |
| [ ] | `today.weightPrompt` | Weekly weight (optional) | வார எடை (விருப்பம்) |
| [ ] | `today.weightSave` | Save weight | எடையை சேமி |
| [ ] | `today.sleep` | Sleep | தூக்கம் |
| [ ] | `today.sleepHours` | {{count}} h | {{count}} மணி |
| [ ] | `today.deleteFood` | Remove {{name}}? | {{name}}-ஐ நீக்கவா? |
| [ ] | `quickLog.title` | Quick log | விரைவு பதிவு |
| [ ] | `quickLog.mood` | Mood | மனநிலை |
| [ ] | `quickLog.energy` | Energy | சக்தி |
| [ ] | `quickLog.stress` | Stress | மன அழுத்தம் |
| [ ] | `quickLog.symptoms` | Symptoms | அறிகுறிகள் |
| [ ] | `quickLog.sleep` | Sleep last night | நேத்து ராத்திரி தூக்கம் |
| [ ] | `quickLog.saved` | Logged ✓ | பதிவானது ✓ |
| [ ] | `quickLog.save` | Save | சேமி |
| [ ] | `symptoms.acne` | Acne | முகப்பரு |
| [ ] | `symptoms.hair_fall` | Hair fall | முடி கொட்டுதல் |
| [ ] | `symptoms.hirsutism` | Extra hair growth | அதிக முடி வளர்ச்சி |
| [ ] | `symptoms.bloating` | Bloating | வயிறு உப்புசம் |
| [ ] | `symptoms.cramps` | Cramps | வயிற்று வலி |
| [ ] | `symptoms.cravings` | Cravings | சாப்பிட ஆசை |
| [ ] | `symptoms.fatigue` | Tiredness | சோர்வு |
| [ ] | `symptoms.headache` | Headache | தலைவலி |
| [ ] | `symptoms.pelvic_pain` | Pelvic pain | இடுப்பு வலி |
| [ ] | `symptoms.breast_tenderness` | Breast tenderness | மார்பக வலி |
| [ ] | `symptoms.spotting` | Spotting | இடையில் இரத்தக்கசிவு |
| [ ] | `symptoms.fainting` | Fainting | மயக்கம் |
| [ ] | `symptoms.other` | Other | மற்றவை |
| [ ] | `cycle.title` | Cycle | சுழற்சி |
| [ ] | `cycle.dayOf` | Cycle day {{day}} | சுழற்சி நாள் {{day}} |
| [ ] | `cycle.periodDay` | Period day {{day}} | பீரியட் நாள் {{day}} |
| [ ] | `cycle.late` | {{count}} days past the predicted range | கணித்த range-ஐ விட {{count}} நாள் தாமதம் |
| [ ] | `cycle.unknown` | Log a period to start tracking | கண்காணிக்க ஆரம்பிக்க ஒரு பீரியடை பதிவு செய் |
| [ ] | `cycle.phase.menstrual` | Period | பீரியட் |
| [ ] | `cycle.phase.follicular` | Follicular phase (estimate) | ஃபாலிக்குலர் கட்டம் (தோராயம்) |
| [ ] | `cycle.phase.luteal` | Luteal phase (estimate) | லூட்டியல் கட்டம் (தோராயம்) |
| [ ] | `cycle.phase.late` | Late | தாமதம் |
| [ ] | `cycle.phase.unknown` |  |  |
| [ ] | `cycle.prediction` | Next period | அடுத்த பீரியட் |
| [ ] | `cycle.window` | {{earliest}} – {{latest}} | {{earliest}} – {{latest}} |
| [ ] | `cycle.likely` | Most likely around {{date}} | பெரும்பாலும் {{date}} அளவில் |
| [ ] | `cycle.confidence.low` | Low confidence | குறைந்த நம்பகத்தன்மை |
| [ ] | `cycle.confidence.medium` | Medium confidence | நடுத்தர நம்பகத்தன்மை |
| [ ] | `cycle.confidence.high` | High confidence | அதிக நம்பகத்தன்மை |
| [ ] | `cycle.rangeNote` | PCOS cycles often vary, so this is a range. | PCOS-ல சுழற்சி அடிக்கடி மாறும், அதனால இது ஒரு range தான். |
| [ ] | `cycle.logStart` | Period started | பீரியட் ஆரம்பம் |
| [ ] | `cycle.logEnd` | Period ended | பீரியட் முடிவு |
| [ ] | `cycle.startOn` | Period started on {{date}} | {{date}} அன்று பீரியட் ஆரம்பம் |
| [ ] | `cycle.endOn` | Period ended on {{date}} | {{date}} அன்று பீரியட் முடிவு |
| [ ] | `cycle.tapDay` | Tap a day to log your period | பீரியடை பதிவு செய்ய ஒரு நாளை தொடு |
| [ ] | `cycle.history` | Cycle history | சுழற்சி வரலாறு |
| [ ] | `cycle.historyEmpty` | Your past cycles will show here. | உன் பழைய சுழற்சிகள் இங்கே தெரியும். |
| [ ] | `cycle.length` | {{count}} days | {{count}} நாட்கள் |
| [ ] | `cycle.ongoing` | ongoing | நடந்துகொண்டிருக்கிறது |
| [ ] | `cycle.flow` | Flow | இரத்தப்போக்கு |
| [ ] | `cycle.flows.spotting` | Spotting | சிறு கசிவு |
| [ ] | `cycle.flows.light` | Light | குறைவு |
| [ ] | `cycle.flows.medium` | Medium | நடுத்தரம் |
| [ ] | `cycle.flows.heavy` | Heavy | அதிகம் |
| [ ] | `cycle.pain` | Pain (0–10) | வலி (0–10) |
| [ ] | `cycle.autoClosed` | We ended this period after 10 days. Did it end on {{date}}? | 10 நாளுக்கு அப்புறம் இந்த பீரியடை முடிச்சு வச்சோம். {{date}} அன்று முடிஞ்சதா? |
| [ ] | `cycle.autoClosedFix` | Change end date | முடிவு தேதியை மாத்து |
| [ ] | `cycle.legendPeriod` | Period | பீரியட் |
| [ ] | `cycle.legendPredicted` | Predicted window | கணித்த காலம் |
| [ ] | `cycle.deletePeriod` | Delete this period? | இந்த பீரியடை நீக்கவா? |
| [ ] | `cycle.monthPrev` | Previous month | முந்தைய மாதம் |
| [ ] | `cycle.monthNext` | Next month | அடுத்த மாதம் |
| [ ] | `cycle.notDuringPeriod` | That day is inside a logged period. | அந்த நாள் ஏற்கனவே பதிவான பீரியடுக்குள் இருக்கு. |
| [ ] | `cycle.cycleLength` | Cycle: {{count}} days | சுழற்சி: {{count}} நாட்கள் |
| [ ] | `insightCards.delayTitle` | Your period is running late | உன் பீரியட் தாமதமாகுது |
| [ ] | `insightCards.delayBody` | It's {{count}} days past the predicted range. That's common with PCOS. | கணித்த range-ஐ விட {{count}} நாள் ஆயிடுச்சு. PCOS-ல இது சகஜம் தான். |
| [ ] | `insightCards.delayFactors` | Things that may have played a role: | இதுக்கு காரணமா இருந்திருக்கக்கூடியவை: |
| [ ] | `insightCards.delayPregnancy` | If there's any chance of pregnancy, a home test is an easy way to rule it out. | கர்ப்பமா இருக்க வாய்ப்பு இருந்தா, வீட்டிலேயே ஒரு test எடுக்கிறது ஈஸியா உறுதி செய்ய உதவும். |
| [ ] | `insightCards.delayDoctor` | If delays keep happening, your doctor can help. | தொடர்ந்து தாமதமானா, உன் டாக்டர் உதவுவாங்க. |
| [ ] | `insightCards.factors.high_stress` | Quite a few stressful days | நிறைய மன அழுத்தமான நாட்கள் |
| [ ] | `insightCards.factors.poor_sleep` | Less sleep than usual | வழக்கத்தை விட குறைவான தூக்கம் |
| [ ] | `insightCards.factors.weight_change` | A change in weight | எடையில் ஒரு மாற்றம் |
| [ ] | `insightCards.factors.exercise_change` | A big jump in exercise | உடற்பயிற்சியில் திடீர் அதிகரிப்பு |
| [ ] | `insightCards.factors.illness_or_travel` | Being unwell or travelling | உடம்பு சரியில்லாதது அல்லது பயணம் |
| [ ] | `insightCards.factors.medication_change` | A medicine starting or stopping | ஒரு மருந்து ஆரம்பித்தது அல்லது நிறுத்தியது |
| [ ] | `insightCards.factors.low_intake_days` | Some days with lighter meals than your usual | சில நாள் வழக்கத்தை விட குறைவா சாப்பிட்டது |
| [ ] | `insightCards.factors.usual_pattern` | Your cycles have been this long before | முன்னாடியும் உன் சுழற்சி இவ்வளவு நீளமா இருந்திருக்கு |
| [ ] | `insightCards.redFlagTitle` | Worth a chat with your doctor | உன் டாக்டர்கிட்ட பேசுறது நல்லது |
| [ ] | `insightCards.redFlags.no_period_90` | It's been 90 days or more since your last period. | கடைசி பீரியடுக்கு அப்புறம் 90 நாள் அல்லது அதுக்கு மேல ஆயிடுச்சு. |
| [ ] | `insightCards.redFlags.heavy_bleeding` | You logged very heavy bleeding with strong pain. | கடுமையான வலியோட மிக அதிக இரத்தப்போக்கு பதிவு செஞ்சிருக்க. |
| [ ] | `insightCards.redFlags.long_bleeding` | A period lasted more than 8 days. | ஒரு பீரியட் 8 நாளுக்கு மேல நீடிச்சது. |
| [ ] | `insightCards.redFlags.intermenstrual_bleeding` | You've had bleeding between periods on several days. | பீரியடுகளுக்கு இடையில் பல நாள் இரத்தக்கசிவு இருந்திருக்கு. |
| [ ] | `insightCards.redFlags.severe_pelvic_pain` | You logged severe pelvic pain outside your period. | பீரியட் இல்லாத நேரத்தில் கடுமையான இடுப்பு வலி பதிவு செஞ்சிருக்க. |
| [ ] | `insightCards.redFlags.fainting` | You logged fainting. | மயக்கம் பதிவு செஞ்சிருக்க. |
| [ ] | `insightCards.redFlags.chat_symptom` | Something you mentioned in chat is worth checking. | அரட்டையில் நீ சொன்ன ஒன்னை சரிபார்க்கிறது நல்லது. |
| [ ] | `insightCards.redFlagBody` | This isn't an emergency alert, just a gentle nudge to mention it to your doctor soon. | இது அவசர எச்சரிக்கை இல்லை, சீக்கிரம் உன் டாக்டர்கிட்ட சொல்லுன்னு ஒரு மென்மையான நினைவூட்டல் தான். |
| [ ] | `insightCards.dismiss` | Got it | சரி |
| [ ] | `insightCards.patternTitle` | You might notice… | நீ கவனிக்கலாம்… |
| [ ] | `insightCards.patterns.mood_by_phase` | Your mood tends to dip a little in the {{phase}}. | {{phase}}-ல உன் மனநிலை கொஞ்சம் குறையுது போல. |
| [ ] | `insightCards.patterns.cravings_luteal` | Cravings show up more in the days before your period. | பீரியடுக்கு முன்னாடி நாட்களில் சாப்பிட ஆசை அதிகமா வருது. |
| [ ] | `insightCards.patterns.sugar_acne` | Acne days sometimes follow higher-sugar days. | சர்க்கரை அதிகமான நாளுக்கு அப்புறம் சில சமயம் முகப்பரு வருது. |
| [ ] | `insights.title` | Insights | நுண்ணறிவுகள் |
| [ ] | `insights.weekly` | This week | இந்த வாரம் |
| [ ] | `insights.weeklyEmpty` | Your first weekly recap arrives on Sunday evening. | உன் முதல் வார சுருக்கம் ஞாயிறு மாலை வரும். |
| [ ] | `insights.cycleLengths` | Cycle lengths | சுழற்சி நீளங்கள் |
| [ ] | `insights.balanceTrend` | Food balance, last 14 days | உணவு சமநிலை, கடைசி 14 நாள் |
| [ ] | `insights.moodTrend` | Mood, last 30 days | மனநிலை, கடைசி 30 நாள் |
| [ ] | `insights.weightTrend` | Weight trend (smoothed) | எடை போக்கு (சீராக்கப்பட்டது) |
| [ ] | `insights.labs` | Lab results | பரிசோதனை முடிவுகள் |
| [ ] | `insights.notEnough` | Not enough data yet. Keep logging and this will fill in. | இன்னும் போதுமான தகவல் இல்லை. தொடர்ந்து பதிவு செஞ்சா இது நிரம்பும். |
| [ ] | `insights.stats.days_with_food_logged` | Days with food logged | சாப்பாடு பதிவான நாட்கள் |
| [ ] | `insights.stats.avg_balance_score` | Average balance score | சராசரி சமநிலை மதிப்பெண் |
| [ ] | `insights.stats.avg_mood` | Average mood | சராசரி மனநிலை |
| [ ] | `insights.stats.avg_sleep_hours` | Average sleep (hours) | சராசரி தூக்கம் (மணி) |
| [ ] | `insights.stats.exercise_minutes_total` | Exercise (minutes) | உடற்பயிற்சி (நிமிடம்) |
| [ ] | `insights.stats.medication_doses_taken` | Medicine doses taken | எடுத்த மருந்து அளவுகள் |
| [ ] | `labs.title` | Lab results | பரிசோதனை முடிவுகள் |
| [ ] | `labs.add` | Add result | முடிவு சேர் |
| [ ] | `labs.test` | Test | பரிசோதனை |
| [ ] | `labs.customName` | Test name | பரிசோதனை பெயர் |
| [ ] | `labs.value` | Value | மதிப்பு |
| [ ] | `labs.unit` | Unit | அலகு |
| [ ] | `labs.range` | Reference range (from your report) | குறிப்பு வரம்பு (உன் ரிப்போர்ட்டிலிருந்து) |
| [ ] | `labs.rangeHint` | e.g. 0.4 – 4.0 | எ.கா. 0.4 – 4.0 |
| [ ] | `labs.date` | Test date | பரிசோதனை தேதி |
| [ ] | `labs.within` | Within the range on your report | உன் ரிப்போர்ட்டில் உள்ள வரம்புக்குள் |
| [ ] | `labs.outside` | Outside the range on your report | உன் ரிப்போர்ட்டில் உள்ள வரம்புக்கு வெளியே |
| [ ] | `labs.empty` | Add values from your lab reports to see them over time. | காலப்போக்கில் பார்க்க உன் லேப் ரிப்போர்ட் மதிப்புகளை சேர். |
| [ ] | `labs.names.testosterone` | Testosterone | டெஸ்டோஸ்டிரோன் |
| [ ] | `labs.names.AMH` | AMH | AMH |
| [ ] | `labs.names.LH` | LH | LH |
| [ ] | `labs.names.FSH` | FSH | FSH |
| [ ] | `labs.names.fasting_insulin` | Fasting insulin | வெறும் வயிற்று இன்சுலின் |
| [ ] | `labs.names.HbA1c` | HbA1c | HbA1c |
| [ ] | `labs.names.TSH` | TSH | TSH |
| [ ] | `labs.names.vitamin_D` | Vitamin D | வைட்டமின் D |
| [ ] | `labs.names.other` | Other | மற்றவை |
| [ ] | `me.title` | Me | நான் |
| [ ] | `me.remembers` | What {{name}} remembers | {{name}} நினைவில் வைத்திருப்பவை |
| [ ] | `me.medications` | Medicines | மருந்துகள் |
| [ ] | `me.labs` | Lab results | பரிசோதனை முடிவுகள் |
| [ ] | `me.insights` | Insights | நுண்ணறிவுகள் |
| [ ] | `me.settings` | Settings | அமைப்புகள் |
| [ ] | `me.doctorReport` | Doctor report | டாக்டர் ரிப்போர்ட் |
| [ ] | `me.export` | Export my data | என் தகவல்களை export செய் |
| [ ] | `me.exported` | Your data is ready to share or save. | உன் தகவல்கள் பகிர அல்லது சேமிக்க தயார். |
| [ ] | `me.delete` | Delete everything | எல்லாத்தையும் நீக்கு |
| [ ] | `me.version` | Version {{version}} | பதிப்பு {{version}} |
| [ ] | `me.signedInAs` | Signed in as {{email}} | {{email}} ஆக உள்நுழைந்துள்ளாய் |
| [ ] | `remembers.title` | What {{name}} remembers | {{name}} நினைவில் வைத்திருப்பவை |
| [ ] | `remembers.hint` | Short notes your companion keeps so it can follow up like a friend. Edit or delete anything. | ஒரு நண்பர் மாதிரி விசாரிக்க உன் துணை வைத்திருக்கும் சின்ன குறிப்புகள். எதை வேணும்னாலும் திருத்தலாம் அல்லது நீக்கலாம். |
| [ ] | `remembers.empty` | Nothing yet. As you chat, little things worth remembering will show up here. | இன்னும் எதுவும் இல்லை. நீ பேசப் பேச, நினைவில் வைக்க வேண்டிய சின்ன விஷயங்கள் இங்கே வரும். |
| [ ] | `remembers.deleteConfirm` | Forget this? | இதை மறந்துடவா? |
| [ ] | `remembers.categories.preference` | Likes | பிடித்தவை |
| [ ] | `remembers.categories.person` | People | மனிதர்கள் |
| [ ] | `remembers.categories.event` | Plans | திட்டங்கள் |
| [ ] | `remembers.categories.health` | Health | ஆரோக்கியம் |
| [ ] | `remembers.categories.other` | Other | மற்றவை |
| [ ] | `meds.title` | Medicines | மருந்துகள் |
| [ ] | `meds.add` | Add medicine | மருந்து சேர் |
| [ ] | `meds.name` | Name | பெயர் |
| [ ] | `meds.namePlaceholder` | e.g. Metformin | எ.கா. Metformin |
| [ ] | `meds.dose` | Dose | அளவு |
| [ ] | `meds.dosePlaceholder` | e.g. 500 mg | எ.கா. 500 mg |
| [ ] | `meds.times` | Reminder times | நினைவூட்டல் நேரங்கள் |
| [ ] | `meds.addTime` | Add time | நேரம் சேர் |
| [ ] | `meds.active` | Active | செயலில் |
| [ ] | `meds.empty` | No medicines yet. | இன்னும் மருந்துகள் இல்லை. |
| [ ] | `meds.note` | Companion only reminds you. It never comments on whether a medicine is right for you. | Companion நினைவூட்டும் மட்டும். ஒரு மருந்து உனக்கு சரியானதான்னு அது ஒருபோதும் சொல்லாது. |
| [ ] | `meds.stop` | Stop taking | எடுப்பதை நிறுத்து |
| [ ] | `meds.notificationTitle` | Medicine time | மருந்து நேரம் |
| [ ] | `meds.notificationBody` | {{name}} {{dose}} | {{name}} {{dose}} |
| [ ] | `meds.actionTaken` | Taken | எடுத்தாச்சு |
| [ ] | `meds.actionSnooze` | Snooze 30 min | 30 நிமிடம் கழித்து |
| [ ] | `settings.title` | Settings | அமைப்புகள் |
| [ ] | `settings.appLanguage` | App language | ஆப் மொழி |
| [ ] | `settings.english` | English | English |
| [ ] | `settings.tamil` | தமிழ் | தமிழ் |
| [ ] | `settings.replyLanguage` | Companion replies in | துணை பதில் சொல்லும் மொழி |
| [ ] | `settings.persona` | Personality | குணம் |
| [ ] | `settings.companionName` | Companion's name | துணையின் பெயர் |
| [ ] | `settings.addressForm` | Tamil address form | தமிழில் அழைக்கும் விதம் |
| [ ] | `settings.calories` | Show calories | கலோரிகளை காட்டு |
| [ ] | `settings.checkins` | Check-in times | விசாரிப்பு நேரங்கள் |
| [ ] | `settings.morning` | Morning | காலை |
| [ ] | `settings.evening` | Evening | மாலை |
| [ ] | `settings.quietHours` | Quiet hours | அமைதி நேரம் |
| [ ] | `settings.quietStart` | From | இருந்து |
| [ ] | `settings.quietEnd` | To | வரை |
| [ ] | `settings.waterNudges` | Water reminders (2 a day) | தண்ணீர் நினைவூட்டல் (நாளுக்கு 2) |
| [ ] | `settings.weightTracking` | Weight tracking | எடை கண்காணிப்பு |
| [ ] | `settings.weightHint` | Off by default. If on, you'll be asked at most once a week, and only a smoothed trend is shown. | இயல்பாக ஆஃப். ஆன் செய்தால், வாரத்துக்கு ஒரு முறைக்கு மேல் கேட்காது, சீரான போக்கு மட்டும் காட்டப்படும். |
| [ ] | `settings.appLock` | App lock | ஆப் பூட்டு |
| [ ] | `settings.theme` | Appearance | தோற்றம் |
| [ ] | `settings.themeSystem` | System | சிஸ்டம் |
| [ ] | `settings.themeLight` | Light | வெளிச்சம் |
| [ ] | `settings.themeDark` | Dark | இருள் |
| [ ] | `settings.timeFormatHint` | 24-hour time, e.g. 08:30 | 24 மணி நேர வடிவம், எ.கா. 08:30 |
| [ ] | `settings.invalidTime` | Use HH:MM, e.g. 08:30 | HH:MM வடிவில் கொடு, எ.கா. 08:30 |
| [ ] | `settings.saved` | Saved ✓ | சேமிக்கப்பட்டது ✓ |
| [ ] | `notifications.morningTitle` | Good morning 🌸 | காலை வணக்கம் 🌸 |
| [ ] | `notifications.morningBody` | How did you sleep? Tell me about your morning. | நல்லா தூங்கினியா? உன் காலை எப்படி போகுதுன்னு சொல்லு. |
| [ ] | `notifications.eveningTitle` | How was your day? 💛 | இன்னைக்கு எப்படி போச்சு? 💛 |
| [ ] | `notifications.eveningBody` | Tell me what you ate and how you're feeling. | என்ன சாப்பிட்ட, எப்படி இருக்கன்னு சொல்லு. |
| [ ] | `notifications.waterTitle` | Water break 💧 | தண்ணீர் இடைவேளை 💧 |
| [ ] | `notifications.waterBody` | A glass of water sounds nice right now. | இப்போ ஒரு கிளாஸ் தண்ணீர் குடிச்சா நல்லா இருக்கும். |
| [ ] | `report.title` | Doctor report | டாக்டர் ரிப்போர்ட் |
| [ ] | `report.range` | Date range | தேதி வரம்பு |
| [ ] | `report.last3` | Last 3 months | கடைசி 3 மாதம் |
| [ ] | `report.last6` | Last 6 months | கடைசி 6 மாதம் |
| [ ] | `report.last12` | Last 12 months | கடைசி 12 மாதம் |
| [ ] | `report.notes` | Your notes for the doctor | டாக்டருக்கான உன் குறிப்புகள் |
| [ ] | `report.notesPlaceholder` | Questions or anything you want to mention | கேள்விகள் அல்லது சொல்ல விரும்புவது |
| [ ] | `report.generate` | Create PDF | PDF உருவாக்கு |
| [ ] | `report.generating` | Creating… | உருவாக்குகிறது… |
| [ ] | `report.heading` | Health summary for doctor visit | டாக்டர் சந்திப்புக்கான ஆரோக்கிய சுருக்கம் |
| [ ] | `report.period` | Period covered | காலம் |
| [ ] | `report.cycleHistory` | Cycle history | சுழற்சி வரலாறு |
| [ ] | `report.start` | Start | ஆரம்பம் |
| [ ] | `report.end` | End | முடிவு |
| [ ] | `report.length` | Cycle length (days) | சுழற்சி நீளம் (நாட்கள்) |
| [ ] | `report.flow` | Flow | இரத்தப்போக்கு |
| [ ] | `report.symptomFrequency` | Symptom frequency (days logged) | அறிகுறி அடிக்கடித்தன்மை (பதிவான நாட்கள்) |
| [ ] | `report.medsHeading` | Medicines | மருந்துகள் |
| [ ] | `report.adherence` | Doses marked taken | எடுத்ததாக குறித்த அளவுகள் |
| [ ] | `report.weightHeading` | Weight trend | எடை போக்கு |
| [ ] | `report.labsHeading` | Lab results | பரிசோதனை முடிவுகள் |
| [ ] | `report.notesHeading` | Notes | குறிப்புகள் |
| [ ] | `report.none` | None logged | எதுவும் பதிவு இல்லை |
| [ ] | `report.generatedOn` | Generated on {{date}} | {{date}} அன்று உருவாக்கப்பட்டது |
| [ ] | `report.prediction` | Current prediction | தற்போதைய கணிப்பு |
| [ ] | `export.title` | Export my data | என் தகவல்களை export செய் |
| [ ] | `export.body` | Download everything as a JSON file you can keep or share. | எல்லாத்தையும் ஒரு JSON கோப்பாக பதிவிறக்கு, வைத்துக்கொள்ளலாம் அல்லது பகிரலாம். |
| [ ] | `export.button` | Export | Export |
| [ ] | `export.working` | Preparing… | தயார் செய்கிறது… |
| [ ] | `deleteAll.title` | Delete everything | எல்லாத்தையும் நீக்கு |
| [ ] | `deleteAll.body` | This permanently deletes your account, all logs, chats, memories and backups. It can't be undone. You may want to export your data first. | இது உன் கணக்கு, எல்லா பதிவுகள், அரட்டைகள், நினைவுகள், backups எல்லாத்தையும் நிரந்தரமா நீக்கும். திரும்பப் பெற முடியாது. முதலில் உன் தகவல்களை export செய்யலாம். |
| [ ] | `deleteAll.typeToConfirm` | Type DELETE to confirm | உறுதி செய்ய DELETE என்று டைப் செய் |
| [ ] | `deleteAll.button` | Delete my account | என் கணக்கை நீக்கு |
| [ ] | `deleteAll.working` | Deleting… | நீக்குகிறது… |
| [ ] | `developer.title` | Developer | டெவலப்பர் |
| [ ] | `developer.models` | Recent replies and the model that answered | சமீபத்திய பதில்களும் பதில் சொன்ன மாடலும் |
| [ ] | `developer.queued` | Queued messages | காத்திருக்கும் மெசேஜ்கள் |
| [ ] | `developer.none` | None | எதுவும் இல்லை |
| [ ] | `developer.retries` | retries {{count}} | மறுமுயற்சி {{count}} |
| [ ] | `empty.insightsCta` | Open chat | அரட்டையை திற |
| [ ] | `a11y.sendMessage` | Send message | மெசேஜ் அனுப்பு |
| [ ] | `a11y.openCamera` | Log food with a photo | புகைப்படம் மூலம் சாப்பாடு பதிவு |
| [ ] | `a11y.moodValue` | Mood {{value}} of 5 | மனநிலை 5-ல் {{value}} |
| [ ] | `a11y.levelValue` | {{label}} {{value}} of 5 | {{label}} 5-ல் {{value}} |
| [ ] | `a11y.removeItem` | Remove {{name}} | {{name}}-ஐ நீக்கு |
| [ ] | `a11y.calendarDay` | {{date}} | {{date}} |
| [ ] | `a11y.periodDay` | {{date}}, period | {{date}}, பீரியட் |
| [ ] | `a11y.predictedDay` | {{date}}, predicted window | {{date}}, கணித்த காலம் |
| [ ] | `a11y.callHelpline` | Call Tele-MANAS helpline 14416 | Tele-MANAS உதவி எண் 14416-ஐ அழை |
| [ ] | `chatPage.loadEarlier` | Load earlier messages | முந்தைய மெசேஜ்களை காட்டு |
| [ ] | `chatPage.removed` | Removed: {{label}} | நீக்கப்பட்டது: {{label}} |
| [ ] | `chatPage.undoAria` | Undo: {{label}} | திரும்பப் பெறு: {{label}} |
| [ ] | `chatPage.conversation` | Conversation with {{name}} | {{name}} உடன் அரட்டை |
| [ ] | `chatPage.quickReplies` | Quick replies | விரைவு பதில்கள் |
| [ ] | `chatPage.languages` | Tamil · English · Tanglish | தமிழ் · English · Tanglish |
| [ ] | `chatPage.closePanel` | Close chat | அரட்டையை மூடு |
| [ ] | `chatPage.openPanel` | Talk to Companion | Companion-உடன் பேசு |
| [ ] | `chatPage.quickChat` | Quick chat | விரைவு அரட்டை |
| [ ] | `chatPage.privacyNote` | Only you can see your logs. Export or delete them any time from Me. | உங்கள் பதிவுகளை நீங்கள் மட்டுமே பார்க்க முடியும். Me பக்கத்தில் எப்போது வேண்டுமானாலும் ஏற்றுமதி செய்யலாம் அல்லது நீக்கலாம். |
| [ ] | `chatPage.periodHint` | This updates your cycle and the next-period range. | இது உங்கள் சுழற்சியையும் அடுத்த மாதவிடாய் வரம்பையும் புதுப்பிக்கும். |
| [ ] | `cyclePage.cyclesUsed_one` | Based on {{count}} past cycle | கடந்த {{count}} சுழற்சியின் அடிப்படையில் |
| [ ] | `cyclePage.cyclesUsed_other` | Based on {{count}} past cycles | கடந்த {{count}} சுழற்சிகளின் அடிப்படையில் |
| [ ] | `cyclePage.calendar` | Period calendar | மாதவிடாய் நாள்காட்டி |
| [ ] | `cyclePage.legend` | Legend | குறிப்பு |
| [ ] | `cyclePage.legendToday` | Today | இன்று |
| [ ] | `cyclePage.saved` | Saved ✓ | சேமிக்கப்பட்டது ✓ |
| [ ] | `cyclePage.saveError` | Couldn't save that. Please check the dates and try again. | சேமிக்க முடியவில்லை. தேதிகளைச் சரிபார்த்து மீண்டும் முயலவும். |
| [ ] | `cyclePage.startHint` | Log the first day of your period. | மாதவிடாயின் முதல் நாளைப் பதிவு செய்யவும். |
| [ ] | `cyclePage.endHint` | Your period has been ongoing since {{date}}. | {{date}} முதல் உங்கள் மாதவிடாய் தொடர்கிறது. |
| [ ] | `cyclePage.editTitle` | Edit period | மாதவிடாயைத் திருத்தவும் |
| [ ] | `cyclePage.lastedDays` | How many days did it last? | எத்தனை நாட்கள் நீடித்தது? |
| [ ] | `cyclePage.endDate` | End date | முடிவு தேதி |
| [ ] | `cyclePage.saveEnd` | Save end date | முடிவு தேதியைச் சேமிக்கவும் |
| [ ] | `cyclePage.confirmDelete` | Yes, delete | ஆம், நீக்கவும் |
| [ ] | `cyclePage.range` | {{start}} → {{end}} | {{start}} → {{end}} |
| [ ] | `insightsPage.recap` | Your weekly recap | உன் வாராந்திரச் சுருக்கம் |
| [ ] | `insightsPage.trends` | Trends | போக்குகள் |
| [ ] | `insightsPage.labsHint` | Values from your reports, over time. | உன் ரிப்போர்ட்டுகளில் உள்ள மதிப்புகள், காலப்போக்கில். |
| [ ] | `insightsPage.openLabs` | Open lab results | பரிசோதனை முடிவுகளைத் திற |
| [ ] | `insightsPage.cycleLabel` | Cycle {{n}} | சுழற்சி {{n}} |
| [ ] | `insightsPage.patternHint` | Gentle patterns from your own logs, not a diagnosis. | உன் சொந்தப் பதிவுகளிலிருந்து தெரியும் மென்மையான போக்குகள், இது நோயறிதல் இல்லை. |
| [ ] | `mePage.privacyNote` | Everything here is private to you. | இங்கே உள்ள எல்லாமே உனக்கு மட்டும் தான். |
| [ ] | `mePage.saveName` | Save name | பெயரைச் சேமி |
| [ ] | `mePage.nameInvalid` | Use 1 to 30 characters. | 1 முதல் 30 எழுத்துகள் வரை கொடு. |
| [ ] | `mePage.saveTimes` | Save times | நேரங்களைச் சேமி |
| [ ] | `mePage.notifications.title` | Notifications | அறிவிப்புகள் |
| [ ] | `mePage.notifications.checking` | Checking this browser… | இந்த பிரவுசரைச் சரிபார்க்கிறது… |
| [ ] | `mePage.notifications.offBody` | Turn on notifications for gentle check-ins and medicine reminders on this device. | இந்தச் சாதனத்தில் மென்மையான விசாரிப்புகளும் மருந்து நினைவூட்டல்களும் வர அறிவிப்புகளை ஆன் செய். |
| [ ] | `mePage.notifications.turnOn` | Turn on | ஆன் செய் |
| [ ] | `mePage.notifications.onBody` | Notifications are on for this device. | இந்தச் சாதனத்தில் அறிவிப்புகள் ஆன் ஆக உள்ளன. |
| [ ] | `mePage.notifications.test` | Send a test | சோதனை அனுப்பு |
| [ ] | `mePage.notifications.turnOff` | Turn off | ஆஃப் செய் |
| [ ] | `mePage.notifications.deniedBody` | Notifications are blocked for this site. To allow them, open the site settings in your browser (the icon next to the address bar), set Notifications to Allow, then reload this page. | இந்தத் தளத்துக்கு அறிவிப்புகள் தடுக்கப்பட்டுள்ளன. அனுமதிக்க, பிரவுசரில் தள அமைப்புகளைத் திற (முகவரிப் பட்டிக்கு அருகில் உள்ள ஐகான்), அறிவிப்புகளை 'அனுமதி' என மாற்று, பிறகு இந்தப் பக்கத்தை மீண்டும் ஏற்று. |
| [ ] | `mePage.notifications.installBody` | On iPhone, notifications work only from the home-screen app: | ஐபோனில், ஹோம் ஸ்கிரீன் ஆப்பிலிருந்து மட்டுமே அறிவிப்புகள் வேலை செய்யும்: |
| [ ] | `mePage.notifications.installStep1` | In Safari, tap the Share button. | Safari-யில் பகிர் (Share) பட்டனைத் தட்டு. |
| [ ] | `mePage.notifications.installStep2` | Choose “Add to Home Screen”. | “ஹோம் ஸ்கிரீனில் சேர்” என்பதைத் தேர்ந்தெடு. |
| [ ] | `mePage.notifications.installStep3` | Open Companion from the new icon and turn notifications on here. | புதிய ஐகானிலிருந்து Companion-ஐத் திறந்து, இங்கே அறிவிப்புகளை ஆன் செய். |
| [ ] | `mePage.notifications.unsupportedBody` | This browser can't show notifications. Try Chrome, Edge or Firefox, or the home-screen app on iPhone. | இந்த பிரவுசரால் அறிவிப்புகளைக் காட்ட முடியாது. Chrome, Edge அல்லது Firefox-ஐ முயற்சி செய், அல்லது ஐபோனில் ஹோம் ஸ்கிரீன் ஆப்பைப் பயன்படுத்து. |
| [ ] | `mePage.notifications.notConfiguredBody` | Notifications aren't set up for this website yet. | இந்தத் தளத்துக்கு அறிவிப்புகள் இன்னும் அமைக்கப்படவில்லை. |
| [ ] | `mePage.notifications.failed` | Couldn't change notifications. Please try again. | அறிவிப்புகளை மாற்ற முடியவில்லை. மீண்டும் முயற்சி செய். |
| [ ] | `mePage.notifications.results.sent` | Test sent. It should appear in a moment. | சோதனை அனுப்பப்பட்டது. சில நொடிகளில் வரும். |
| [ ] | `mePage.notifications.results.no_subscription` | This device isn't subscribed yet. Turn notifications off and on again. | இந்தச் சாதனம் இன்னும் இணைக்கப்படவில்லை. அறிவிப்புகளை ஆஃப் செய்து மீண்டும் ஆன் செய். |
| [ ] | `mePage.notifications.results.quiet_hours` | It's your quiet hours, so nothing was sent. | இப்போது உன் அமைதி நேரம், அதனால் எதுவும் அனுப்பவில்லை. |
| [ ] | `mePage.notifications.results.cap` | You've reached today's notification limit. | இன்றைய அறிவிப்பு வரம்பை எட்டிவிட்டாய். |
| [ ] | `mePage.notifications.results.error` | The test couldn't be delivered. Please try again. | சோதனையை அனுப்ப முடியவில்லை. மீண்டும் முயற்சி செய். |
| [ ] | `mePage.notifications.results.disabled` | Notifications aren't set up on the server yet. | சர்வரில் அறிவிப்புகள் இன்னும் அமைக்கப்படவில்லை. |
| [ ] | `mePage.facts.length` | Use 3 to 300 characters. | 3 முதல் 300 எழுத்துகள் வரை கொடு. |
| [ ] | `mePage.facts.editLabel` | Edit this note | இந்தக் குறிப்பைத் திருத்து |
| [ ] | `mePage.meds.edit` | Edit medicine | மருந்தைத் திருத்து |
| [ ] | `mePage.meds.nameRequired` | Add a name. | ஒரு பெயர் கொடு. |
| [ ] | `mePage.meds.maxTimes` | Up to 8 reminder times. | அதிகபட்சம் 8 நினைவூட்டல் நேரங்கள். |
| [ ] | `mePage.meds.duplicateTime` | That time is already added. | அந்த நேரம் ஏற்கனவே சேர்க்கப்பட்டுள்ளது. |
| [ ] | `mePage.meds.noTimes` | No reminder times | நினைவூட்டல் நேரங்கள் இல்லை |
| [ ] | `mePage.meds.removeTime` | Remove {{time}} | {{time}} நீக்கு |
| [ ] | `mePage.meds.newTime` | New reminder time | புதிய நினைவூட்டல் நேரம் |
| [ ] | `mePage.meds.stopTitle` | Stop {{name}}? | {{name}} நிறுத்தவா? |
| [ ] | `mePage.meds.stopBody` | Reminders stop and today is saved as the stop date. Your history stays. | நினைவூட்டல்கள் நின்றுவிடும், இன்றைய தேதி நிறுத்திய நாளாகச் சேமிக்கப்படும். உன் பழைய பதிவுகள் அப்படியே இருக்கும். |
| [ ] | `mePage.meds.stopped` | Stopped medicines ({{count}}) | நிறுத்திய மருந்துகள் ({{count}}) |
| [ ] | `mePage.meds.stoppedOn` | Stopped on {{date}} | {{date}} அன்று நிறுத்தப்பட்டது |
| [ ] | `mePage.labs.valueInvalid` | Enter a number. | ஒரு எண்ணைக் கொடு. |
| [ ] | `mePage.labs.dateInvalid` | Pick a date that isn't in the future. | இன்றைக்குப் பிறகான தேதி வேண்டாம். |
| [ ] | `mePage.labs.customRequired` | Add the test name. | பரிசோதனையின் பெயரைக் கொடு. |
| [ ] | `mePage.labs.deleteConfirm` | Delete this result? | இந்த முடிவை நீக்கவா? |
| [ ] | `mePage.labs.trend` | {{name}} over time | காலப்போக்கில் {{name}} |
| [ ] | `mePage.labs.insightsLink` | See insights | நுண்ணறிவுகளைப் பார் |
| [ ] | `onboardingPage.selectedDate` | Selected: {{date}} | தேர்ந்தெடுத்தது: {{date}} |
| [ ] | `onboardingPage.noDate` | No date picked. That's okay, you can skip this. | தேதி எதுவும் தேர்வு செய்யல. பரவாயில்ல, இதை விட்டுடலாம். |
| [ ] | `onboardingPage.notSureSkip` | Not sure, skip | தெரியல, விட்டுடு |
| [ ] | `onboardingPage.setLength` | Pick a number of days | நாட்களின் எண்ணிக்கையை தேர்வு செய் |
| [ ] | `onboardingPage.medNumber` | Medicine {{n}} | மருந்து {{n}} |
| [ ] | `onboardingPage.timeNumber` | Time {{n}} | நேரம் {{n}} |
| [ ] | `onboardingPage.pushOn` | Notifications are on. You'll only get gentle reminders. | அறிவிப்புகள் ஆன் ஆயிடுச்சு. மென்மையான நினைவூட்டல்கள் மட்டும் வரும். |
| [ ] | `onboardingPage.pushDenied` | Notifications are blocked in this browser. You can allow them in the browser's site settings, then turn them on in Settings. | இந்த பிரவுசரில் அறிவிப்புகள் தடுக்கப்பட்டிருக்கு. பிரவுசரின் தள அமைப்புகளில் அனுமதி கொடுத்து, பிறகு அமைப்புகளில் ஆன் பண்ணலாம். |
| [ ] | `onboardingPage.pushOff` | No problem. You can turn notifications on later in Settings. | பரவாயில்ல. அறிவிப்புகளை பிறகு அமைப்புகளில் ஆன் பண்ணலாம். |
| [ ] | `onboardingPage.pushUnsupported` | This browser can't show notifications. Your check-ins will still be waiting for you in chat. | இந்த பிரவுசரில் அறிவிப்புகள் வராது. ஆனா உன் செக்-இன்கள் அரட்டையில் உனக்காக காத்திருக்கும். |
| [ ] | `onboardingPage.pushNotConfigured` | Notifications aren't ready yet. You can turn them on later in Settings. | அறிவிப்புகள் இன்னும் தயாராகல. பிறகு அமைப்புகளில் ஆன் பண்ணலாம். |
| [ ] | `onboardingPage.pushNeedsInstall` | On iPhone, notifications work after you add Companion to your Home Screen: | iPhone-ல், Companion-ஐ முகப்புத் திரையில் சேர்த்த பிறகுதான் அறிவிப்புகள் வேலை செய்யும்: |
| [ ] | `onboardingPage.installTitle` | Keep Companion on your home screen | Companion-ஐ முகப்புத் திரையில் வச்சுக்கோ |
| [ ] | `onboardingPage.installBody` | Add it like an app. It opens full screen and is one tap away whenever you want to talk. | ஒரு ஆப் மாதிரி சேர்த்துக்கோ. முழுத் திரையில் திறக்கும், பேசணும்னு தோணும்போது ஒரே தட்டில் வரும். |
| [ ] | `onboardingPage.androidTitle` | On Android (Chrome) | Android போனில் (Chrome) |
| [ ] | `onboardingPage.androidStep1` | Tap the ⋮ menu at the top right. | மேலே வலது பக்கம் உள்ள ⋮ மெனுவை தட்டு. |
| [ ] | `onboardingPage.androidStep2` | Tap "Install app" or "Add to Home screen". | "ஆப்பை நிறுவு" அல்லது "முகப்புத் திரையில் சேர்" என்பதை தட்டு. |
| [ ] | `onboardingPage.iosTitle` | On iPhone (Safari) | iPhone-ல் (Safari) |
| [ ] | `onboardingPage.iosStep1` | Open this site in Safari and tap the Share button (the square with an arrow). | இந்த தளத்தை Safari-ல் திறந்து, பகிர் பட்டனை (அம்புக்குறி உள்ள சதுரம்) தட்டு. |
| [ ] | `onboardingPage.iosStep2` | Choose "Add to Home Screen". | "முகப்புத் திரையில் சேர்" என்பதை தேர்வு செய். |
| [ ] | `onboardingPage.iosStep3` | Open Companion from the new icon on your Home Screen. | முகப்புத் திரையில் வந்த புது ஐகானில் இருந்து Companion-ஐ திற. |
| [ ] | `todayPage.waterUndo` | −250 ml | −250 மி.லி |
| [ ] | `todayPage.waterUndoLabel` | Remove 250 ml | 250 மி.லி நீக்கவும் |
| [ ] | `todayPage.tellChat` | Tell me in chat | அரட்டையில் சொல்லுங்கள் |
| [ ] | `todayPage.addMeds` | Add medicines | மருந்துகளைச் சேர்க்கவும் |
| [ ] | `todayPage.doseLabel` | {{name}} · {{time}} | {{name}} · {{time}} |
| [ ] | `todayPage.weightLabel` | Weight (kg) | எடை (கி.கி) |
| [ ] | `todayPage.weightHint` | Only for your own trend. Skip it any week. | உங்கள் போக்கைப் பார்க்க மட்டும். எந்த வாரமும் தவிர்க்கலாம். |
| [ ] | `todayPage.weightInvalid` | Please enter a weight between 20 and 300 kg. | 20 முதல் 300 கி.கி வரையிலான எடையை உள்ளிடவும். |
| [ ] | `todayPage.weightSaved` | Weight saved ✓ | எடை சேமிக்கப்பட்டது ✓ |
| [ ] | `todayPage.seeInsights` | See your insights | உங்கள் பார்வைகளைக் காணுங்கள் |
| [ ] | `todayPage.openCycle` | Open cycle | சுழற்சியைத் திறக்கவும் |
| [ ] | `todayPage.addSleep` | Add sleep | தூக்கத்தைச் சேர்க்கவும் |
| [ ] | `todayPage.skipSleep` | Skip sleep | தூக்கத்தைத் தவிர்க்கவும் |
| [ ] | `todayPage.pickOne` | Pick at least one thing to log. | பதிவு செய்ய குறைந்தது ஒன்றைத் தேர்ந்தெடுக்கவும். |
| [ ] | `todayPage.kcalTotal` | About {{count}} kcal so far | இதுவரை சுமார் {{count}} கலோரி |
| [ ] | `todayPage.moodNow` | Feeling {{value}} of 5 | மனநிலை 5-இல் {{value}} |

## Server messages (fallbacks, pushes, delay check-in)

| ✓ | key | English | Tamil | Tanglish |
|---|---|---|---|---|
| [ ] | `queued` | I've saved your message 💛 I'm having trouble thinking right now, so I'll reply properly in a little while. Anything you logged is safe. | உன் மெசேஜ் சேவ் ஆயிடுச்சு 💛 இப்போ கொஞ்சம் யோசிக்க முடியல, கொஞ்ச நேரத்துல சரியா பதில் சொல்றேன். நீ பதிவு செஞ்சது எல்லாம் பத்திரமா இருக்கு. | Un message save aayiduchu 💛 Ippo konjam yosikka mudiyala, konja nerathula sariya reply panren. Nee log pannadhu ellam safe ah iruku. |
| [ ] | `budget` | I've saved your message 💛 I've hit my chatting limit for today, so I'll reply as soon as it resets. You can still log things from the Today tab. | உன் மெசேஜ் சேவ் ஆயிடுச்சு 💛 இன்னைக்கு என் பேசுற லிமிட் முடிஞ்சிடுச்சு, ரீசெட் ஆனதும் பதில் சொல்றேன். Today டேப்ல இருந்து இன்னும் பதிவு பண்ணலாம். | Un message save aayiduchu 💛 Innaiku en chat limit mudinjiduchu, reset aanadhum reply panren. Today tab la irundhu innum log pannalam. |
| [ ] | `rateLimited` | That's a lot of messages in a few minutes! Give me a short breather and I'll be right here 💛 | கொஞ்ச நேரத்துல நிறைய மெசேஜ் வந்திருக்கு! ஒரு சின்ன ப்ரேக் குடு, நான் இங்கேயே இருக்கேன் 💛 | Konja nerathula neraya messages! Oru chinna break kudu, naan inga dhaan iruken 💛 |
| [ ] | `replyReadyTitle` | Companion replied | Companion பதில் சொல்லியிருக்கு | Companion reply panniruku |
| [ ] | `replyReadyBody` | I finally got back to your message 💛 | உன் மெசேஜுக்கு பதில் சொல்லிட்டேன் 💛 | Un message ku reply panniten 💛 |
| [ ] | `delayTitle` | Just checking in 💛 | சும்மா விசாரிக்கிறேன் 💛 | Summa visarikiren 💛 |
| [ ] | `delayBody` | Your period seems a little later than the usual range. Want to talk about it? | உன் பீரியட் வழக்கமான range-ஐ விட கொஞ்சம் லேட் ஆகுது போல. பேசலாமா? | Un period usual range ah vida konjam late aagudhu pola. Pesalaama? |
| [ ] | `redFlagTitle` | A gentle note | ஒரு சின்ன குறிப்பு | Oru chinna note |
| [ ] | `redFlagBody` | Something you logged is worth showing your doctor. I've put a note in the Cycle tab. | நீ பதிவு செஞ்ச ஒன்னு டாக்டர்கிட்ட காட்டுறது நல்லது. Cycle டேப்ல ஒரு குறிப்பு வச்சிருக்கேன். | Nee log panna onnu doctor kitta kaatradhu nalladhu. Cycle tab la oru note vechiruken. |
| [ ] | `weeklyTitle` | Your week with Companion | இந்த வாரம் உன்னோட | Indha vaaram unnoda |
| [ ] | `softNudge` | Haven't heard from you in a few days. No pressure at all, I'm here whenever you want to chat 💛 | சில நாளா உன்கிட்ட இருந்து எதுவும் இல்ல. எந்த அவசரமும் இல்ல, பேசணும்னு தோணும்போது நான் இருக்கேன் 💛 | Sila naala un kitta irundhu edhuvum illa. Endha avasaramum illa, pesanum nu thonum podhu naan iruken 💛 |
| [ ] | `factor.high_stress` | quite a few stressful days | நிறைய ஸ்ட்ரெஸ்ஸான நாட்கள் | neraya stress aana naatkal |
| [ ] | `factor.poor_sleep` | less sleep than usual | வழக்கத்தை விட குறைவான தூக்கம் | vazhakkatha vida kammiyana thookkam |
| [ ] | `factor.weight_change` | a change in weight | எடையில் ஒரு மாற்றம் | weight la oru maatram |
| [ ] | `factor.exercise_change` | a big jump in exercise | உடற்பயிற்சியில் திடீர் அதிகரிப்பு | exercise la thideer nu increase |
| [ ] | `factor.illness_or_travel` | being unwell or travelling | உடம்பு சரியில்லாதது அல்லது பயணம் | udambu sari illadhadhu illa travel |
| [ ] | `factor.medication_change` | a medication starting or stopping | மருந்து தொடங்கியது அல்லது நிறுத்தியது | medicine start/stop pannadhu |
| [ ] | `factor.low_intake_days` | some days with lighter meals than your usual | சில நாள் வழக்கத்தை விட குறைவா சாப்பிட்டது | sila naal vazhakkatha vida kammiya saaptadhu |
| [ ] | `factor.usual_pattern` | your cycles have been this long before too | முன்னாடியும் உன் சைக்கிள் இவ்வளவு நீளமா இருந்திருக்கு | munnadiyum un cycle ivlo neelama irundhiruku |

Also review the delay check-in template in `delayCheckIn()` in `backend/src/core/messages.ts`.
