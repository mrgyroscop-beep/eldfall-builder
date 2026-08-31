# Проверка задач Eldfall

Связанные задачи: KAN-128–KAN-147, label `eldfall`.

| Задача            | Реализация / доказательство                                                                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 129 Архитектура   | README, lib/model.ts, разделение UI/domain/service/D1                                                                                                                                          |
| 130 Импорт        | scripts/import-guildhall.mjs; immutable raw + normalized snapshot; diff всех типов сущностей; publish только явно, атомарно                                                                    |
| 131 Схема         | lib/model.ts + lib/validation.ts; 63 профиля; тест целостности ссылок                                                                                                                          |
| 132 Каталог       | components/guild-app.tsx + profile.tsx; RU/EN поиск, фракция/класс/цена/тег, диалог профиля                                                                                                    |
| 133 Редактор      | фракция, лимит, экземпляры, лидер, upgrades/options/spell reference, локальный черновик                                                                                                        |
| 134 Валидатор     | lib/game.ts + upgrades.ts; отдельный движок; серверная проверка перед матчем; unit tests                                                                                                       |
| 135 Локализация   | data/localization.json + data/ru/: полный перевод текущего справочника, интерфейса, матчей и печати; независимые RU/EN; per-record review и защита от изменения источника; tests/i18n.test.tsx |
| 136 Сохранение    | D1 rosters + datasets; read/edit capabilities; optimistic revision; integration tests                                                                                                          |
| 137 Печать        | A4 print-only stylesheet; JSON export/import с улучшениями/заклинаниями/версиями                                                                                                               |
| 138 Развёртывание | Sites owner-only + HTTPS; migrations; npm run check; automatic revision backups and JSON restore                                                                                               |
| 140 Модель матча  | lib/model.ts + README lifecycle; immutable roster snapshots                                                                                                                                    |
| 141 Подключение   | приглашение URL/6-символьный код (24 ч); лимит 5 попыток/мин на аккаунт; отзыв кода/ссылок; проверка владельца ростера; максимум 2 игрока                                                      |
| 142 Фиксация      | одинаковая версия/лимит, оба подтверждают, отмена до старта; integration tests                                                                                                                 |
| 143 Экран         | обе стороны, профиль без потери контекста, responsive layout                                                                                                                                   |
| 144 Счётчики      | HP/AP/mana 0..100, VP -1000..1000, round 1..100 — технические границы ручного трекера; states, initiative, undo                                                                                |
| 145 Синхронизация | 2s polling, monotonic client revision, D1 CAS and atomic event insert, reconnection; локальный ограниченный журнал сбоев/восстановления/конфликтов и тесты его безопасного восстановления      |
| 146 История       | pause/resume, finish/read-only, result including winner/note, event snapshots, JSON log                                                                                                        |
| 147 Тесты         | tests/game.test.ts, service.test.ts, render.test.tsx; реальные локальные D1 queries в изолированной Miniflare                                                                                  |

## Неподтверждённая вручную часть

Визуальная проверка на реальных телефонах и пробная печать PDF не запускались. Не выдавать CSS/SSR-проверки за браузерный прогон. KAN-132/133/137/143 можно передать на ручную приёмку после публикации.

## Ограничение доступа

Приложение публикуется **только владельцу**. Права внешних email-приглашений на аккаунте Sites выключены (`external_visitor_invites_enabled=false`). Не менять сайт на публичный. Вопрос второго аккаунта/рабочего пространства или альтернативного приватного хостинга остаётся для владельца; KAN-138 и эпики не закрывать как полностью принятые до решения.
