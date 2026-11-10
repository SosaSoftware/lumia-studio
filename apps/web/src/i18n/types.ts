/** Interface languages. Spanish is the default and the reference of every dictionary. */
export type Lang = 'es' | 'en';

export const LANGS: readonly Lang[] = ['es', 'en'];

/** Native name of each language, shown in the language selector. */
export const LANG_NAMES: Readonly<Record<Lang, string>> = { es: 'Español', en: 'English' };

/** Singular and plural form of a message; `tn` picks one with the plural rules of the language. */
export interface PluralForms {
  readonly one: string;
  readonly other: string;
}

export type MessageValue = string | PluralForms;

export interface MessageTree {
  readonly [key: string]: MessageValue | MessageTree;
}

/** Values of the `{name}` placeholders of a message. */
export type MessageParams = Readonly<Record<string, string | number>>;

type PathsTo<T, Leaf> = {
  [K in keyof T & string]: T[K] extends Leaf ? K : T[K] extends MessageValue ? never : `${K}.${PathsTo<T[K], Leaf>}`;
}[keyof T & string];

/** Dotted keys of the messages that are plain text. */
export type TextKey<T> = PathsTo<T, string>;

/** Dotted keys of the messages that have a singular and a plural form. */
export type PluralKey<T> = PathsTo<T, PluralForms>;
