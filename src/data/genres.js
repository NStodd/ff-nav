import { CLASSES } from './classes.js'
import { SCIFI_CLASSES } from './scifiClasses.js'
import { WESTERN_CLASSES } from './westernClasses.js'
import { PIRATE_CLASSES } from './pirateClasses.js'

export const GENRES = [
  {
    id: 'ff',
    name: 'Final Fantasy',
    tagline: 'Navigation Chronicles',
    description: 'Choose a class, master an ability, chart your course.',
    color: '#F0C060',
    status: 'available',
    entryRoute: 'class-select',
    classes: CLASSES,
  },
  {
    id: 'scifi',
    name: 'Star Voyager',
    tagline: 'Deep Space Routing',
    description: 'Choose a role, master a system, chart your course.',
    color: '#3498DB',
    status: 'available',
    entryRoute: 'class-select',
    classes: SCIFI_CLASSES,
  },
  {
    id: 'western',
    name: 'Wild Frontier',
    tagline: 'Trail Navigation',
    description: 'Choose a role, master a skill, chart your course.',
    color: '#C87F32',
    status: 'available',
    entryRoute: 'class-select',
    classes: WESTERN_CLASSES,
  },
  {
    id: 'pirate',
    name: 'High Seas',
    tagline: 'Open Water Routing',
    description: 'Choose a role, master a trade, chart your course.',
    color: '#1ABC9C',
    status: 'available',
    entryRoute: 'class-select',
    classes: PIRATE_CLASSES,
  },
]
