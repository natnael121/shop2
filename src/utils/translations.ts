// Translation utilities for the catalog system
export const translations = {
  en: {
    home: 'Home',
    about: 'About',
    waiter: 'Waiter',
    cart: 'Cart',
    bill: 'Bill',
    settings: 'Settings',
    table: 'Table',
    aboutUs: 'About Us',
    contactInfo: 'Contact Information',
    operatingHours: 'Operating Hours',
    features: 'Features',
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
    defaultDescription: 'Welcome to our restaurant! We serve delicious food with excellent service.',
    specialMessage: 'Thank you for choosing us! We appreciate your business.',
    alerts: 'Alerts'
  },
  am: {
    home: 'ቤት',
    about: 'ስለ',
    waiter: 'አገልጋይ',
    cart: 'ጋሪ',
    bill: 'ሂሳብ',
    settings: 'ቅንብሮች',
    table: 'ጠረጴዛ',
    aboutUs: 'ስለ እኛ',
    contactInfo: 'የመገናኛ መረጃ',
    operatingHours: 'የስራ ሰዓት',
    features: 'ባህሪያት',
    monday: 'ሰኞ',
    tuesday: 'ማክሰኞ',
    wednesday: 'ረቡዕ',
    thursday: 'ሐሙስ',
    friday: 'አርብ',
    saturday: 'ቅዳሜ',
    sunday: 'እሁድ',
    defaultDescription: 'ወደ ሬስቶራንታችን እንኳን በደህና መጡ! ጣፋጭ ምግብ በጥሩ አገልግሎት እናቀርባለን።',
    specialMessage: 'እኛን ስለመረጡ እናመሰግናለን! ንግድዎን እናደንቃለን።',
    alerts: 'ማሳወቂያ'
  }
};

export const useTranslation = (language: 'en' | 'am') => {
  return (key: keyof typeof translations.en) => translations[language][key];
};