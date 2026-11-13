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
The UI translations are in `assets/locales.toml`. Each translation key has a TOML table containing language-code/value pairs. English is the reference language.

1. Add the language's native name under `[language.name]` in `assets/locales.toml`.
2. Add its language code and translated value to each applicable key table. Preserve placeholders such as `{error}` and leave URLs, format identifiers, and literal values unchanged.
3. Run the translation check:
```bash
npm run check:translations
```

The check reports every missing key grouped by language and exits with an error while any are missing. The UI falls back to English for untranslated entries.

## A few things to keep in mind
- Keep pull requests focused on one change where possible.
- Prefer clear names and readable code.
- Update translations when adding or changing text shown in the app.