# Отчет по техническому аудиту проекта: Импорты, Экспорты и Архитектурные Связи

Проведен детальный аудит кодовой базы проекта `incose-paper-analyser` с позиции Старшего фронтенд-разработчика (Senior Frontend Developer). Были проанализированы все Vue-компоненты, JS-файлы логики, структуры данных Pinia-хранилищ, настройки роутера, а также запущены статические анализаторы (ESLint, Oxlint).

---

## 📋 Резюме аудита (Executive Summary)

1. **Битые пути (Broken Imports):** Физически битых путей импорта (когда импортируется несуществующий файл или папка) в проекте **не обнаружено**. Все относительные пути (`../`, `../../`) в Vue и JS файлах прописаны корректно и ведут к существующим модулям.
2. **Неиспользуемые импорты и компоненты (Dead Code):** Выявлен один полностью неиспользуемый файл хранилища (`store/counter.js`) и неиспользуемые переменные/функции в других компонентах.
3. **Критические архитектурные расхождения (Critical Reference Mismatches):** В процессе аудита связей между компонентами и Pinia-хранилищем были обнаружены **критические баги интеграции** (отсутствующие геттеры и несовпадения имен свойств), которые приводят к падению приложения во время работы (Runtime Errors) и ломают ключевой функционал фильтрации графа.

---

## 🛠 Подробный отчет по проблемам

### 1. Неиспользуемые файлы и компоненты (Dead Code)
* **Файл:** `src/store/counter.js`
  * **Проблема:** Хранилище `useCounterStore` объявлено, но **ни разу не импортировано и не использовано** ни в одном компоненте проекта.
  * **Рекомендация:** Удалить файл, если он остался от дефолтного шаблона Vite, либо задействовать в бизнес-логике.

* **Файл:** `src/components/panels/MetricsPanel.vue` (Строка 127)
  * **Проблема:** Объявлена функция `openEditModal`, но она **никуда не привязана**. Вместо неё в шаблоне на кнопке напрямую вызывается метод хранилища: `@click="store.openModal(store.focusedNodeId)"`.
  * **Рекомендация:** Удалить неиспользуемую функцию `openEditModal`.

---

### 2. Критические ошибки интеграции и расхождения (Critical Reference Bugs)
Эти проблемы не вызывают синтаксических ошибок при сборке, но ломают логику работы приложения при взаимодействии пользователя с интерфейсом.

#### A. Полностью сломанное модальное окно редактирования (TypeError)
* **Файл:** `src/components/modals/NodeInfoModal.vue` (Строки 43, 46, 50, 221, 226, 232, 245, 268, 271, 295, 323, 324)
  * **Проблема:** Компонент модального окна активно использует свойство `store.inspectedNodes` (например, `store.inspectedNodes.length` и `store.inspectedNodes[0]?.authors`). Однако в хранилище `src/store/graphStore.js` **отсутствует такое свойство или геттер!** Есть только массив ID — `inspectedNodeIds`.
  * **Результат:** При попытке открыть модальное окно приложение упадет с ошибкой `TypeError: Cannot read properties of undefined (reading 'length')`.
  * **Решение:** Добавить в `getters` в `src/store/graphStore.js`:
    ```javascript
    inspectedNodes(state) {
      if (!state.graphModel) return []
      return state.inspectedNodeIds.map(id => state.graphModel.nodes.get(id)).filter(Boolean)
    }
    ```

#### B. Неработающий пакетный режим (Batch Mode)
* **Файл:** `src/components/modals/NodeInfoModal.vue` (Строки 10, 22, 25, 58, 105, 221, 226, 232)
  * **Проблема:** Модальное окно проверяет флаг `store.isBatchMode`, но в `src/store/graphStore.js` **этого свойства или геттера нет**.
  * **Результат:** Приложение никогда не перейдет в режим массового редактирования, даже если выбрано несколько узлов.
  * **Решение:** Добавить в `getters` в `src/store/graphStore.js`:
    ```javascript
    isBatchMode(state) {
      return state.inspectedNodeIds.length > 1
    }
    ```

#### C. Неработающий фильтр внешнего окружения (Environment Toggles Mismatch)
* **Файл:** `src/components/panels/EgoPanel.vue` (Строка 48) и `core/models/Graph.js`
  * **Проблема:** В панели `EgoPanel.vue` чекбокс привязан к свойству `store.vizSettings.showTarget`:
    ```html
    <input type="checkbox" v-model="store.vizSettings.showTarget" />
    ```
    Однако в состоянии хранилища свойство называется `showEnv`, а движок графа в `Graph.js` фильтрует именно по `vizSettings.showEnv`.
  * **Результат:** Переключатель "Env" (окружение) на UI абсолютно ничего не делает, и внешние узлы не скрываются.
  * **Решение:** Изменить в `EgoPanel.vue` привязку на `store.vizSettings.showEnv`.

#### D. Неработающий выбор направления связей (Link Direction Mismatch)
* **Файл:** `src/components/panels/EgoPanel.vue` (Строка 27) и `core/models/Graph.js`
  * **Проблема:** Выпадающий список выбора направления связей привязан к `store.vizSettings.linkDirection`:
    ```html
    <select v-model="store.vizSettings.linkDirection" class="s-select">
    ```
    Но в состоянии хранилища и в файле `Graph.js` ожидается свойство `direction` (`vizSettings.direction`).
  * **Результат:** Изменение направления связей в выпадающем списке UI никак не влияет на отрисовку графа.
  * **Решение:** Изменить в `EgoPanel.vue` привязку на `store.vizSettings.direction`.

#### E. Сломанная фильтрация по ISSN в списке топ-хабов
* **Файл:** `src/components/panels/MetricsPanel.vue` (Строка 90)
  * **Проблема:** Фильтрация топ-хабов проверяет свойство `n.issn`:
    ```javascript
    if (store.trackedIssns.includes(n.issn) && !store.selectedISSNs.includes(n.issn)) return false;
    ```
    Но у объектов узлов (`Node` в `Graph.js`) нет свойства `issn` — у них есть массив `issns`.
  * **Результат:** Фильтрация по ISSN в списке правого сайдбара не работает, так как `n.issn` всегда `undefined`.
  * **Решение:** Переписать строку на корректную проверку через массив:
    ```javascript
    const nodeIssns = n.issns || [];
    const hasTracked = nodeIssns.some(i => store.trackedIssns.includes(i));
    const hasSelected = nodeIssns.some(i => store.selectedISSNs.includes(i));
    if (hasTracked && !hasSelected) return false;
    ```

---

### 3. Замечания по качеству кода и стилю (Linter Warnings)

Согласно результатам прогона `eslint` и `oxlint`, найдены следующие мелкие недочеты:

1. **Бесполезное присваивание (no-useless-assignment) в `core/parsers/JsonAdapter.js` (Строка 7):**
   * Переменная `rawNodes` инициализируется пустым массивом `let rawNodes = []`, но затем безусловно перезаписывается внутри ветвей `if (isRawArray)` и `else`. Стартовое значение `[]` никогда не считывается.
2. **Неиспользуемые аргументы ошибок в блоках catch (no-unused-vars) в `src/components/modals/NodeInfoModal.vue`:**
   * Строка 288: `catch (e) { alert("Failed...") }`
   * Строка 369: `catch (e) { failed += ... }`
   * Аргумент `e` объявлен, но не используется. Рекомендуется заменить на синтаксис ES2019 без указания переменной: `catch { ... }`.
3. **Неиспользуемое выражение (no-unused-expressions) в `src/components/visualization/ForceGraph3D.vue` (Строка 166):**
   * Конструкция `isActive ? Graph.resumeAnimation() : Graph.pauseAnimation()` является тернарным оператором, используемым в качестве выражения (Expression). Рекомендуется заменить на стандартный `if/else` для улучшения читаемости и соответствия правилам линтера:
     ```javascript
     if (isActive) {
       Graph.resumeAnimation()
     } else {
       Graph.pauseAnimation()
     }
     ```

---

## 🚀 Рекомендации по исправлению

1. **Добавить недостающие геттеры в `src/store/graphStore.js`:**
   Реализовать `inspectedNodes` и `isBatchMode` для восстановления работоспособности модального окна.
2. **Синхронизировать свойства `vizSettings` между UI и бизнес-логикой:**
   Исправить привязки `showTarget` &rarr; `showEnv` и `linkDirection` &rarr; `direction` в `EgoPanel.vue`.
3. **Исправить обращение к ISSN в `MetricsPanel.vue`:**
   Заменить обращение к несуществующему полю `n.issn` на обход массива `n.issns`.
4. **Удалить неиспользуемые фрагменты:**
   Удалить файл `src/store/counter.js` и неиспользуемую функцию `openEditModal` в `MetricsPanel.vue`.
5. **Провести рефакторинг мелких предупреждений линтера** для идеальной чистоты кодовой базы.
