# Contributing to Pulsar
Thank you for your interest in contributing to Pulsar! This project is built by the community for the community, and every contribution from reporting a bug to writing a new feature is highly valued.
Below you will find guidelines on how you can support the project.
## Reporting Bugs
If something isn't working as expected, please let me know!
1. **Search existing issues:** Before opening a new one, check the [Issues](https://github.com/fuzjajadrowa/Pulsar/issues) tab to see if someone else has already reported the same problem.
2. **Use the template:** If the bug is new, create an issue describing using Bug Report template.
## Feature Request
Do you have an idea for a new feature, such as support for a new platform or a UI change?
* Open a new Issue and use Feature Request template.
* Describe exactly why this feature would be useful for other users.
## Creating Pull Requests (PR)
Want to fix a bug or add a feature yourself? Great! Here is how to do it:
### 1. Environment Setup
Pulsar is built using **Rust** and **Tauri**. To work on the project locally, you will need:
* [Rust](https://www.rust-lang.org/tools/install)
* [Node.js](https://nodejs.org/) (for the app frontend)
* System dependencies for Tauri (refer to the official Tauri documentation)
### 2. Workflow
1. **Fork:** Create a "Fork" of the repository to your own GitHub account.
2. **Clone:** Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/Pulsar.git
   ```
3. **Branch:** Create a new branch for your change:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/description-of-fix
   ```
4. **Code:** Implement your changes. Remember to keep the code style consistent (e.g., use `cargo fmt` for Rust).
5. **Test:** Ensure the app builds correctly and your changes don't break existing features.
6. **Commit:** Commit your changes with a clear message:
   ```bash
   git commit -m "Add support for TikTok search"
   ```
7. **Push:** Push the changes to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
### 3. Opening the PR
* Go to the main Pulsar repository page on GitHub.
* You will see a yellow bar with a **"Compare & pull request"** button. Click it.
* Briefly describe what your PR changes and what problems it solves, use Pull Request template.
* Wait for a code review—I might have some questions or suggestions before merging.
## Coding Guidelines
* **Clarity:** Write readable code and add comments where logic is complex.
* **Translations:** If you add new UI text, remember to add the corresponding keys to the JSON files in the `langs/` folder.
* **Commits:** Try to ensure that one PR solves one specific problem.
---
Thank you for your time and contribution to the development of **Pulsar**!