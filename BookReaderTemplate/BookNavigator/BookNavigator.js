import { html, LitElement } from 'lit-element';
import { nothing } from 'lit-html';
import SearchProvider from './providers/search.js';
import DownloadProvider from './providers/download.js';
import VisualAdjustmentProvider from './providers/visual-adjustments.js';
import SharingProvider from '../ItemNavigator/providers/sharing.js';
import BookmarksProvider from './providers/bookmarks.js';
import { Book } from './BookModel.js';
import '../ItemNavigator/ItemNavigator.js';
import BRFullscreenMgr from './br-fullscreen-mgr.js';
import bookLoader from './book-loader.js';
import navigatorCSS from './styles/book-navigator.js';

const events = {
  menuUpdated: 'menuUpdated',
  updateSideMenu: 'updateSideMenu',
  ViewportInFullScreen: 'ViewportInFullScreen',
};
export class BookNavigator extends LitElement {
  static get styles() {
    return navigatorCSS;
  }

  static get properties() {
    return {
      book: { type: Object },
      bookContainerSelector: { type: String },
      bookReaderLoaded: { type: Boolean },
      bookreader: { type: Object },
      downloadableTypes: { type: Array },
      fullscreenMgr: { type: Object },
      isAdmin: { type: Boolean },
      lendingInitialized: { type: Boolean },
      lendingStatus: { type: Object },
      menuProviders: { type: Object },
      menuShortcuts: { type: Array },
      signedIn: { type: Boolean },
    };
  }

  constructor() {
    super();
    this.book = {};
    this.bookContainerSelector = '.BRcontainer';
    this.bookReaderLoaded = false;
    this.bookreader = null;
    this.downloadableTypes = [];
    this.fullscreenMgr = null;
    this.isAdmin = false;
    this.lendingInitialized = false;
    this.lendingStatus = {};
    this.menuProviders = {};
    this.menuShortcuts = [];
    this.signedIn = false;

    // Untracked properties
    this.model = new Book();
    this.shortcutOrder = ['volumes', 'search', 'bookmarks'];
  }

  firstUpdated() {
    this.model.setMetadata(this.book);
    this.bindEventListeners();
  }

  /**
   * Instantiates books submenus & their update callbacks
   *
   * NOTE: we are doing our best to scope bookreader's instance.
   * If your submenu provider uses a bookreader instance to read, manually
   * manipulate BookReader, please update the navigator's instance of it
   * to keep it in sync.
   */
  initializeBookSubmenus() {
    this.menuProviders = {
      search: new SearchProvider(
        (brInstance = null) => {
          if (brInstance) {
            /* refresh br instance reference */
            this.bookreader = brInstance;
          }
          this.updateMenuContents();
          if ($(window).width() >= 640) { /* open side search menu */
            this.openSideSearchMenu();
          }
        },
        this.bookreader,
      ),
      downloads: new DownloadProvider(),
      visualAdjustments: new VisualAdjustmentProvider({
        onOptionChange: (event, brInstance = null) => {
          if (brInstance) {
            /* refresh br instance reference */
            this.bookreader = brInstance;
          }
          this.updateMenuContents();
        },
        bookContainerSelector: this.bookContainerSelector,
        bookreader: this.bookreader,
      }),
      share: new SharingProvider(this.book.metadata, this.baseHost, this.itemType),
    };

    if (this.signedIn) {
      this.menuProviders.bookmarks = new BookmarksProvider(this.bookmarksOptions, this.bookreader);
    }

    this.addMenuShortcut('search'); /* start with search as a shortcut */
    this.updateMenuContents();
  }

  get bookmarksOptions() {
    return {
      showItemNavigatorModal: this.showItemNavigatorModal.bind(this),
      closeItemNavigatorModal: this.closeItemNavigatorModal.bind(this),
      onBookmarksChanged: (bookmarks) => {
        const method = bookmarks.length ? 'add' : 'remove';
        this[`${method}MenuShortcut`]('bookmarks');
        this.updateMenuContents();
      },
    };
  }

  /**
   * Open side search menu
   */
  openSideSearchMenu() {
    const event = new CustomEvent(
      events.updateSideMenu, {
        detail: { menuId: 'search', action: 'open' },
      },
    );
    this.dispatchEvent(event);
  }

  /**
   * Sets order of menu and emits custom event when done
   */
  updateMenuContents() {
    const {
      search, downloads, visualAdjustments, share, bookmarks = {},
    } = this.menuProviders;
    const menu = [search, visualAdjustments, share, bookmarks];

    if (this.shouldShowDownloadsMenu()) {
      downloads.update(this.downloadableTypes);
      menu.splice(1, 0, downloads);
    }

    const event = new CustomEvent(
      events.menuUpdated, {
        detail: menu,
      },
    );
    this.dispatchEvent(event);
  }

  /**
   * Confirms if we should show the downloads menu
   * @returns {bool}
   */
  shouldShowDownloadsMenu() {
    if (this.isAdmin) { return true; }
    const { user_loan_record = {} } = this.lendingStatus;
    const hasNoLoanRecord = Array.isArray(user_loan_record); /* (bc PHP assoc. arrays) */

    if (hasNoLoanRecord) { return false; }

    const hasValidLoan = user_loan_record.type && (user_loan_record.type !== 'SESSION_LOAN');
    return hasValidLoan;
  }

  /**
   * Adds a provider object to the menuShortcuts array property if it isn't
   * already added. menuShortcuts are then sorted by shortcutOrder and
   * a menuShortcutsUpdated event is emitted.
   *
   * @param {string} menuId - a string matching the id property of a provider
   */
  addMenuShortcut(menuId) {
    if (this.menuShortcuts.find((m) => m.id === menuId)) { return; }

    this.menuShortcuts.push(this.menuProviders[menuId]);
    this.sortMenuShortcuts();
    this.emitMenuShortcutsUpdated();
  }

  /**
   * Removes a provider object from the menuShortcuts array and emits a
   * menuShortcutsUpdated event.
   *
   * @param {string} menuId - a string matching the id property of a provider
   */
  removeMenuShortcut(menuId) {
    this.menuShortcuts = this.menuShortcuts.filter((m) => m.id !== menuId);
    this.emitMenuShortcutsUpdated();
  }

  /**
   * Sorts the menuShortcuts property by comparing each provider's id to
   * the id in each iteration over the shortcutOrder array.
   */
  sortMenuShortcuts() {
    this.menuShortcuts = this.shortcutOrder.reduce((shortcuts, id) => {
      const menu = this.menuShortcuts.find((m) => m.id === id);
      if (menu) { shortcuts.push(menu); }
      return shortcuts;
    }, []);
  }

  emitMenuShortcutsUpdated() {
    const event = new CustomEvent('menuShortcutsUpdated', {
      detail: this.menuShortcuts,
    });
    this.dispatchEvent(event);
  }

  /**
   * Core bookreader event handler registry
   *
   * NOTE: we are trying to keep bookreader's instance in scope
   * Please update Book Navigator's instance reference of it to keep it current
   */
  bindEventListeners() {
    window.addEventListener('BookReader:PostInit', (e) => {
      this.bookreader = e.detail.props;
      this.bookReaderLoaded = true;
      this.initializeBookSubmenus();
      setTimeout(() => this.bookreader.resize(), 0);
      const brSelector = this.br?.el || '#BookReader';
      // eslint-disable-next-line compat/compat
      const brResizeObserver = new ResizeObserver((elements) => this.resizeBookReader());
      brResizeObserver.observe(document.querySelector(brSelector));
    });
    window.addEventListener('BookReader:fullscreenToggled', (event) => {
      const { detail: { props: brInstance = null } } = event;
      if (brInstance) {
        this.bookreader = brInstance;
      }
      this.manageFullScreenBehavior(event);
    }, { passive: true });
    window.addEventListener('BookReader:ToggleSearchMenu', (event) => {
      this.dispatchEvent(new CustomEvent(events.updateSideMenu, {
        detail: { menuId: 'search', action: 'toggle' },
      }));
    });
    window.addEventListener('LendingFlow:PostInit', ({ detail }) => {
      const { downloadTypesAvailable, lendingStatus, isAdmin } = detail;
      this.lendingInitialized = true;
      this.downloadableTypes = downloadTypesAvailable;
      this.lendingStatus = lendingStatus;
      this.isAdmin = isAdmin;
    });
  }

  resizeBookReader() {
    // eslint-disable-next-line no-unused-expressions
    this.bookreader?.resize();
  }

  manageFullScreenBehavior(event) {
    this.emitFullScreenState(event);

    const isFullscreen = !!this.bookreader.isFullscreenActive;
    const showFullscreen = () => {
      window.scroll(0, 0); // to compensate for BR's original CSS gaps
      setTimeout(() => this.bookreader.resize(), 250);
    };

    if (!isFullscreen && this.fullscreenMgr) {
      this.fullscreenMgr.teardown();
      this.bookreader.resize();
    } else {
      this.fullscreenMgr = new BRFullscreenMgr(showFullscreen);
      this.fullscreenMgr.execute();
    }
  }

  /**
   * Intercepts and relays fullscreen toggle events
   * @param {Event} e
   */
  emitFullScreenState({ detail }) {
    const { props: brInstance } = detail;

    const isFullScreen = brInstance.isFullscreenActive;
    const event = new CustomEvent('ViewportInFullScreen', {
      detail: { isFullScreen },
    });
    this.dispatchEvent(event);
  }

  emitShowItemNavigatorModal(e) {
    this.dispatchEvent(new CustomEvent('showItemNavigatorModal', {
      detail: e.detail,
    }));
  }

  emitCloseItemNavigatorModal() {
    this.dispatchEvent(new CustomEvent('closeItemNavigatorModal'));
  }

  showItemNavigatorModal(e) {
    this.emitShowItemNavigatorModal(e);
  }

  closeItemNavigatorModal() {
    this.emitCloseItemNavigatorModal();
  }

  get loader() {
    const loader = html`
      <div class="book-loader">${bookLoader}<div>
      <h3>Loading viewer</h3>
    `;
    return !this.bookReaderLoaded ? loader : nothing;
  }

  get loadingClass() {
    return !this.bookReaderLoaded ? 'loading' : '';
  }

  render() {
    return html`<div id="book-navigator" class="${this.loadingClass}">
      ${this.loader}
      <slot name="bookreader"></slot>
    </div>
  `;
  }
}

customElements.define('book-navigator', BookNavigator);
