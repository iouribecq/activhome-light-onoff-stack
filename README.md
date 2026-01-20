# Activhome Light OnOff Stack

Custom Lovelace card for Home Assistant.

The **Activhome Light OnOff Stack** provides a clean and touch-friendly
ON/OFF control stack for lights, designed to integrate seamlessly
with Activhome dashboards.

## Features

- Simple ON / OFF stack interface for lights
- Optimized for touch devices (iPad / iPhone)
- Activhome visual style
- Lightweight and fast
- Designed for local dashboards and kiosk usage

## Installation

### HACS (recommended)

1. Open HACS
2. Go to **Frontend**
3. Add this repository as a custom repository
4. Install **Activhome Light OnOff Stack**
5. Reload Home Assistant

### Manual

1. Copy `dist/activhome-light-onoff-stack.js` to:
   ```
   /config/www/activhome-light-onoff-stack/
   ```
2. Add the resource in Home Assistant:
   ```
   /local/activhome-light-onoff-stack/activhome-light-onoff-stack.js
   ```

## Usage

```yaml
type: custom:activhome-light-onoff-stack
```

## Status

Stable initial release.

---

Part of the **Activhome** ecosystem.
