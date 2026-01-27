import { TimePatterns } from '../../core/types';

export const TIME_PATTERNS_DA: TimePatterns = {
  weekday: {
    morning: {
      timeBlock: '07:00-10:00',
      demandLevel: 'medium',
      primaryBehaviors: ['pendlere', 'forretningsmorgenmad'],
      keyProducts: ['morgenmad', 'kaffe', 'bagværk'],
      optimalPostTime: '06:00-07:30',
      messagingFocus: ['kvalitet', 'hastighed', 'friskbagt'],
      appliesTo: ['cafe', 'bageri', 'hotel'],
      culturalNote: 'Morgenmad ude er ikke mainstream - primært pendlere og hotelgæster'
    },
    
    noon: {
      timeBlock: '11:30-13:30',
      demandLevel: 'peak',
      primaryBehaviors: ['hurtig_frokost', 'forretningsmøder'],
      keyProducts: ['smørrebrød', 'frokost', 'sunde_bowls'],
      optimalPostTime: '08:00-10:00',
      messagingFocus: ['hastighed', 'sundhed', 'traditionelt'],
      appliesTo: ['restaurant', 'cafe', 'kantine'],
      culturalNote: 'Dansk frokost er markant tidlig (11:30) og hurtig (30 min typisk). Ofte kold frokost.'
    },
    
    afternoon: {
      timeBlock: '14:00-16:30',
      demandLevel: 'low',
      primaryBehaviors: ['kaffepause', 'hybridarbejdere'],
      keyProducts: ['kaffe', 'kage', 'let_snack'],
      optimalPostTime: '12:00-14:00',
      messagingFocus: ['hygge', 'pause', 'kvalitet'],
      appliesTo: ['cafe'],
      culturalNote: 'Eftermiddagskaffebølgen - mindre etableret end svensk fika'
    },
    
    evening: {
      timeBlock: '17:30-20:30',
      demandLevel: 'medium',
      primaryBehaviors: ['familieaftensmad', 'forretningsmiddag'],
      keyProducts: ['hovedret', 'aftensmenu'],
      optimalPostTime: '14:00-16:00',
      messagingFocus: ['kvalitet', 'atmosfære', 'booking'],
      appliesTo: ['restaurant', 'bistro'],
      culturalNote: 'Køkkener begynder at lukke ned kl 21:00. To-skifts strategi: 17:30 og 20:00 seatings. Man-ons LAV (hjemmelavet aftensmad kultur).'
    }
  },
  
  weekend: {
    brunch: {
      timeBlock: '09:00-14:00',
      demandLevel: 'high',
      primaryBehaviors: ['sociale_sammenkomster', 'familietid'],
      keyProducts: ['brunch', 'morgenmad', 'frokost'],
      optimalPostTime: 'tor_fre 16:00-20:00',
      messagingFocus: ['hygge', 'afslappet', 'ingen_stress'],
      appliesTo: ['restaurant', 'cafe'],
      culturalNote: 'Weekend brunch stadig voksende trend i større byer, men ikke universel i mindre byer'
    }
  },
  
  seasonalModifiers: {
    summer: {
      months: [6, 7, 8],
      demandMultiplier: 1.5,
      messagingShift: ['udeservering', 'solskin', 'frisk', 'lys'],
      locationBoosts: {
        waterfront: 1.8,
        shopping_district: 1.2,
        tourist: 1.6,
        city_centre: 1.3,
        residential: 0.9,
        office: 0.8,
        student: 0.5,
        transport_hub: 1.1,
        mixed_use: 1.1
      }
    },
    
    winter: {
      months: [11, 12, 1, 2],
      demandMultiplier: 0.8,
      messagingShift: ['hygge', 'varme', 'komfort', 'indenfor'],
      locationBoosts: {
        waterfront: 0.5,
        shopping_district: 1.3,
        tourist: 0.6,
        city_centre: 1.0,
        residential: 1.1,
        office: 1.0,
        student: 1.2,
        transport_hub: 1.0,
        mixed_use: 1.0
      }
    }
  }
};
