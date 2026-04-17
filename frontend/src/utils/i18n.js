// ============================================================
// BUROOJ HEIGHTS ERP — i18n (English + Urdu)
// ============================================================
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Navigation
      dashboard:       'Dashboard',
      properties:      'Properties',
      customers:       'Customers',
      bookings:        'Bookings',
      payments:        'Payments',
      installments:    'Installments',
      reports:         'Reports',
      hr:              'HR',
      payroll:         'Payroll',
      expenses:        'Expenses',
      agents:          'Agents',
      investors:       'Investors',
      settings:        'Settings',
      logout:          'Logout',

      // Common
      search:          'Search',
      add:             'Add',
      edit:            'Edit',
      delete:          'Delete',
      save:            'Save Changes',
      cancel:          'Cancel',
      loading:         'Loading...',
      noData:          'No data found',
      confirm:         'Confirm',
      close:           'Close',
      download:        'Download',
      print:           'Print',
      export:          'Export',
      filter:          'Filter',
      status:          'Status',
      date:            'Date',
      amount:          'Amount',
      total:           'Total',
      actions:         'Actions',

      // Properties
      unit:            'Unit',
      tower:           'Tower',
      floor:           'Floor',
      unitType:        'Unit Type',
      size:            'Size (sqft)',
      price:           'Price',
      available:       'Available',
      sold:            'Sold',
      reserved:        'Reserved',
      maintenance:     'Maintenance',

      // Customers
      name:            'Name',
      phone:           'Phone',
      email:           'Email',
      cnic:            'CNIC',
      address:         'Address',

      // Bookings
      bookingNo:       'Booking No',
      bookingDate:     'Booking Date',
      paymentPlan:     'Payment Plan',
      downPayment:     'Down Payment',
      monthlyInst:     'Monthly Installment',

      // Payments
      receipt:         'Receipt',
      paymentMethod:   'Payment Method',
      referenceNo:     'Reference No',
      bank:            'Bank',
      outstanding:     'Outstanding',

      // AI Chat
      aiAssistant:     'AI Assistant',
      typeMessage:     'Type your message...',
      aiWelcome:       'Hello! I\'m your Burooj Heights AI Assistant. Ask me anything about the project, inventory, or bookings.',
      thinking:        'Thinking...',

      // Voice
      voiceSearch:     'Voice Search',
      listening:       'Listening...',
      voiceHint:       'Say: "search client Ahmed" or "show unit A-101"',
      voiceNotSupported: 'Voice search not supported in this browser',

      // Settings
      language:        'Language',
      english:         'English',
      urdu:            'اردو',
      emailSettings:   'Email Settings',
      whatsappSettings:'WhatsApp Settings',
      aiSettings:      'AI Settings',
      smtpHost:        'SMTP Host',
      smtpPort:        'SMTP Port',
      googleMapsKey:   'Google Maps API Key',
      projectLocation: 'Project Location',
    },
  },

  ur: {
    translation: {
      // Navigation
      dashboard:       'ڈیش بورڈ',
      properties:      'پراپرٹیز',
      customers:       'گاہک',
      bookings:        'بکنگز',
      payments:        'ادائیگیاں',
      installments:    'قسطیں',
      reports:         'رپورٹس',
      hr:              'ایچ آر',
      payroll:         'تنخواہ',
      expenses:        'اخراجات',
      agents:          'ایجنٹس',
      investors:       'سرمایہ کار',
      settings:        'ترتیبات',
      logout:          'لاگ آؤٹ',

      // Common
      search:          'تلاش',
      add:             'شامل کریں',
      edit:            'ترمیم',
      delete:          'حذف کریں',
      save:            'تبدیلیاں محفوظ کریں',
      cancel:          'منسوخ',
      loading:         'لوڈ ہو رہا ہے...',
      noData:          'کوئی ڈیٹا نہیں ملا',
      confirm:         'تصدیق',
      close:           'بند کریں',
      download:        'ڈاؤن لوڈ',
      print:           'پرنٹ',
      export:          'برآمد',
      filter:          'فلٹر',
      status:          'صورتحال',
      date:            'تاریخ',
      amount:          'رقم',
      total:           'کل',
      actions:         'اعمال',

      // Properties
      unit:            'یونٹ',
      tower:           'ٹاور',
      floor:           'منزل',
      unitType:        'یونٹ کی قسم',
      size:            'سائز (مربع فٹ)',
      price:           'قیمت',
      available:       'دستیاب',
      sold:            'فروخت',
      reserved:        'محفوظ',
      maintenance:     'مرمت',

      // Customers
      name:            'نام',
      phone:           'فون',
      email:           'ای میل',
      cnic:            'شناختی کارڈ',
      address:         'پتہ',

      // Bookings
      bookingNo:       'بکنگ نمبر',
      bookingDate:     'بکنگ کی تاریخ',
      paymentPlan:     'ادائیگی کا منصوبہ',
      downPayment:     'پیشگی ادائیگی',
      monthlyInst:     'ماہانہ قسط',

      // Payments
      receipt:         'رسید',
      paymentMethod:   'ادائیگی کا طریقہ',
      referenceNo:     'حوالہ نمبر',
      bank:            'بینک',
      outstanding:     'واجب الادا',

      // AI Chat
      aiAssistant:     'اے آئی اسسٹنٹ',
      typeMessage:     'اپنا پیغام لکھیں...',
      aiWelcome:       'السلام علیکم! میں بروج ہائٹس کا اے آئی اسسٹنٹ ہوں۔ پراجیکٹ، انوینٹری یا بکنگ کے بارے میں کچھ بھی پوچھیں۔',
      thinking:        'سوچ رہا ہوں...',

      // Voice
      voiceSearch:     'آواز سے تلاش',
      listening:       'سن رہا ہوں...',
      voiceHint:       'کہیں: "گاہک احمد تلاش کریں" یا "یونٹ A-101 دکھائیں"',
      voiceNotSupported: 'اس براؤزر میں آواز سے تلاش ممکن نہیں',

      // Settings
      language:        'زبان',
      english:         'English',
      urdu:            'اردو',
      emailSettings:   'ای میل ترتیبات',
      whatsappSettings:'واٹس ایپ ترتیبات',
      aiSettings:      'اے آئی ترتیبات',
      smtpHost:        'SMTP ہوسٹ',
      smtpPort:        'SMTP پورٹ',
      googleMapsKey:   'گوگل میپس کی',
      projectLocation: 'پراجیکٹ مقام',
    },
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng:       localStorage.getItem('burooj_lang') || 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
