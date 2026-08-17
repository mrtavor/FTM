# 📍 GeoSnap Map — Інтерактивна Фото-Карта

> **100% Client-Side Processing • Firebase Spark Plan (Безкоштовно) • GitHub Pages**

Інтерактивна карта для додавання та перегляду фотографій за GPS-координатами. Вся обробка медіа (парсинг EXIF, очищення метаданих, стиснення до WebP та створення мікро-мініатюр) виконується виключно у браузері користувача, що дозволяє працювати на безкоштовному тарифі Firebase без серверів і без Cloud Functions.

---

## 🌟 Ключові Особливості

- **100% Клієнтська обробка (Canvas API + `exifr`)**:
  - Автоматичне вилучення GPS-координат з метаданих фото.
  - Повне очищення (EXIF stripping) конфіденційних метаданих при перемальовуванні через Canvas.
  - Стиснення основного фото до макс. 800px у форматі WebP (~150–250 КБ).
  - Створення квадратної мікро-мініатюри 100×100px WebP (~10–15 КБ) для маркерів.
- **Оптимізація безкоштовного Firebase Spark Plan**:
  - Geohash-діапазони (`ngeohash`) для вибірки точок лише з видимої області екрана (Bounding Box).
  - Локальний клієнтський кеш (In-Memory Cache) — запобігає повторним читанням Firestore під час зуму та навігації.
- **Динамічна карта (Leaflet.js)**:
  - **Zoom Out ($\le 10$)**: Кластеризація маркерів із лічильником точок.
  - **Medium Zoom ($11–14$)**: Користувацькі емодзі-піни.
  - **Zoom In ($\ge 15$)**: Інтерактивні прев'ю-мініатюри фотографій.
- **UI/UX Дизайн**:
  - М'який Flat/Paper стиль у спокійних Eye-Care тонах.
  - Зручний Bottom Bar із піднятою кнопкою «+».
  - Повна адаптивність під мобільні пристрої (Mobile-First).
  - Інтерактивний режим вибору точки на карті вручну (Crosshair Pin Picker), якщо у фото відсутній GPS.

---

## 🚀 Швидкий Старт

### 1. Встановлення залежностей
```bash
npm install
```

### 2. Запуск локального сервера розробки
```bash
npm run dev
```

### 3. Збірка для продакшену
```bash
npm run build
```

---

## ⚙️ Налаштування Firebase (Spark Plan)

1. Перейдіть до [Firebase Console](https://console.firebase.google.com/) та створіть новий проєкт (на безкоштовному тарифі Spark).
2. **Автентифікація (Authentication)**:
   - Перейдіть у *Build -> Authentication -> Sign-in method*.
   - Увімкніть **Anonymous** (Анонімний вхід) — це захистить базу від прямих бот-запитів.
3. **База даних (Firestore Database)**:
   - Перейдіть у *Build -> Firestore Database* та створіть базу у Production-режимі.
   - Скопіюйте вміст файлу `firestore.rules` у вкладку **Rules** вашої бази в консолі та опублікуйте їх.
4. **Сховище (Cloud Storage)**:
   - Перейдіть у *Build -> Storage* та активуйте сховище.
   - Скопіюйте вміст файлу `storage.rules` у вкладку **Rules** вашого сховища та опублікуйте їх.
5. **Отримання ключів**:
   - Перейдіть у *Project Settings (⚙️) -> General -> Your apps -> Web app (</>)*.
   - Скопіюйте конфігурацію `firebaseConfig`.
   - Ви можете ввести ці ключі прямо в інтерфейсі додатку через кнопку **⚙️ Налаштування** або створити файл `.env` на основі `.env.example`.

---

## 🔒 Безпека та Захист API-ключів (HTTP Referrers)

Щоб захистити ваші API-ключі від використання на сторонніх сайтах:
1. Перейдіть у [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Знайдіть створений API-ключ вашого Firebase проєкту.
3. У розділі **Application restrictions** виберіть **Websites (HTTP referrers)**.
4. Додайте домени вашого додатку:
   - `http://localhost:3000/*` (для локальної розробки)
   - `https://<ваш_юзернейм>.github.io/*` (для GitHub Pages)
5. Збережіть зміни.

---

## 🌐 Деплой на GitHub Pages

У репозиторій уже додано GitHub Actions workflow (`.github/workflows/deploy.yml`).

1. Запушіть код у ваш GitHub репозиторій:
   ```bash
   git add .
   git commit -m "feat: initial photo map release"
   git push origin main
   ```
2. У репозиторії на GitHub перейдіть у **Settings -> Pages**.
3. У полі **Source** оберіть **GitHub Actions**.
4. GitHub автоматично збере проєкт та опублікує його на вашому `https://<username>.github.io/<repo>/`!

---

## 📂 Структура Проєкту

```
FTM/
├── .github/workflows/deploy.yml  # Автодеплой на GitHub Pages
├── firestore.rules               # Суворі правила безпеки для Firestore
├── storage.rules                 # Суворі правила безпеки для Cloud Storage
├── index.html                    # Головна сторінка додатку
├── package.json                  # Залежності
├── vite.config.js                # Налаштування Vite (base: './')
├── src/
│   ├── main.js                   # Точка входу
│   ├── styles/                   # main.css, map.css, modal.css
│   ├── services/
│   │   ├── firebase.js           # Ініціалізація Firebase SDK (Auth, DB, Storage)
│   │   ├── authService.js        # Анонімна автентифікація
│   │   ├── imageProcessor.js     # EXIF, Canvas WebP стиснення, мініатюри
│   │   └── geoService.js         # Geohash запити та локальний кеш точок
│   ├── components/
│   │   ├── map.js                # Leaflet карта, кластери, емодзі, прев'ю
│   │   ├── uploadModal.js        # Модалка завантаження, EXIF, crosshair picker
│   │   ├── photoDetailModal.js   # Перегляд повного фото та опису
│   │   ├── settingsModal.js      # Налаштування ключів Firebase в браузері
│   │   └── infoModal.js          # Інформація про архітектуру та ліміти
│   └── utils/
│       ├── config.js             # Менеджер конфігурації
│       ├── toast.js              # Інтерактивні сповіщення
│       └── mockData.js           # Демо-точки для швидкого тестування
```
