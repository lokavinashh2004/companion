// A picture for a dish, from its name (English, Tanglish or Tamil script). Meal photos are never stored,
// so the Meals card shows this instead.
import type { Meal } from '@/lib/api';

const DISHES: [RegExp, string][] = [
  [/idl[iy]|இட்லி/i, '🍥'],
  [/dosa|dosai|thosai|uttapam|appam|தோசை|ஆப்பம்|ஊத்தப்பம்/i, '🫓'],
  [/chapat|roti|phulka|paratha|parotta|naan|சப்பாத்தி|பரோட்டா/i, '🫓'],
  [/pongal|upma|kichadi|khichdi|poha|பொங்கல்|உப்புமா/i, '🥣'],
  [/sambar|rasam|kuzhambu|kulambu|curry|dal|dhal|paruppu|kootu|சாம்பார்|ரசம்|குழம்பு|பருப்பு|கூட்டு/i, '🍲'],
  [/biryani|pulao|fried rice|பிரியாணி/i, '🍛'],
  [/rice|sadam|saadham|meals|சாதம்|சோறு/i, '🍚'],
  [/vada|vadai|bonda|bajji|samosa|வடை|போண்டா|பஜ்ஜி/i, '🍩'],
  [/egg|omelet|முட்டை/i, '🥚'],
  [/chicken|mutton|fish|meen|prawn|கோழி|மீன்|இறால்/i, '🍗'],
  [/sundal|chana|channa|rajma|சுண்டல்/i, '🫘'],
  [/poriyal|avial|aviyal|salad|vegetable|veg|keerai|spinach|பொரியல்|அவியல்|கீரை/i, '🥗'],
  [/curd|yogurt|buttermilk|moru|thayir|raita|தயிர்|மோர்/i, '🥛'],
  [/milk|பால்/i, '🥛'],
  [/coffee|காபி/i, '☕'],
  [/tea|chai|டீ|தேநீர்/i, '🍵'],
  [/banana|வாழை/i, '🍌'],
  [/apple|ஆப்பிள்/i, '🍎'],
  [/mango|மாம்பழம்/i, '🥭'],
  [/fruit|guava|papaya|orange|pomegranate|பழம்|கொய்யா|பப்பாளி/i, '🍉'],
  [/nuts|almond|badam|cashew|peanut|கடலை|பாதாம்/i, '🥜'],
  [/biscuit|cookie|cake|sweet|payasam|laddu|halwa|பிஸ்கட்|இனிப்பு|பாயசம்|லட்டு/i, '🍪'],
  [/juice|smoothie|ஜூஸ்/i, '🧃'],
  [/bread|toast|sandwich|பிரெட்/i, '🍞'],
  [/oats|ragi|millet|kambu|cholam|ஓட்ஸ்|ராகி|கம்பு|சோளம்/i, '🌾'],
];

const MEAL_ART: Record<Meal, string> = { breakfast: '🍳', lunch: '🍛', snack: '🍪', dinner: '🍲', other: '🍽️' };

export function dishArt(name: string): string | null {
  return DISHES.find(([re]) => re.test(name))?.[1] ?? null;
}

/** The meal's picture: its first recognisable dish, else a generic one for the meal. */
export function mealArt(meal: Meal, names: string[]): string {
  for (const n of names) {
    const art = dishArt(n);
    if (art) return art;
  }
  return MEAL_ART[meal];
}
