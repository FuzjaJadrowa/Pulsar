# Contributing to Pulsar
Thanks for taking the time to contribute. Bug reports, translations, documentation improvements, and code changes are all welcome.

## Reporting a bug
Before opening an issue, check [existing issues](https://github.com/fuzjajadrowa/Pulsar/issues) to see if the problem has already been reported. If it hasn't, open a new issue with the **Bug Report** template and include the steps to reproduce the problem, what you expected to happen, and what happened instead.

## Suggesting a feature
Open an issue using the **Feature Request** template. Explain what you'd like Pulsar to do and how it would help people using the app.

## Contributing code
### Set up your environment
Pulsar uses **Tauri**, **Rust**, and **Node.js**. Install:
- [Rust](https://www.rust-lang.org/tools/install) with the stable toolchain.
- [Node.js](https://nodejs.org/) (version 20 or later).
- The system dependencies required by Tauri for your operating system. See the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for details.

### Make your changes
1. Fork the repository and clone your fork:
```bash
git clone https://github.com/YOUR-USERNAME/Pulsar.git
cd Pulsar
```

2. Create a branch for your change:
```bash
git checkout -b feature/short-description
```
For a bug fix, a name such as `fix/short-description` works well.

3. Make the change and keep the surrounding code style consistent. Format Rust code with `cargo fmt`.
4. Build the app and check the affected features before opening a pull request. If you add or change translation keys, run the translation check described below.
5. Commit your changes with a short, clear message, then push the branch to your fork:
```bash
git add .
git commit -m "Describe the change"
git push origin feature/short-description
```

### Open a pull request
Open a pull request from your branch to the Pulsar repository. Use the pull request template and describe what changed, why it was needed, and how you checked it. A maintainer may ask questions or suggest changes during review.

## Adding a language
The interface translations are in `public/assets/langs/`. English (`en.json`) is the reference file; the other language files must use the same keys and nested structure.

1. Copy `public/assets/langs/en.json` to `public/assets/langs/<code>.json`, using the language's lowercase two-letter code where available (for example, `es.json` for Spanish).
2. Translate the values in the new file. Keep every key exactly as it is in `en.json`, preserve the JSON structure, and leave placeholders such as `{error}` unchanged. Don't translate URLs, format identifiers, or other values that are meant to remain literal.
3. Add the language to the selector in `src/features/settings/Settings.tsx`, using the language's native name as its label, the correct line of the code are marked with comments.
4. Add the code and any useful name aliases to `normalizeLocale` in `src/services/i18n.ts`. This lets the app load the new JSON file when that language is selected, it's also marked with comments.
5. Run the translation key check:
```bash
npm run check:translations
```

The check compares every language file with `en.json` and reports missing or extra keys. Fix any reported differences refers to added language before submitting the pull request.
Include the new JSON file and the selector and locale changes in the same pull request. If you update English UI text or add a new UI string, update the corresponding key in every language file as well.

## A few things to keep in mind
- Keep pull requests focused on one change where possible.
- Prefer clear names and readable code.
- Update translations when adding or changing text shown in the app.