/**
 * Раздел «Если уже не справляюсь». Тексты и ссылки — только здесь.
 * ВАЖНО: перед демо проверить каждую ссылку и номер по официальным источникам и проставить verifiedAt.
 * Пока verifiedAt === null, UI показывает пометку «проверьте актуальность».
 */
export interface HelpResource {
  id: string;
  /** ключ i18n для заголовка и описания */
  titleKey: string;
  descKey: string;
  url: string | null;
  phone: string | null;
  verifiedAt: string | null;
}

export const HELP_RESOURCES: HelpResource[] = [
  {
    id: "bank_restructuring",
    titleKey: "help.restructuring.title",
    descKey: "help.restructuring.desc",
    url: null,
    phone: null,
    verifiedAt: null,
  },
  {
    id: "regulator",
    titleKey: "help.regulator.title",
    descKey: "help.regulator.desc",
    url: "https://www.gov.kz/memleket/entities/ardfm",
    phone: null,
    verifiedAt: null,
  },
  {
    id: "police",
    titleKey: "help.police.title",
    descKey: "help.police.desc",
    url: null,
    phone: "102",
    verifiedAt: null,
  },
];
