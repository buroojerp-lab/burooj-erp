// Language switcher — English / Urdu toggle
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const isUrdu   = i18n.language === 'ur';

  const toggle = () => {
    const next = isUrdu ? 'en' : 'ur';
    i18n.changeLanguage(next);
    localStorage.setItem('burooj_lang', next);
    document.documentElement.dir = next === 'ur' ? 'rtl' : 'ltr';
    document.documentElement.lang = next;
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-[#0098B4] transition text-sm font-medium"
      title="Switch Language"
    >
      <Globe size={15} />
      <span>{isUrdu ? 'EN' : 'اردو'}</span>
    </button>
  );
}
