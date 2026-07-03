import { LocaleConfig } from '../../core/types';
import { LOCALE_DA_DK } from '../da-DK';
import { CATEGORIES_EN } from './categories';

export const LOCALE_EN_US: LocaleConfig = {
  ...LOCALE_DA_DK,
  locale: 'en-US',
  country: 'US',
  language: 'en',
  categories: CATEGORIES_EN
};

export * from './categories';
