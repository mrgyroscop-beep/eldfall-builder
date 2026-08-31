import type { Catalog, Issue, Lang } from './model';
import { name, upgradeName } from './i18n';

export const errorMessages: Record<string, [string, string]> = {
  CONFLICT: [
    'Данные изменены на другом устройстве. Черновик сохранён: обновите данные или сохраните копию.',
    'Changed on another device. Your draft is retained: reload or save a copy.',
  ],
  FORBIDDEN: [
    'Нет доступа к этой записи.',
    'You do not have access to this record.',
  ],
  OWNER_ONLY: [
    'Это действие доступно только владельцу.',
    'Only the owner can do this.',
  ],
  FORMAT_MISMATCH: [
    'У ростеров должны совпадать лимит очков, версия данных и правил.',
    'Rosters must use the same point limit, data and rules versions.',
  ],
  MATCH_FULL: [
    'В матче уже два игрока.',
    'This match already has two players.',
  ],
  SIGN_IN_REQUIRED: [
    'Войдите в аккаунт, которому открыт доступ к сайту.',
    'Sign in with an account allowed to access this site.',
  ],
  DATA_VERSION_UNAVAILABLE: [
    'Версия справочника отсутствует на сервере.',
    'This catalogue version is unavailable.',
  ],
  RULES_VERSION_MISMATCH: [
    'Версия правил не совпадает с версией справочника.',
    'Rules and catalogue versions do not match.',
  ],
  SERVER_ERROR: [
    'Ошибка сервера. Попробуйте ещё раз.',
    'Server error. Please retry.',
  ],
  OWN_ROSTER_REQUIRED: [
    'Сначала сохраните свой ростер.',
    'Save your own roster first.',
  ],
  NOT_FOUND: [
    'Запись или приглашение не найдено.',
    'Record or invitation not found.',
  ],
  ALREADY_JOINED: [
    'Вы уже участвуете в этом матче.',
    'You already joined this match.',
  ],
  INVITE_REQUIRED: [
    'Нужна действующая ссылка или код приглашения.',
    'A valid invitation link or code is required.',
  ],
  BAD_INPUT: ['Некорректные данные запроса.', 'Invalid request data.'],
  BAD_ACTION: ['Это действие недоступно.', 'This action is unavailable.'],
  BAD_ROSTER: ['Неверная структура ростера.', 'Invalid roster structure.'],
  BAD_BACKUP: ['Некорректный файл резервной копии.', 'Invalid backup file.'],
  BAD_JSON: [
    'Не удалось прочитать файл или запрос.',
    'Could not read the file or request.',
  ],
  JSON_REQUIRED: ['Требуется формат JSON.', 'JSON format required.'],
  EMPTY_BODY: ['Получен пустой запрос.', 'Empty request received.'],
  CROSS_ORIGIN: [
    'Запрос разрешён только с этого сайта.',
    'Requests must originate from this site.',
  ],
  REQUEST_TOO_LARGE: ['Запрос слишком большой.', 'Request is too large.'],
  RECORD_TOO_LARGE: ['Запись слишком большая.', 'Record is too large.'],
  FINISHED: [
    'Матч завершён и доступен только для чтения.',
    'This finished match is read-only.',
  ],
  NOT_READY: [
    'Сначала оба игрока должны присоединиться к матчу.',
    'Both players must join first.',
  ],
  NOT_ACTIVE: ['Сейчас матч не идёт.', 'The match is not active.'],
  NOT_PAUSED: ['Матч не находится на паузе.', 'The match is not paused.'],
  RESULT_REQUIRED: ['Укажите результат партии.', 'Enter the match result.'],
  NO_UNDO: [
    'Нет вашего последнего действия для отмены.',
    'There is no latest action of yours to undo.',
  ],
  BAD_STATE: ['Неизвестное состояние модели.', 'Unknown model state.'],
  BAD_FIELD: ['Нельзя изменить это поле.', 'This field cannot be changed.'],
  RANGE: [
    'Значение за допустимыми пределами.',
    'Value outside the supported range.',
  ],
  NOT_ACTIVE_SIDE: [
    'Сменить раунд может игрок с инициативой.',
    'Only the player with initiative can advance the round.',
  ],
  EVENT_LIMIT: [
    'Достигнут предел событий матча.',
    'Match event limit reached.',
  ],
  BAD_CATALOG: ['Некорректный справочник.', 'Invalid catalogue.'],
  DUPLICATE_CATALOG_ID: [
    'В справочнике есть повторяющиеся записи.',
    'Duplicate catalogue records.',
  ],
  BAD_CHARACTER: ['Некорректный профиль модели.', 'Invalid model profile.'],
};
export function errorText(message: string, lang: Lang): string {
  if (errorMessages[message])
    return errorMessages[message][lang === 'ru' ? 0 : 1];
  if (message.startsWith('INVALID_ROSTER:'))
    return lang === 'ru'
      ? 'Ростер не прошёл проверку. Откройте его в билдере и исправьте замечания.'
      : 'Roster validation failed. Open it in the builder and resolve the issues.';
  if (/fetch|network|timeout|aborted|HTTP|load failed/i.test(message))
    return lang === 'ru'
      ? 'Не удалось связаться с сервером. Проверьте подключение и повторите.'
      : 'Could not reach the server. Check your connection and retry.';
  if (/JSON|Unexpected token|Unexpected end/i.test(message))
    return errorMessages.BAD_JSON[lang === 'ru' ? 0 : 1];
  if (/[а-яё]/i.test(message))
    return lang === 'ru'
      ? message
      : 'Could not read or save local data. Server records are unchanged.';
  return lang === 'ru'
    ? 'Не удалось выполнить действие. Повторите попытку.'
    : 'Could not complete the action. Please retry.';
}
const issueEnglish: Record<string, string> = {
  ELEMENT: 'Choose one element for the Djinnborn Marzban.',
  NAME: 'Use a roster name of 1–120 characters.',
  POINTS: 'Point limit must be an integer from 1 to 1000.',
  EMPTY: 'Recruit at least one model.',
  SIZE: 'A party may contain at most 10 models (p. 33).',
  FACTION: 'Choose a faction.',
  NATIVE: 'Include at least one native faction model (p. 33).',
  VERSION: 'The exact catalogue version is required.',
  DUPLICATE: 'Model instance identifiers must be unique.',
  UNKNOWN: 'Unknown model profile.',
  UNAVAILABLE: 'This model is unavailable to your faction.',
  LIMIT: 'Model recruitment limit exceeded.',
  SPELL: 'Spell unavailable for the school, level or element.',
  OVER_BUDGET: 'Recruitment point limit exceeded.',
  LEADER: 'Choose a party leader.',
};
export function issueText(issue: Issue, lang: Lang, d: Catalog) {
  if (lang === 'en') return issueEnglish[issue.code] ?? issue.message;
  let text = issue.message;
  for (const c of d.characters)
    text = text.replaceAll(c.name, name(c.id, c.name, lang));
  for (const u of d.upgrades ?? [])
    text = text.replaceAll(u.name, upgradeName(u, lang));
  const fragments: Record<string, string> = {
    'Named Characters cannot receive upgrades (errata April 2026, p. 3).':
      'Именные персонажи не могут получать улучшения (исправления, апрель 2026, с. 3).',
    'Upgrade slots exceeded:': 'Превышено число улучшений:',
    'Duplicate upgrade on one model.': 'У модели повторяется одно улучшение.',
    'Unknown upgrade.': 'Неизвестное улучшение.',
    'wrong faction.': 'не подходит фракция.',
    'party limit': 'лимит на отряд',
    'Warrior required.': 'нужен класс «Воин».',
    'Soldier required.': 'нужен класс «Солдат».',
    'cannot assign to a Demon.': 'нельзя назначить демону.',
    'Medium or smaller.': 'нужен средний размер или меньше.',
    'select a valid option.': 'выберите допустимый вариант.',
  };
  for (const [en, ru] of Object.entries(fragments))
    text = text.replaceAll(en, ru);
  return text;
}
