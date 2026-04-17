// src/theme/theme.js — Burooj ERP design tokens
export const theme = {
  colors: {
    brand: {
      50:  '#e6f7fa',
      100: '#b3e8f4',
      200: '#80d8ee',
      300: '#4dc9e8',
      400: '#26b8d6',
      500: '#0098B4',
      600: '#007a91',
      700: '#005c6e',
      800: '#003d4a',
      900: '#001f27',
    },
    sidebar: {
      bg:        '#0d1117',
      bgHover:   '#161b22',
      border:    '#21262d',
      text:      '#8b949e',
      textActive:'#f0f6fc',
      active:    '#0098B4',
      activeBg:  'rgba(0,152,180,0.15)',
    },
    surface: {
      bg:     '#ffffff',
      bgAlt:  '#f8fafc',
      border: '#e2e8f0',
    },
    status: {
      success: '#10b981',
      warning: '#f59e0b',
      danger:  '#ef4444',
      info:    '#3b82f6',
    },
  },

  gradients: {
    teal:    'linear-gradient(135deg, #0098B4 0%, #005c6e 100%)',
    emerald: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    amber:   'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    rose:    'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
    indigo:  'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
    violet:  'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
  },

  shadows: {
    card:  '0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.04)',
    modal: '0 20px 60px rgba(0,0,0,.15)',
    sm:    '0 1px 2px rgba(0,0,0,.05)',
  },

  radius: {
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '18px',
  },

  sidebar: {
    width:          '240px',
    widthCollapsed: '60px',
  },

  topbar: {
    height: '56px',
  },
};

export const STAT_GRADIENTS = [
  theme.gradients.teal,
  theme.gradients.emerald,
  theme.gradients.amber,
  theme.gradients.rose,
  theme.gradients.indigo,
  theme.gradients.violet,
];
