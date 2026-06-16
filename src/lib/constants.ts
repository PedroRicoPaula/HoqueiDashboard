// ─── Age Groups ───────────────────────────────────────────────────────────────

export const AGE_GROUPS = [
  { value: 'SUB11',   label: 'Sub-11' },
  { value: 'SUB13',   label: 'Sub-13' },
  { value: 'SUB15',   label: 'Sub-15' },
  { value: 'SUB17',   label: 'Sub-17' },
  { value: 'SUB19',   label: 'Sub-19' },
  { value: 'SENIORS', label: 'Seniores' },
]

export const AGE_GROUP_LABELS: Record<string, string> = Object.fromEntries(
  AGE_GROUPS.map((g) => [g.value, g.label])
)

// ─── Material States ──────────────────────────────────────────────────────────

export const MATERIAL_STATE_LABELS: Record<string, string> = {
  FREE: 'Livre',
  ASSIGNED: 'Atribuído',
  DAMAGED: 'Danificado',
}

export const MATERIAL_STATE_COLORS: Record<string, string> = {
  FREE: 'bg-green-100 text-green-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  DAMAGED: 'bg-red-100 text-red-800',
}

// ─── Season ───────────────────────────────────────────────────────────────────

/** Sep–Jun (10 months). Months ≥ 9 belong to seasonStart year; months < 9 to seasonStart+1. */
export const SEASON_MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6]

/** Index-aligned month abbreviations (index 0 unused). */
export const MONTH_LABELS = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// ─── Direction Roles ──────────────────────────────────────────────────────────

export const DIRECTION_ROLES = [
  'TRAINER', 'ASSISTANT_TRAINER', 'DIRECTOR', 'SECCIONISTA', 'SOCORRISTA', 'FIELD_DIRECTOR',
] as const

export type DirectionRole = typeof DIRECTION_ROLES[number]

export const DIRECTION_ROLE_LABELS: Record<string, string> = {
  TRAINER:           'Treinador',
  ASSISTANT_TRAINER: 'Treinador Adjunto',
  DIRECTOR:          'Diretor',
  SECCIONISTA:       'Seccionista',
  SOCORRISTA:        'Socorrista',
  FIELD_DIRECTOR:    'Diretor de Campo',
}

export const DIRECTION_ROLE_COLORS: Record<string, string> = {
  TRAINER:           'bg-blue-100 text-blue-800',
  ASSISTANT_TRAINER: 'bg-sky-100 text-sky-800',
  DIRECTOR:          'bg-purple-100 text-purple-800',
  SECCIONISTA:       'bg-emerald-100 text-emerald-800',
  SOCORRISTA:        'bg-red-100 text-red-800',
  FIELD_DIRECTOR:    'bg-orange-100 text-orange-800',
}

// ─── Age Group Calendar Colors ────────────────────────────────────────────────

export const AGE_GROUP_CALENDAR_COLORS: Record<string, { bg: string; text: string; hover: string }> = {
  SUB11:   { bg: 'bg-yellow-100',  text: 'text-yellow-900',  hover: 'hover:bg-yellow-200'  },
  SUB13:   { bg: 'bg-green-100',   text: 'text-green-900',   hover: 'hover:bg-green-200'   },
  SUB15:   { bg: 'bg-blue-100',    text: 'text-blue-900',    hover: 'hover:bg-blue-200'    },
  SUB17:   { bg: 'bg-purple-100',  text: 'text-purple-900',  hover: 'hover:bg-purple-200'  },
  SUB19:   { bg: 'bg-gray-100',    text: 'text-gray-700',    hover: 'hover:bg-gray-200'    },
  SENIORS: { bg: 'bg-gray-800',    text: 'text-white',       hover: 'hover:bg-gray-900'    },
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export const SESSION_TYPE_LABELS: Record<string, string> = {
  GENERAL:      'Geral',
  GOALKEEPERS:  'Guarda-Redes',
  FIELD_PLAYERS: 'Jogadores de Campo',
  SPECIFIC:     'Específico',
}

export const SESSION_TYPE_COLORS: Record<string, string> = {
  GENERAL:      'bg-blue-100 text-blue-800',
  GOALKEEPERS:  'bg-yellow-100 text-yellow-800',
  FIELD_PLAYERS: 'bg-green-100 text-green-800',
  SPECIFIC:     'bg-purple-100 text-purple-800',
}

// ─── Textile Materials ────────────────────────────────────────────────────────

export const TEXTILE_CATEGORY_LABELS: Record<string, string> = {
  GAME:     'Jogo',
  TRAINING: 'Treino',
  OTHER:    'Outro',
}

export const TEXTILE_TYPE_LABELS: Record<string, string> = {
  GAME_SHIRT:    'Camisola de Jogo',
  GAME_SHORTS:   'Calções de Jogo',
  GAME_SOCKS:    'Meias de Jogo',
  GK_SHIRT:      'Camisola Guarda-Redes',
  TRAINING_TOP:  'Camisola de Treino',
  TRAINING_PANTS: 'Calças de Treino',
  TRAINING_KIT:  'Fato de Treino Completo',
  JACKET:        'Casaco',
  TSHIRT:        'T-Shirt',
  OTHER:         'Outro',
}

export const TEXTILE_TYPES_BY_CATEGORY: Record<string, string[]> = {
  GAME:     ['GAME_SHIRT', 'GAME_SHORTS', 'GAME_SOCKS', 'GK_SHIRT'],
  TRAINING: ['TRAINING_TOP', 'TRAINING_PANTS', 'TRAINING_KIT', 'JACKET', 'TSHIRT'],
  OTHER:    ['OTHER'],
}

export const TEXTILE_SIZES_ADULT = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']
export const TEXTILE_SIZES_CHILD = ['4', '6', '8', '10', '12', '14', '16']
export const TEXTILE_SIZES_ALL = [...TEXTILE_SIZES_CHILD, ...TEXTILE_SIZES_ADULT]

export const TEXTILE_STATE_LABELS: Record<string, string> = {
  STOCK:    'Em Stock',
  ASSIGNED: 'Atribuído',
  DAMAGED:  'Danificado',
  LOST:     'Perdido',
}

export const TEXTILE_STATE_COLORS: Record<string, string> = {
  STOCK:    'bg-green-100 text-green-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  DAMAGED:  'bg-red-100 text-red-800',
  LOST:     'bg-gray-100 text-gray-800',
}

// ─── Material Types ───────────────────────────────────────────────────────────

export const MATERIAL_TYPES: Record<string, string[]> = {
  ATHLETE: [
    'Patins Completos', 'Botas', 'Chassis', 'Rodas', 'Travões', 'Rolamentos',
    'Stick', 'Bola', 'Luvas', 'Joelheiras', 'Caneleiras', 'Coquilha', 'Capacete com Viseira',
  ],
  GOALKEEPER: [
    'Patins de Guarda-Redes', 'Stick de Guarda-Redes', 'Caneleiras de Guarda-Redes',
    'Peitilho', 'Luva de Raquete', 'Luva do Stick', 'Máscara com Grelha/Viseira',
    'Calções Almofadados', 'Proteção de Pescoço',
  ],
  SMALL: [
    'Cones', 'Coletes', 'Bola de Treino', 'Saco de Equipamento', 'Garrafa',
    'Rolamentos', 'Fita para Sticks', 'Atacadores', 'Conjunto de Parafusos', 'Borracha de Suspensão',
  ],
}
