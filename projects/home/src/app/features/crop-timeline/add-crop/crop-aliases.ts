import { slugifyReferenceName } from '../../../core/i18n/reference-name';

/**
 * Other names farmers use for the predefined crops: how they are said in Marathi and Hindi
 * written in English letters ("kanda"), English synonyms ("peanut"), and the Marathi and
 * Hindi names themselves, so a farmer can find a crop whichever way they type it and in
 * whichever language the app is showing. Keyed by the slug of the crop's English name.
 */
const ALIASES: Record<string, readonly string[]> = {
  wheat: ['gahu', 'gehu', 'gehun', 'गहू', 'गेहूं'],
  rice: ['bhat', 'dhan', 'chawal', 'paddy', 'तांदूळ', 'भात', 'चावल', 'धान'],
  maize: ['makka', 'makai', 'corn', 'मका', 'मक्का'],
  jowar: ['jwari', 'jowari', 'sorghum', 'ज्वारी', 'ज्वार'],
  bajra: ['bajri', 'pearl millet', 'बाजरी', 'बाजरा'],
  tur: ['toor', 'tuvar', 'arhar', 'pigeon pea', 'तूर', 'अरहर'],
  gram: ['chana', 'harbhara', 'harbara', 'chickpea', 'हरभरा', 'चना'],
  moong: ['mung', 'green gram', 'मूग', 'मूंग'],
  urad: ['udid', 'black gram', 'उडीद', 'उड़द'],
  soybean: ['soyabean', 'soya', 'सोयाबीन'],
  groundnut: ['bhuimug', 'shengdana', 'moongfali', 'peanut', 'भुईमूग', 'शेंगदाणा', 'मूंगफली'],
  sunflower: ['suryaphool', 'surajmukhi', 'सूर्यफूल', 'सूरजमुखी'],
  mustard: ['sarson', 'mohari', 'मोहरी', 'सरसों'],
  sesame: ['til', 'teel', 'तीळ', 'तिल'],
  cotton: ['kapus', 'kapas', 'कापूस', 'कपास'],
  sugarcane: ['us', 'ganna', 'cane', 'ऊस', 'गन्ना'],
  turmeric: ['halad', 'haldi', 'हळद', 'हल्दी'],
  onion: ['kanda', 'pyaz', 'pyaaz', 'कांदा', 'प्याज'],
  tomato: ['tamatar', 'टोमॅटो', 'टमाटर'],
  potato: ['batata', 'aloo', 'alu', 'बटाटा', 'आलू'],
  brinjal: ['vangi', 'baingan', 'eggplant', 'वांगी', 'बैंगन'],
  cabbage: ['kobi', 'patta gobi', 'कोबी', 'पत्ता गोभी'],
  cauliflower: ['phulkobi', 'phool gobhi', 'फुलकोबी', 'फूलगोभी'],
  okra: ['bhendi', 'bhindi', 'lady finger', 'ladies finger', 'भेंडी', 'भिंडी'],
  green_chilli: ['mirchi', 'hirvi mirchi', 'hari mirch', 'chilli', 'मिरची', 'हरी मिर्च'],
  garlic: ['lasun', 'lahsun', 'लसूण', 'लहसुन'],
  ginger: ['ale', 'adrak', 'आले', 'अदरक'],
  capsicum: ['dhobli mirchi', 'shimla mirch', 'bell pepper', 'ढोबळी मिरची', 'शिमला मिर्च'],
  grapes: ['draksha', 'angur', 'द्राक्षे', 'अंगूर'],
  pomegranate: ['dalimb', 'anar', 'डाळिंब', 'अनार'],
  banana: ['keli', 'kela', 'केळी', 'केला'],
  mango: ['amba', 'aam', 'आंबा', 'आम'],
  orange: ['santra', 'narangi', 'संत्री', 'संतरा'],
  sweet_lime: ['mosambi', 'mausambi', 'मोसंबी', 'मौसंबी'],
  papaya: ['papai', 'papita', 'पपई', 'पपीता'],
  guava: ['peru', 'amrud', 'पेरू', 'अमरूद'],
  watermelon: ['kalingad', 'tarbooj', 'कलिंगड', 'तरबूज'],
  vegetables: ['bhajipala', 'sabzi', 'भाजीपाला', 'सब्जी'],
  fruits: ['phale', 'phal', 'फळे', 'फल'],
};

/** Other names for a predefined crop, or none. Matches on the slug of its English name. */
export function cropAliases(name: string): readonly string[] {
  return ALIASES[slugifyReferenceName(name)] ?? [];
}

/** The slugs this table knows, for tests. */
export const ALIASED_CROP_SLUGS: readonly string[] = Object.keys(ALIASES);
