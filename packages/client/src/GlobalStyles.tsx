import { createGlobalStyle } from "styled-components";

export const GlobalStyles = createGlobalStyle`
  :root {
    --neon-green: #00ff41;
    --dark-green: #003b00;
    --deep-black: #0d0208;
    --glass-bg: rgba(13, 2, 8, 0.75);
    --glass-border: rgba(0, 255, 65, 0.3);
    --font-mono: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
  }

  body {
    margin: 0;
    padding: 0;
    background-color: var(--deep-black);
    color: var(--neon-green);
    font-family: var(--font-mono);
    overflow: hidden;
    user-select: none;
  }

  * {
    box-sizing: border-box;
  }

  /* Custom Scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
  }
  ::-webkit-scrollbar-track {
    background: var(--deep-black);
  }
  ::-webkit-scrollbar-thumb {
    background: var(--dark-green);
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: var(--neon-green);
  }

  /* Glassmorphism Classes */
  .glass-panel {
    background: var(--glass-bg);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--glass-border);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.8);
  }

  .neon-text {
    text-shadow: 0 0 8px var(--neon-green);
  }

  .neon-border {
    border: 1px solid var(--neon-green);
    box-shadow: 0 0 10px var(--neon-green);
  }

  button {
    cursor: pointer;
    background: transparent;
    border: 1px solid var(--neon-green);
    color: var(--neon-green);
    padding: 8px 16px;
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 1px;
    transition: all 0.2s ease;
    clip-path: polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%);
  }

  button:hover {
    background: var(--neon-green);
    color: var(--deep-black);
    box-shadow: 0 0 15px var(--neon-green);
  }

  button:active {
    transform: scale(0.95);
  }

  input {
    background: rgba(0, 59, 0, 0.3);
    border: 1px solid var(--dark-green);
    color: var(--neon-green);
    padding: 8px 12px;
    font-family: var(--font-mono);
    outline: none;
  }

  input:focus {
    border-color: var(--neon-green);
    box-shadow: 0 0 5px var(--neon-green);
  }
`;
