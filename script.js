class GridGame {
  constructor() {
    // Cache DOM elements
    this.table = document.getElementById('interactiveTable');
    this.gridBody = document.getElementById('gridBody');
    this.notifyEl = document.getElementById('notification');
    this.settingsBtn = document.getElementById('settingsToggle');
    this.settingsPanel = document.getElementById('settingsPanel');

    // -- Settings Panel Elements --
    this.importInput = document.getElementById('importFile');
    // Mode Selection
    this.modeRadios = document.querySelectorAll('input[name="gameMode"]');
    // Explore Controls
    this.exploreControlsDiv = document.getElementById('explore-controls');
    this.langSelect = document.getElementById('languageSelect');
    this.formDiv = document.querySelector('.form-selector'); // Container for radios
    this.showDefaultFormToggle = document.getElementById('showDefaultFormToggle');
    this.colorCellsToggle = document.getElementById('colorCellsToggle');
    this.toggleBtn = document.getElementById('toggleItemsBtn'); // Show/Hide Names
    // Guess Cell Controls
    this.guessCellControlsDiv = document.getElementById('guess-cell-controls');
    this.guessGameBtn = document.getElementById('guessGameBtn');
    this.scoreDisplay = document.getElementById('scoreDisplay');
    // Timed Recall Controls
    this.timedRecallControlsDiv = document.getElementById('timed-recall-controls');
    this.recallSlider = document.getElementById('recallSlider');
    this.sliderValueDisplay = document.getElementById('sliderValueDisplay');
    this.recallGameBtn = document.getElementById('recallGameBtn');
    // Debug Controls
    this.debugToggle = document.getElementById('debugToggle');
    this.debugOptionsDiv = document.getElementById('debug-options');
    this.typedSpan = document.getElementById('typedDigits'); // Now inside debug
    this.clearBtn = document.getElementById('clearBtn');    // Now inside debug

    // -- Other UI Elements --
    this.defaultFormDisplay = document.getElementById('defaultFormDisplay');
    this.defaultFormCoordSpan = this.defaultFormDisplay.querySelector('.coord-display');
    this.defaultFormTextSpan = this.defaultFormDisplay.querySelector('.text-display');


    // --- Configuration & Constants ---
    this.AUTO_CLEAR_DELAY = 1500;
    this.STORAGE_KEY = 'gridData_v2';
    this.DEFAULT_FORM_INDEX = 0; // e.g., "Full Name"
    this.INITIAL_CELL_FORM_INDEX = 1; // e.g., "Abbreviation"
    this.FALLBACK_CELL_FORM_INDEX = 1; // Form to use if selected is missing
    this.FEEDBACK_ANIM_DURATION = 500; // ms, should match CSS animation

    // --- State variables ---
    this.inputCoords = ''; // For explore mode coord input
    this.autoClearId = null; // Timer for explore input feedback clear
    this.data = null; // Loaded grid data {meta, items}
    this.currentLang = 'en'; // Selected language code
    this.currentForm = this.INITIAL_CELL_FORM_INDEX; // Selected form index for cell display
    this.cellMap = {}; // Cache: { "CR": tdElement }
    this.numRows = 0; // From data.meta
    this.numCols = 0; // From data.meta
    this.categories = {}; // From data.meta { id: { name, color } }
    // Settings state
    this.showDefaultFormAboveGrid = false; // Explore mode setting
    this.useCategoryColors = false; // Explore mode setting
    this.showDebugOptions = false; // Setting panel setting
    // Game State
    this.gameState = {
        mode: 'explore', // 'explore', 'guess-cell', 'timed-recall'
        isActive: false, // Is a game currently running?
        currentPrompt: null, // Info for current game item: { coord, itemData }
        score: 0, // For Guess the Cell game
        timerId: null, // For Timed Recall loop timer
        recallDuration: 3 // Default seconds for Timed Recall delay
    };

    // Initialize the application
    this.init();
  }

  // --- Initialization ---

  async init() {
    try {
        this.loadSettings(); // Load saved UI settings (toggles, slider value)
        this.bindEvents();   // Setup event listeners
        this.initSettingsToggle(); // Setup settings panel open/close/focus
        this.updateSettingsUI(); // Apply loaded settings to UI elements

        await this.loadData(); // Load grid data (localStorage or fetch)

        this.updateFeedback(); // Update typed coords display (if debug enabled)

        if (this.data) {
            // Data loaded successfully, setup the main UI
            console.log("Data loaded successfully, proceeding with UI setup.");
            this.renderGridStructure(); // Build HTML grid
            this.cacheCells();          // Store references to TD elements
            this.populateControlsBasedOnData(); // Fill language/form options
            this.updateGrid();          // Populate cells with initial text
            this.updateGridAppearance();// Apply category colors if needed
        } else {
            // No data could be loaded
            console.warn("Initialization finished, but no valid data was loaded.");
            this.renderEmptyGridMessage(); // Show placeholder/error in grid
        }
        console.log("Initialization sequence complete.");
        // Apply initial UI state for the selected mode (e.g., show/hide controls)
        // Pass true to avoid stopping game on initial load if mode was persisted (though not implemented)
        this.setMode(this.gameState.mode, true);

    } catch (error) {
        // Catch critical errors during the async init process
        console.error("Critical error during GridGame initialization:", error);
        this.notify("Critical error during initialization. App may be unstable. Check console.", "error", 0);
        this.renderEmptyGridMessage(); // Show error state
    }
  }

  // --- Settings Persistence (Basic Example using localStorage) ---

  loadSettings() {
      // Load UI preference settings
      this.showDefaultFormAboveGrid = localStorage.getItem('showDefaultForm') === 'true';
      this.useCategoryColors = localStorage.getItem('useCategoryColors') === 'true';
      this.showDebugOptions = localStorage.getItem('showDebugOptions') === 'true';
      this.gameState.recallDuration = parseInt(localStorage.getItem('recallDuration') || '3', 10);
      // Could potentially load last used language/form index here too
      // Could load last mode: this.gameState.mode = localStorage.getItem('lastMode') || 'explore';
  }

  saveSetting(key, value) {
      // Helper to save a setting to localStorage
      try {
          localStorage.setItem(key, value);
      } catch (e) {
          console.warn(`Could not save setting ${key}:`, e);
          // Handle potential storage quota errors if necessary
      }
  }

  updateSettingsUI() {
      // Reflect loaded/current settings state in the UI controls
      this.showDefaultFormToggle.checked = this.showDefaultFormAboveGrid;
      this.colorCellsToggle.checked = this.useCategoryColors;
      this.debugToggle.checked = this.showDebugOptions;
      this.debugOptionsDiv.hidden = !this.showDebugOptions; // Show/hide debug section
      this.recallSlider.value = this.gameState.recallDuration;
      this.sliderValueDisplay.textContent = this.gameState.recallDuration;

      // Persisted body classes (e.g., show/hide item names)
      const itemsVisible = localStorage.getItem('itemsVisible') === 'true';
      document.body.classList.toggle('items-visible', itemsVisible);
      this.toggleBtn.textContent = itemsVisible ? 'Hide Names' : 'Show Names'; // Update button text
      document.body.classList.toggle('category-colors-visible', this.useCategoryColors); // Apply category color class

      // Set the correct mode radio button based on current state
      const currentModeRadio = document.querySelector(`input[name="gameMode"][value="${this.gameState.mode}"]`);
      if (currentModeRadio) currentModeRadio.checked = true;

      this.updateDefaultFormDisplayVisibility(); // Apply initial visibility for the top display
      this.updateGridAppearance(); // Apply category colors if needed
  }


  // --- Event Binding ---

  bindEvents() {
    // Settings Panel Toggle/Focus handled by initSettingsToggle

    // File Import Button
    this.importInput.addEventListener('change', e => this.handleFile(e));

    // Mode Selection Radio Buttons
    this.modeRadios.forEach(radio => radio.addEventListener('change', (e) => {
        this.setMode(e.target.value);
        // Optional: persist last selected mode
        // this.saveSetting('lastMode', e.target.value);
    }));

    // --- Explore Mode Controls ---
    this.langSelect.addEventListener('change', e => {
      this.currentLang = e.target.value;
      this.updateGrid(); // Update cell text
      this.updateDefaultFormDisplay(); // Update highlight info if shown in explore mode
    });
    this.showDefaultFormToggle.addEventListener('change', e => {
        this.showDefaultFormAboveGrid = e.target.checked;
        this.saveSetting('showDefaultForm', this.showDefaultFormAboveGrid); // Persist
        this.updateDefaultFormDisplayVisibility();
        // Update content if explore mode & cell highlighted
        if (this.gameState.mode === 'explore' && this.table.querySelector('td.highlight')) {
            this.updateDefaultFormDisplay();
        }
    });
    this.colorCellsToggle.addEventListener('change', e => {
        this.useCategoryColors = e.target.checked;
        this.saveSetting('useCategoryColors', this.useCategoryColors); // Persist
        document.body.classList.toggle('category-colors-visible', this.useCategoryColors);
        this.updateGridAppearance();
    });
     this.toggleBtn.addEventListener('click', () => this.toggleItems()); // Show/Hide names

     // --- Game Control Buttons ---
     this.guessGameBtn.addEventListener('click', () => this.toggleGameState('guess-cell'));
     this.recallGameBtn.addEventListener('click', () => this.toggleGameState('timed-recall'));

     // --- Timed Recall Slider ---
     this.recallSlider.addEventListener('input', e => {
         const newDuration = parseInt(e.target.value, 10);
         this.gameState.recallDuration = newDuration;
         this.sliderValueDisplay.textContent = newDuration; // Update display
         this.saveSetting('recallDuration', newDuration); // Persist
         // Change takes effect on the *next* timed recall cycle if game is active
     });

    // --- Debug Controls ---
    this.debugToggle.addEventListener('change', e => {
        this.showDebugOptions = e.target.checked;
        this.saveSetting('showDebugOptions', this.showDebugOptions); // Persist
        this.debugOptionsDiv.hidden = !this.showDebugOptions; // Show/hide section
    });
    // Clear button now inside debug section
    this.clearBtn.addEventListener('click', () => this.clearInput());

    // --- Global / Grid Listeners ---
    document.addEventListener('keydown', e => this.handleKey(e));
    this.table.addEventListener('click', e => {
      // Use event delegation to handle clicks on TD elements
      const td = e.target.closest('td[data-col][data-row]');
      if (td) this.handleCellClick(td);
    });
  }

  // --- Mode Switching & Game State Management ---

  setMode(newMode, isInitialSetup = false) {
      console.log(`Setting mode to: ${newMode}`);
      // Stop active game if mode changes
      if (!isInitialSetup && this.gameState.mode !== newMode) {
          this.stopCurrentGame();
      }

      this.gameState.mode = newMode;

      // --- Update Active Mode in Settings Panel ---
      // Remove 'active' class from all sections
      document.querySelectorAll('.settings-section[data-mode]').forEach(section => {
          section.classList.remove('active');
      });
      // Add 'active' to the current mode's section
      const activeSection = this.settingsPanel.querySelector(`.settings-section[data-mode="${newMode}"]`);
      if (activeSection) {
          activeSection.classList.add('active');
          activeSection.hidden = false; // Ensure visibility
      }

      // --- Reset Game-Specific UI ---
      if (!isInitialSetup) {
          this.clearHighlight();
          this.clearDefaultFormDisplay();
          this.guessGameBtn.textContent = 'Start Game';
          this.guessGameBtn.classList.remove('active');
          this.recallGameBtn.textContent = 'Start Game';
          this.recallGameBtn.classList.remove('active');
          this.scoreDisplay.textContent = 'Score: 0';
      }

      // --- Disable Explore Controls During Games ---
      const disableExploreControls = (newMode !== 'explore') || this.gameState.isActive;
      const dataLoaded = !!this.data;

      // Update element states
      this.langSelect.disabled = disableExploreControls || !dataLoaded;
      this.formDiv.querySelectorAll('input[type="radio"]').forEach(r => {
          r.disabled = disableExploreControls || !dataLoaded;
      });
      this.showDefaultFormToggle.disabled = disableExploreControls || !dataLoaded;
      this.colorCellsToggle.disabled = disableExploreControls || !dataLoaded;
      this.toggleBtn.disabled = disableExploreControls || !dataLoaded;

      // Enable game buttons if data is loaded
      this.guessGameBtn.disabled = !dataLoaded;
      this.recallGameBtn.disabled = !dataLoaded;
  }

  toggleGameState(modeForButton) {
      // Called when a game's Start/Stop button is clicked
      if (this.gameState.mode !== modeForButton) {
          // Should not happen if buttons are correctly enabled/disabled by setMode
          console.warn(`Start/Stop button pressed for inactive mode: ${modeForButton}`);
          return;
      }
      if (this.gameState.isActive) {
          this.stopCurrentGame();
      } else {
          this.startGame();
      }
  }

  startGame() {
      // Starts the game corresponding to the current mode
      if (!this.data) {
          this.notify("Cannot start game: No data loaded.", "error");
          return;
      }
      if (this.gameState.mode === 'explore') return; // Cannot start game in explore mode

      console.log(`Starting game: ${this.gameState.mode}`);
      this.gameState.isActive = true;
      this.gameState.score = 0; // Reset score for guess game
      this.scoreDisplay.textContent = `Score: ${this.gameState.score}`;
      this.clearHighlight(); // Clear any previous highlight
      this.clearDefaultFormDisplay(); // Clear previous prompt/info

      // Disable non-game controls and update button state via setMode
    //   this.setMode(this.gameState.mode);

      // Update the specific game button to "Stop" state
      const btn = this.gameState.mode === 'guess-cell' ? this.guessGameBtn : this.recallGameBtn;
      btn.textContent = 'Stop Game';
      btn.classList.add('active'); // Add class for Stop styling (e.g., red)
      // Disable explore controls manually:
      this.langSelect.disabled = true;
      this.formDiv.querySelectorAll('input[type="radio"]').forEach(r => r.disabled = true);
      this.showDefaultFormToggle.disabled = true;
      this.colorCellsToggle.disabled = true;
      this.toggleBtn.disabled = true;

      // Start the specific game loop
      if (this.gameState.mode === 'guess-cell') {
          this.nextGuessCellPrompt(); // Display first prompt
      } else if (this.gameState.mode === 'timed-recall') {
          this.startTimedRecallLoop(); // Start the timed sequence
      }
  }

  stopCurrentGame() {
      // Stops any active game and resets state
      if (!this.gameState.isActive) return; // No game active
      const stoppedMode = this.gameState.mode; // Remember which mode was stopped
      console.log(`Stopping game: ${stoppedMode}`);

      // Clear any active timers (crucial for timed recall)
      if (this.gameState.timerId) {
          clearTimeout(this.gameState.timerId);
          this.gameState.timerId = null;
      }

      // Reset game state variables
      this.gameState.isActive = false;
      this.gameState.currentPrompt = null;
      // Keep score? Or reset here? Let's keep score until next start.

      // Ensure UI is clean after stopping
      // Make sure any hidden text (from timed recall) is visible upon stopping
      const highlighted = this.table.querySelector('td.highlight');
      if (highlighted) {
           const span = highlighted.querySelector('.item-name');
           if (span) span.style.visibility = 'visible';
      }
      this.clearHighlight(); // Clear highlight
      this.clearDefaultFormDisplay(); // Clear prompt area

      // Re-enable controls for the mode we just stopped and reset button text
      this.setMode(stoppedMode);
  }

  // --- Utility Functions ---

   getRandomItem() {
      // Finds a random, valid (non-null) item coordinate from the data
      if (!this.data || !this.data.items) return null;
      // Get coordinates of items that have data (are not null)
      const validCoords = Object.keys(this.data.items).filter(coord => this.data.items[coord] !== null);
      if (validCoords.length === 0) {
          console.warn("getRandomItem: No valid items found in data.");
          return null; // No items to choose from
      }

      // Avoid picking the same item twice in a row if possible
      let randomCoord;
      let maxTries = 5; // Limit attempts to avoid infinite loop if only 1 item
      do {
          // Pick a random index from the valid coordinates array
          randomCoord = validCoords[Math.floor(Math.random() * validCoords.length)];
          maxTries--;
      } while (
          validCoords.length > 1 && // Only avoid repeat if there's > 1 choice
          this.gameState.currentPrompt?.coord === randomCoord && // Check if it's same as last prompt
          maxTries > 0 // Ensure loop terminates
      );

      // Return the coordinate and the corresponding item data
      return { coord: randomCoord, itemData: this.data.items[randomCoord] };
  }

   applyFeedbackAnimation(td, isCorrect) {
        // Adds a temporary CSS class for visual feedback on click/guess
        const className = isCorrect ? 'feedback-correct' : 'feedback-wrong';
        td.classList.add(className);
        // Use requestAnimationFrame to ensure the class is applied before setting timeout
        requestAnimationFrame(() => {
            setTimeout(() => {
                td.classList.remove(className); // Remove class after animation duration
            }, this.FEEDBACK_ANIM_DURATION);
        });
    }

  // --- Game Mode Logic Implementation ---

  nextGuessCellPrompt() {
       // Sets up the next prompt for the "Guess the Cell" game
       if (!this.gameState.isActive || this.gameState.mode !== 'guess-cell') return; // Safety checks

       const promptItem = this.getRandomItem(); // Get a random valid item
       if (!promptItem) {
           this.notify("No valid items found to continue game.", "error");
           this.stopCurrentGame(); // Stop if no items available
           return;
       }
       this.gameState.currentPrompt = promptItem; // Store the item to be guessed
       const r = promptItem.coord[1];
       const c = promptItem.coord[0];
       // Get the Full Name form for the prompt text
       const fullName = this.getItem(r, c, this.DEFAULT_FORM_INDEX);
       console.log("Prompting:", fullName, "@", promptItem.coord); // Debugging log

       // Update the prompt display area above the grid
       this.updateDefaultFormDisplay('Guess:', fullName || '???'); // Use helper

       this.clearHighlight(); // Ensure no previous highlight remains
  }

  startTimedRecallLoop() {
      // Starts or continues the Timed Recall game loop
      if (!this.gameState.isActive || this.gameState.mode !== 'timed-recall') return; // Safety checks

      clearTimeout(this.gameState.timerId); // Clear any previous timer
      this.clearHighlight(); // Clear previous highlight immediately

      const promptItem = this.getRandomItem(); // Get a random valid item
       if (!promptItem) {
           this.notify("No valid items found to continue game.", "error");
           this.stopCurrentGame();
           return;
       }
      this.gameState.currentPrompt = promptItem; // Store the current item
      const { coord } = promptItem;
      const c = coord[0];
      const r = coord[1];
      console.log("Timed Recall:", coord, `Delay: ${this.gameState.recallDuration}s`); // Debugging log

      // Update the prompt display area to show the coordinates
      this.updateDefaultFormDisplay('Locate:', `${c},${r}`); // Use helper

       // Highlight the target cell BUT hide its content initially
       const td = this.cellMap[coord]; // Get cell element from cache
       if(td) {
            // highlight() applies class and category color
            this.highlight(coord);
            // Ensure highlight doesn't clear our prompt
            this.updateDefaultFormDisplay('Locate:', `${c},${r}`);

            // Hide the text content within the cell
            const span = td.querySelector('.item-name');
            if(span) {
                 span.style.visibility = 'hidden';
            }

            // Start the timer to reveal the content after the specified duration
            this.gameState.timerId = setTimeout(() => this.revealTimedRecallItem(td, coord), this.gameState.recallDuration * 1000);
       } else {
            // Should not happen if data is valid, but handle defensively
            console.error(`Cell not found in cellMap for coord: ${coord}. Skipping.`);
            // Try the next item quickly to avoid getting stuck
            this.gameState.timerId = setTimeout(() => this.startTimedRecallLoop(), 500);
       }
  }

   revealTimedRecallItem(td, coord) {
        // Called by the timer in startTimedRecallLoop to reveal the cell content
        // Safety check: Ensure game is still active and the prompt hasn't changed
        if (!this.gameState.isActive || this.gameState.mode !== 'timed-recall' || !this.gameState.currentPrompt || this.gameState.currentPrompt.coord !== coord) {
            console.log("Reveal cancelled: Game stopped or prompt changed during delay.");
            return; // Don't proceed if state changed
        }

        console.log("Revealing:", coord); // Debugging log
        if(td) {
            // Make the text content visible again
            const span = td.querySelector('.item-name');
            if(span) {
                 span.style.visibility = 'visible';
            }
        } else {
             console.warn(`TD element missing during reveal for ${coord}`);
        }

        // Start the timer for the *next* item in the loop
        // Pause duration after reveal can be same as recall duration or different
        const pauseDuration = this.gameState.recallDuration * 1000;
        this.gameState.timerId = setTimeout(() => this.startTimedRecallLoop(), pauseDuration);
   }

  // --- Core Grid/UI Logic Methods ---

  handleCellClick(td) {
    // Handles clicks on grid cells, behavior depends on the current mode
    const coords = td.dataset.col + td.dataset.row; // Get "CR" coordinate string

    if (this.gameState.mode === 'explore') {
        // Explore Mode: Highlight clicked cell, show info if enabled
        if (this.gameState.isActive) return; // Should not be active
        this.clearAutoClear(); // Clear input feedback timer if running
        this.inputCoords = coords; // Update debug display if shown
        this.updateFeedback();
        this.clearHighlight(); // Clear previous highlight
        this.highlight(coords); // Highlight the new cell
    }
    else if (this.gameState.mode === 'guess-cell') {
        // Guess the Cell Game Mode: Check if the guess is correct
        if (!this.gameState.isActive || !this.gameState.currentPrompt) return; // Game not running or no prompt yet

        const correctCoord = this.gameState.currentPrompt.coord;
        const isCorrect = (coords === correctCoord);

        this.applyFeedbackAnimation(td, isCorrect); // Provide visual feedback (green/red flash)

        if (isCorrect) {
            // Correct Guess
            console.log("Correct Guess!");
            this.gameState.score++; // Increment score
            this.scoreDisplay.textContent = `Score: ${this.gameState.score}`; // Update score display
            // Optional: Briefly show correct cell content (highlight does this implicitly)
            // this.highlight(coords);

            // Move to the next prompt after a short delay (longer than animation)
            const nextPromptTimer = setTimeout(() => {
                // Double-check game wasn't stopped during the delay
                if (this.gameState.isActive && this.gameState.mode === 'guess-cell') {
                     this.nextGuessCellPrompt();
                }
            }, this.FEEDBACK_ANIM_DURATION + 150);
        } else {
            // Incorrect Guess
            console.log("Incorrect Guess.");
            // Feedback animation already shown. Prompt remains the same.
        }
    }
    else if (this.gameState.mode === 'timed-recall') {
        // Timed Recall Game Mode: Clicks currently do nothing
        if (!this.gameState.isActive) return;
        console.log("Click ignored during Timed Recall game.");
        // Alternative: Could implement stopping the game on click
        // this.stopCurrentGame();
    }
  }

  handleKey(e) {
      // Handles global keydown events

      // --- Escape Key: Universal Stop/Close ---
      if (e.key === 'Escape') {
          e.preventDefault();
          if (this.gameState.isActive) {
              // If a game is active, Escape stops it
              this.stopCurrentGame();
              return; // Escape's job is done
          }
          // If no game active, Escape closes settings or clears explore input
          if (this.settingsPanel.classList.contains('open')) {
              this.closeSettingsPanel();
          } else {
              this.clearInput(); // Clear explore input/highlight
          }
          return; // Escape's job is done
      }

      // --- Ignore other keys if game is active or focus is inappropriate ---
      if (
          this.gameState.isActive || // Ignore number/backspace if game running
          e.ctrlKey || e.altKey || e.metaKey || // Ignore modified keys
          ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || // Ignore if focus is in form elements
          (this.settingsPanel.contains(e.target) && e.key !== 'Escape') // Ignore keys within open settings panel (except Escape)
      ) {
          return; // Do nothing further
      }

      // --- Explore Mode Key Handling (Digit Input & Backspace) ---
      if (this.gameState.mode === 'explore') {
          const key = e.key;
          // Handle Digit Input (0-9)
          if (key >= '0' && key <= '9') {
              e.preventDefault();
              this.clearAutoClear(); // Clear feedback timer
              // Build coordinate string (max 2 digits)
              if (this.inputCoords.length < 2) {
                  this.inputCoords += key;
                  this.updateFeedback(); // Update debug display
                  if (this.inputCoords.length === 2) {
                      // Two digits entered, attempt highlight
                      this.clearHighlight(); // Clear previous highlight first
                      if (this.highlight(this.inputCoords)) {
                          // Valid coords highlighted, schedule feedback clear
                          this.scheduleClear();
                      } else {
                          // Invalid coords typed
                          this.notify(`Invalid coords: ${this.inputCoords}`, 'error', 1500);
                          this.clearInput(); // Clear the invalid input
                      }
                  } else {
                      // Only one digit typed, ensure no highlight is active
                      this.clearHighlight();
                  }
              } else {
                  // Already had 2 digits, replace with the new digit
                  this.inputCoords = key;
                  this.updateFeedback();
                  this.clearHighlight(); // Clear previous highlight
              }
          }
          // Handle Backspace Key
          else if (key === 'Backspace') {
              e.preventDefault();
              this.clearAutoClear(); // Clear feedback timer
              this.inputCoords = this.inputCoords.slice(0, -1); // Remove last digit
              this.updateFeedback();
              // If less than 2 digits remain, clear any highlight
              if (this.inputCoords.length < 2) {
                  this.clearHighlight();
              }
          }
      }
  }

  initSettingsToggle() {
    // Handles opening/closing the settings panel and focus management
    this.settingsBtn.setAttribute('aria-expanded', 'false');
    this.settingsPanel.setAttribute('aria-hidden', 'true');

    this.settingsBtn.addEventListener('click', () => {
      const isOpen = this.settingsPanel.classList.toggle('open');
      this.settingsPanel.setAttribute('aria-hidden', String(!isOpen));
      this.settingsBtn.setAttribute('aria-expanded', String(isOpen));

      if (isOpen) {
        // Move focus into the panel after transition starts
        requestAnimationFrame(() => {
             this.settingsPanel.focus(); // Focus panel first for context
        });
      } else {
          // Return focus to the toggle button when closing via click
          this.settingsBtn.focus();
      }
    });

    // Close panel if clicked outside
    document.addEventListener('click', e => {
      if (
        this.settingsPanel.classList.contains('open') &&
        !this.settingsPanel.contains(e.target) && // Click outside panel
        !this.settingsBtn.contains(e.target)      // Not on toggle button
      ) {
        this.closeSettingsPanel(false); // Close without refocusing toggle (Escape handler does that)
      }
    });

    // Allow Enter/Space on gear button for accessibility
    this.settingsBtn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.settingsBtn.click(); // Trigger the click handler
      }
    });
  }

  closeSettingsPanel(refocusToggle = true) {
      // Closes the settings panel programmatically
      if (this.settingsPanel.classList.contains('open')) {
          this.settingsPanel.classList.remove('open');
          this.settingsPanel.setAttribute('aria-hidden', 'true');
          this.settingsBtn.setAttribute('aria-expanded', 'false');
          if (refocusToggle) {
               this.settingsBtn.focus(); // Return focus to button (e.g., after Escape)
          }
      }
  }

  updateFeedback() {
      // Updates the "Typed: " display in the debug section
      if (this.typedSpan) { // Check if element exists (might be removed)
          this.typedSpan.textContent = this.inputCoords || '--';
      }
  }

  notify(msg, type = 'info', clearAfter = 3000) {
      // Displays temporary notifications
      console.log(`Notification (${type}): ${msg}`); // Log for debugging
      this.notifyEl.textContent = msg;
      this.notifyEl.setAttribute('type', type); // For CSS styling
      this.notifyEl.hidden = false; // Make visible
      // Clear previous timeout if any
      clearTimeout(this._notifTimeout);
      // Set new timeout to hide notification (if clearAfter > 0)
      if (clearAfter > 0) {
          this._notifTimeout = setTimeout(() => { this.notifyEl.hidden = true; }, clearAfter);
      }
  }

  updateDefaultFormDisplayVisibility() {
      // Controls visibility of the area above the grid based on mode and toggle state
      const isExploreAndToggleOn = (this.gameState.mode === 'explore' && this.showDefaultFormAboveGrid);
      const isGameActive = this.gameState.isActive; // Show prompt area during games

      this.defaultFormDisplay.hidden = !(isExploreAndToggleOn || isGameActive);

      // Clear content if hiding
      if (this.defaultFormDisplay.hidden) {
          this.clearDefaultFormDisplay();
      }
  }

  updateDefaultFormDisplay(label = null, text = null) {
      // Updates the content of the display area (used for explore info or game prompts)
      if (label !== null && text !== null) {
          this.defaultFormCoordSpan.textContent = label; // e.g., "Guess:", "Locate:", "C,R"
          this.defaultFormTextSpan.textContent = text || '---'; // e.g., "Full Name", "---"
          // Ensure it's visible if setting content (visibility logic might hide it otherwise)
          this.updateDefaultFormDisplayVisibility(); // Recalculate visibility based on current state
      } else {
          // Clear if called with nulls
          this.clearDefaultFormDisplay();
      }
  }

  clearDefaultFormDisplay() {
      // Resets the display area text
      this.defaultFormCoordSpan.textContent = '--';
      this.defaultFormTextSpan.textContent = '---';
      // Visibility is handled by updateDefaultFormDisplayVisibility
  }

  clearAutoClear() {
      // Clears the timer for the explore mode input feedback
      if (this.autoClearId) {
          clearTimeout(this.autoClearId);
          this.autoClearId = null;
      }
  }

  scheduleClear() {
      // Sets timer to clear the explore mode input feedback display
      this.clearAutoClear();
      this.autoClearId = setTimeout(() => {
          this.inputCoords = ''; // Clear the coordinate string state
          this.updateFeedback(); // Update the UI display
          this.autoClearId = null;
      }, this.AUTO_CLEAR_DELAY);
  }

  clearHighlight() {
      // Removes highlight and ensures text visibility is reset
      const prev = this.table.querySelector('td.highlight');
      if (prev) {
          prev.classList.remove('highlight');
          prev.style.removeProperty('--highlight-cell-bg'); // Remove category bg override
          // Ensure text visibility reset (important for timed recall stop)
          const span = prev.querySelector('.item-name');
          if (span) span.style.visibility = 'visible';
      }
  }

  highlight(coords) {
      // Highlights a cell by coordinate string "CR", returns the TD element or null
      // Assumes clearHighlight was called before if replacing highlight
      const td = this.cellMap[coords];
      if (!td) {
          console.warn(`Highlight failed: Cell not found for coords ${coords}`);
          return null; // Cell doesn't exist in cache
      }

      td.classList.add('highlight'); // Apply highlight class

      // Apply category background color using CSS variable
      const categoryId = td.dataset.category || 'unknown';
      const categoryColor = this.categories[categoryId]?.color || this.categories['unknown']?.color || null; // Use unknown color if defined, else null
      if (categoryColor) {
          td.style.setProperty('--highlight-cell-bg', categoryColor);
      } else {
           // Ensure default highlight if no category color (remove variable)
           td.style.removeProperty('--highlight-cell-bg');
      }

      // Update the top display area ONLY if in explore mode AND toggle is on
      if (this.gameState.mode === 'explore') {
            if (this.showDefaultFormAboveGrid) {
                const c = coords[0];
                const r = coords[1];
                const defaultFormText = this.getItem(r, c, this.DEFAULT_FORM_INDEX);
                this.updateDefaultFormDisplay(`${c},${r}`, defaultFormText); // Show coords C,R format
            } else {
                // If toggle is off in explore mode, ensure prompt area is cleared/hidden
                this.clearDefaultFormDisplay();
            }
      }
      // Game modes handle their own prompt display updates separately

      return td; // Return the highlighted element
  }


  toggleItems() {
      // Toggles visibility of item names in cells (via body class) - primarily affects explore mode
      const becomingVisible = document.body.classList.toggle('items-visible');
      this.saveSetting('itemsVisible', becomingVisible); // Persist state
      this.toggleBtn.textContent = becomingVisible ? 'Hide Names' : 'Show Names';
      this.toggleBtn.title = becomingVisible ? 'Hide item names' : 'Show item names';
      // Update category background colors based on new visibility state
      this.updateGridAppearance();
  }

  clearInput() {
      // Clears the coordinate input feedback (debug display) and explore mode highlight/prompt
      this.inputCoords = '';
      this.updateFeedback();
      this.clearAutoClear(); // Clear feedback timer
      // Only clear highlight/prompt if currently in explore mode
      if (this.gameState.mode === 'explore') {
          this.clearHighlight();
          this.clearDefaultFormDisplay();
      }
  }

  renderEmptyGridMessage() {
      // Displays a message in the grid body when no data is loaded or error occurs
      const colspan = this.numCols || 1; // Use loaded cols or default to 1
      this.gridBody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center; padding: 20px; cursor: default;">No data loaded or initialization error. Please load a valid JSON file via settings.</td></tr>`;
      // Disable controls that depend on data
      this.langSelect.disabled = true;
      this.formDiv.innerHTML = '<span>Display Form (in grid):</span><div>--</div>';
      this.showDefaultFormToggle.disabled = true;
      this.colorCellsToggle.disabled = true;
      this.toggleBtn.disabled = true;
      this.guessGameBtn.disabled = true;
      this.recallGameBtn.disabled = true;
      // Ensure header row is minimal
      const headRow = this.table.querySelector('thead tr');
      if (headRow) headRow.innerHTML = '<th scope="col" class="corner-cell"></th>';
  }

  renderGridStructure() {
      // Builds the HTML structure (headers, rows, cells) based on loaded data dimensions
      if (!this.data || !this.data.meta || this.numRows === 0 || this.numCols === 0) {
          console.error("Cannot render grid structure: Invalid data or dimensions.");
          this.renderEmptyGridMessage();
          return;
      }

      // --- Render Column Headers ---
      const headRow = this.table.querySelector('thead tr');
      headRow.innerHTML = '<th scope="col" class="corner-cell" aria-label="Corner cell"></th>'; // Reset headers
      for (let c = 0; c < this.numCols; c++) {
          const th = document.createElement('th');
          th.scope = 'col';
          th.textContent = c;
          th.classList.add('col-header');
          headRow.appendChild(th);
      }

      // --- Generate Grid Body ---
      this.gridBody.innerHTML = ''; // Clear previous grid
      for (let r = 0; r < this.numRows; r++) {
          const tr = document.createElement('tr');
          // Create row header cell
          const rowTh = document.createElement('th');
          rowTh.scope = 'row';
          rowTh.textContent = r;
          rowTh.classList.add('row-header');
          tr.appendChild(rowTh);
          // Create data cells
          for (let c = 0; c < this.numCols; c++) {
              const td = document.createElement('td');
              const coord = `${c}${r}`;
              td.dataset.row = r;
              td.dataset.col = c;
              td.setAttribute('role', 'gridcell');
              td.setAttribute('tabindex', '-1'); // For potential future keyboard nav
              td.setAttribute('aria-label', `Cell ${c},${r}`);
              // Store category directly on the element for easier access later
              const itemData = this.data.items[coord];
              const categoryId = itemData?.category || 'unknown'; // Default if missing
              td.dataset.category = categoryId;

              // Add span for item name display
              const span = document.createElement('span');
              span.className = 'item-name';
              td.appendChild(span);
              tr.appendChild(td);
          }
          this.gridBody.appendChild(tr);
      }
  }

  cacheCells() {
      // Creates the cellMap for quick lookup of TD elements by "CR" coordinate
      this.cellMap = {};
      this.gridBody.querySelectorAll('td[data-col][data-row]').forEach(td => {
          this.cellMap[td.dataset.col + td.dataset.row] = td;
      });
      console.log(`Cached ${Object.keys(this.cellMap).length} cells.`);
  }

  // --- Data Handling Methods ---

  async handleFile(e) {
      // Handles loading data from a user-selected JSON file
      // Stop any active game before loading new data
      this.stopCurrentGame();

      const file = e.target.files[0];
      if (!file) { this.notify('No file selected.', 'info', 2000); return; }
      if (!file.type.includes('json')) { this.notify('Invalid file type. Please select a .json file', 'error'); e.target.value = ''; return; }

      const reader = new FileReader();
      reader.onload = async () => {
          try {
              const parsed = JSON.parse(reader.result);
              this.validateData(parsed); // Validate the structure and content
              this.data = parsed; // Assign new data
              this.persistData(parsed); // Save to localStorage
              // Reload UI completely based on new data
              await this.onDataLoaded();
              this.notify('Data loaded successfully!', 'success');
              // Reset to explore mode after loading new data for predictability
              this.setMode('explore');
              const exploreRadio = document.querySelector('input[name="gameMode"][value="explore"]');
              if(exploreRadio) exploreRadio.checked = true; // Update radio button selection
          } catch (err) {
              // Handle errors during file reading, parsing, or validation
              this.notify(`Error loading file: ${err.message}`, 'error', 5000);
              console.error("File loading/parsing error:", err);
              // Decide error behavior: Clear grid? Show message? Keep old data?
              // Currently keeps old data loaded if validation fails.
          } finally {
              e.target.value = ''; // Reset file input
          }
      };
      reader.onerror = () => {
          // Handle file reading errors
          this.notify(`Error reading file: ${reader.error}`, 'error', 5000);
          console.error("File Reader error:", reader.error);
          e.target.value = '';
      };
      reader.readAsText(file); // Start reading the file
  }

  validateData(d) {
      // Validates the structure and basic content rules of the loaded JSON data
      console.log("Validating data structure...");
      if (typeof d !== 'object' || d === null) throw new Error('Data must be an object.');
      if (!d.meta || typeof d.meta !== 'object') throw new Error("Missing or invalid 'meta' object.");
      if (!d.items || typeof d.items !== 'object') throw new Error("Missing or invalid 'items' object.");

      const { meta } = d;
      // Validate Meta Fields
      if (typeof meta.rows !== 'number' || !Number.isInteger(meta.rows) || meta.rows <= 0 || meta.rows > 10) throw new Error('meta.rows must be an integer between 1 and 10.');
      if (typeof meta.cols !== 'number' || !Number.isInteger(meta.cols) || meta.cols <= 0 || meta.cols > 10) throw new Error('meta.cols must be an integer between 1 and 10.');
      if (!meta.languages || typeof meta.languages !== 'object' || Object.keys(meta.languages).length === 0) throw new Error("Missing, invalid, or empty 'meta.languages' object.");
      if (!meta.defaultLanguage || !meta.languages[meta.defaultLanguage]) throw new Error("meta.defaultLanguage is missing or not found in meta.languages.");
      if (!meta.forms || !Array.isArray(meta.forms) || meta.forms.length === 0) throw new Error("Missing, invalid, or empty 'meta.forms' array.");
      if (typeof meta.categories !== 'object' || meta.categories === null) throw new Error("Missing or invalid 'meta.categories' object.");

      // Validate Categories structure
      for(const catId in meta.categories) {
           const category = meta.categories[catId];
           if (typeof category !== 'object' || typeof category.name !== 'string' || !category.name.trim() || typeof category.color !== 'string' || !category.color.match(/^#[0-9a-fA-F]{6}$/)) {
               throw new Error(`Invalid category definition for '${catId}'. Must have non-empty name (string) and 6-digit hex color (string, e.g., '#ff0000').`);
           }
       }
       // Warn if 'unknown' category isn't explicitly defined, but don't error yet
       if (!meta.categories.unknown) {
           console.warn("Data validation: 'unknown' category not found in meta.categories. Items referencing 'unknown' will use a default style.");
       }

      // Validate Items structure
      const numForms = meta.forms.length;
      for (const coord in d.items) {
          // Check coordinate format "CR" (0-9 for each)
          if (!coord.match(/^[0-9]{2}$/)) throw new Error(`Invalid item coordinate format: '${coord}'. Expected 'CR' (e.g., '00', '23').`);
          const c = parseInt(coord[0], 10);
          const r = parseInt(coord[1], 10);
          // Check coordinate bounds
          if (c >= meta.cols || r >= meta.rows) throw new Error(`Item coordinate '${coord}' is outside grid dimensions (${meta.cols}x${meta.rows}).`);

          const item = d.items[coord];
          // Allow null items (representing empty cells explicitly)
          if (item === null) continue;

          // Check item is an object if not null
          if (typeof item !== 'object') throw new Error(`Item data for '${coord}' must be an object or null.`);

          // Check category reference (allow 'unknown' even if not in meta.categories)
          if (typeof item.category !== 'string' || !item.category.trim()) {
               throw new Error(`Item '${coord}' has missing or empty 'category' field.`);
          }
          if (!meta.categories[item.category] && item.category !== 'unknown') {
              console.warn(`Item '${coord}' category '${item.category}' not found in meta.categories. Will be treated as 'unknown'.`);
              // Could throw an error here for stricter validation:
              // throw new Error(`Item '${coord}' has invalid category reference: '${item.category}'. It must exist in meta.categories or be 'unknown'.`);
          }

          // Check language data structure for the item
          let hasLanguageData = false;
          for (const langCode in item) {
              if (langCode === 'category') continue; // Skip the category key
              hasLanguageData = true; // Mark that this item has some language data
              if (!meta.languages[langCode]) throw new Error(`Item '${coord}' contains data for unknown language '${langCode}' not defined in meta.languages.`);
              // Check that language data is an array matching the number of forms
              if (!Array.isArray(item[langCode]) || item[langCode].length !== numForms) {
                  throw new Error(`Item '${coord}' language '${langCode}' data must be an array with length matching meta.forms (${numForms}). Found length ${item[langCode]?.length}.`);
              }
              // Optional: Check type of form entries (should be string or null)
              // item[langCode].forEach((formText, idx) => {
              //     if (formText !== null && typeof formText !== 'string') {
              //         throw new Error(`Item '${coord}' lang '${langCode}' form index ${idx} must be a string or null.`);
              //     }
              // });
          }
          if (!hasLanguageData) {
               throw new Error(`Item '${coord}' does not contain any language data.`);
          }
      }
      console.log("Data validation passed.");
  }

  async onDataLoaded() {
      // Called after new data is loaded and validated (either from file or initial load)
      if (!this.data) {
           // If data loading failed, ensure grid shows error state
           this.renderEmptyGridMessage();
           return;
      }
      console.log("onDataLoaded: Processing new data...");
      // Update core properties from meta data
      this.numRows = this.data.meta.rows;
      this.numCols = this.data.meta.cols;
      this.categories = this.data.meta.categories || {};

      // Preserve user's language/form selection if still valid in new data
      if (!this.data.meta.languages[this.currentLang]) {
          this.currentLang = this.data.meta.defaultLanguage || Object.keys(this.data.meta.languages)[0];
          console.log(`Current language invalid in new data, reset to: ${this.currentLang}`);
      }
       if (!this.data.meta.forms[this.currentForm] || this.currentForm === this.DEFAULT_FORM_INDEX) {
           // Reset form if invalid or was set to the default form (which isn't selectable)
           this.currentForm = Math.min(this.INITIAL_CELL_FORM_INDEX, this.data.meta.forms.length - 1); // Ensure valid index
            console.log(`Current form invalid/default in new data, reset to index: ${this.currentForm}`);
       }

      // Force stop any active game (should have been stopped by handleFile, but be safe)
      this.stopCurrentGame();

      // Re-render grid structure, cache cells, populate controls, update content
      this.renderGridStructure();
      this.cacheCells();
      this.populateControlsBasedOnData(); // Updates selects/radios based on new data
      this.updateGrid(); // Update cell text based on current lang/form
      this.updateGridAppearance(); // Apply category colors etc. based on current settings

      // Ensure UI reflects potentially updated settings state (like disabled controls)
      this.updateSettingsUI();
      // Re-apply current mode UI state (important if mode wasn't reset, ensures correct controls enabled/disabled)
      this.setMode(this.gameState.mode, true); // Pass true to indicate initial setup context for this data
  }

  populateControlsBasedOnData() {
      // Populates the settings panel controls (language, form) based on loaded this.data
      if (!this.data || !this.data.meta) {
           // Ensure controls are disabled if no data loaded
           this.renderEmptyGridMessage();
           return;
      }
      const { languages = {}, defaultLanguage, forms = [] } = this.data.meta;
      const dataLoaded = true; // Flag for enabling controls

      // --- Populate Language Selector ---
      this.langSelect.innerHTML = ''; // Clear existing options
      const langCodes = Object.keys(languages);
      if (langCodes.length === 0) {
          this.langSelect.innerHTML = '<option value="">-- No Langs --</option>';
          this.langSelect.disabled = true;
      } else {
          langCodes.forEach(code => {
              const option = document.createElement('option');
              option.value = code;
              option.textContent = languages[code] || code; // Use defined name or code
              this.langSelect.appendChild(option);
          });
          // Set the value based on currentLang state (which might have been reset in onDataLoaded)
          this.langSelect.value = this.currentLang;
          // Enable/disable based on data AND if explore mode is active
          this.langSelect.disabled = !dataLoaded || this.gameState.mode !== 'explore';
      }

      // --- Populate Form Selector Radio Buttons (excluding default form) ---
      this.formDiv.innerHTML = '<span>Display Form (in grid):</span>'; // Reset container
      const radioContainer = document.createElement('div');
      radioContainer.className = 'radio-group'; // For styling consistency
      let formOptionsAvailable = false;
      if (forms.length > 1) { // Only show options if there's more than the default
          forms.forEach((formLabel, index) => {
              if (index === this.DEFAULT_FORM_INDEX) return; // Skip default form
              formOptionsAvailable = true;
              const labelEl = document.createElement('label');
              const radioInput = document.createElement('input');
              radioInput.type = 'radio';
              radioInput.name = 'displayForm'; // Group radios
              radioInput.value = index; // Store form index as value
              // Check based on currentForm state (might have been reset)
              radioInput.checked = (index === this.currentForm);
              // Disable based on data and mode
              radioInput.disabled = !dataLoaded || this.gameState.mode !== 'explore';
              // Update state and grid on change
              radioInput.addEventListener('change', () => {
                  this.currentForm = parseInt(radioInput.value, 10);
                  this.updateGrid(); // Update cell content
              });
              labelEl.appendChild(radioInput);
              const labelText = document.createElement('span');
              labelText.textContent = ` ${formLabel || `Form ${index + 1}`}`; // Use label or default
              labelEl.appendChild(labelText);
              radioContainer.appendChild(labelEl);
          });
      }

      if (!formOptionsAvailable) {
          // If only default form exists (or none), display message
          radioContainer.textContent = '(Only one display form available)';
          // Ensure currentForm state is valid if only default exists
          if (forms.length <= 1) this.currentForm = 0;
      }
      this.formDiv.appendChild(radioContainer);

      // --- Enable/Disable other controls based on data and mode ---
      const disableExploreControls = (this.gameState.mode !== 'explore');
      this.toggleBtn.disabled = !dataLoaded || disableExploreControls;
      this.showDefaultFormToggle.disabled = !dataLoaded || disableExploreControls;
      this.colorCellsToggle.disabled = !dataLoaded || disableExploreControls;
      // Game buttons depend only on data loaded status
      this.guessGameBtn.disabled = !dataLoaded;
      this.recallGameBtn.disabled = !dataLoaded;
  }

  getItem(r, c, formIndex) {
      // Retrieves the display string for a given cell and form index, with fallbacks
      if (!this.data || !this.data.items) return ''; // No data
      const coordKey = `${c}${r}`;
      const itemEntry = this.data.items[coordKey];
      if (!itemEntry || typeof itemEntry !== 'object') return ''; // Cell is empty (null) or invalid

      const defaultLangCode = this.data.meta?.defaultLanguage || 'en';
      const currentLangData = itemEntry[this.currentLang]; // Array of forms for current lang
      const defaultLangData = itemEntry[defaultLangCode]; // Array of forms for default lang

      let text = null; // Use null to distinguish from empty string ""

      // --- Fallback Logic ---
      // 1. Current Lang / Requested Form Index
      text = currentLangData?.[formIndex] ?? text;
      if (text !== null) return String(text); // Found, return (even if "")

      // 2. Default Lang / Requested Form Index
      text = defaultLangData?.[formIndex] ?? text;
      if (text !== null) return String(text);

      // 3. Current Lang / Fallback *Cell* Form Index (e.g., Abbreviation)
      //    Only fallback if the requested index wasn't the fallback index itself
      const fallbackIndex = this.FALLBACK_CELL_FORM_INDEX;
      if (formIndex !== fallbackIndex) {
           text = currentLangData?.[fallbackIndex] ?? text;
           if (text !== null) return String(text);
      }

      // 4. Default Lang / Fallback *Cell* Form Index
      if (formIndex !== fallbackIndex) {
           text = defaultLangData?.[fallbackIndex] ?? text;
           if (text !== null) return String(text);
      }

      // 5. Current Lang / Default Form Index (e.g., Full Name) - lower priority
      //    Only fallback if the requested index wasn't the default index itself
      if (formIndex !== this.DEFAULT_FORM_INDEX) {
           text = currentLangData?.[this.DEFAULT_FORM_INDEX] ?? text;
           if (text !== null) return String(text);
      }

      // 6. Default Lang / Default Form Index - lowest priority
      if (formIndex !== this.DEFAULT_FORM_INDEX) {
           text = defaultLangData?.[this.DEFAULT_FORM_INDEX] ?? text;
           if (text !== null) return String(text);
      }

      // If absolutely nothing found (e.g., data missing for all fallbacks)
      return '';
  }

  updateGrid() {
      // Updates the text content of all cells based on current language and form selection
      if (!this.data) {
          console.warn("Cannot update grid: No data loaded.");
          // Ensure grid shows error message if called without data
          if (!this.gridBody.querySelector('td[colspan]')) { // Avoid replacing existing msg
                this.renderEmptyGridMessage();
          }
          return;
      }
      console.log(`Updating grid view. Lang: ${this.currentLang}, Form Index (Cells): ${this.currentForm}`);
      // Iterate through the cached cell map
      for (const [key, td] of Object.entries(this.cellMap)) {
          const c = key[0];
          const r = key[1];
          const itemNameSpan = td.querySelector('.item-name');
          if (itemNameSpan) {
              // Get text using the *currently selected cell form*
              itemNameSpan.textContent = this.getItem(r, c, this.currentForm);
              // Ensure visibility is reset (relevant if stopping timed recall)
              itemNameSpan.style.visibility = 'visible';
          } else {
               // Should not happen if grid generated correctly
               console.warn(`Missing .item-name span in cell ${key}`);
          }
      }
  }

  updateGridAppearance() {
      // Updates visual styles like category background colors based on settings
      if (!this.data) return; // No data to apply appearance to

      // Apply category colors only if toggle is on AND item names are hidden
      const applyCategoryColor = this.useCategoryColors

      // Iterate through cached cells
      for (const td of Object.values(this.cellMap)) {
          if (applyCategoryColor) {
              // Get category ID and color
              const categoryId = td.dataset.category || 'unknown';
              const categoryColor = this.categories[categoryId]?.color || 'transparent'; // Use defined color or transparent
              // Apply color using CSS variable
              td.style.setProperty('--cell-category-bg', categoryColor);
          } else {
              // Remove the variable to revert to default CSS background (or hover effects)
              td.style.removeProperty('--cell-category-bg');
          }
      }
  }

  async loadData() {
      // Loads data, trying localStorage first, then fetching default 'data.json'
      const savedData = localStorage.getItem(this.STORAGE_KEY);
      if (savedData) {
          console.log("Found data in localStorage. Attempting to load...");
          try {
              const parsed = JSON.parse(savedData);
              this.validateData(parsed); // Validate stored data
              this.data = parsed; // Assign validated data
              this.notify('Loaded data from storage', 'success', 2000);
              return; // Exit early, data loaded successfully
          } catch (err) {
              // Handle errors with stored data (invalid JSON, validation failure)
              console.error("Error loading data from localStorage:", err);
              this.notify('Could not load saved data (invalid format?), trying default.', 'error', 4000);
              localStorage.removeItem(this.STORAGE_KEY); // Clear invalid stored data
              this.data = null; // Ensure data is null before proceeding to fetch
          }
      } else {
          console.log("No data found in localStorage.");
      }

      // If no valid data from storage, try fetching default
      console.log("Fetching default data.json...");
      try {
          const response = await fetch('data.json');
          if (response.ok) {
              const jsonData = await response.json();
              this.validateData(jsonData); // Validate fetched data
              this.data = jsonData; // Assign validated data
              this.notify('Loaded default data', 'success', 2000);
              // Optionally persist the fetched default data for next time?
              this.persistData(this.data);
          } else {
              // Handle HTTP errors (e.g., 404 Not Found)
              throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
          }
      } catch (err) {
          // Handle errors during fetch or validation of fetched data
          console.error("Error fetching or validating default data.json:", err);
          this.notify(`Could not load default data: ${err.message}. Please load a file manually.`, 'error', 0); // Keep message visible
          this.data = null; // Ensure data state is null on failure
      }
  }

  persistData(dataToSave) {
      // Saves the provided data object to localStorage
      if (!dataToSave) {
          console.warn("Attempted to persist null data. Aborting.");
          return;
      }
      try {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToSave));
          console.log("Data persisted to localStorage.");
      } catch (err) {
          // Handle potential storage errors (e.g., quota exceeded)
          console.error("Error persisting data to localStorage:", err);
           if (err.name === 'QuotaExceededError') {
               this.notify('Could not save data: Storage limit exceeded.', 'error', 5000);
           } else {
               this.notify('Could not save data to local storage.', 'error', 5000);
           }
      }
  }

} // End of GridGame class

// --- Initialize the application ---
document.addEventListener('DOMContentLoaded', () => new GridGame());
