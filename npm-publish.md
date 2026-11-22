# Публикация на npm и GitHub

## Текущее состояние (package.json)

```json
"name": "git-wrapped",      // ✓ готово
"version": "1.0.0",        // ✓ готово для first release
"bin": {"git-wrapped": "bin/git-wrapped.js"}  // ✓ готово
"main": "src/index.js",    // ✓ готово
"files": [...]             // ✓ включает bin, src, examples
```

## Требуемые действия:

### 1. NPM publish
- **Требования:** npm config set //registry://_authToken (npm@access)
- Команда: `npm publish`
- Версия для first release: `1.0.0`

### 2. GitHub репозиторий с proper settings
- Создать новый репо `git-wrapped` или использовать существующее
- Topics: `git`, `developer-tools`, `year-in-review`
- Добавить карточку в верх README (уже есть, нужно проверить)

## Вопросы:

1. **npm username** для публичного имени:
   - Использовать `git-wrapped` (текущий аккаунт)?
   - Или создать новое имя в npm ecosystem?

2. **GitHub репозиторий:**
   - Создать новый репо с правильными конфигами?
   - Использовать существующее?

3. **Версия для релиза:**
   - `1.0.0` (текущая)?
   - `1.1.0` (с улучшенными конфигами перед релизом)?

### Для npm publish нужен доступ к:
- npm@access token или подтверждение личности в npm account
