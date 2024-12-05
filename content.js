// Main content script
(function () {
  // Add missing variable declarations
  let mainObserver = null;
  let observerTimeout = null;

  const SELECTORS = {
    SUBSCRIBE_BUTTON: 'ytd-subscribe-button-renderer',
    SUBSCRIBED: '[subscribed]',
  };

  // Add these constants at the top
  /*
  const API_CONFIG = {
    CLIENT_ID: 'YOUR_CLIENT_ID',
    SCOPES: ['https://www.googleapis.com/auth/youtube.force-ssl'],
    API_BASE: 'https://www.googleapis.com/youtube/v3',
  };
  */

  // Add API utilities
  /*
  async function getChannelSubscriptionId(channelId) {
    try {
      const token = await chrome.runtime.sendMessage({ type: 'GET_AUTH_TOKEN' });
      const response = await fetch(
        `${API_CONFIG.API_BASE}/subscriptions?part=id&forChannelId=${channelId}&mine=true`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const data = await response.json();
      return data.items?.[0]?.id;
    } catch (error) {
      console.error('Failed to get subscription ID:', error);
      return null;
    }
  }

  async function unsubscribeViaApi(subscriptionId) {
    try {
      const token = await chrome.runtime.sendMessage({ type: 'GET_AUTH_TOKEN' });
      await fetch(`${API_CONFIG.API_BASE}/subscriptions?id=${subscriptionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      return true;
    } catch (error) {
      console.error('API unsubscribe failed:', error);
      return false;
    }
  }
  */

  // Add missing debounce utility
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Add missing cleanup function
  function cleanupButton(button) {
    if (button._observer) {
      button._observer.disconnect();
    }
    button.remove();
  }

  // Core utilities
  // Remove this duplicate createButton function
  /*
  const createButton = (isChannelPage) => {
    const btn = document.createElement("button");
    btn.className = `easy-unsub-button ${isChannelPage ? 'channel-page-unsub' : ''}`;
    btn.innerHTML = `
      <svg class="unsub-icon" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>
      <span>Unsub</span>
    `;
    btn.addEventListener("click", handleUnsubscribe);
    return btn;
  };
  */

  // Add error tracking and retry mechanism
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 500;

  // Add type checking and validation
  function isValidButton(element) {
    return (
      element instanceof HTMLElement &&
      element.matches(SELECTORS.SUBSCRIBE_BUTTON)
    );
  }

  // Replace the existing handleUnsubscribe function with this updated version
  async function handleUnsubscribe(event) {
    event.preventDefault();
    event.stopPropagation();

    const button = event.currentTarget;
    if (!button || button.disabled) return;

    try {
      button.classList.add('loading');
      button.disabled = true;

      const subscribeButton = button.closest('ytd-subscribe-button-renderer');
      if (!subscribeButton) throw new Error('Subscribe button not found');

      let retryCount = 0;
      let success = false;

      while (retryCount < MAX_RETRIES && !success) {
        try {
          const youtubeButton = await findYoutubeButton(subscribeButton);
          await clickAndWaitForDialog(youtubeButton);
          await confirmUnsubscribe();
          await verifyUnsubscribeSuccess(subscribeButton);
          success = true;
        } catch (error) {
          retryCount++;
          if (retryCount === MAX_RETRIES) throw error;
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
        }
      }

      handleSuccessfulUnsubscribe(button, subscribeButton);
    } catch (error) {
      console.error('Unsubscribe failed:', error);
      handleFailedUnsubscribe(button);
    }
  }

  // Add these helper functions after the existing utility functions
  async function findYoutubeButton(subscribeButton) {
    const youtubeButton = subscribeButton.querySelector(
      '#subscribe-button button, button.yt-spec-button-shape-next, [aria-label*="Unsubscribe"]'
    );
    if (!youtubeButton) throw new Error('YouTube subscribe button not found');
    return youtubeButton;
  }

  async function clickAndWaitForDialog(youtubeButton) {
    youtubeButton.click();
    // Wait for dialog to appear
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const dialog = document.querySelector('yt-confirm-dialog-renderer');
      if (dialog) return dialog;
    }
    throw new Error('Confirmation dialog not found');
  }

  async function confirmUnsubscribe() {
    const confirmButton = Array.from(
      document.querySelectorAll(
        'yt-confirm-dialog-renderer button, button.yt-spec-button-shape-next'
      )
    ).find((btn) => btn.textContent.toLowerCase().includes('unsubscribe'));

    if (!confirmButton) throw new Error('Confirm button not found');
    confirmButton.click();
  }

  async function verifyUnsubscribeSuccess(subscribeButton) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (isSubscribed(subscribeButton)) {
      throw new Error('Unsubscribe verification failed');
    }
  }

  function handleSuccessfulUnsubscribe(button, subscribeButton) {
    button.classList.remove('loading');
    button.disabled = false;

    // If we're on the channels page, animate and remove the channel
    const channelContainer = subscribeButton.closest('ytd-channel-renderer');
    if (channelContainer) {
      channelContainer.classList.add('channel-exit-animation');
      setTimeout(() => channelContainer.remove(), 500);
    }
  }

  function handleFailedUnsubscribe(button) {
    button.classList.remove('loading');
    button.disabled = false;
    // Optionally show an error state
    button.classList.add('error');
    setTimeout(() => button.classList.remove('error'), 2000);
  }

  // Optimized isSubscribed check
  function isSubscribed(button) {
    if (!button) return false;
    return (
      button.hasAttribute('subscribed') ||
      button.hasAttribute('is-subscribed') ||
      button.querySelector(
        "[subscribed], [is-subscribed], button[aria-label*='Unsubscribe']"
      ) !== null
    );
  }

  // Debounced URL handler
  const handleUrlChange = debounce(() => {
    console.log('URL changed:', window.location.pathname);
    addUnsubscribeButtons();
  }, 250);

  // Utility functions
  // Add new page type detection
  function isVideosTabPage() {
    return window.location.pathname.includes('/videos');
  }

  // Update createUnsubButton function
  function createUnsubButton(isVideoPage = false) {
    const button = document.createElement('button');
    button.className = `easy-unsub-button ${
      isVideoPage ? 'videos-page-unsub' : ''
    }`;
    button.innerHTML = `
      <svg class="unsub-icon" viewBox="0 0 24 24">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="8.5" cy="7" r="4"></circle>
        <line x1="23" y1="11" x2="17" y2="11"></line>
      </svg>
      <span>Unsub</span>
    `;

    // Ensure proper button insertion
    button.style.cssText = `
      display: inline-flex !important;
      visibility: visible !important;
      opacity: 1 !important;
      position: static !important;
      margin-left: 8px !important;
    `;

    if (isVideoPage) {
      button.addEventListener('click', handleVideoPageUnsubscribe);
    } else {
      button.addEventListener('click', handleUnsubscribe);
    }
    return button;
  }

  // Add video page specific unsubscribe handler
  async function handleVideoPageUnsubscribe(event) {
    event.preventDefault();
    event.stopPropagation();

    const button = event.currentTarget;
    if (!button || button.disabled) return;

    try {
      button.classList.add('loading');
      button.disabled = true;

      const subscribeButton = button.closest('ytd-subscribe-button-renderer');
      if (!subscribeButton) throw new Error('Subscribe button not found');

      const youtubeButton = await findYoutubeButton(subscribeButton);
      await clickAndWaitForDialog(youtubeButton);
      await confirmUnsubscribe();
      await verifyUnsubscribeSuccess(subscribeButton);

      handleSuccessfulUnsubscribe(button, subscribeButton);
    } catch (error) {
      console.error('Video page unsubscribe failed:', error);
      handleFailedUnsubscribe(button);
    }
  }

  // Add helper function to get channel ID
  /*
  function getChannelIdFromPage() {
    // Try meta tag first
    const meta = document.querySelector('meta[itemprop="channelId"]');
    if (meta?.content) return meta.content;

    // Try URL pattern
    const match = window.location.pathname.match(/@([^/]+)/);
    return match?.[1] || null;
  }
  */

  // Function to setup button observer
  function setupButtonObserver(unsubButton, subscribeButton) {
    if (unsubButton._observer) {
      unsubButton._observer.disconnect();
    }

    const observer = new MutationObserver((mutations) => {
      if (!document.contains(subscribeButton)) {
        cleanupButton(unsubButton);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    unsubButton._observer = observer;
  }

  // Optimized button addition
  const addUnsubscribeButtons = debounce(() => {
    // Wait for YouTube's dynamic content to load
    setTimeout(() => {
      const buttons = document.querySelectorAll(
        `${SELECTORS.SUBSCRIBE_BUTTON}[subscribed], ${SELECTORS.SUBSCRIBE_BUTTON}[is-subscribed]`
      );

      const isVideoPage = window.location.pathname.includes('/videos');

      buttons.forEach((subscribeButton) => {
        if (
          !subscribeButton.querySelector('.easy-unsub-button') &&
          isSubscribed(subscribeButton)
        ) {
          const unsubButton = createUnsubButton(isVideoPage);

          // Ensure proper insertion point
          const insertionPoint =
            subscribeButton.querySelector('#subscribe-button') ||
            subscribeButton;
          insertionPoint.appendChild(unsubButton);

          // Force proper layout
          requestAnimationFrame(() => {
            unsubButton.style.display = 'inline-flex';
            unsubButton.style.visibility = 'visible';
            unsubButton.style.opacity = '1';
          });

          setupButtonObserver(unsubButton, subscribeButton);
        }
      });
    }, 1000); // Give more time for YouTube's content to load
  }, 100);

  // Update confirmation dialog for API-based unsubscribe
  /*
  function showConfirmDialog() {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.className = 'yt-confirm-dialog-renderer';
      // ...add dialog HTML and styling...
      
      const confirmBtn = dialog.querySelector('.confirm-button');
      confirmBtn.addEventListener('click', () => {
        dialog.remove();
        resolve(true);
      });
      
      const cancelBtn = dialog.querySelector('.cancel-button');
      cancelBtn.addEventListener('click', () => {
        dialog.remove();
        resolve(false);
      });
      
      document.body.appendChild(dialog);
    });
  }
  */

  // Optimized observer setup
  function setupMainObserver() {
    try {
      if (mainObserver) {
        mainObserver.disconnect();
      }

      mainObserver = new MutationObserver((mutations) => {
        // Clear previous timeout
        if (observerTimeout) {
          clearTimeout(observerTimeout);
        }

        // Set new timeout for batch processing
        observerTimeout = setTimeout(() => {
          const shouldUpdate = mutations.some(
            (mutation) =>
              mutation.target instanceof Element &&
              (mutation.target.closest('ytd-subscribe-button-renderer') ||
                mutation.target.matches(SELECTORS.CHANNEL_SUBSCRIBE))
          );

          if (shouldUpdate) {
            addUnsubscribeButtons();
          }
        }, 100);
      });

      // Observe only necessary parts of the page
      const observeTarget = window.location.pathname.includes('/@')
        ? document.querySelector('#channel-container')
        : document.querySelector('#content');

      if (observeTarget) {
        mainObserver.observe(observeTarget, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['subscribed'],
        });
      }
    } catch (error) {
      console.error('Observer setup failed:', error);
    }
  }

  // Add bulk unsubscribe functionality with UserMinus icon and tooltips
  // Add state management object
  const bulkState = {
    isProcessing: false,
    selected: 0,
    completed: 0,
    total: 0,
  };

  // Update progress display
  function updateProgress() {
    const progress = document.querySelector('.bulk-progress');
    if (!progress) return;

    const text = bulkState.isProcessing
      ? `Processing: ${bulkState.completed}/${bulkState.selected}`
      : bulkState.completed > 0
      ? `Completed: ${bulkState.completed}/${bulkState.selected}`
      : `Selected: ${bulkState.selected}`;

    // Animate the text change
    progress.style.opacity = '0';
    setTimeout(() => {
      progress.textContent = text;
      progress.style.opacity = '1';
    }, 200);

    // Update button state
    const unsubBtn = document.getElementById('unsubAllBtn');
    if (unsubBtn) {
      unsubBtn.disabled = bulkState.selected === 0 || bulkState.isProcessing;
      unsubBtn.classList.toggle('processing', bulkState.isProcessing);
    }
  }

  // Update addBulkControls function
  function addBulkControls() {
    if (
      window.location.pathname !== '/feed/channels' ||
      document.querySelector('.bulk-controls')
    ) {
      return;
    }

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'bulk-controls';
    controlsDiv.innerHTML = `
      <button class="bulk-button" id="selectAllBtn">Select All</button>
      <button class="bulk-button" id="unsubAllBtn" disabled>
        <svg class="unsub-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <line x1="18" y1="8" x2="23" y2="13"/>
          <line x1="23" y1="8" x2="18" y2="13"/>
        </svg>
        Unsub
      </button>
      <span class="bulk-progress">Selected: 0</span>
    `;

    const container = document.querySelector('ytd-browse');
    container?.insertBefore(controlsDiv, container.firstChild);

    // Update checkbox handling
    function handleCheckboxChange(e) {
      const checkbox = e.target;
      if (checkbox.checked) {
        bulkState.selected++;
      } else {
        bulkState.selected--;
      }
      document.getElementById('unsubAllBtn').disabled =
        bulkState.selected === 0;
      updateProgress();
    }

    // Add checkboxes with improved handling
    function addCheckboxesToChannels() {
      document.querySelectorAll('ytd-channel-renderer').forEach((channel) => {
        if (!channel.querySelector('.channel-checkbox')) {
          const checkbox = document.createElement('div');
          checkbox.className = 'channel-checkbox-wrapper';
          checkbox.innerHTML =
            '<input type="checkbox" class="channel-checkbox">';
          channel.insertBefore(checkbox, channel.firstChild);

          // Add change listener
          checkbox
            .querySelector('.channel-checkbox')
            .addEventListener('change', handleCheckboxChange);
        }
      });
    }

    // Update bulk unsubscribe with improved state management
    async function handleBulkUnsubscribe() {
      const selectedChannels = document.querySelectorAll(
        '.channel-checkbox:checked'
      );
      bulkState.isProcessing = true;
      bulkState.completed = 0;
      bulkState.selected = selectedChannels.length;

      document.getElementById('selectAllBtn').disabled = true;
      document.getElementById('unsubAllBtn').disabled = true;

      updateProgress();

      for (const checkbox of selectedChannels) {
        const channel = checkbox.closest('ytd-channel-renderer');
        const subscribeButton = channel.querySelector(
          'ytd-subscribe-button-renderer'
        );

        if (subscribeButton) {
          bulkState.completed++;
          updateProgress();

          try {
            // Find and click the YouTube subscribe button
            const youtubeButton = subscribeButton.querySelector(
              '#subscribe-button button, button.yt-spec-button-shape-next, [aria-label*="Unsubscribe"]'
            );
            if (!youtubeButton)
              throw new Error('YouTube subscribe button not found');

            // Click the button and wait for dialog
            youtubeButton.click();

            // Bypass confirmation dialog
            let confirmButton = null;
            for (let i = 0; i < 10; i++) {
              await new Promise((resolve) => setTimeout(resolve, 100));
              confirmButton = Array.from(
                document.querySelectorAll(
                  'yt-confirm-dialog-renderer button, button.yt-spec-button-shape-next'
                )
              ).find((btn) =>
                btn.textContent.toLowerCase().includes('unsubscribe')
              );
              if (confirmButton) break;
            }

            if (confirmButton) {
              confirmButton.click();
            }

            // Verify unsubscribe was successful
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const stillSubscribed =
              subscribeButton.hasAttribute('subscribed') ||
              subscribeButton.querySelector('[subscribed]');

            if (stillSubscribed) throw new Error('Channel is still subscribed');

            // Success - cleanup
            channel.classList.add('channel-exit-animation');
            await new Promise((resolve) => setTimeout(resolve, 500));
            channel.remove();
          } catch (error) {
            console.error('Unsubscribe failed:', error);
          }
        }

        // Add small delay between operations
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      bulkState.isProcessing = false;
      document.getElementById('selectAllBtn').disabled = false;
      updateProgress();
    }

    // Event listeners
    document
      .getElementById('selectAllBtn')
      ?.addEventListener('click', (event) => {
        const button = event.target;
        const isSelecting = button.textContent === 'Select All';
        button.textContent = isSelecting ? 'Unselect All' : 'Select All';
        button.classList.toggle('active', isSelecting);
        document.querySelectorAll('.channel-checkbox').forEach((cb) => {
          cb.checked = isSelecting;
        });
        bulkState.selected = isSelecting
          ? document.querySelectorAll('.channel-checkbox').length
          : 0;
        document.getElementById('unsubAllBtn').disabled =
          bulkState.selected === 0;
        updateProgress();
      });

    document
      .getElementById('unsubAllBtn')
      ?.addEventListener('click', handleBulkUnsubscribe);

    // Monitor for new channels
    const channelsObserver = new MutationObserver(addCheckboxesToChannels);
    const channelsContainer = document.querySelector('ytd-browse');
    if (channelsContainer) {
      channelsObserver.observe(channelsContainer, {
        childList: true,
        subtree: true,
      });
    }

    addCheckboxesToChannels();
  }

  // Improved initialization with retry mechanism
  function init() {
    let initAttempts = 0;
    const maxAttempts = 5;

    function attemptInit() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attemptInit);
        return;
      }

      try {
        if (mainObserver) {
          mainObserver.disconnect();
        }

        setupMainObserver();
        addUnsubscribeButtons();

        if (window.location.pathname === '/feed/channels') {
          setTimeout(addBulkControls, 1000);
        }

        // Verify elements are added
        const elements = document.querySelectorAll(
          '.easy-unsub-button, .bulk-controls'
        );
        if (elements.length === 0 && initAttempts < maxAttempts) {
          console.log(`Retry attempt ${initAttempts + 1} of ${maxAttempts}`);
          initAttempts++;
          setTimeout(attemptInit, 1000);
          return;
        }
      } catch (error) {
        console.error('Init error:', error);
        if (initAttempts < maxAttempts) {
          initAttempts++;
          setTimeout(attemptInit, 1000);
        }
      }
    }

    attemptInit();
  }

  // Replace setTimeout-based execution with more robust initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Clean up on navigation
  window.addEventListener('beforeunload', () => {
    if (mainObserver) {
      mainObserver.disconnect();
    }
    if (observerTimeout) {
      clearTimeout(observerTimeout);
    }
  });
})();
