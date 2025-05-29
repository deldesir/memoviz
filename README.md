# MemoViz 🧠✨

**MemoViz** is an interactive, grid-based web application designed to help you learn and memorize structured information through visualization and engaging game modes. Built with SvelteKit and designed with an offline-first PWA (Progressive Web App) approach in mind, MemoViz aims to be a reliable study tool, especially in areas with limited internet connectivity.

## What is MemoViz?

At its core, MemoViz takes custom datasets defined in JSON format and displays them in a configurable grid. Users can then interact with this grid in several ways:

* **Explore Mode:** Freely click on cells or type coordinates to reveal information, select display languages, and toggle different visual aids.
* **Game Modes:** Test your knowledge and recall with built-in games like "Guess the Cell" (given a name, find its location) and "Timed Recall" (recall an item from its location before it's revealed).
* **Customization:** Load your own datasets, switch between different pre-defined datasets from a catalog, filter by categories, and adjust display preferences.

## Key Features ✨

* **Interactive Grid Display:** Visually presents data in a clear, configurable grid.
* **Customizable Datasets:** Load your own data using a flexible JSON format.
* **Dataset Catalog:** Easily switch between different pre-defined datasets.
* **Explore Mode:**
    * Highlight cells via click or keyboard input (e.g., typing "10" for column 1, row 0).
    * Multi-language support for data display.
    * Selectable display forms (e.g., full name, abbreviation, symbol).
    * Optional display of item names directly in cells.
    * Optional coloring of cells by category.
    * Optional display of detailed info for the highlighted item above the grid.
* **Game Modes:**
    * **Guess the Cell:** Given an item's full name, find its position on the grid.
    * **Timed Recall:** Given coordinates, recall the item before its name is revealed after a set delay.
    * Score tracking for games.
    * Visual feedback for correct/incorrect guesses.
* **Category Filtering:** Focus game modes on specific categories within a dataset.
* **Settings Modal:** Centralized panel for all options (mode, language, forms, display toggles, game filters, data management).
* **Persistence:** Remembers your last used dataset and UI settings via browser storage.
* **(Planned) Offline-First PWA:** Designed to work reliably even without an internet connection once initially loaded.

## Tech Stack 🥞

* [SvelteKit](https://kit.svelte.dev/)
* [Svelte](https://svelte.dev/)
* TypeScript / JSDoc for type safety
* Vite for fast development and builds
* (Future) Service Workers for PWA capabilities

## Project Setup and Usage

Follow these instructions to get the project running on your local machine for development and testing purposes.

### Prerequisites

* Node.js (LTS version recommended, includes npm) installed on your system. You can download it from [nodejs.org](https://nodejs.org/).

### Installation

1.  **Clone the repository (if you haven't already):**
    ```bash
    git clone <repository-url>
    cd memoviz # Or your project's directory name
    ```

2.  **Install dependencies:**
    Navigate to the project's root directory (where `package.json` is located) and run:
    ```bash
    npm install
    ```
    (Alternatively, use `yarn install` or `pnpm install` if you prefer those package managers.)

### Running the Project

* **Development Mode:**
    To start the development server with Hot Module Replacement (HMR):
    ```bash
    npm run dev
    ```
    To automatically open it in your default web browser:
    ```bash
    npm run dev -- --open
    ```
    To run on a specific host (e.g., to access from other devices on your network) and port:
    ```bash
    npm run dev -- --host 0.0.0.0 --port 8085
    ```
    The application will typically be available at `http://localhost:5173` (or the port you specified).

* **Previewing the Production Build:**
    First, create a production build (see next step). Then, run:
    ```bash
    npm run preview
    ```
    This starts a local server to serve your built application as it would appear in production.

### Building the Project

To create an optimized production-ready version of your application:
```bash
npm run build
```

This command bundles your application, typically into a `build` directory (for Adapter Node) or `.svelte-kit/output` (for other adapters), ready for deployment.

### Code Quality Tools

  * **Linting:**
    To check the codebase for potential errors and enforce coding style:

    ```bash
    npm run lint
    ```

  * **Formatting:**
    To automatically format the code according to Prettier rules:

    ```bash
    npm run format
    ```

### Type Checking

To check for type errors (if using TypeScript or JSDoc with `checkJs`):

```bash
npm run check
```

Or to run the type checker in watch mode:

```bash
npm run check:watch
```

## Roadmap 🗺️

This project is actively being developed. Here's a rough outline of current and planned features:

  * **Phase 1: Core Functionality (Mostly Complete)**

      * ✅ Dynamic grid rendering from JSON.
      * ✅ Explore mode with highlighting and info display.
      * ✅ Settings modal for language, display forms, and UI toggles.
      * ✅ Game Modes: "Guess the Cell" and "Timed Recall" with basic logic.
      * ✅ Category filtering for game modes.
      * ✅ Multi-language support for data content (items, categories, dataset names).
      * ✅ Basic settings and last loaded dataset persistence.
      * ✅ Loading datasets via file input and a predefined catalog.
      * ✅ "App Info & Reset" section in settings.

  * **Phase 2: PWA & Polish (Upcoming)**

      * Implement Service Worker for offline caching (app shell, static assets, catalog, and loaded datasets).
      * Web App Manifest for installability ("Add to Home Screen").
      * Refine UI/UX:
          * Improve transitions and visual feedback.
          * Enhanced styling for a more "modern" grid/card appearance (deferred).
          * Robust focus management in modals and across the app.
          * More user-friendly error display and notifications.
      * Thorough testing and bug fixing.

  * **Phase 3: Advanced Features & Expansion (Future Ideas)**

      * Full UI Internationalization (i18n) for all static app text using `svelte-i18n` or similar.
      * In-app tool to create or edit datasets.
      * More game modes or variations.
      * User accounts and cloud synchronization for datasets (optional, major).
      * Shareable links to specific datasets or app states.
      * Community-contributed datasets.

## Contributing

Details on how to contribute to the project will be added here. We welcome suggestions, bug reports, and pull requests!

## License

This project is licensed under the **GPL-3.0 License**. See the [LICENSE](https://www.google.com/search?q=LICENSE) file for details (or the link you provided: `https://github.com/deldesir/memoviz#GPL-3.0-1-ov-file`).
