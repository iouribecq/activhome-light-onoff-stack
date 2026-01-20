// Activhome Light ON/OFF Stack - v0.1.0 (no-build, dependency-free)
// Type: custom:activhome-light-onoff-stack
//
// Base model: activhome-light-stack (v0.2.4)
//
// Goal:
// - A single ha-card container with style/theme applied on container
// - Renders a vertical stack of "light panel" rows (NOT generic cards)
// - Each row: icon (more-info) + name (navigate/more-info) + ON + OFF actions
//
// Config:
//   items (required): array of rows
//     - entity (required): light.xxx (reference for icon + state)
//     - name (optional)
//     - on_action (optional): HA ui_action object
//     - off_action (optional): HA ui_action object
//     - navigation_path (optional): /dashboard/0
//     - tap_action (optional): HA native ui_action (we only use action=navigate + navigation_path)
//     - font_size (optional): "16px".."24px" (empty => container default)
//
//   actions_button_width (optional): number (px) width for ON/OFF buttons
//   actions_button_border (optional): boolean (default false)
//     - if true: 1px border, rectangle (border-radius:0)
//
//   style (optional): transparent|activhome|glass|dark_glass|solid|neon_pulse|neon_glow|primary_breathe|primary_tint...
//   theme (optional): HA theme name (applies theme vars to this card container only)
//   card_style (optional): CSS injected into container (targets ha-card)
//   accent_color (optional): "#RRGGBB" (used by neon_glow + primary_* styles via --ah-accent-color)
//   default_font_size (optional): "16px".."24px" (applies if item.font_size is empty)
//
// Notes:
// - ON/OFF are always active.
// - If on_action/off_action is not provided, defaults are:
//     ON  => homeassistant.turn_on  entity_id = item.entity
//     OFF => homeassistant.turn_off entity_id = item.entity

(() => {
  const YELLOW = "#FFCC00";

  function fireEvent(node, type, detail = {}, options = {}) {
    const event = new CustomEvent(type, {
      bubbles: options.bubbles ?? true,
      composed: options.composed ?? true,
      cancelable: options.cancelable ?? false,
      detail,
    });
    node.dispatchEvent(event);
    return event;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // --- Height helpers (row / total mode) -----------------------------------
  function _toNumber(v) {
    if (v === null || v === undefined) return NaN;
    if (typeof v === "number") return v;
    const s = String(v).trim();
    if (!s) return NaN;
    // Accept "350", "350px", "350 px"
    const n = parseFloat(s.replace(/px\s*$/i, ""));
    return Number.isFinite(n) ? n : NaN;
  }

  function _clampNum(n, min, max) {
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }
  // -------------------------------------------------------------------------

  // --- Optional Home Assistant theme support -------------------------------
  function _getThemeVars(hass, themeName) {
    const themes = hass?.themes?.themes;
    if (!themes || !themeName) return null;
    const theme = themes[themeName];
    if (!theme) return null;

    // Theme structure can be flat or { modes: { light: {...}, dark: {...} } }
    if (theme.modes && (theme.modes.light || theme.modes.dark)) {
      const modeKey = hass.themes?.darkMode ? "dark" : "light";
      return theme.modes[modeKey] || theme.modes.light || theme.modes.dark || null;
    }
    return theme;
  }

  function _clearTheme(el, prevVars) {
    if (!el || !prevVars) return;
    Object.keys(prevVars).forEach((k) => {
      const cssVar = k.startsWith("--") ? k : `--${k}`;
      el.style.removeProperty(cssVar);
    });
  }

  function _applyTheme(el, hass, themeName, prevVars) {
    const vars = _getThemeVars(hass, themeName);
    if (!vars) return null;

    _clearTheme(el, prevVars);

    Object.entries(vars).forEach(([key, val]) => {
      const cssVar = key.startsWith("--") ? key : `--${key}`;
      el.style.setProperty(cssVar, String(val));
    });
    return vars;
  }
  // -------------------------------------------------------------------------

  function stylePresetCss(styleName) {
    const s = (styleName || "transparent").toLowerCase();
    switch (s) {
      case "activhome":
        return `
          ha-card {
            --mdc-icon-size: 0px;
            --ha-card-padding: 10px;

            padding: var(--ha-card-padding) !important;
            background-color: rgba(0,0,0,0.40);
            border: 1px solid rgba(255,255,255,0.15);

            border-radius: 16px;
            box-shadow: none;
          }`;

      case "glass":
        return `
          ha-card{
            --mdc-icon-size: 0px;
            --ha-card-padding: 10px;

            padding: var(--ha-card-padding) !important;

            background: rgba(255,255,255,0.10);
            border-radius: 16px;
            box-shadow: none;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
          }`;

      case "dark_glass":
        return `
          ha-card{
            --mdc-icon-size: 0px;
            --ha-card-padding: 10px;

            padding: var(--ha-card-padding) !important;
            border-radius: 16px;
            background: rgba(15, 15, 15, 0.55);
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.45);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.12);
          }`;

      case "solid":
        return `
          ha-card{
            --mdc-icon-size: 0px;
            --ha-card-padding: 10px;

            padding: var(--ha-card-padding) !important;

            background: var(--card-background-color, rgba(0,0,0,0.2));
            border-radius: 16px;
            box-shadow: none;
          }`;

      case "neon_pulse":
        return `
          ha-card {
            border-radius: 16px;
            background: rgba(10, 10, 10, 0.45);
            padding: 8px 10px;

            backdrop-filter: blur(8px) brightness(1.1);
            -webkit-backdrop-filter: blur(8px) brightness(1.1);

            border: 1px solid rgba(255, 0, 180, 0.4);

            box-shadow:
              0 0 12px rgba(255, 0, 180, 0.5),
              0 0 24px rgba(255, 0, 180, 0.3),
              0 8px 20px rgba(0, 0, 0, 0.4);

            animation: ah_neon_pulse 12s linear infinite;
            transition:
              box-shadow 0.4s ease,
              border-color 0.4s ease,
              background 0.4s ease;

            will-change: box-shadow, border-color;
          }

          @keyframes ah_neon_pulse {
            0% {
              border-color: rgba(255, 0, 180, 0.5);
              box-shadow:
                0 0 12px rgba(255, 0, 180, 0.6),
                0 0 24px rgba(255, 0, 180, 0.35),
                0 8px 20px rgba(0, 0, 0, 0.4);
            }
            25% {
              border-color: rgba(0, 180, 255, 0.5);
              box-shadow:
                0 0 12px rgba(0, 180, 255, 0.6),
                0 0 24px rgba(0, 180, 255, 0.35),
                0 8px 20px rgba(0, 0, 0, 0.4);
            }
            50% {
              border-color: rgba(0, 255, 180, 0.5);
              box-shadow:
                0 0 12px rgba(0, 255, 180, 0.6),
                0 0 24px rgba(0, 255, 180, 0.35),
                0 8px 20px rgba(0, 0, 0, 0.4);
            }
            75% {
              border-color: rgba(255, 255, 0, 0.5);
              box-shadow:
                0 0 12px rgba(255, 255, 0, 0.55),
                0 0 24px rgba(255, 255, 0, 0.32),
                0 8px 20px rgba(0, 0, 0, 0.4);
            }
            100% {
              border-color: rgba(255, 0, 180, 0.5);
              box-shadow:
                0 0 12px rgba(255, 0, 180, 0.6),
                0 0 24px rgba(255, 0, 180, 0.35),
                0 8px 20px rgba(0, 0, 0, 0.4);
            }
          }`;

      case "neon_glow":
        return `
          ha-card{
            --ah-accent: var(--ah-accent-color, #FF00B4);

            border-radius: 16px;
            background: rgba(10, 10, 10, 0.42);
            padding: 8px 10px;

            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);

            border: 1px solid color-mix(in oklab, var(--ah-accent) 55%, transparent);

            box-shadow:
              0 0 14px color-mix(in oklab, var(--ah-accent) 55%, transparent),
              0 0 28px color-mix(in oklab, var(--ah-accent) 30%, transparent),
              0 10px 22px rgba(0, 0, 0, 0.40);

            transition: box-shadow 0.25s ease, border-color 0.25s ease;
          }

          ha-card:hover{
            box-shadow:
              0 0 18px color-mix(in oklab, var(--ah-accent) 70%, transparent),
              0 0 36px color-mix(in oklab, var(--ah-accent) 40%, transparent),
              0 12px 24px rgba(0, 0, 0, 0.45);
          }`;

      case "primary_breathe":
        return `
          ha-card{
            --ah-accent: var(--ah-accent-color, var(--primary-color));

            border-radius: 16px;
            background: rgba(0,0,0,0.35);
            padding: 8px 10px;

            border: 1px solid color-mix(in oklab, var(--ah-accent) 30%, transparent);

            box-shadow:
              0 0 10px color-mix(in oklab, var(--ah-accent) 40%, transparent),
              0 8px 20px rgba(0,0,0,0.35);

            animation: ah_primary_breathe 7s ease-in-out infinite;
          }

          @keyframes ah_primary_breathe {
            0%, 100% {
              box-shadow:
                0 0 10px color-mix(in oklab, var(--ah-accent) 35%, transparent),
                0 8px 20px rgba(0,0,0,0.35);
            }
            50% {
              box-shadow:
                0 0 18px color-mix(in oklab, var(--ah-accent) 55%, transparent),
                0 10px 24px rgba(0,0,0,0.42);
            }
          }`;

      case "primary_tint":
        return `
          ha-card{
            --ah-accent: var(--ah-accent-color, var(--primary-color));

            border-radius: 16px;
            padding: 8px 10px;

            background: color-mix(in oklab, var(--ah-accent) 12%, rgba(0,0,0,0.35));
            border: 1px solid color-mix(in oklab, var(--ah-accent) 28%, transparent);

            box-shadow:
              0 0 10px color-mix(in oklab, var(--ah-accent) 30%, transparent),
              0 8px 18px rgba(0,0,0,0.35);
          }`;

      case "transparent":
      default:
        return `
          ha-card{
            --mdc-icon-size: 0px;
            --ha-card-padding: 10px;

            padding: var(--ha-card-padding) !important;

            background: none;
            box-shadow: none;
          }`;
    }
  }

  class ActivhomeLightOnoffStack extends HTMLElement {
    set hass(hass) {
      this._hass = hass;

      // IMPORTANT: Avoid full Shadow DOM rebuild on every hass update.
      // Rebuilding (shadowRoot.innerHTML = ...) can cause iOS Safari/WebView to snap scroll.
      if (!this.shadowRoot || !this._config || !this._didRenderOnce) {
        this._render();
        this._didRenderOnce = true;
        return;
      }

      this._updateFromHass();
    }

    setConfig(config) {
      if (!config || !Array.isArray(config.items) || config.items.length === 0) {
        throw new Error("activhome-light-onoff-stack: 'items' (non-empty array) is required");
      }
      const style = config.style ?? "transparent";
      const height_mode = String(config.height_mode || "row").toLowerCase() === "total" ? "total" : "row";
      const row_height = _toNumber(config.row_height);
      const target_total_height = config.target_total_height;

      const bbw = _toNumber(config.actions_button_width);
      const actions_button_width = Number.isFinite(bbw) ? bbw : undefined;
      const actions_button_border = config.actions_button_border === true;

      this._config = {
        ...config,
        style,
        height_mode,
        row_height: Number.isFinite(row_height) ? row_height : 50,
        target_total_height,
        actions_button_width,
        actions_button_border,
        // Default behavior: value includes padding/borders unless user explicitly sets false
        target_total_includes_padding: config.target_total_includes_padding !== false,
      };
      this._render();
    }

    getCardSize() {
      return Math.max(1, this._config?.items?.length || 1);
    }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this._render();

      // Responsive actions sizing (native-like): keep text size, shrink only action buttons/icons on narrow cards.
      if (!this._roActions) {
        this._roActions = new ResizeObserver(() => this._applyResponsiveActions());
        this._roActions.observe(this);
      }
      this._applyResponsiveActions();
    }

    disconnectedCallback() {
      if (this._roActions) {
        try {
          this._roActions.disconnect();
        } catch (_) {}
        this._roActions = null;
      }
    }

    _applyResponsiveActions() {
      // Default (large screens / iPad Pro / desktop)
      let actionW = 60;
      let gap = 6;
      let icon = 32;

      const w = this.getBoundingClientRect?.().width || 0;

      // Typical iPad 3-columns range
      if (w > 0 && w < 520) {
        actionW = 52;
        gap = 5;
        icon = 28;
      }
      // Very narrow (phone / split view)
      if (w > 0 && w < 420) {
        actionW = 60; // keep a usable hit area
        gap = 5;
        icon = 28;
      }

      this.style.setProperty("--ah-action-w", `${actionW}px`);
      this.style.setProperty("--ah-action-gap", `${gap}px`);
      this.style.setProperty("--ah-action-icon", `${icon}px`);

      const cfgW = _toNumber(this._config?.actions_button_width);
      if (Number.isFinite(cfgW) && cfgW > 0) {
        this.style.setProperty("--ah-action-btn-w", `${cfgW}px`);
      } else {
        this.style.removeProperty("--ah-action-btn-w");
      }
    }

    _openMoreInfo(entityId) {
      fireEvent(this, "hass-more-info", { entityId });
    }

    _navigate(path) {
      if (!path) return;
      history.pushState(null, "", path);
      window.dispatchEvent(new Event("location-changed"));
    }

    _callServiceFromString(service, data = {}, target = undefined) {
      if (!service || typeof service !== "string") return;
      const s = service.trim();
      const dot = s.indexOf(".");
      if (dot <= 0) return;
      const domain = s.slice(0, dot);
      const srv = s.slice(dot + 1);

      const payload = data && typeof data === "object" ? { ...data } : {};

      // Home Assistant frontend expects `target` as a separate 4th argument in many installs.
      // Passing `payload.target = {...}` can be ignored, resulting in a no-op.
      try {
        if (target && typeof target === "object") {
          this._hass?.callService(domain, srv, payload, target);
        } else {
          this._hass?.callService(domain, srv, payload);
        }
      } catch (e) {
        // Best-effort fallback for older frontends
        if (target && typeof target === "object") payload.target = target;
        try {
          this._hass?.callService(domain, srv, payload);
        } catch (_) {}
      }
    }

    _runUiAction(uiAction, fallbackEntityId) {
      const a = uiAction && typeof uiAction === "object" ? uiAction : null;
      const action = String(a?.action || "").toLowerCase();

      if (!action || action === "none") return;

      if (action === "more-info") {
        const eid = String(a?.entity || "").trim() || fallbackEntityId;
        if (eid) this._openMoreInfo(eid);
        return;
      }

      if (action === "navigate") {
        const p = String(a?.navigation_path || "").trim();
        if (p) this._navigate(p);
        return;
      }

      if (action === "url") {
        const u = String(a?.url_path || "").trim();
        if (u) window.open(u, "_blank");
        return;
      }

      if (action === "toggle") {
        const eid = String(a?.entity || "").trim() || fallbackEntityId;
        if (eid) this._hass?.callService("homeassistant", "toggle", { entity_id: eid });
        return;
      }

      if (action === "call-service") {
        const svc = String(a?.service || "").trim();
        const target = a?.target && typeof a.target === "object" ? a.target : undefined;
        const data =
          a?.service_data && typeof a.service_data === "object"
            ? a.service_data
            : a?.data && typeof a.data === "object"
              ? a.data
              : {};
        this._callServiceFromString(svc, data, target);
        return;
      }

      // Fallback: try HA action handler events (best effort)
      // (keeps this card dependency-free; if HA changes internals, our supported actions above still work)
      try {
        fireEvent(this, "hass-action", { action: a, entity: fallbackEntityId });
      } catch (_) {}
    }

    _updateFromHass() {
      const hass = this._hass;
      if (!hass || !this.shadowRoot || !this._config) return;

      // Keep container theme vars in sync without rerendering
      const cardEl = this.shadowRoot.querySelector("ha-card");
      const themeName = (this._config.theme || "").trim();
      if (cardEl && themeName) {
        this._appliedThemeVars = _applyTheme(cardEl, hass, themeName, this._appliedThemeVars);
      }

      const rows = this.shadowRoot.querySelectorAll(".row");
      rows.forEach((row) => {
        const entityId = row?.dataset?.entity;
        if (!entityId) return;

        const stateObj = hass.states?.[entityId];
        const lightOn = stateObj?.state === "on";

        const stateIcon = row.querySelector("ha-state-icon");
        if (stateIcon && stateObj) {
          stateIcon.hass = hass;
          stateIcon.stateObj = stateObj;
          stateIcon.style.color = lightOn ? YELLOW : "var(--primary-text-color)";
        }
      });
    }

    _render() {
      if (!this.shadowRoot || !this._config) return;
      const hass = this._hass;

      // Height settings
      const itemsCount = Array.isArray(this._config.items) ? this._config.items.length : 0;

      const heightModeRaw = String(this._config.height_mode || "row").toLowerCase();
      const heightMode = heightModeRaw === "total" ? "total" : "row";

      const rowMin = 50;
      const rowMax = 220;

      const baseRow = _clampNum(_toNumber(this._config.row_height), rowMin, rowMax);
      this.style.setProperty("--ah-row-height", `${baseRow}px`);

      // Action button border toggle
      const borderEnabled = this._config.actions_button_border === true;
      this.style.setProperty("--ah-action-btn-border-w", borderEnabled ? "1px" : "0px");

      const presetCss = stylePresetCss(this._config.style);
      const customCss = this._config.card_style ? `\n/* card_style */\n${this._config.card_style}\n` : "";

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display:block;
            --ah-row-height: 50px;

            /* Responsive actions (default values for large screens) */
            --ah-action-w: 60px;
            --ah-action-gap: 6px;
            --ah-action-icon: 32px;

            /* Optional overrides */
            --ah-action-btn-w: var(--ah-action-w);
            --ah-action-btn-border-w: 0px;
            --ah-action-btn-border-color: color-mix(in oklab, var(--primary-text-color) 28%, transparent);
          }

          ha-card{
            padding: 0;
            --ha-card-border-width: 0px;
            color: var(--primary-text-color);
          }
          ${presetCss}
          ${customCss}

          .list{
            display: flex;
            flex-direction: column;
          }

          .row{
            display:grid;
            grid-template-columns: 48px 1fr var(--ah-action-btn-w) var(--ah-action-btn-w);
            align-items:center;
            column-gap: var(--ah-action-gap);
            height: var(--ah-row-height);
          }

          button{
            font: inherit;
            -webkit-tap-highlight-color: transparent; /* ✅ iOS: supprime le flash */
            outline: none; /* ✅ évite le ring focus collé */
            touch-action: manipulation; /* ✅ iOS: réduit les comportements scroll/zoom au tap */
          }

          button:focus,
          button:focus-visible{ outline: none !important; }

          .iconBtn{
            height: var(--ah-row-height); width:48px;
            display:flex; align-items:center; justify-content:center;
            background:none; border:none; padding:0;
            cursor:pointer;
          }

          ha-state-icon{ --mdc-icon-size:32px; }

          .nameBtn{
            height: var(--ah-row-height);
            background:none; border:none;
            padding:0 0 0 4px;
            text-align:left;
            min-width:0;
            display:flex; align-items:center;
            cursor:pointer;
          }

          .name{
            font-size: var(
              --ah-font-size,
              var(
                --ha-font-size-m,
                var(--paper-font-body1_-_font-size, 20px)
              )
            );
            font-weight: var(
              --ha-font-weight-normal,
              var(--paper-font-body1_-_font-weight, 500)
            );
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
            width:100%;
            color: var(--primary-text-color);
          }

          .actionBtn{
            height: var(--ah-row-height);
            width: var(--ah-action-btn-w);
            display:flex; align-items:center; justify-content:center;
            background:none;
            border: var(--ah-action-btn-border-w) solid var(--ah-action-btn-border-color);
            padding:0;
            cursor:pointer;
            border-radius: 12px;
            transition: background-color 120ms ease;
            color: var(--primary-text-color);
            box-sizing: border-box;
          }
          .actionBtn:hover{ background: color-mix(in oklab, currentColor 12%, transparent); }
          .actionBtn:active{ background: color-mix(in oklab, currentColor 18%, transparent); }

          .actionLabel{
            font-size: var(
              --ah-font-size,
              var(
                --ha-font-size-m,
                var(--paper-font-body1_-_font-size, 20px)
              )
            );
            font-weight: var(
              --ha-font-weight-normal,
              var(--paper-font-body1_-_font-weight, 500)
            );
            line-height: 1;
            user-select: none;
            -webkit-user-select: none;
          }

          /* ✅ iOS/tactile : feedback au tap conservé, sans effet stroboscope */
          @media (hover: none) and (pointer: coarse) {
            .actionBtn,
            .iconBtn,
            .nameBtn {
              transition: none !important;
            }

            .actionBtn:hover,
            .iconBtn:hover,
            .nameBtn:hover {
              background: none !important;
            }

            .actionBtn:active,
            .iconBtn:active,
            .nameBtn:active {
              background: rgba(255, 255, 255, 0.10) !important;
            }
          }
        </style>

        <ha-card>
          <div class="list" id="list"></div>
        </ha-card>
      `;

      // Ensure responsive action sizing is applied immediately after (re)render.
      this._applyResponsiveActions();

      const cardEl = this.shadowRoot.querySelector("ha-card");

      // Apply optional HA theme to container
      const themeName = (this._config.theme || "").trim();
      if (cardEl) {
        if (themeName) {
          this._appliedThemeVars = _applyTheme(cardEl, hass, themeName, this._appliedThemeVars);
        } else if (this._appliedThemeVars) {
          _clearTheme(cardEl, this._appliedThemeVars);
          this._appliedThemeVars = null;
        }

        // Optional container accent color (used by neon_glow + primary_* styles)
        const acc = (this._config.accent_color || "").trim();
        if (acc) cardEl.style.setProperty("--ah-accent-color", acc);
        else cardEl.style.removeProperty("--ah-accent-color");

        // ✅ Default font size: guaranteed 20px unless user sets default_font_size
        const dfs = (this._config.default_font_size || "").trim();
        cardEl.style.setProperty("--ah-default-font-size", dfs || "20px");
      }

      const list = this.shadowRoot.getElementById("list");
      if (!list) return;

      this._didRenderOnce = true;

      // Ensure responsive variables are updated after render
      this._applyResponsiveActions();

      const items = this._config.items || [];
      items.forEach((it) => {
        const entityId = (it?.entity || "").trim();
        if (!entityId) return;

        const stateObj = hass?.states?.[entityId];

        const name =
          (it?.name || "").trim() || (stateObj?.attributes?.friendly_name || "") || entityId;

        const lightOn = stateObj?.state === "on";

        const row = document.createElement("div");
        row.className = "row";
        row.dataset.entity = entityId;

        // Per-item font size:
        const rowFontSize = (it?.font_size || "").trim();
        const containerDefaultFs = (this._config.default_font_size || "").trim() || "20px";
        row.style.setProperty("--ah-font-size", rowFontSize || containerDefaultFs);

        row.innerHTML = `
          <button class="iconBtn" data-action="more-info" aria-label="More info" tabindex="-1" type="button">
            <ha-state-icon></ha-state-icon>
          </button>

          <button class="nameBtn" data-action="name" aria-label="Navigate or more-info" tabindex="-1" type="button">
            <span class="name">${escapeHtml(name)}</span>
          </button>

          <button class="actionBtn" data-action="on" aria-label="ON" tabindex="-1" type="button">
            <span class="actionLabel">ON</span>
          </button>

          <button class="actionBtn" data-action="off" aria-label="OFF" tabindex="-1" type="button">
            <span class="actionLabel">OFF</span>
          </button>
        `;

        // Setup ha-state-icon
        const stateIcon = row.querySelector("ha-state-icon");
        if (stateIcon && hass && stateObj) {
          stateIcon.hass = hass;
          stateIcon.stateObj = stateObj;
          stateIcon.style.color = lightOn ? YELLOW : "var(--primary-text-color)";
        }

        // Click handling (robust in HA/iOS/overlays)
        // Why: some installs can block pointer events on the <button> elements (or retarget events)
        // which makes per-button listeners appear "dead". We therefore listen on the row (capture)
        // and resolve the intended action from the composed event path.
        const _blurAll = () => {
          try {
            row.querySelectorAll("button").forEach((b) => b.blur?.());
          } catch (_) {}
          try {
            this.shadowRoot?.activeElement?.blur?.();
          } catch (_) {}
        };

        const _resolveActionFromEvent = (ev) => {
          const path = (typeof ev.composedPath === "function") ? ev.composedPath() : [];
          for (const el of path) {
            if (!el) continue;
            // Prefer explicit data-action on any element in the path
            const act = el.getAttribute?.("data-action");
            if (act) return { action: act, el };
            // Or a button that contains a data-action
            if (el.tagName === "BUTTON") {
              const a2 = el.getAttribute?.("data-action");
              if (a2) return { action: a2, el };
            }
          }
          // Fallback to closest() for browsers that don't expose the composed path
          const btn = ev.target?.closest?.("button[data-action]");
          const act = btn?.getAttribute?.("data-action");
          return act ? { action: act, el: btn } : null;
        };

        const _handleAction = (action, ev) => {
          ev?.preventDefault?.();
          ev?.stopPropagation?.();
          _blurAll();

          if (action === "more-info") {
            this._openMoreInfo(entityId);
            return;
          }

          if (action === "name") {
            // Optional HA native action (we only support navigate here)
            const ta = it?.tap_action;
            if (ta && typeof ta === "object") {
              const a = String(ta.action || "").toLowerCase();
              if (a === "navigate") {
                const p = String(ta.navigation_path || "").trim();
                if (p) {
                  this._navigate(p);
                  return;
                }
              }
            }

            // Backward-compatible behavior (unchanged)
            const path = (it?.navigation_path || "").trim();
            if (path) this._navigate(path);
            else this._openMoreInfo(entityId);
            return;
          }

          if (action === "on") {
            if (it?.on_action && typeof it.on_action === "object") {
              this._runUiAction(it.on_action, entityId);
            } else {
              this._hass?.callService("homeassistant", "turn_on", { entity_id: entityId });
            }
            return;
          }

          if (action === "off") {
            if (it?.off_action && typeof it.off_action === "object") {
              this._runUiAction(it.off_action, entityId);
            } else {
              this._hass?.callService("homeassistant", "turn_off", { entity_id: entityId });
            }
            return;
          }
        };

        // 1) Capture on the row (works even if buttons don't receive pointer events)
        row.addEventListener(
          "click",
          (ev) => {
            const info = _resolveActionFromEvent(ev);
            if (!info) return;
            _handleAction(info.action, ev);
          },
          { capture: true }
        );

        // 2) Also bind directly to the buttons (fast path when possible)
        row.querySelector('button[data-action="more-info"]')?.addEventListener("click", (ev) => _handleAction("more-info", ev));
        row.querySelector('button[data-action="name"]')?.addEventListener("click", (ev) => _handleAction("name", ev));
        row.querySelector('button[data-action="on"]')?.addEventListener("click", (ev) => _handleAction("on", ev));
        row.querySelector('button[data-action="off"]')?.addEventListener("click", (ev) => _handleAction("off", ev));

list.appendChild(row);
      });

      // --- TOTAL height mode: calibrate using real ha-card padding + borders -----
      const card = this.shadowRoot.querySelector("ha-card");
      if (card) {
        card.style.boxSizing = "border-box";
      }

      // Reset total-mode layout when not in total mode
      if (heightMode !== "total" || !_toNumber(this._config.target_total_height)) {
        if (card) {
          card.style.removeProperty("height");
          card.style.removeProperty("display");
          card.style.removeProperty("flex-direction");
        }
        if (list) {
          list.style.removeProperty("flex");
          list.style.removeProperty("min-height");
        }
        return;
      }

      const requested = _toNumber(this._config.target_total_height);
      const includesPadding = this._config.target_total_includes_padding !== false;

      requestAnimationFrame(() => {
        const cardEl2 = this.shadowRoot?.querySelector?.("ha-card");
        const listEl = this.shadowRoot?.getElementById?.("list");
        if (!cardEl2 || !listEl) return;

        const cs = getComputedStyle(cardEl2);

        const padTop = parseFloat(cs.paddingTop) || 0;
        const padBottom = parseFloat(cs.paddingBottom) || 0;

        const bTop = parseFloat(cs.borderTopWidth) || 0;
        const bBottom = parseFloat(cs.borderBottomWidth) || 0;

        const count = itemsCount || 1;

        const innerAvailable = Math.max(
          includesPadding ? requested - padTop - padBottom - bTop - bBottom : requested,
          0
        );

        let computedRow = innerAvailable / count;
        computedRow = _clampNum(computedRow, rowMin, rowMax);

        const finalTotal = computedRow * count + padTop + padBottom + bTop + bBottom;

        this.style.setProperty("--ah-row-height", `${computedRow}px`);

        cardEl2.style.display = "flex";
        cardEl2.style.flexDirection = "column";
        listEl.style.flex = "1 1 auto";
        listEl.style.minHeight = "0";

        cardEl2.style.height = `${finalTotal}px`;
      });
    }

    static getConfigElement() {
      return document.createElement("activhome-light-onoff-stack-editor");
    }

    static getStubConfig() {
      return {
        type: "custom:activhome-light-onoff-stack",
        style: "activhome",
        theme: "",
        card_style: "",
        accent_color: "",
        default_font_size: "",
        height_mode: "row",
        row_height: 50,
        target_total_height: "",
        target_total_includes_padding: true,
        actions_button_width: 60,
        actions_button_border: false,
        items: [
          {
            entity: "light.example",
            on_action: { action: "call-service", service: "light.turn_on", target: { entity_id: "light.example" } },
            off_action: { action: "call-service", service: "light.turn_off", target: { entity_id: "light.example" } },
            navigation_path: "/dashboard/0",
            tap_action: { action: "navigate", navigation_path: "/dashboard/0" },
            font_size: "",
          },
        ],
      };
    }
  }

  class ActivhomeLightOnoffStackEditor extends HTMLElement {
    set hass(hass) {
      this._hass = hass;
      if (this._form) this._form.hass = hass;

      if (this._schema) {
        const themeNames = Object.keys(this._hass?.themes?.themes || {}).sort((a, b) => a.localeCompare(b));
        const themeField = this._schema.find((f) => f.name === "theme");
        if (themeField && themeField.selector?.select) {
          themeField.selector.select.options = [{ label: "Aucun", value: "" }].concat(
            themeNames.map((t) => ({ label: t, value: t }))
          );
        }
        if (this._form) this._form.schema = this._schema;
      }
    }

    setConfig(config) {
      this._config = {
        style: "transparent",
        theme: "",
        card_style: "",
        accent_color: "",
        default_font_size: "",
        height_mode: "row",
        row_height: 50,
        target_total_height: "",
        target_total_includes_padding: true,
        actions_button_width: "",
        actions_button_border: false,
        items: [],
        ...config,
      };
      this._ensureRendered();
      this._refresh();
    }

    connectedCallback() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this._ensureRendered();
      this._refresh();
    }

    _ensureRendered() {
      if (this._rendered) return;
      this._rendered = true;

      this.shadowRoot.innerHTML = `
        <style>
          .wrap { display: grid; gap: 12px; }
          details { border: 0; }
          summary { cursor: pointer; list-style: none; }
          summary::-webkit-details-marker { display: none; }
          .summaryRow { display:flex; align-items:center; justify-content: space-between; gap: 8px; padding: 2px 0; }
          .summaryLeft { display:flex; align-items:center; gap: 8px; }
          .sectionTitle { font-weight: 600; }
          .badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 18px;
            height: 18px;
            padding: 0 6px;
            border-radius: 999px;
            border: 1px solid color-mix(in oklab, var(--primary-text-color) 18%, transparent);
            font-size: 12px;
            opacity: 0.9;
          }
          .items { display: grid; gap: 10px; }
          .itemCard {
            border: 1px solid color-mix(in oklab, var(--primary-text-color) 18%, transparent);
            border-radius: 12px;
            padding: 10px;
          }
          .itemHeader { display:flex; align-items:center; justify-content: space-between; gap: 8px; }
          .btnRow { display:flex; gap: 6px; }
          button {
            cursor: pointer;
            border-radius: 10px;
            padding: 6px 10px;
            border: 1px solid color-mix(in oklab, var(--primary-text-color) 18%, transparent);
            background: none;
            color: var(--primary-text-color);
          }
          button:hover { background: color-mix(in oklab, var(--primary-text-color) 8%, transparent); }
          button:disabled { opacity: 0.4; cursor: default; }
          .hint { opacity:0.8; font-size: 12px; line-height: 1.3; }
          code { font-family: var(--code-font-family, ui-monospace, SFMono-Regular, Menlo, monospace); }
        </style>

        <div class="wrap">
          <details id="secParams">
            <summary>
              <div class="summaryRow">
                <div class="summaryLeft"><div class="sectionTitle">Paramètres</div></div>
              </div>
            </summary>
            <div style="margin-top:10px;">
              <ha-form id="form"></ha-form>
            </div>
          </details>

          <details id="secItems">
            <summary>
              <div class="summaryRow">
                <div class="summaryLeft"><div class="sectionTitle">Items</div><span class="badge" id="itemsCount">0</span></div>
              </div>
            </summary>
            <div style="margin-top:10px;">
              <div class="items" id="items"></div>
              <div style="margin-top:10px;">
                <button id="add">+ Ajouter une lumière</button>
              </div>
              <div class="hint" style="margin-top:6px;">
                Chaque item crée une ligne "Light Panel" (icône + nom + ON + OFF).
              </div>
            </div>
          </details>

          <div class="hint">
            <div><b>CSS avancé</b> : le contenu de <code>card_style</code> est injecté tel quel dans la carte.</div>
            <div>Pour modifier le fond/radius/ombre, cible <code>ha-card { ... }</code>.</div>
          </div>
        </div>
      `;

      this._form = this.shadowRoot.getElementById("form");
      if (this._hass) this._form.hass = this._hass;

      // Replié par défaut (paramètres + items)
      const secParams = this.shadowRoot.getElementById("secParams");
      const secItems = this.shadowRoot.getElementById("secItems");
      if (secParams) secParams.open = false;
      if (secItems) secItems.open = false;

      this._schema = [
        {
          name: "theme",
          label: "Theme conteneur (optionnel)",
          selector: { select: { options: [{ label: "Aucun", value: "" }], mode: "dropdown" } },
        },
        {
          name: "style",
          label: "Style conteneur",
          selector: {
            select: {
              options: [
                { label: "Transparent", value: "transparent" },
                { label: "Activhome", value: "activhome" },
                { label: "Glass", value: "glass" },
                { label: "Dark glass (Activhome)", value: "dark_glass" },
                { label: "Solid", value: "solid" },
                { label: "Neon Pulse", value: "neon_pulse" },
                { label: "Neon Glow", value: "neon_glow" },
                { label: "Primary + Breathe", value: "primary_breathe" },
                { label: "Primary Tint", value: "primary_tint" },
              ],
              mode: "dropdown",
            },
          },
        },
        {
          name: "height_mode",
          label: "Mode de hauteur",
          selector: {
            select: {
              options: [
                { label: "Hauteur de ligne (px)", value: "row" },
                { label: "Hauteur totale cible", value: "total" },
              ],
              mode: "dropdown",
            },
          },
        },
        {
          name: "row_height",
          label: "Hauteur des lignes (px) — min 50",
          selector: { number: { min: 50, max: 220, step: 1, mode: "box" } },
        },
        {
          name: "target_total_height",
          label: "Hauteur totale cible (px)",
          selector: { number: { min: 50, max: 2000, step: 1, mode: "box" } },
        },
        {
          name: "target_total_includes_padding",
          label: "La hauteur saisie correspond à la hauteur totale de la carte",
          selector: { boolean: {} },
        },
        {
          name: "actions_button_width",
          label: "Largeur boutons ON/OFF (px, optionnel)",
          selector: { number: { min: 40, max: 200, step: 1, mode: "box" } },
        },
        {
          name: "actions_button_border",
          label: "Bordure fine ON/OFF (rectangle)",
          selector: { boolean: {} },
        },
        {
          name: "default_font_size",
          label: "Taille police par défaut (optionnel)",
          selector: {
            select: {
              options: [
                { label: "Par défaut (20)", value: "" },
                { label: "16", value: "16px" },
                { label: "17", value: "17px" },
                { label: "18", value: "18px" },
                { label: "19", value: "19px" },
                { label: "20", value: "20px" },
                { label: "21", value: "21px" },
                { label: "22", value: "22px" },
                { label: "23", value: "23px" },
                { label: "24", value: "24px" },
              ],
              mode: "dropdown",
            },
          },
        },
        { name: "accent_color", label: "Couleur accent (Neon/Primary seulement, optionnel)", selector: { text: {} } },
        { name: "card_style", label: "CSS avancé (optionnel)", selector: { text: { multiline: true } } },
      ];

      const themeNames = Object.keys(this._hass?.themes?.themes || {}).sort((a, b) => a.localeCompare(b));
      const themeField = this._schema.find((f) => f.name === "theme");
      if (themeField && themeField.selector?.select) {
        themeField.selector.select.options = [{ label: "Aucun", value: "" }].concat(
          themeNames.map((t) => ({ label: t, value: t }))
        );
      }

      this._form.schema = this._schema;

      this._form.addEventListener("value-changed", (ev) => {
        const v = ev.detail?.value || {};
        const merged = { ...this._config, ...v, type: "custom:activhome-light-onoff-stack" };

        ["theme", "card_style", "accent_color", "default_font_size"].forEach((k) => {
          if (merged[k] === "" || merged[k] == null) delete merged[k];
        });

        // Height defaults / clean
        const hm = String(merged.height_mode || "row").toLowerCase() === "total" ? "total" : "row";
        merged.height_mode = hm;

        const rh = _toNumber(merged.row_height);
        if (Number.isFinite(rh)) merged.row_height = rh;

        merged.target_total_includes_padding = merged.target_total_includes_padding !== false;

        if (hm === "row") {
          delete merged.target_total_height;
          if (merged.target_total_includes_padding === true) delete merged.target_total_includes_padding;
        }

        const rhClean = _toNumber(merged.row_height);
        if (!Number.isFinite(rhClean) || rhClean === 50) delete merged.row_height;

        if (hm === "row") delete merged.height_mode;
        if (merged.target_total_includes_padding === true) delete merged.target_total_includes_padding;

        const tth = _toNumber(merged.target_total_height);
        if (!Number.isFinite(tth) || tth <= 0) delete merged.target_total_height;

        const bw = _toNumber(merged.actions_button_width);
        if (!Number.isFinite(bw) || bw <= 0) delete merged.actions_button_width;
        else merged.actions_button_width = bw;

        if (merged.actions_button_border !== true) delete merged.actions_button_border;

        if (!merged.style) merged.style = "transparent";
        if (!Array.isArray(merged.items)) merged.items = [];

        this._config = merged;
        fireEvent(this, "config-changed", { config: merged });
        // IMPORTANT: ne pas re-render la liste items ici (sinon perte de focus).
      });

      this.shadowRoot.getElementById("add")?.addEventListener("click", () => {
        const next = { ...this._config };
        next.items = Array.isArray(next.items) ? [...next.items] : [];
        next.items.push({ entity: "", name: "", on_action: undefined, off_action: undefined, navigation_path: "", tap_action: undefined, font_size: "" });
        this._config = next;
        this._emit();
        this._refreshItems();
      });
    }

    _emit() {
      const clean = { ...this._config, type: "custom:activhome-light-onoff-stack" };

      const hm = String(clean.height_mode || "row").toLowerCase() === "total" ? "total" : "row";
      if (hm === "row") delete clean.height_mode;
      else clean.height_mode = "total";

      const rh = _toNumber(clean.row_height);
      if (!Number.isFinite(rh) || rh === 50) delete clean.row_height;
      else clean.row_height = rh;

      const tth = _toNumber(clean.target_total_height);
      if (!Number.isFinite(tth) || tth <= 0) delete clean.target_total_height;
      else clean.target_total_height = tth;

      if (clean.target_total_includes_padding === true || clean.target_total_includes_padding == null) {
        delete clean.target_total_includes_padding;
      }

      const bw = _toNumber(clean.actions_button_width);
      if (!Number.isFinite(bw) || bw <= 0) delete clean.actions_button_width;
      else clean.actions_button_width = bw;

      if (clean.actions_button_border !== true) delete clean.actions_button_border;

      clean.items = (clean.items || []).map((it) => {
        const out = { ...it };
        ["name", "navigation_path", "tap_action", "font_size"].forEach((k) => {
          if (out[k] === "" || out[k] == null) delete out[k];
        });
        if (!out.on_action || typeof out.on_action !== "object") delete out.on_action;
        if (!out.off_action || typeof out.off_action !== "object") delete out.off_action;
        return out;
      });

      fireEvent(this, "config-changed", { config: clean });
    }

    _refresh() {
      if (!this._form || !this._config) return;

      this._form.data = {
        theme: this._config.theme || "",
        style: this._config.style || "transparent",

        height_mode: String(this._config.height_mode || "row").toLowerCase() === "total" ? "total" : "row",
        row_height: Number.isFinite(_toNumber(this._config.row_height)) ? _toNumber(this._config.row_height) : 50,
        target_total_height:
          this._config.target_total_height === 0 || this._config.target_total_height
            ? _toNumber(this._config.target_total_height)
            : "",
        target_total_includes_padding: this._config.target_total_includes_padding !== false,

        actions_button_width:
          Number.isFinite(_toNumber(this._config.actions_button_width)) ? _toNumber(this._config.actions_button_width) : "",
        actions_button_border: this._config.actions_button_border === true,

        card_style: this._config.card_style || "",
        accent_color: this._config.accent_color || "",
        default_font_size: this._config.default_font_size || "",
      };

      this._refreshItems();
    }

    _refreshItems() {
      const host = this.shadowRoot.getElementById("items");
      if (!host) return;

      const items = Array.isArray(this._config.items) ? this._config.items : [];
      const countEl = this.shadowRoot.getElementById("itemsCount");
      if (countEl) countEl.textContent = String(items.length);
      const focusedEl = this.shadowRoot.querySelector(":focus");

      if (host.childElementCount !== items.length) {
        host.innerHTML = "";

        items.forEach((it, idx) => {
          const wrap = document.createElement("details");
          wrap.className = "itemCard";
          // Replié par défaut
          wrap.open = false;

          const summary = document.createElement("summary");

          const header = document.createElement("div");
          header.className = "itemHeader";
          header.innerHTML = `<div><b>Item ${idx + 1}</b></div>`;

          const btnRow = document.createElement("div");
          btnRow.className = "btnRow";

          const up = document.createElement("button");
          up.textContent = "↑";
          up.disabled = idx === 0;
          up.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const current = Array.isArray(this._config.items) ? this._config.items : [];
            const next = { ...this._config, items: [...current] };
            const tmp = next.items[idx - 1];
            next.items[idx - 1] = next.items[idx];
            next.items[idx] = tmp;
            this._config = next;
            this._emit();
            this._refreshItems();
          });

          const down = document.createElement("button");
          down.textContent = "↓";
          down.disabled = idx === items.length - 1;
          down.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const current = Array.isArray(this._config.items) ? this._config.items : [];
            const next = { ...this._config, items: [...current] };
            const tmp = next.items[idx + 1];
            next.items[idx + 1] = next.items[idx];
            next.items[idx] = tmp;
            this._config = next;
            this._emit();
            this._refreshItems();
          });

          const del = document.createElement("button");
          del.textContent = "Supprimer";
          del.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const current = Array.isArray(this._config.items) ? this._config.items : [];
            const next = { ...this._config, items: [...current] };
            next.items.splice(idx, 1);
            this._config = next;
            this._emit();
            this._refreshItems();
          });

          btnRow.appendChild(up);
          btnRow.appendChild(down);
          btnRow.appendChild(del);
          header.appendChild(btnRow);

          summary.appendChild(header);

          // IMPORTANT: certains environnements HA/iOS peuvent avoir un toggle <details>
          // capricieux quand le <summary> contient des éléments interactifs.
          // On force ici un toggle fiable (hors clic sur les boutons).
          summary.addEventListener("click", (e) => {
            if (e.target && e.target.closest && e.target.closest("button")) return;
            e.preventDefault();
            wrap.open = !wrap.open;
          });

          const form = document.createElement("ha-form");
          if (this._hass) form.hass = this._hass;

          form.schema = [
            { name: "entity", label: "Lumière", required: true, selector: { entity: { domain: "light" } } },
            { name: "name", label: "Nom affiché (optionnel)", selector: { text: {} } },
            { name: "on_action", label: "Action ON (optionnel)", selector: { ui_action: {} } },
            { name: "off_action", label: "Action OFF (optionnel)", selector: { ui_action: {} } },
            { name: "navigation_path", label: "Navigation path (optionnel)", selector: { text: {} } },
            { name: "tap_action", label: "Navigation (UI native, optionnel)", selector: { ui_action: {} } },
            {
              name: "font_size",
              label: "Taille police (optionnel)",
              selector: {
                select: {
                  options: [
                    { label: "Par défaut (20)", value: "" },
                    { label: "16", value: "16px" },
                    { label: "17", value: "17px" },
                    { label: "18", value: "18px" },
                    { label: "19", value: "19px" },
                    { label: "20", value: "20px" },
                    { label: "21", value: "21px" },
                    { label: "22", value: "22px" },
                    { label: "23", value: "23px" },
                    { label: "24", value: "24px" },
                  ],
                  mode: "dropdown",
                },
              },
            },
          ];

          form.data = {
            entity: it.entity || "",
            name: it.name || "",
            on_action: it.on_action || undefined,
            off_action: it.off_action || undefined,
            navigation_path: it.navigation_path || "",
            tap_action: it.tap_action || undefined,
            font_size: it.font_size || "",
          };

          form.addEventListener("value-changed", (ev) => {
            const v = ev.detail?.value || {};
            const current = Array.isArray(this._config.items) ? this._config.items : [];
            const next = { ...this._config, items: [...current] };

            const merged = { ...next.items[idx], ...v };

            ["name", "navigation_path", "tap_action", "font_size"].forEach((k) => {
              if (merged[k] === "" || merged[k] == null) delete merged[k];
            });
            if (!merged.on_action || typeof merged.on_action !== "object") delete merged.on_action;
            if (!merged.off_action || typeof merged.off_action !== "object") delete merged.off_action;

            next.items[idx] = merged;
            this._config = next;
            this._emit();
            // IMPORTANT: ne pas re-render la liste items ici (sinon perte de focus).
          });

          wrap.appendChild(summary);
          wrap.appendChild(form);
          host.appendChild(wrap);
        });

        return;
      }

      const cards = host.querySelectorAll(".itemCard");
      cards.forEach((card, idx) => {
        const title = card.querySelector(".itemHeader > div");
        if (title) title.innerHTML = `<b>Item ${idx + 1}</b>`;

        const buttons = card.querySelectorAll(".btnRow button");
        const up = buttons[0];
        const down = buttons[1];
        if (up) up.disabled = idx === 0;
        if (down) down.disabled = idx === items.length - 1;

        const form = card.querySelector("ha-form");
        if (!form) return;

        const isFocusedInside = focusedEl ? form.contains(focusedEl) : false;
        if (isFocusedInside) return;

        const it = items[idx] || {};
        form.data = {
          entity: it.entity || "",
          name: it.name || "",
          on_action: it.on_action || undefined,
          off_action: it.off_action || undefined,
          navigation_path: it.navigation_path || "",
          tap_action: it.tap_action || undefined,
          font_size: it.font_size || "",
        };
      });
    }
  }

  if (!customElements.get("activhome-light-onoff-stack")) {
    customElements.define("activhome-light-onoff-stack", ActivhomeLightOnoffStack);
  }
  if (!customElements.get("activhome-light-onoff-stack-editor")) {
    customElements.define("activhome-light-onoff-stack-editor", ActivhomeLightOnoffStackEditor);
  }

  window.customCards = window.customCards || [];
  if (!window.customCards.find((c) => c.type === "activhome-light-onoff-stack")) {
    window.customCards.push({
      type: "activhome-light-onoff-stack",
      name: "Activhome Light ON/OFF Stack",
      description: "Stack vertical de panneaux de lumières (ON/OFF à la place de play/power)",
    });
  }
})();
